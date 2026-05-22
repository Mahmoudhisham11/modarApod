import { addDoc, collection, deleteDoc, doc, getDocs, limit, orderBy, query, updateDoc, where } from "firebase/firestore";

import { db } from "@/app/firebase";

const DEBTS_COLLECTION = "debts";
const DEBT_PAYMENTS_COLLECTION = "debtPayments";

const FETCH_LIMIT = 3000;

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
    createdAt: new Date(),
    createdBy: data.createdBy,
  });
  return docRef.id;
}

/**
 * Delete a debt and its associated payments.
 * If the debt has an imageUrl, it also removes the image from Cloudinary.
 *
 * @param {string} debtId
 * @param {{ imageUrl?: string }} [debtData]
 */
export async function deleteDebt(debtId, debtData) {
  // 1. Delete image from Cloudinary (server-side API route)
  if (debtData?.imageUrl) {
    try {
      await fetch("/api/cloudinary/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: debtData.imageUrl }),
      });
    } catch {
      // Non-blocking — continue even if image deletion fails
    }
  }

  // 2. Delete associated payment records
  const paymentsSnap = await getDocs(
    query(collection(db, DEBT_PAYMENTS_COLLECTION), where("debtId", "==", debtId)),
  );
  const deletes = paymentsSnap.docs.map((d) => deleteDoc(doc(db, DEBT_PAYMENTS_COLLECTION, d.id)));
  await Promise.all(deletes);

  // 3. Delete the debt document
  await deleteDoc(doc(db, DEBTS_COLLECTION, debtId));
}

/**
 * @param {{
 *   debtId: string;
 *   amount: number;
 *   shop: string;
 *   createdBy: string;
 *   note?: string;
 * }} data
 */
export async function createDebtPayment(data) {
  const docRef = await addDoc(collection(db, DEBT_PAYMENTS_COLLECTION), {
    debtId: data.debtId,
    amount: data.amount,
    shop: data.shop,
    note: data.note ?? "",
    createdAt: new Date(),
    createdBy: data.createdBy,
  });
  return docRef.id;
}

/**
 * @param {string} debtId
 * @param {number} remaining
 */
export async function makeDebtPayment({ debtId, amount, shop, createdBy, note }) {
  const debtDoc = await getDocs(
    query(collection(db, DEBTS_COLLECTION), where("__name__", "==", debtId)),
  );
  if (debtDoc.empty) throw new Error("الدين غير موجود");

  const debtData = debtDoc.docs[0].data();
  const currentRemaining = typeof debtData.remaining === "number" ? debtData.remaining : 0;
  const newRemaining = Math.max(0, currentRemaining - amount);

  await updateDoc(doc(db, DEBTS_COLLECTION, debtId), { remaining: newRemaining });
  await addDoc(collection(db, DEBT_PAYMENTS_COLLECTION), {
    debtId,
    amount,
    shop,
    note: note ?? "",
    createdAt: new Date(),
    createdBy,
  });

  return newRemaining;
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
