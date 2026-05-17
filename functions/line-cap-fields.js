/** Keep in sync with lib/lines/line-cap-fields.js */

/** @param {unknown} v */
function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** @param {unknown} v */
function asString(v) {
  if (v === null || v === undefined) return "";
  return String(v);
}

/**
 * @param {number} n
 */
export function round2(n) {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

/** @param {unknown} ts */
function opToDate(ts) {
  if (ts && typeof ts === "object" && "toDate" in ts && typeof ts.toDate === "function") {
    return ts.toDate();
  }
  if (ts instanceof Date) return ts;
  return new Date(0);
}

/** @param {Date} d */
function dateKeyLocal(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * @param {Record<string, unknown>} data
 * @param {"capDailyWithdraw" | "capDailyDeposit" | "capMonthlyWithdraw" | "capMonthlyDeposit"} key
 */
export function hasStoredCap(data, key) {
  return Object.prototype.hasOwnProperty.call(data, key) && data[key] !== null && data[key] !== "";
}

/**
 * @param {string} ymd YYYY-MM-DD
 */
function previousYmd(ymd) {
  const parts = ymd.split("-").map((p) => Number(p));
  const y = parts[0];
  const m = parts[1];
  const d = parts[2];
  if (!y || !m || !d) return "";
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - 1);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/**
 * @param {Array<Record<string, unknown>>} operations
 * @param {string} lineId
 * @param {string} dateYmd
 * @param {unknown} lastDailyReset
 * @param {number} remainder
 * @param {"dailyWithdraw" | "dailyDeposit"} field
 */
function inferDailyCapFromOperations(operations, lineId, dateYmd, lastDailyReset, remainder, field) {
  const lastDaily = typeof lastDailyReset === "string" ? lastDailyReset.trim() : "";
  const days = new Set([dateYmd]);
  if (lastDaily) days.add(lastDaily);
  const prev = previousYmd(dateYmd);
  if (prev) days.add(prev);

  let best = remainder > 0 ? remainder : 0;
  for (const day of days) {
    const used = sumLimitAdjustmentsForDay(operations, lineId, day, field);
    if (used > 0) best = Math.max(best, round2(remainder + used));
  }
  return best;
}

/**
 * @param {Array<Record<string, unknown>>} operations
 * @param {string} lineId
 * @param {string} dateYmd
 * @param {"dailyWithdraw" | "dailyDeposit" | "withdrawLimit" | "depositLimit"} field
 */
function sumLimitAdjustmentsForDay(operations, lineId, dateYmd, field) {
  let sum = 0;
  for (const op of operations) {
    if (asString(op.sourceId) !== lineId) continue;
    const d = opToDate(op.createdAt);
    if (d.getTime() === 0 || dateKeyLocal(d) !== dateYmd) continue;
    const lim = op.limitAdjustment;
    if (!lim || typeof lim !== "object") continue;
    const v = Number(/** @type {Record<string, unknown>} */ (lim)[field]);
    if (Number.isFinite(v) && v > 0) sum += v;
  }
  return round2(sum);
}

/**
 * @param {Array<Record<string, unknown>>} operations
 * @param {string} lineId
 * @param {number} month 1-12
 */
function sumLimitAdjustmentsForMonth(operations, lineId, month) {
  let sumW = 0;
  let sumD = 0;
  let sumMw = 0;
  let sumMd = 0;
  for (const op of operations) {
    if (asString(op.sourceId) !== lineId) continue;
    const d = opToDate(op.createdAt);
    if (d.getTime() === 0 || d.getMonth() + 1 !== month) continue;
    const lim = op.limitAdjustment;
    if (!lim || typeof lim !== "object") continue;
    const l = /** @type {Record<string, unknown>} */ (lim);
    if (Number(l.dailyWithdraw) > 0) sumW += Number(l.dailyWithdraw);
    if (Number(l.dailyDeposit) > 0) sumD += Number(l.dailyDeposit);
    if (Number(l.withdrawLimit) > 0) sumMw += Number(l.withdrawLimit);
    if (Number(l.depositLimit) > 0) sumMd += Number(l.depositLimit);
  }
  return {
    withdrawLimit: round2(sumMw),
    depositLimit: round2(sumMd),
    dailyWithdraw: round2(sumW),
    dailyDeposit: round2(sumD),
  };
}

/**
 * @param {Record<string, unknown>} data
 * @param {{
 *   operations?: Array<Record<string, unknown>>;
 *   lineId?: string;
 *   dateYmd?: string;
 *   month?: number;
 * }} [ctx]
 */
export function resolveEffectiveCaps(data, ctx = {}) {
  const { operations = [], lineId = "", dateYmd = "", month = 0 } = ctx;

  let capDailyWithdraw = hasStoredCap(data, "capDailyWithdraw") ? num(data.capDailyWithdraw) : 0;
  let capDailyDeposit = hasStoredCap(data, "capDailyDeposit") ? num(data.capDailyDeposit) : 0;
  let capMonthlyWithdraw = hasStoredCap(data, "capMonthlyWithdraw") ? num(data.capMonthlyWithdraw) : 0;
  let capMonthlyDeposit = hasStoredCap(data, "capMonthlyDeposit") ? num(data.capMonthlyDeposit) : 0;

  const remW = num(data.dailyWithdraw);
  const remD = num(data.dailyDeposit);
  const remMw = num(data.withdrawLimit);
  const remMd = num(data.depositLimit);

  if (!hasStoredCap(data, "capDailyWithdraw") && lineId && dateYmd) {
    capDailyWithdraw = inferDailyCapFromOperations(
      operations,
      lineId,
      dateYmd,
      data.lastDailyReset,
      remW,
      "dailyWithdraw",
    );
  }

  if (!hasStoredCap(data, "capDailyDeposit") && lineId && dateYmd) {
    capDailyDeposit = inferDailyCapFromOperations(
      operations,
      lineId,
      dateYmd,
      data.lastDailyReset,
      remD,
      "dailyDeposit",
    );
  }

  if (!hasStoredCap(data, "capMonthlyWithdraw") && lineId && month > 0 && operations.length > 0) {
    const sums = sumLimitAdjustmentsForMonth(operations, lineId, month);
    if (sums.withdrawLimit > 0) capMonthlyWithdraw = round2(remMw + sums.withdrawLimit);
    else if (remMw > 0) capMonthlyWithdraw = remMw;
  }

  if (!hasStoredCap(data, "capMonthlyDeposit") && lineId && month > 0 && operations.length > 0) {
    const sums = sumLimitAdjustmentsForMonth(operations, lineId, month);
    if (sums.depositLimit > 0) capMonthlyDeposit = round2(remMd + sums.depositLimit);
    else if (remMd > 0) capMonthlyDeposit = remMd;
  }

  return { capDailyWithdraw, capDailyDeposit, capMonthlyWithdraw, capMonthlyDeposit };
}

/**
 * @param {Record<string, unknown>} data
 * @param {ReturnType<typeof resolveEffectiveCaps>} caps
 */
export function buildCapBackfillPatch(data, caps) {
  /** @type {Record<string, number>} */
  const patch = {};
  if (!hasStoredCap(data, "capDailyWithdraw") && caps.capDailyWithdraw > 0) {
    patch.capDailyWithdraw = caps.capDailyWithdraw;
  }
  if (!hasStoredCap(data, "capDailyDeposit") && caps.capDailyDeposit > 0) {
    patch.capDailyDeposit = caps.capDailyDeposit;
  }
  if (!hasStoredCap(data, "capMonthlyWithdraw") && caps.capMonthlyWithdraw > 0) {
    patch.capMonthlyWithdraw = caps.capMonthlyWithdraw;
  }
  if (!hasStoredCap(data, "capMonthlyDeposit") && caps.capMonthlyDeposit > 0) {
    patch.capMonthlyDeposit = caps.capMonthlyDeposit;
  }
  return patch;
}
