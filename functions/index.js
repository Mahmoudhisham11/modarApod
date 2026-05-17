/**
 * مهمة منتصف الليل لإعادة متبقي الليميت اليومي/الشهري على numbers و instapayLines.
 * المنطق المشترك: ../lib/lines/limit-reset-compute.js
 */
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";

import { computeLimitResetUpdates, getClockInTimeZone } from "./limit-reset-compute.js";

initializeApp();
const db = getFirestore();

const COLLECTIONS = ["numbers", "instapayLines"];
const BATCH_CHUNK = 450;

/** @type {Array<Record<string, unknown>> | null} */
let recentOperationsCache = null;

/**
 * @returns {Promise<Array<Record<string, unknown>>>}
 */
async function loadRecentOperations() {
  if (recentOperationsCache) return recentOperationsCache;
  const snap = await db.collection("operations").orderBy("createdAt", "desc").limit(5000).get();
  recentOperationsCache = snap.docs.map((d) => ({
    id: d.id,
    .../** @type {Record<string, unknown>} */ (d.data()),
  }));
  return recentOperationsCache;
}

/**
 * @param {string} collectionName
 * @param {{ ymd: string; month: number }} clock
 * @param {Array<Record<string, unknown>>} operations
 */
async function processCollection(collectionName, clock, operations) {
  const snap = await db.collection(collectionName).get();
  let batch = db.batch();
  let batchCount = 0;
  let total = 0;

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    const patch = computeLimitResetUpdates(data, clock, {
      operations,
      lineId: docSnap.id,
    });
    if (!patch) continue;
    batch.update(docSnap.ref, patch);
    batchCount += 1;
    total += 1;
    if (batchCount >= BATCH_CHUNK) {
      await batch.commit();
      batch = db.batch();
      batchCount = 0;
    }
  }

  if (batchCount > 0) await batch.commit();
  return total;
}

const timeZone = process.env.LIMIT_RESET_TZ || "Africa/Cairo";

export const resetLineLimitsAtMidnight = onSchedule(
  {
    schedule: "0 0 * * *",
    timeZone,
    region: "me-central1",
    memory: "256MiB",
    timeoutSeconds: 540,
  },
  async () => {
    recentOperationsCache = null;
    const clock = getClockInTimeZone(timeZone);
    const operations = await loadRecentOperations();
    let grand = 0;
    for (const name of COLLECTIONS) {
      const n = await processCollection(name, clock, operations);
      grand += n;
    }
    console.log(`resetLineLimitsAtMidnight done ymd=${clock.ymd} month=${clock.month} updates=${grand}`);
  },
);
