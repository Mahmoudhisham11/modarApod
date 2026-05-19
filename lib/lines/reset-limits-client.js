/**
 * إعادة ضبط الليميت اليومي/الشهري على الخطوط (مثل cashat-main Numbers/page.jsx).
 * يُستدعى من صفحة الخطوط عند التحميل وعند منتصف الليل بتوقيت القاهرة.
 */
import { collection, doc, getDocs, query, where, writeBatch } from "firebase/firestore";

import { db } from "@/app/firebase";

export const LIMIT_RESET_TIMEZONE = "Africa/Cairo";
export const DAILY_LIMIT_DEFAULT = 60000;
const MONTHLY_LIMIT_FALLBACK = 60000;
const LINE_COLLECTIONS = /** @type {const} */ (["numbers", "instapayLines"]);
const BATCH_CHUNK = 450;

/**
 * @param {string} timeZone
 * @param {Date} [now]
 * @returns {string} YYYY-MM-DD
 */
export function formatYmdInTimeZone(timeZone, now = new Date()) {
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = dtf.formatToParts(now);
  /** @param {string} t */
  const get = (t) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/**
 * شهر 0–11 مثل cashat-main (Date.getMonth).
 * @param {string} timeZone
 * @param {Date} [now]
 */
export function getMonthInTimeZone(timeZone, now = new Date()) {
  const dtf = new Intl.DateTimeFormat("en-US", { timeZone, month: "numeric" });
  const month = Number(dtf.format(now));
  return Number.isFinite(month) ? month - 1 : now.getMonth();
}

/**
 * @param {string} timeZone
 * @param {Date} [now]
 * @returns {number}
 */
export function msUntilMidnightInTimeZone(timeZone, now = new Date()) {
  const ymd = formatYmdInTimeZone(timeZone, now);
  const parts = ymd.split("-").map((p) => Number(p));
  const y = parts[0];
  const m = parts[1];
  const d = parts[2];
  if (!y || !m || !d) {
    const next = new Date(now);
    next.setHours(24, 0, 0, 0);
    return Math.max(0, next.getTime() - now.getTime());
  }
  const nextLocal = new Date(y, m - 1, d + 1, 0, 0, 0, 0);
  return Math.max(1000, nextLocal.getTime() - now.getTime());
}

/** @param {unknown} v */
function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * @param {Record<string, unknown>} line
 * @param {string} todayDate
 * @param {number} currentMonth 0–11
 * @returns {Record<string, unknown> | null}
 */
export function buildLineLimitResetPatch(line, todayDate, currentMonth) {
  const lastDailyRaw = line.lastDailyReset;
  const lastDaily = typeof lastDailyRaw === "string" ? lastDailyRaw.trim() : "";

  const lastMonthRaw = line.lastMonthlyReset;
  const hasLastMonth =
    lastMonthRaw !== undefined && lastMonthRaw !== null && lastMonthRaw !== "";
  const lastMonthNum = num(lastMonthRaw);

  const needDaily = !lastDaily || lastDaily !== todayDate;
  const needMonthly = !hasLastMonth || lastMonthNum !== currentMonth;

  if (!needDaily && !needMonthly) return null;

  /** @type {Record<string, unknown>} */
  const patch = {};

  if (needDaily) {
    patch.dailyWithdraw = DAILY_LIMIT_DEFAULT;
    patch.dailyDeposit = DAILY_LIMIT_DEFAULT;
    patch.lastDailyReset = todayDate;
  }

  if (needMonthly) {
    patch.withdrawLimit = num(line.originalWithdrawLimit) || MONTHLY_LIMIT_FALLBACK;
    patch.depositLimit = num(line.originalDepositLimit) || MONTHLY_LIMIT_FALLBACK;
    patch.lastMonthlyReset = currentMonth;
  }

  return patch;
}

/**
 * @param {string} shop
 * @returns {Promise<{ updated: number }>}
 */
export async function resetShopLineLimitsIfNeeded(shop) {
  const s = shop.trim();
  if (!s) return { updated: 0 };

  const todayDate = formatYmdInTimeZone(LIMIT_RESET_TIMEZONE);
  const currentMonth = getMonthInTimeZone(LIMIT_RESET_TIMEZONE);
  let updated = 0;

  for (const collName of LINE_COLLECTIONS) {
    const q = query(collection(db, collName), where("shop", "==", s));
    const snap = await getDocs(q);
    let batch = writeBatch(db);
    let batchCount = 0;

    for (const d of snap.docs) {
      const data = /** @type {Record<string, unknown>} */ (d.data());
      const patch = buildLineLimitResetPatch(data, todayDate, currentMonth);
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

/**
 * جدولة إعادة الضبط عند منتصف الليل (توقيت القاهرة).
 * @param {string} shop
 * @param {() => void | Promise<void>} onReset
 * @returns {() => void} إلغاء الجدولة
 */
export function scheduleDailyLimitReset(shop, onReset) {
  let timeoutId = /** @type {ReturnType<typeof setTimeout> | undefined} */ (undefined);
  let cancelled = false;

  const schedule = () => {
    if (cancelled) return;
    const ms = msUntilMidnightInTimeZone(LIMIT_RESET_TIMEZONE);
    timeoutId = setTimeout(async () => {
      if (cancelled) return;
      try {
        await onReset();
      } catch (err) {
        console.error("scheduleDailyLimitReset", err);
      }
      schedule();
    }, ms);
  };

  schedule();

  return () => {
    cancelled = true;
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  };
}
