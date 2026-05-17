import {
  asString,
  dateKeyLocal,
  endOfLocalDayFromInput,
  getOpAmount,
  getOpCommission,
  getOpType,
  opToDate,
  startOfLocalDayFromInput,
} from "@/lib/dashboard/operation-display";

/** @typedef {"today" | "week" | "month" | "all" | "custom"} ReportPeriodPreset */

/**
 * @param {Date} ref
 * @returns {Date}
 */
function startOfLocalWeekSunday(ref) {
  const d = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate(), 0, 0, 0, 0);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  return d;
}

/**
 * @param {Date} ref
 * @returns {Date}
 */
function startOfLocalMonth(ref) {
  return new Date(ref.getFullYear(), ref.getMonth(), 1, 0, 0, 0, 0);
}

/**
 * @param {Date} ref
 * @returns {Date}
 */
function endOfLocalDay(ref) {
  return new Date(ref.getFullYear(), ref.getMonth(), ref.getDate(), 23, 59, 59, 999);
}

/**
 * @param {ReportPeriodPreset} preset
 * @param {{ dateFrom?: string; dateTo?: string }} [range]
 * @returns {string}
 */
export function periodLabelAr(preset, range) {
  if (preset === "today") return "اليوم";
  if (preset === "week") return "هذا الأسبوع";
  if (preset === "month") return "هذا الشهر";
  if (preset === "all") return "كل التقارير المحمّلة";
  if (preset === "custom" && range?.dateFrom && range?.dateTo) {
    return `من ${range.dateFrom} إلى ${range.dateTo}`;
  }
  if (preset === "custom" && range?.dateFrom) return `من ${range.dateFrom}`;
  if (preset === "custom" && range?.dateTo) return `حتى ${range.dateTo}`;
  return "فترة مخصصة";
}

/**
 * @param {Array<Record<string, unknown>>} items
 * @param {{ preset: ReportPeriodPreset; dateFrom?: string; dateTo?: string; now?: Date }} opts
 */
export function filterOperationsByPeriod(items, opts) {
  const now = opts.now ?? new Date();
  const preset = opts.preset;

  if (preset === "all") return items;

  let rangeStart = null;
  let rangeEnd = endOfLocalDay(now);

  if (preset === "today") {
    rangeStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  } else if (preset === "week") {
    rangeStart = startOfLocalWeekSunday(now);
  } else if (preset === "month") {
    rangeStart = startOfLocalMonth(now);
  } else if (preset === "custom") {
    rangeStart = opts.dateFrom ? startOfLocalDayFromInput(opts.dateFrom) : null;
    rangeEnd = opts.dateTo ? endOfLocalDayFromInput(opts.dateTo) : endOfLocalDay(now);
    if (!rangeStart && !rangeEnd) return items;
    if (!rangeEnd) rangeEnd = endOfLocalDay(now);
  }

  return items.filter((item) => {
    const d = opToDate(item.createdAt);
    if (d.getTime() === 0) return false;
    if (rangeStart && d < rangeStart) return false;
    if (rangeEnd && d > rangeEnd) return false;
    return true;
  });
}

/**
 * @param {number} n
 */
function round2(n) {
  return Math.round(n * 100) / 100;
}

/**
 * @param {Record<string, unknown>} row
 */
function reportTypeLabel(row) {
  const t = getOpType(row);
  return t.trim() || "—";
}

/**
 * @param {Record<string, unknown>} row
 */
function reportPhoneKey(row) {
  const phone = asString(row.phone).trim();
  return phone || "—";
}

/**
 * @param {Array<Record<string, unknown>>} items
 */
export function buildReportSummary(items) {
  let count = 0;
  let totalAmount = 0;
  let totalCommission = 0;

  /** @type {Record<string, { key: string; label: string; count: number; volume: number }>} */
  const byTypeMap = {};
  /** @type {Record<string, { key: string; label: string; count: number; volume: number }>} */
  const byPhoneMap = {};
  /** @type {Record<string, { dateKey: string; volume: number; commission: number; count: number }>} */
  const dailyMap = {};

  for (const row of items) {
    const d = opToDate(row.createdAt);
    if (d.getTime() === 0) continue;

    count += 1;
    const amt = getOpAmount(row);
    const com = getOpCommission(row);
    totalAmount += amt;
    totalCommission += com;

    const typeKey = reportTypeLabel(row);
    if (!byTypeMap[typeKey]) {
      byTypeMap[typeKey] = { key: typeKey, label: typeKey, count: 0, volume: 0 };
    }
    byTypeMap[typeKey].count += 1;
    byTypeMap[typeKey].volume += amt;

    const phoneKey = reportPhoneKey(row);
    if (!byPhoneMap[phoneKey]) {
      byPhoneMap[phoneKey] = { key: phoneKey, label: phoneKey, count: 0, volume: 0 };
    }
    byPhoneMap[phoneKey].count += 1;
    byPhoneMap[phoneKey].volume += amt;

    const dk = dateKeyLocal(d);
    if (!dailyMap[dk]) {
      dailyMap[dk] = { dateKey: dk, volume: 0, commission: 0, count: 0 };
    }
    dailyMap[dk].count += 1;
    dailyMap[dk].volume += amt;
    dailyMap[dk].commission += com;
  }

  const dailyKeys = Object.keys(dailyMap).sort();
  const dailySeries = dailyKeys.slice(-14).map((k) => {
    const row = dailyMap[k];
    return {
      dateKey: row.dateKey,
      volume: round2(row.volume),
      commission: round2(row.commission),
      count: row.count,
    };
  });

  const byType = Object.values(byTypeMap)
    .map((r) => ({ ...r, volume: round2(r.volume) }))
    .sort((a, b) => b.volume - a.volume);

  const byPhone = Object.values(byPhoneMap)
    .map((r) => ({ ...r, volume: round2(r.volume) }))
    .sort((a, b) => b.volume - a.volume);

  const topPhones = byPhone.slice(0, 10);

  const uniqueTypesCount = Object.keys(byTypeMap).length;
  const avgAmount = count > 0 ? round2(totalAmount / count) : 0;

  return {
    count,
    totalAmount: round2(totalAmount),
    totalCommission: round2(totalCommission),
    uniqueTypesCount,
    avgAmount,
    byType,
    byPhone,
    topPhones,
    dailySeries,
  };
}
