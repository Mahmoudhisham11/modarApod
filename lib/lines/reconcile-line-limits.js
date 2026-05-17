import { collection, doc, getDocs, query, where, writeBatch } from "firebase/firestore";

import { db } from "@/app/firebase";
import { computeLimitResetUpdates, getClockInTimeZone } from "@/lib/lines/limit-reset-compute";
import { fetchOperationsByShop } from "@/lib/operations/operations-service";

const COLLECTIONS = /** @type {const} */ (["numbers", "instapayLines"]);
const BATCH_CHUNK = 450;
/** يطابق Cloud Function الافتراضي */
export const LIMIT_RESET_TIMEZONE = "Africa/Cairo";

/**
 * @param {string} shop
 * @returns {Promise<{ updated: number }>}
 */
export async function reconcileShopLineLimits(shop) {
  const s = shop.trim();
  if (!s) return { updated: 0 };

  const clock = getClockInTimeZone(LIMIT_RESET_TIMEZONE);
  let operations = [];
  try {
    operations = await fetchOperationsByShop(s);
  } catch {
    operations = [];
  }

  let updated = 0;

  for (const collName of COLLECTIONS) {
    const q = query(collection(db, collName), where("shop", "==", s));
    const snap = await getDocs(q);
    let batch = writeBatch(db);
    let batchCount = 0;

    for (const d of snap.docs) {
      const data = /** @type {Record<string, unknown>} */ (d.data());
      const patch = computeLimitResetUpdates(data, clock, {
        operations,
        lineId: d.id,
      });
      if (!patch) continue;
      batch.update(doc(db, collName, d.id), patch);
      batchCount += 1;
      updated += 1;
      if (batchCount >= BATCH_CHUNK) {
        await batch.commit();
        batch = writeBatch(db);
        batchCount = 0;
      }
    }

    if (batchCount > 0) await batch.commit();
  }

  return { updated };
}
