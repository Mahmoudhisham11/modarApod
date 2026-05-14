/**
 * Firestore: أضف قواعد أمان لمجموعة `operations` (مثل `numbers`: حصر shop للمستخدم).
 */
import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from "firebase/firestore";

import { db } from "@/app/firebase";

import { parseFiniteNumberOrZero } from "@/lib/lines/line-payload";

import { OPERATION_TYPE, SOURCE_KIND, isMachineDebitOperation } from "./constants";
import {
  analyzeOperation,
  formatLineAmountString,
  lineLimitRemaindersFromRow,
  parseLineAmount,
  parseMachineBalance,
  round2,
  sourceDisplayNameFromRow,
} from "./eligibility";

const OPERATIONS_COLLECTION = "operations";

const FETCH_LIMIT = 3000;

/** @param {unknown} v */
function asString(v) {
  if (v === null || v === undefined) return "";
  return String(v);
}

/**
 * @param {import("./constants").SourceKind} kind
 */
function sourceCollectionName(kind) {
  if (kind === SOURCE_KIND.TELECOM) return "numbers";
  if (kind === SOURCE_KIND.INSTAPAY) return "instapayLines";
  return "machines";
}

/**
 * @param {string} shop
 * @returns {Promise<Array<Record<string, unknown> & { id: string }>>}
 */
