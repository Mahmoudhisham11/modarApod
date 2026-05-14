import { addDoc, collection, deleteDoc, doc, getDocs, query, serverTimestamp, updateDoc, where } from "firebase/firestore";

import { db } from "@/app/firebase";

const COLLECTION = "machines";

/**
 * @param {string} shop
 * @returns {Promise<Array<Record<string, unknown> & { id: string }>>}
 */
export async function fetchMachinesByShop(shop) {
  const q = query(collection(db, COLLECTION), where("shop", "==", shop));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * @param {{ name: string; balance: number; shop: string; userEmail: string }} data
 */
export async function createMachineDocument(data) {
  const ref = await addDoc(collection(db, COLLECTION), {
    name: data.name.trim(),
    balance: data.balance,
    shop: data.shop.trim(),
    userEmail: data.userEmail.trim(),
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

/**
 * @param {string} id
 * @param {{ name: string; balance: number }} patch
 */
export async function updateMachineDocument(id, patch) {
  await updateDoc(doc(db, COLLECTION, id), {
    name: patch.name.trim(),
    balance: patch.balance,
  });
}

/**
 * @param {string} id
 */
export async function deleteMachineDocument(id) {
  await deleteDoc(doc(db, COLLECTION, id));
}
