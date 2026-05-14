import { OPERATION_TYPE } from "@/lib/operations/constants";

/** @param {unknown} ts */
function opToDate(ts) {
  if (ts && typeof ts === "object" && "toDate" in ts && typeof ts.toDate === "function") {
    return ts.toDate();
  }
  if (ts instanceof Date) return ts;
  return new Date(0);
}

/** @param {Date} a @param {Date} b */
function sameLocalDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  );
}

/** @param {Date} a @param {Date} b */
function sameLocalMonth(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

/**
 * KPIs «الليميت المستهلك»: جمع سحب/إيداع حسب اليوم والشهر المحليين (مطابق لفكرة eligibility).
 * @param {Array<Record<string, unknown>>} operations
 * @param {{ now?: Date }} [opts]
 */
export function aggregateWithdrawDepositDayMonth(operations, opts) {
  const now = opts?.now ?? new Date();
  let dayWithdraw = 0;
  let dayDeposit = 0;
  let monthWithdraw = 0;
  let monthDeposit = 0;

  for (const op of operations) {
    const d = opToDate(op.createdAt);
    if (d.getTime() === 0) continue;

    const type = String(op.type ?? op.operationType ?? "");
    const rawVal = op.operationVal ?? op.amount;
    const v = Number(rawVal);
    const val = Number.isFinite(v) ? v : 0;

    if (type === OPERATION_TYPE.WITHDRAW) {
      if (sameLocalDay(d, now)) dayWithdraw += val;
      if (sameLocalMonth(d, now)) monthWithdraw += val;
    } else if (type === OPERATION_TYPE.DEPOSIT) {
      if (sameLocalDay(d, now)) dayDeposit += val;
      if (sameLocalMonth(d, now)) monthDeposit += val;
    }
  }

  return { dayWithdraw, dayDeposit, monthWithdraw, monthDeposit };
}
