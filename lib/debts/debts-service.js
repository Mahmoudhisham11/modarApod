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
  serverTimestamp,
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
 *   paymentMethod?: "cash" | "wallet";
 *   sourceId?: string;
 *   sourceKind?: import("@/lib/operations/constants").SourceKind;
 * }} data
 */
export async function createDebt(data) {
  const debtData = {
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
  };

  if (data.paymentMethod) {
    return runTransaction(db, async (transaction) => {
      const debtRef = doc(collection(db, DEBTS_COLLECTION));
      transaction.set(debtRef, debtData);

      if (data.paymentMethod === "cash") {
        const shopRef = doc(db, SHOPS_COLLECTION, data.shop);
        const shopSnap = await transaction.get(shopRef);
        const shopData = shopSnap.data();
        const oldCash = shopData ? Number(shopData.cash) || 0 : 0;
        const newCash = data.type === "ليك" ? oldCash - data.amount : oldCash + data.amount;
        if (newCash < 0) throw new Error("النقدي لا يكفي لتسجيل الدين.");
        transaction.update(shopRef, { cash: newCash });
        return debtRef.id;
      }

      if (!data.sourceId || !data.sourceKind) throw new Error("يجب اختيار وسيلة الدفع.");
      const colName = data.sourceKind === "telecom" ? "numbers" : data.sourceKind === "instapay" ? "instapayLines" : "machines";
      const sourceRef = doc(db, colName, data.sourceId);
      const sourceSnap = await transaction.get(sourceRef);
      if (!sourceSnap.exists()) throw new Error("الوسيلة غير موجودة");
      const sourceRow = sourceSnap.data();
      let currentBalance = 0;
      if (data.sourceKind === "machine") {
        currentBalance = Number(sourceRow.balance) || 0;
      } else {
        currentBalance = Number(sourceRow.amount ?? sourceRow.balance ?? 0) || 0;
      }
      const newBalance = data.type === "ليك" ? currentBalance - data.amount : currentBalance + data.amount;
      if (newBalance < 0) throw new Error("الرصيد في هذه الوسيلة لا يكفي.");
      if (data.sourceKind === "machine") {
        transaction.update(sourceRef, { balance: newBalance });
      } else {
        transaction.update(sourceRef, { amount: String(newBalance) });
      }
      return debtRef.id;
    });
  }

  const docRef = await addDoc(collection(db, DEBTS_COLLECTION), debtData);
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
 * @param {string} shop
 * @returns {Promise<Array<{ id: string; customerName: string; amount: number; remaining: number; dueDate: string; daysLeft: number } & Record<string, unknown>>>}
 */
export async function fetchDebtsDueSoon(shop) {
  if (!shop.trim()) return [];
  try {
    const debts = await fetchDebtsByShop(shop);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const soon = [];
    for (const d of debts) {
      if (!d.dueDate) continue;
      if (d.remaining <= 0) continue;
      const due = new Date(d.dueDate);
      if (isNaN(due.getTime())) continue;
      const dueStart = new Date(due.getFullYear(), due.getMonth(), due.getDate());
      const diffDays = Math.round((dueStart.getTime() - today.getTime()) / 86400000);
      if (diffDays < -7) continue; // ignore debts more than 7 days overdue
      if (diffDays > 30) continue; // ignore debts due more than 30 days away
      soon.push({
        ...d,
        daysLeft: diffDays,
      });
    }
    soon.sort((a, b) => a.daysLeft - b.daysLeft);
    return soon;
  } catch {
    return [];
  }
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
