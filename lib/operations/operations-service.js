/**
 * Firestore: أضف قواعد أمان لمجموعة `operations` (مثل `numbers`: حصر shop للمستخدم).
 */
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  increment,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from "firebase/firestore";

import { db } from "@/app/firebase";

import { parseFiniteNumberOrZero } from "@/lib/lines/line-payload";
import { invalidateSourcesCache, loadSources } from "@/lib/sources/sources-cache";

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

const FETCH_LIMIT = 500;

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
  const externalDirection = opType === OPERATION_TYPE.EXTERNAL && typeof payload.externalDirection === "string"
    ? payload.externalDirection.trim() : "";
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

  // Get source data from module-level cache (0 Firestore reads)
  const raw = await loadSources(shop);
  const allSources = [...raw.telecom, ...raw.instapay, ...raw.machines];
  const matchedSource = allSources.find((s) => s.id === sourceId);
  const sourceRow = /** @type {Record<string, unknown> | undefined} */ (matchedSource);

  // External operation may use a manually entered number, not a real source
  if (opType !== OPERATION_TYPE.EXTERNAL) {
    if (!sourceRow) throw new Error("الوسيلة غير موجودة في البيانات المحملة.");
    if (asString(sourceRow.shop).trim() !== shop) throw new Error("الوسيلة لا تنتمي لهذا الفرع.");
  }

  const sourceCol = sourceCollectionName(payload.sourceKind);
  const sourceRef = sourceRow ? doc(db, sourceCol, sourceId) : null;
  const shopRef = doc(db, "shops", shop);
  const opRef = doc(collection(db, OPERATIONS_COLLECTION));

  const noOps = /** @type {Array<Record<string, unknown>>} */ ([]);
  const sourceTypeForOp =
    payload.sourceKind === SOURCE_KIND.INSTAPAY
      ? SOURCE_KIND.INSTAPAY
      : payload.sourceKind === SOURCE_KIND.MACHINE
        ? SOURCE_KIND.MACHINE
        : SOURCE_KIND.TELECOM;

  // LIQUIDATION and EXTERNAL: skip analyzeOperation (limits check), handle manually
  const shouldBypassAnalysis = opType === OPERATION_TYPE.LIQUIDATION || opType === OPERATION_TYPE.EXTERNAL;

  if (!shouldBypassAnalysis) {
    const analysis = analyzeOperation({
      sourceKind: payload.sourceKind,
      sourceRow: /** @type {Record<string, unknown>} */ (sourceRow),
      operationType: opType,
      amount: amt,
      commission: com,
      operations: noOps,
      sourceId,
    });

    if (!analysis.executable) {
      throw new Error(analysis.messages[0] || "العملية غير مسموحة.");
    }
  }

  const sourceName = sourceRow ? sourceDisplayNameFromRow(sourceRow, payload.sourceKind) : sourceId;
  const lineOrSourcePhone = sourceRow ? asString(sourceRow.phone).trim() : sourceId;

  /** @type {{ dailyWithdraw: number; withdrawLimit: number; dailyDeposit: number; depositLimit: number } | null} */
  let limitAdjustmentForOp = null;
  let balanceTransferTargetId = "";
  let beforeBalanceTarget = null;
  let afterBalanceTarget = null;
  const batch = writeBatch(db);

  if (sourceRow && payload.sourceKind === SOURCE_KIND.MACHINE) {
    const beforeBalance = parseMachineBalance(sourceRow);
    if (opType === OPERATION_TYPE.DEPOSIT) {
      batch.update(sourceRef, { balance: increment(amt) });
    } else if (opType === OPERATION_TYPE.BALANCE_TRANSFER) {
      const targetRef = doc(db, "machines", targetId);
      const targetRow = /** @type {Record<string, unknown> | undefined} */ (raw.machines.find((m) => m.id === targetId));
      if (!targetRow) throw new Error("الماكينة الهدف غير موجودة في البيانات المحملة.");
      if (asString(targetRow.shop).trim() !== shop) throw new Error("الهدف لا يتبع نفس الفرع.");
      const need = amt + com;
      if (beforeBalance < need) throw new Error("الرصيد غير كافٍ للتحويل والرسوم.");
      batch.update(targetRef, { balance: increment(amt) });
      batch.update(sourceRef, { balance: increment(-need) });
      balanceTransferTargetId = targetId;
      beforeBalanceTarget = parseMachineBalance(targetRow);
      afterBalanceTarget = beforeBalanceTarget + amt;
    } else if (opType === OPERATION_TYPE.LIQUIDATION) {
      const need = amt;
      if (beforeBalance < need) throw new Error("الرصيد غير كافٍ.");
      batch.update(sourceRef, { balance: increment(-need) });
    } else if (opType === OPERATION_TYPE.EXTERNAL) {
      const need = amt;
      if (beforeBalance < need) throw new Error("الرصيد غير كافٍ.");
      batch.update(sourceRef, { balance: increment(-need) });
    } else if (isMachineDebitOperation(opType)) {
      const need = amt + com;
      if (beforeBalance < need) throw new Error("الرصيد غير كافٍ.");
      batch.update(sourceRef, { balance: increment(-need) });
    }
  } else if (sourceRow) {
    const beforeBalance = parseLineAmount(sourceRow);
    const rem = lineLimitRemaindersFromRow(sourceRow);
    limitAdjustmentForOp = { dailyWithdraw: 0, withdrawLimit: 0, dailyDeposit: 0, depositLimit: 0 };

    /** @type {Record<string, unknown>} */
    const lineUpdate = {};
    if (opType === OPERATION_TYPE.WITHDRAW || opType === OPERATION_TYPE.LIQUIDATION) {
      lineUpdate.amount = formatLineAmountString(beforeBalance + amt);
      if (opType === OPERATION_TYPE.WITHDRAW) {
        if (rem.remDailyWithdraw > 0) {
          lineUpdate.dailyWithdraw = increment(-amt);
          limitAdjustmentForOp.dailyWithdraw = amt;
        }
        if (rem.remMonthlyWithdraw > 0) {
          lineUpdate.withdrawLimit = increment(-amt);
          limitAdjustmentForOp.withdrawLimit = amt;
        }
      }
    } else if (opType === OPERATION_TYPE.EXTERNAL) {
      lineUpdate.amount = formatLineAmountString(beforeBalance + amt);
      // EXTERNAL: لا يؤثر على الليميت
    } else {
      // DEPOSIT
      lineUpdate.amount = formatLineAmountString(beforeBalance - amt);
      if (rem.remDailyDeposit > 0) {
        lineUpdate.dailyDeposit = increment(-amt);
        limitAdjustmentForOp.dailyDeposit = amt;
      }
      if (rem.remMonthlyDeposit > 0) {
        lineUpdate.depositLimit = increment(-amt);
        limitAdjustmentForOp.depositLimit = amt;
      }
    }
    batch.update(sourceRef, lineUpdate);
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
    commation: opType === OPERATION_TYPE.LIQUIDATION ? -Math.abs(com) : com,
    receiver: customerPhone || "",
    phone: lineOrSourcePhone,
    notes: notes || "",
    userName,
    createdAt: serverTimestamp(),
  };

  if (opType === OPERATION_TYPE.EXTERNAL && externalDirection) {
    opDoc.externalDirection = externalDirection;
  }

  if (limitAdjustmentForOp) {
    opDoc.limitAdjustment = limitAdjustmentForOp;
  }

  if (balanceTransferTargetId) {
    opDoc.targetId = balanceTransferTargetId;
    opDoc.beforeBalanceTarget = beforeBalanceTarget;
    opDoc.afterBalanceTarget = afterBalanceTarget;
  }

  if (opType === OPERATION_TYPE.WITHDRAW || opType === OPERATION_TYPE.LIQUIDATION || (opType === OPERATION_TYPE.EXTERNAL && externalDirection !== "deposit")) {
    batch.update(shopRef, { cash: increment(-amt) });
  } else if (opType === OPERATION_TYPE.DEPOSIT || (opType === OPERATION_TYPE.EXTERNAL && externalDirection === "deposit")) {
    batch.update(shopRef, { cash: increment(amt) });
  }

  batch.set(opRef, opDoc);
  await batch.commit();
  invalidateSourcesCache(shop);
  return opRef.id;
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

    /** إذا كانت العملية إضافة نقدي نعكس التأثير على النقدي فقط */
    if (typeStr === OPERATION_TYPE.CASH_ADDITION) {
      const cRef = doc(db, "shops", shop);
      const cSnap = await transaction.get(cRef);
      const cData = cSnap.data();
      const oldCash = cData ? Number(cData.cash) || 0 : 0;
      transaction.set(cRef, { cash: Math.max(0, oldCash - amt) }, { merge: true });
      transaction.delete(opRef);
      return;
    }

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

    /** قراءة النقدي قبل أي كتابة */
    let currentCash = 0;
    if (typeStr === OPERATION_TYPE.WITHDRAW || typeStr === OPERATION_TYPE.DEPOSIT || typeStr === OPERATION_TYPE.LIQUIDATION || typeStr === OPERATION_TYPE.EXTERNAL) {
      const cRef = doc(db, "shops", shop);
      const cSnap = await transaction.get(cRef);
      const cData = cSnap.data();
      currentCash = cData ? Number(cData.cash) || 0 : 0;
    }

    /** قراءة الماكينة الهدف لتحويل الرصيد قبل أي كتابة */
    let targetId = "";
    let targetRow = null;
    if (kind === SOURCE_KIND.MACHINE && typeStr === OPERATION_TYPE.BALANCE_TRANSFER) {
      targetId = asString(op.targetId).trim();
      if (targetId) {
        const tRef = doc(db, "machines", targetId);
        const tSnap = await transaction.get(tRef);
        if (tSnap.exists) {
          const tData = /** @type {Record<string, unknown>} */ (tSnap.data());
          if (asString(tData.shop).trim() === shop) {
            targetRow = tData;
          }
        }
      }
    }

    if (kind === SOURCE_KIND.MACHINE) {
      const opType = /** @type {import("./constants").OperationType} */ (typeStr);

      if (opType === OPERATION_TYPE.BALANCE_TRANSFER) {
        const need = amt + commission;
        const sb = parseMachineBalance(sourceRow);
        if (!targetId) {
          throw new Error("سجل تحويل الرصيد بلا ماكينة هدف.");
        }
        if (!targetRow) {
          throw new Error("ماكينة الهدف غير موجودة.");
        }
        const beforeStored = op.beforeBalanceTarget;
        const beforeNum =
          typeof beforeStored === "number" && Number.isFinite(beforeStored)
            ? beforeStored
            : Number(beforeStored);
        transaction.update(sourceRef, { balance: sb + need });
        if (Number.isFinite(beforeNum)) {
          transaction.update(doc(db, "machines", targetId), { balance: beforeNum });
        } else {
          const tb = parseMachineBalance(targetRow);
          transaction.update(doc(db, "machines", targetId), { balance: tb - amt });
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
      if (typeStr !== OPERATION_TYPE.WITHDRAW && typeStr !== OPERATION_TYPE.DEPOSIT && typeStr !== OPERATION_TYPE.LIQUIDATION && typeStr !== OPERATION_TYPE.EXTERNAL) {
        throw new Error("حذف هذا النوع من العمليات على الخط غير مدعوم.");
      }
      const beforeBalance = parseLineAmount(sourceRow);
      let afterBalance = beforeBalance;
      if (typeStr === OPERATION_TYPE.WITHDRAW || typeStr === OPERATION_TYPE.LIQUIDATION || typeStr === OPERATION_TYPE.EXTERNAL) {
        /** عكس السحب: ينقص رصيد الخط. */
        afterBalance = beforeBalance - amt;
      } else {
        /** عكس الإيداع: يزيد رصيد الخط. */
        afterBalance = beforeBalance + amt;
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
        // LIQUIDATION و EXTERNAL: لا يوجد تأثير على الليميت، لا حاجة للعكس
      }

      transaction.update(sourceRef, lineUpdate);
    }

    /** عكس تأثير النقدي عند الحذف */
    const opExternalDirection = typeStr === OPERATION_TYPE.EXTERNAL ? asString(op.externalDirection) : "";
    if (typeStr === OPERATION_TYPE.WITHDRAW || typeStr === OPERATION_TYPE.LIQUIDATION || (typeStr === OPERATION_TYPE.EXTERNAL && opExternalDirection !== "deposit")) {
      transaction.set(doc(db, "shops", shop), { cash: currentCash + amt }, { merge: true });
    } else if (typeStr === OPERATION_TYPE.DEPOSIT || (typeStr === OPERATION_TYPE.EXTERNAL && opExternalDirection === "deposit")) {
      transaction.set(doc(db, "shops", shop), { cash: Math.max(0, currentCash - amt) }, { merge: true });
    }

    transaction.delete(opRef);
  });
}

const REPORTS_COLLECTION = "reports";

/**
 * ينقل كل عمليات الفرع من `operations` إلى `reports` مع إضافة تاريخ التقفيل.
 * @param {string} shop
 * @param {string} closedBy
 * @returns {Promise<{ moved: number }>}
 */
export async function closeDayOperations(shop, closedBy) {
  const s = shop.trim();
  if (!s) throw new Error("الفرع مطلوب");

  const ops = await fetchOperationsByShop(s);
  if (ops.length === 0) return { moved: 0 };

  const now = new Date();
  const archivedAt = now.toISOString();
  const moved = ops.length;

  // Firestore batch limit is 500 writes; each op = 1 setDoc + 1 deleteDoc = 2 writes
  const BATCH_SIZE = 250;

  for (let i = 0; i < ops.length; i += BATCH_SIZE) {
    const chunk = ops.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);

    for (const op of chunk) {
      const { id, ...data } = op;
      const reportRef = doc(collection(db, REPORTS_COLLECTION));
      batch.set(reportRef, {
        ...data,
        archivedAt,
        closedBy,
      });
      batch.delete(doc(db, OPERATIONS_COLLECTION, id));
    }

    await batch.commit();
  }

  return { moved };
}
