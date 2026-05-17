import {
  buildCapBackfillPatch,
  resolveEffectiveCaps,
} from "./line-cap-fields";

/** أي تعديل هنا طالِعه على functions/limit-reset-compute.js أيضاً */

/** @param {unknown} v */
function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * @param {number} n
 */
export function round2(n) {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

/** @deprecated استخدم resolveEffectiveCaps */
export function resolveCapsFromDoc(data) {
  return resolveEffectiveCaps(data);
}

/**
 * @param {string} timeZone IANA e.g. Africa/Cairo
 * @param {Date} [now]
 * @returns {{ ymd: string; month: number }}
 */
export function getClockInTimeZone(timeZone, now = new Date()) {
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = dtf.formatToParts(now);
  /** @param {string} t */
  const get = (t) => parts.find((p) => p.type === t)?.value ?? "";
  const ymd = `${get("year")}-${get("month")}-${get("day")}`;
  const month = Number(get("month"));
  return { ymd, month: Number.isFinite(month) ? month : 1 };
}

/**
 * @param {number} current
 * @param {number} target
 */
function differsFromTarget(current, target) {
  if (target <= 0) return false;
  return Math.abs(current - target) > 0.009;
}

/**
 * @param {Record<string, unknown>} data
 * @param {{ ymd: string; month: number }} clock
 * @param {{
 *   operations?: Array<Record<string, unknown>>;
 *   lineId?: string;
 * }} [ctx]
 * @returns {Record<string, unknown> | null}
 */
export function computeLimitResetUpdates(data, clock, ctx = {}) {
  const { ymd, month } = clock;
  const lineId = ctx.lineId ?? "";
  const caps = resolveEffectiveCaps(data, {
    operations: ctx.operations ?? [],
    lineId,
    dateYmd: ymd,
    month,
  });

  const lastDailyRaw = data.lastDailyReset;
  const lastDaily = typeof lastDailyRaw === "string" ? lastDailyRaw.trim() : "";

  const lastMonthRaw = data.lastMonthlyReset;
  const hasLastMonth = lastMonthRaw !== undefined && lastMonthRaw !== null && lastMonthRaw !== "";
  const lastMonthNum = num(lastMonthRaw);

  const targetDailyW = caps.capDailyWithdraw > 0 ? round2(caps.capDailyWithdraw) : 0;
  const targetDailyD = caps.capDailyDeposit > 0 ? round2(caps.capDailyDeposit) : 0;
  const targetMonthW = caps.capMonthlyWithdraw > 0 ? round2(caps.capMonthlyWithdraw) : 0;
  const targetMonthD = caps.capMonthlyDeposit > 0 ? round2(caps.capMonthlyDeposit) : 0;

  const curDailyW = num(data.dailyWithdraw);
  const curDailyD = num(data.dailyDeposit);
  const curMonthW = num(data.withdrawLimit);
  const curMonthD = num(data.depositLimit);

  const calendarDailyDue = !lastDaily || lastDaily !== ymd;
  const calendarMonthlyDue = !hasLastMonth || lastMonthNum !== month;

  const needDaily =
    calendarDailyDue ||
    differsFromTarget(curDailyW, targetDailyW) ||
    differsFromTarget(curDailyD, targetDailyD);

  const needMonthly =
    calendarMonthlyDue ||
    differsFromTarget(curMonthW, targetMonthW) ||
    differsFromTarget(curMonthD, targetMonthD);

  if (!needDaily && !needMonthly) return null;

  /** @type {Record<string, unknown>} */
  const updates = { ...buildCapBackfillPatch(data, caps) };

  if (needDaily) {
    updates.dailyWithdraw = targetDailyW;
    updates.dailyDeposit = targetDailyD;
    updates.lastDailyReset = ymd;
  }

  if (needMonthly) {
    updates.withdrawLimit = targetMonthW;
    updates.depositLimit = targetMonthD;
    updates.lastMonthlyReset = month;
  }

  return updates;
}
