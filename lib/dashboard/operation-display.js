/** @param {unknown} v */
export function asString(v) {
  if (v === null || v === undefined) return "";
  return String(v);
}

/** @param {unknown} ts */
export function opToDate(ts) {
  if (ts && typeof ts === "object" && "toDate" in ts && typeof ts.toDate === "function") {
    return ts.toDate();
  }
  if (ts instanceof Date) return ts;
  return new Date(0);
}

/** @param {Record<string, unknown>} op */
export function getOpAmount(op) {
  const raw = op.operationVal ?? op.amount;
  const v = Number(raw);
  return Number.isFinite(v) ? v : 0;
}

/** @param {Record<string, unknown>} op */
export function getOpCommission(op) {
  const raw = op.commation ?? op.commission;
  const v = Number(raw);
  return Number.isFinite(v) && v >= 0 ? v : 0;
}

/** @param {Record<string, unknown>} op */
export function getOpType(op) {
  return asString(op.type ?? op.operationType);
}

/** @param {Date} d */
export function dateKeyLocal(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** @param {string} ymd */
export function startOfLocalDayFromInput(ymd) {
  if (!ymd) return null;
  const parts = ymd.split("-").map((p) => Number(p));
  const y = parts[0];
  const m = parts[1];
  const d = parts[2];
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

/** @param {string} ymd */
export function endOfLocalDayFromInput(ymd) {
  if (!ymd) return null;
  const parts = ymd.split("-").map((p) => Number(p));
  const y = parts[0];
  const m = parts[1];
  const d = parts[2];
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, 23, 59, 59, 999);
}
