/**
 * عميل لإعادة الليميتات على جهة العميل
 * ملهم من cashat-main
 * 
 * هذا الملف يقدم دوال لإعادة ضبط الليميتات من جهة العميل
 * (بدلاً من الاعتماد على Cloud Functions وحدها)
 */

import { collection, getDocs, query, updateDoc, doc, where } from "firebase/firestore";
import { db } from "@/app/firebase";
import {
  getTodayDate,
  getCurrentMonth,
  buildResetUpdates,
} from "@/lib/lines/reset-limits-simple";

/**
 * أعد ضبط الليميتات لجميع الخطوط لفرع معين
 * @param {string} shop معرف الفرع
 * @returns {Promise<{ updated: number; collections: string[] }>}
 */
export async function resetShopLineLimitsIfNeeded(shop) {
  if (!shop || !shop.trim()) return { updated: 0, collections: [] };

  const todayDate = getTodayDate();
  const currentMonth = getCurrentMonth();
  let totalUpdated = 0;
  const collections = [];

  const COLLECTIONS = ["numbers", "instapayLines", "machines"];

  for (const collName of COLLECTIONS) {
    try {
      const q = query(collection(db, collName), where("shop", "==", shop.trim()));
      const snap = await getDocs(q);

      let collectionUpdated = 0;

      for (const docSnap of snap.docs) {
        const line = docSnap.data();
        const updates = buildResetUpdates(line, todayDate, currentMonth);

        if (updates) {
          try {
            await updateDoc(doc(db, collName, docSnap.id), updates);
            collectionUpdated++;
            totalUpdated++;
          } catch (err) {
            console.error(`Failed to update ${collName}/${docSnap.id}:`, err);
          }
        }
      }

      if (collectionUpdated > 0) {
        collections.push(collName);
      }
    } catch (err) {
      console.error(`Error processing ${collName}:`, err);
    }
  }

  return { updated: totalUpdated, collections };
}

/**
 * أعد ضبط الليميتات لخط واحد
 * @param {string} collectionName اسم المجموعة (numbers, instapayLines, machines)
 * @param {string} docId معرف الوثيقة
 * @returns {Promise<boolean>} true إذا تم التحديث
 */
export async function resetLineLimitIfNeeded(collectionName, docId) {
  if (!collectionName || !docId) return false;

  try {
    const docRef = doc(db, collectionName, docId);
    const snap = await getDocs(query(collection(db, collectionName), where("__name__", "==", docId)));

    if (snap.empty) return false;

    const line = snap.docs[0].data();
    const todayDate = getTodayDate();
    const currentMonth = getCurrentMonth();
    const updates = buildResetUpdates(line, todayDate, currentMonth);

    if (updates) {
      await updateDoc(docRef, updates);
      return true;
    }

    return false;
  } catch (err) {
    console.error(`Error resetting ${collectionName}/${docId}:`, err);
    return false;
  }
}