export async function fetchOperationsByShop(shop) {
  const base = collection(db, OPERATIONS_COLLECTION);
  try {
    const q = query(base, where("shop", "==", shop), orderBy("createdAt", "desc"), limit(FETCH_LIMIT));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch {
    const q2 = query(base, where("shop", "==", shop), limit(FETCH_LIMIT));
    const snap = await getDocs(q2);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }
}

/**
 * @param {{
 *   shop: string;
 *   createdBy: string;
 *   sourceKind: import("./constants").SourceKind;
 *   sourceId: string;
 *   operationType: import("./constants").OperationType;
 *   amount: number;
 *   commission: number;
 *   customerPhone?: string;
 *   notes?: string;
 *   targetId?: string;
 *   userName?: string;
 * }} payload
 */
export async function createOperationWithUpdates(payload) {
  const shop = payload.shop.trim();
  const sourceId = payload.sourceId.trim();
  const amount = Number(payload.amount);
  const commission = Number(payload.commission);
  const amt = Number.isFinite(amount) && amount > 0 ? amount : 0;
  const com = Number.isFinite(commission) && commission >= 0 ? commission : 0;
  const opType = payload.operationType;
  const customerPhone = typeof payload.customerPhone === "string" ? payload.customerPhone.trim() : "";
  const notes = typeof payload.notes === "string" ? payload.notes.trim() : "";
  const targetId = typeof payload.targetId === "string" ? payload.targetId.trim() : "";
  const userName =
    typeof payload.userName === "string" && payload.userName.trim()
      ? payload.userName.trim()
      : payload.createdBy.trim();

  if (!shop || !sourceId || !payload.createdBy.trim()) {
    throw new Error("بيانات غير كاملة.");
  }

  if (opType === OPERATION_TYPE.BALANCE_TRANSFER) {
    if (payload.sourceKind !== SOURCE_KIND.MACHINE) {
      throw new Error("تحويل الرصيد متاح للماكينات فقط.");
    }
    if (!targetId || targetId === sourceId) {
      throw new Error("اختر ماكينة هدف مختلفة عن المصدر.");
    }
  }

  return runTransaction(db, async (transaction) => {
    const sourceCol = sourceCollectionName(payload.sourceKind);
    const sourceRef = doc(db, sourceCol, sourceId);
    const sourceSnap = await transaction.get(sourceRef);
    if (!sourceSnap.exists) {
      throw new Error("الوسيلة غير موجودة.");
    }
    const sourceRow = /** @type {Record<string, unknown>} */ (sourceSnap.data());
    if (asString(sourceRow.shop).trim() !== shop) {
      throw new Error("الوسيلة لا تنتمي لهذا الفرع.");
    }

    const noOps = /** @type {Array<Record<string, unknown>>} */ ([]);

    const sourceTypeForOp =
      payload.sourceKind === SOURCE_KIND.INSTAPAY
        ? SOURCE_KIND.INSTAPAY
        : payload.sourceKind === SOURCE_KIND.MACHINE
          ? SOURCE_KIND.MACHINE
          : SOURCE_KIND.TELECOM;

    const analysis = analyzeOperation({
      sourceKind: payload.sourceKind,
      sourceRow,
      operationType: opType,
      amount: amt,
      commission: com,
      operations: noOps,
      sourceId,
    });

    if (!analysis.executable) {
      throw new Error(analysis.messages[0] || "العملية غير مسموحة.");
    }

    const sourceName = sourceDisplayNameFromRow(sourceRow, payload.sourceKind);
    const lineOrSourcePhone = asString(sourceRow.phone).trim();

    let beforeBalanceTarget = null;
    let afterBalanceTarget = null;
    /** @type {{ dailyWithdraw: number; withdrawLimit: number; dailyDeposit: number; depositLimit: number } | null} */
    let limitAdjustmentForOp = null;
    const opRef = doc(collection(db, OPERATIONS_COLLECTION));

    if (payload.sourceKind === SOURCE_KIND.MACHINE) {
      let beforeBalance = parseMachineBalance(sourceRow);
      let afterBalance = 0;
      if (opType === OPERATION_TYPE.DEPOSIT) {
        afterBalance = beforeBalance + amt;
      } else if (opType === OPERATION_TYPE.BALANCE_TRANSFER) {
        const targetRef = doc(db, "machines", targetId);
        const targetSnap = await transaction.get(targetRef);
        if (!targetSnap.exists) throw new Error("ماكينة الهدف غير موجودة.");
        const targetRow = /** @type {Record<string, unknown>} */ (targetSnap.data());
        if (asString(targetRow.shop).trim() !== shop) throw new Error("الهدف لا يتبع نفس الفرع.");
        const need = amt + com;
        if (beforeBalance < need) throw new Error("الرصيد غير كافٍ للتحويل والعمولة.");
        const tb = parseMachineBalance(targetRow);
        beforeBalanceTarget = tb;
        afterBalanceTarget = tb + amt;
        afterBalance = beforeBalance - need;
        transaction.update(targetRef, { balance: afterBalanceTarget });
      } else if (isMachineDebitOperation(opType)) {
        const need = amt + com;
        if (beforeBalance < need) throw new Error("الرصيد غير كافٍ.");
        afterBalance = beforeBalance - need;
      } else {
        afterBalance = beforeBalance;
      }
      transaction.update(sourceRef, { balance: afterBalance });
    } else {
      const beforeBalance = parseLineAmount(sourceRow);
      let afterBalance = 0;
      if (opType === OPERATION_TYPE.WITHDRAW) {
        /** سحب خط: العمولة في سجل العملية فقط ولا تُخصم من رصيد الخط. */
        afterBalance = beforeBalance - amt;
      } else {
        afterBalance = beforeBalance + amt;
      }
      const rem = lineLimitRemaindersFromRow(sourceRow);
      limitAdjustmentForOp = { dailyWithdraw: 0, withdrawLimit: 0, dailyDeposit: 0, depositLimit: 0 };
      /** @type {Record<string, unknown>} */
      const lineUpdate = { amount: formatLineAmountString(afterBalance) };
      if (opType === OPERATION_TYPE.WITHDRAW) {
        if (rem.remDailyWithdraw > 0) {
          lineUpdate.dailyWithdraw = round2(Math.max(0, rem.remDailyWithdraw - amt));
          limitAdjustmentForOp.dailyWithdraw = amt;
        }
        if (rem.remMonthlyWithdraw > 0) {
          lineUpdate.withdrawLimit = round2(Math.max(0, rem.remMonthlyWithdraw - amt));
          limitAdjustmentForOp.withdrawLimit = amt;
        }
      } else if (opType === OPERATION_TYPE.DEPOSIT) {
        if (rem.remDailyDeposit > 0) {
          lineUpdate.dailyDeposit = round2(Math.max(0, rem.remDailyDeposit - amt));
          limitAdjustmentForOp.dailyDeposit = amt;
        }
        if (rem.remMonthlyDeposit > 0) {
          lineUpdate.depositLimit = round2(Math.max(0, rem.remMonthlyDeposit - amt));
          limitAdjustmentForOp.depositLimit = amt;
        }
      }
      transaction.update(sourceRef, lineUpdate);
    }

    /** @type {Record<string, unknown>} */
    const opDoc = {
      shop,
      sourceId,
      sourceType: sourceTypeForOp,
      source: {
        id: sourceId,
        kind: sourceTypeForOp,
        name: sourceName,
        phone: lineOrSourcePhone,
      },
      type: opType,
      operationVal: String(amt),
      commation: com,
      receiver: customerPhone || "",
      phone: lineOrSourcePhone,
      notes: notes || "",
      userName,
      createdAt: serverTimestamp(),
    };

    if (opType === OPERATION_TYPE.BALANCE_TRANSFER && beforeBalanceTarget !== null) {
      opDoc.targetId = targetId;
      opDoc.beforeBalanceTarget = beforeBalanceTarget;
      opDoc.afterBalanceTarget = afterBalanceTarget;
    }

    if (limitAdjustmentForOp) {
      opDoc.limitAdjustment = limitAdjustmentForOp;
    }

    transaction.set(opRef, opDoc);
    return opRef.id;
  });
}

/**
 * حذف عملية وعكس تأثيرها على الرصيد وحدود الخط أو ماكينة المصدر داخل معاملة واحدة.
 * @param {{ shop: string; operationId: string }} params
 */
export async function deleteOperationWithReversal(params) {
  const shop = typeof params.shop === "string" ? params.shop.trim() : "";
  const operationId = typeof params.operationId === "string" ? params.operationId.trim() : "";
  if (!shop || !operationId) {
    throw new Error("بيانات غير كاملة.");
  }

  await runTransaction(db, async (transaction) => {
    const opRef = doc(db, OPERATIONS_COLLECTION, operationId);
    const opSnap = await transaction.get(opRef);
    if (!opSnap.exists) {
      throw new Error("العملية غير موجودة.");
    }
    const op = /** @type {Record<string, unknown>} */ (opSnap.data());
    if (asString(op.shop).trim() !== shop) {
      throw new Error("العملية لا تنتمي لهذا الفرع.");
    }

    const rawVal = op.operationVal ?? op.amount;
    const val0 = Number(rawVal);
    const amt = Number.isFinite(val0) && val0 > 0 ? val0 : 0;

    const rawCom = op.commation ?? op.commission;
    const com0 = Number(rawCom);
    const commission = Number.isFinite(com0) && com0 >= 0 ? com0 : 0;

    const typeStr = asString(op.type ?? op.operationType);
    const sourceTypeStr = asString(op.sourceType);
    const sourceId = asString(op.sourceId).trim();

    /** @type {import("./constants").SourceKind | ""} */
    let kind = "";
    if (sourceTypeStr === SOURCE_KIND.TELECOM) kind = SOURCE_KIND.TELECOM;
    else if (sourceTypeStr === SOURCE_KIND.INSTAPAY) kind = SOURCE_KIND.INSTAPAY;
    else if (sourceTypeStr === SOURCE_KIND.MACHINE) kind = SOURCE_KIND.MACHINE;

    if (!sourceId || !kind) {
      throw new Error("بيانات الوسيلة في العملية غير مكتملة.");
    }

    const sourceCol = sourceCollectionName(kind);
    const sourceRef = doc(db, sourceCol, sourceId);
    const sourceSnap = await transaction.get(sourceRef);
    if (!sourceSnap.exists) {
      throw new Error("الوسيلة المرتبطة غير موجودة.");
    }
    const sourceRow = /** @type {Record<string, unknown>} */ (sourceSnap.data());
    if (asString(sourceRow.shop).trim() !== shop) {
      throw new Error("الوسيلة لا تنتمي لهذا الفرع.");
    }

    if (kind === SOURCE_KIND.MACHINE) {
      const opType = /** @type {import("./constants").OperationType} */ (typeStr);

      if (opType === OPERATION_TYPE.BALANCE_TRANSFER) {
        const targetId = asString(op.targetId).trim();
        const need = amt + commission;
        const sb = parseMachineBalance(sourceRow);
        transaction.update(sourceRef, { balance: sb + need });
        if (!targetId) {
          throw new Error("سجل تحويل الرصيد بلا ماكينة هدف.");
        }
        const targetRef = doc(db, "machines", targetId);
        const targetSnap = await transaction.get(targetRef);
        if (!targetSnap.exists) {
          throw new Error("ماكينة الهدف غير موجودة.");
        }
        const targetRow = /** @type {Record<string, unknown>} */ (targetSnap.data());
        if (asString(targetRow.shop).trim() !== shop) {
          throw new Error("الهدف لا يتبع نفس الفرع.");
        }
        const beforeStored = op.beforeBalanceTarget;
        const beforeNum =
          typeof beforeStored === "number" && Number.isFinite(beforeStored)
            ? beforeStored
            : Number(beforeStored);
        if (Number.isFinite(beforeNum)) {
          transaction.update(targetRef, { balance: beforeNum });
        } else {
          const tb = parseMachineBalance(targetRow);
          transaction.update(targetRef, { balance: tb - amt });
        }
      } else if (opType === OPERATION_TYPE.DEPOSIT) {
        const sb = parseMachineBalance(sourceRow);
        transaction.update(sourceRef, { balance: sb - amt });
      } else if (isMachineDebitOperation(opType)) {
        const need = amt + commission;
        const sb = parseMachineBalance(sourceRow);
        transaction.update(sourceRef, { balance: sb + need });
      }
    } else {
      if (typeStr !== OPERATION_TYPE.WITHDRAW && typeStr !== OPERATION_TYPE.DEPOSIT) {
        throw new Error("حذف هذا النوع من العمليات على الخط غير مدعوم.");
      }
      const beforeBalance = parseLineAmount(sourceRow);
      let afterBalance = beforeBalance;
      if (typeStr === OPERATION_TYPE.WITHDRAW) {
        afterBalance = beforeBalance + amt;
      } else {
        afterBalance = beforeBalance - amt;
      }

      /** @type {Record<string, unknown>} */
      const lineUpdate = { amount: formatLineAmountString(afterBalance) };

      const lim = op.limitAdjustment;
      if (lim && typeof lim === "object") {
        const l = /** @type {Record<string, unknown>} */ (lim);
        const dw = Number(l.dailyWithdraw);
        if (Number.isFinite(dw) && dw > 0) {
          const cur = parseFiniteNumberOrZero(asString(sourceRow.dailyWithdraw));
          lineUpdate.dailyWithdraw = round2(cur + dw);
        }
        const wl = Number(l.withdrawLimit);
        if (Number.isFinite(wl) && wl > 0) {
          const cur = parseFiniteNumberOrZero(asString(sourceRow.withdrawLimit));
          lineUpdate.withdrawLimit = round2(cur + wl);
        }
        const dd = Number(l.dailyDeposit);
        if (Number.isFinite(dd) && dd > 0) {
          const cur = parseFiniteNumberOrZero(asString(sourceRow.dailyDeposit));
          lineUpdate.dailyDeposit = round2(cur + dd);
        }
        const dl = Number(l.depositLimit);
        if (Number.isFinite(dl) && dl > 0) {
          const cur = parseFiniteNumberOrZero(asString(sourceRow.depositLimit));
          lineUpdate.depositLimit = round2(cur + dl);
        }
      } else {
        if (typeStr === OPERATION_TYPE.WITHDRAW) {
          if ("dailyWithdraw" in sourceRow && sourceRow.dailyWithdraw != null && sourceRow.dailyWithdraw !== "") {
            const cur = parseFiniteNumberOrZero(asString(sourceRow.dailyWithdraw));
            lineUpdate.dailyWithdraw = round2(cur + amt);
          }
          if ("withdrawLimit" in sourceRow && sourceRow.withdrawLimit != null && sourceRow.withdrawLimit !== "") {
            const cur = parseFiniteNumberOrZero(asString(sourceRow.withdrawLimit));
            lineUpdate.withdrawLimit = round2(cur + amt);
          }
        } else if (typeStr === OPERATION_TYPE.DEPOSIT) {
          if ("dailyDeposit" in sourceRow && sourceRow.dailyDeposit != null && sourceRow.dailyDeposit !== "") {
            const cur = parseFiniteNumberOrZero(asString(sourceRow.dailyDeposit));
            lineUpdate.dailyDeposit = round2(cur + amt);
          }
          if ("depositLimit" in sourceRow && sourceRow.depositLimit != null && sourceRow.depositLimit !== "") {
            const cur = parseFiniteNumberOrZero(asString(sourceRow.depositLimit));
            lineUpdate.depositLimit = round2(cur + amt);
          }
        }
      }

      transaction.update(sourceRef, lineUpdate);
    }

    transaction.delete(opRef);
  });
}
