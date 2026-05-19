import { collection, getDocs, query, where } from "firebase/firestore";

import { db } from "@/app/firebase";
import { DAILY_LIMIT_DEFAULT } from "@/lib/lines/reset-limits-client";

const LINE_COLLECTIONS = /** @type {const} */ (["numbers", "instapayLines"]);
const LOW_RATIO = 0.1;

/** @param {unknown} v */
function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * @param {number} remainder
 * @param {number} cap
 * @returns {"ok" | "low" | "exhausted"}
 */
function limitStatus(remainder, cap) {
  if (cap <= 0) return "ok";
  if (remainder <= 0) return "exhausted";
  if (remainder <= cap * LOW_RATIO) return "low";
  return "ok";
}

/**
 * @param {Record<string, unknown>} data
 * @param {string} id
 * @param {string} collectionName
 */
export function computeLineLimitAlerts(data, id, collectionName) {
  const phone = typeof data.phone === "string" ? data.phone.trim() : "";
  const name = typeof data.name === "string" ? data.name.trim() : "";
  const capDaily = DAILY_LIMIT_DEFAULT;
  const capMonthlyW = num(data.originalWithdrawLimit);
  const capMonthlyD = num(data.originalDepositLimit);

  const remDailyW = num(data.dailyWithdraw);
  const remDailyD = num(data.dailyDeposit);
  const remMonthW = num(data.withdrawLimit);
  const remMonthD = num(data.depositLimit);

  /** @type {Array<{ label: string; remainder: number; cap: number; status: "low" | "exhausted" }>} */
  const alerts = [];

  const push = (label, remainder, cap) => {
    if (cap <= 0) return;
    const st = limitStatus(remainder, cap);
    if (st === "ok") return;
    alerts.push({ label, remainder, cap, status: st });
  };

  push("يومي سحب", remDailyW, capDaily);
  push("يومي إيداع", remDailyD, capDaily);
  if (capMonthlyW > 0) push("شهري سحب", remMonthW, capMonthlyW);
  if (capMonthlyD > 0) push("شهري إيداع", remMonthD, capMonthlyD);

  if (alerts.length === 0) return null;

  return {
    id,
    collectionName,
    phone: phone || id,
    name,
    alerts,
  };
}

/**
 * @param {string} shop
 * @returns {Promise<Array<NonNullable<ReturnType<typeof computeLineLimitAlerts>>>>}
 */
export async function fetchShopLimitAlerts(shop) {
  const s = shop.trim();
  if (!s) return [];

  /** @type {Array<NonNullable<ReturnType<typeof computeLineLimitAlerts>>>} */
  const all = [];

  for (const collName of LINE_COLLECTIONS) {
    const q = query(collection(db, collName), where("shop", "==", s));
    const snap = await getDocs(q);
    for (const d of snap.docs) {
      const item = computeLineLimitAlerts(
        /** @type {Record<string, unknown>} */ (d.data()),
        d.id,
        collName,
      );
      if (item) all.push(item);
    }
  }

  all.sort((a, b) => a.phone.localeCompare(b.phone, "ar"));
  return all;
}
