/**
 * Firestore: أضف قواعد أمان لمجموعة `reports` (حصر shop للمستخدم).
 */
import { collection, getDocs, limit, orderBy, query, where } from "firebase/firestore";

import { db } from "@/app/firebase";

const REPORTS_COLLECTION = "reports";

const FETCH_LIMIT = 3000;

/**
 * @param {string} shop
 * @returns {Promise<Array<Record<string, unknown> & { id: string }>>}
 */
export async function fetchReportsByShop(shop) {
  const base = collection(db, REPORTS_COLLECTION);
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
