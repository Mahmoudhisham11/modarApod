import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  updateDoc,
  where,
} from "firebase/firestore";

import { db } from "@/app/firebase";
import { OPERATION_TYPE } from "@/lib/operations/constants";

const DEBTS_COLLECTION = "debts";
const DEBT_PAYMENTS_COLLECTION = "debtPayments";
const SHOPS_COLLECTION = "shops";

const FETCH_LIMIT = 500;

/**
 * @param {string} shop
 * @returns {Promise<Array<{ id: string } & Record<string, unknown>>>}
 */
export async function fetchDebtsByShop(shop) {
  const base = collection(db, DEBTS_COLLECTION);
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
 *   customerName: string;
 *   amount: number;
 *   type: "ليك" | "عليك";
 *   shop: string;
 *   createdBy: string;
 *   note?: string;
 *   imageUrl?: string;
 *   dueDate?: string;
 * }} data
 */
export async function createDebt(data) {
  const docRef = await addDoc(collection(db, DEBTS_COLLECTION), {
    customerName: data.customerName,
    amount: data.amount,
    remaining: data.amount,
    type: data.type,
    shop: data.shop,
    note: data.note ?? "",
    imageUrl: data.imageUrl ?? "",
    dueDate: data.dueDate ?? "",
    createdAt: new Date(),
    createdBy: data.createdBy,
  });
  return docRef.id;
}

/**
 * @param {string} debtId
 * @param {{ imageUrl?: string }} [debtData]
 */
export async function deleteDebt(debtId, debtData) {
  if (debtData?.imageUrl) {
    try {
      await fetch("/api/cloudinary/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: debtData.imageUrl }),
      });
    } catch {
      // non-blocking
    }
  }

  const paymentsSnap = await getDocs(
    query(collection(db, DEBT_PAYMENTS_COLLECTION), where("debtId", "==", debtId)),
  );
  const deletes = paymentsSnap.docs.map((d) => deleteDoc(doc(db, DEBT_PAYMENTS_COLLECTION, d.id)));
  await Promise.all(deletes);
  await deleteDoc(doc(db, DEBTS_COLLECTION, debtId));
}

/**
 * @param {{
 *   debtId: string;
 *   amount: number;
 *   shop: string;
 *   createdBy: string;
 *   note?: string;
 *   paymentMethod: "cash" | "wallet";
 *   sourceId?: string;
 *   sourceKind?: import("@/lib/operations/constants").SourceKind;
 *   debtType: "ليك" | "عليك";
 * }} params
 */
export async function makeDebtPayment({ debtId, amount, shop, createdBy, note, paymentMethod, sourceId, sourceKind, debtType }) {
  const debtRef = doc(db, DEBTS_COLLECTION, debtId);

  /** @param {import("firebase/firestore").Transaction} transaction */
  const validateDebt = async (transaction) => {
    const snap = await transaction.get(debtRef);
    if (!snap.exists()) throw new Error("الدين غير موجود");
    const data = snap.data();
    const remaining = typeof data.remaining === "number" ? data.remaining : 0;
    if (amount > remaining) throw new Error("المبلغ المسدد أكبر من المتبقي.");
    return remaining;
  };

  if (paymentMethod === "cash") {
    return runTransaction(db, async (transaction) => {
      const currentRemaining = await validateDebt(transaction);

      const shopRef = doc(db, SHOPS_COLLECTION, shop);
      const shopSnap = await transaction.get(shopRef);
      const shopData = shopSnap.data();
      const oldCash = shopData ? Number(shopData.cash) || 0 : 0;

      const newCash = debtType === "ليك" ? oldCash + amount : oldCash - amount;

      if (newCash < 0) {
        throw new Error("النقدي لا يكفي لإتمام السداد.");
      }

      transaction.update(shopRef, { cash: newCash });
      transaction.update(debtRef, { remaining: currentRemaining - amount });

      const paymentRef = doc(collection(db, DEBT_PAYMENTS_COLLECTION));
      transaction.set(paymentRef, {
        debtId,
        amount,
        shop,
        note: note ?? "",
        paymentMethod: "cash",
        createdAt: new Date(),
        createdBy,
      });
    });
  }

  // wallet payment
  if (!sourceId || !sourceKind) throw new Error("يجب اختيار وسيلة الدفع.");

  const colName = sourceKind === "telecom" ? "numbers" : sourceKind === "instapay" ? "instapayLines" : "machines";
  const sourceRef = doc(db, colName, sourceId);

  return runTransaction(db, async (transaction) => {
    const currentRemaining = await validateDebt(transaction);

    const sourceSnap = await transaction.get(sourceRef);
    if (!sourceSnap.exists()) throw new Error("الوسيلة غير موجودة");

    const sourceRow = sourceSnap.data();
    let currentBalance = 0;

    if (sourceKind === "machine") {
      currentBalance = Number(sourceRow.balance) || 0;
    } else {
      const raw = sourceRow.amount ?? sourceRow.balance ?? 0;
      currentBalance = Number(raw) || 0;
    }

    if (currentBalance < amount) {
      throw new Error("الرصيد في هذه الوسيلة لا يكفي.");
    }

    const newBalance = currentBalance - amount;

    if (sourceKind === "machine") {
      transaction.update(sourceRef, { balance: newBalance });
    } else {
      transaction.update(sourceRef, { amount: String(newBalance) });
    }

    transaction.update(debtRef, { remaining: currentRemaining - amount });

    const paymentRef = doc(collection(db, DEBT_PAYMENTS_COLLECTION));
    transaction.set(paymentRef, {
      debtId,
      amount,
      shop,
      note: note ?? "",
      paymentMethod: "wallet",
      sourceId,
      sourceKind,
      createdAt: new Date(),
      createdBy,
    });
  });
}

/**
 * @param {string} debtId
 * @returns {Promise<Array<{ id: string } & Record<string, unknown>>>}
 */
export async function fetchDebtPayments(debtId) {
  const q = query(
    collection(db, DEBT_PAYMENTS_COLLECTION),
    where("debtId", "==", debtId),
    orderBy("createdAt", "desc"),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
