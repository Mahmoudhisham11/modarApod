import { addDoc, collection, deleteDoc, doc, getDocs, query, updateDoc, where } from "firebase/firestore";

import { db } from "@/app/firebase";

const COLLECTION = "instapayLines";

/**
 * @param {string} shop
 * @returns {Promise<Array<Record<string, unknown> & { id: string }>>}
 */
export async function fetchInstapayLinesByShop(shop) {
  const q = query(collection(db, COLLECTION), where("shop", "==", shop));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * @param {Record<string, unknown>} data
 */
export async function createInstapayLineDocument(data) {
  const ref = await addDoc(collection(db, COLLECTION), data);
  return ref.id;
}

/**
 * @param {string} id
 * @param {Record<string, unknown>} patch
 */
export async function updateInstapayLineDocument(id, patch) {
  await updateDoc(doc(db, COLLECTION, id), patch);
}

/**
 * @param {string} id
 */
export async function deleteInstapayLineDocument(id) {
  await deleteDoc(doc(db, COLLECTION, id));
}
