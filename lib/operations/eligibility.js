import { parseFiniteNumberOrZero } from "@/lib/lines/line-payload";

import { OPERATION_TYPE, SOURCE_KIND, isMachineDebitOperation } from "./constants";

/** @param {unknown} v */
function asString(v) {
  if (v === null || v === undefined) return "";
  return String(v);
}

/** @param {Record<string, unknown>} row */
export function parseLineAmount(row) {
  return parseFiniteNumberOrZero(asString(row.amount));
}

/** @param {Record<string, unknown>} row */
export function parseMachineBalance(row) {
  const n = Number(row.balance);
  return Number.isFinite(n) ? n : 0;
}

/**
 * الوسيلة تُعتبر نشطة ما لم يُعرّف صراحة أنها غير مفعّلة (للتوافق مع بيانات قديمة بلا حقل).
 * @param {Record<string, unknown>} row
 */
export function isSourceRowActive(row) {
  if (row.active === false) return false;
  if (row.enabled === false) return false;
  const st = asString(row.status).toLowerCase();
  if (st === "inactive" || st === "disabled" || st === "معطل" || st === "غير نشط") return false;
  return true;
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
function startOfLocalDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
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
 * @param {number} n
 * @returns {string}
 */
export function formatLineAmountString(n) {
  if (!Number.isFinite(n)) return "0";
  const rounded = Math.round(n * 100) / 100;
  if (Number.isInteger(rounded)) return String(rounded);
  return String(rounded);
}

/**
 * @param {Array<Record<string, unknown> & { id?: string }>} operations
 * @param {{ sourceId: string; sourceType: string; now?: Date }} ctx
 */
export function aggregateUsageFromOperations(operations, ctx) {
  const now = ctx.now ?? new Date();
  let withdrawToday = 0;
  let withdrawMonth = 0;
  let depositToday = 0;
  let depositMonth = 0;

  for (const op of operations) {
    if (asString(op.sourceId) !== ctx.sourceId) continue;
    if (asString(op.sourceType) !== ctx.sourceType) continue;

    const d = opToDate(op.createdAt);
    if (d.getTime() === 0) continue;

    const type = asString(op.type ?? op.operationType);
    const rawVal = op.operationVal ?? op.amount;
    const amount = Number(rawVal);
    const amt = Number.isFinite(amount) ? amount : 0;

    /** حجم السحب للّيميت على الخط: المبلغ فقط (يُفلتر بـ sourceType؛ سجلات الماكينات لا تُجمع هنا). */
    if (type === OPERATION_TYPE.WITHDRAW || type === OPERATION_TYPE.SMALL_CHANGE_CARDS || type === OPERATION_TYPE.BILLS || type === OPERATION_TYPE.OTHER) {
      const vol = amt;
      if (sameLocalMonth(d, now)) withdrawMonth += vol;
      if (sameLocalDay(d, now)) withdrawToday += vol;
    } else if (type === OPERATION_TYPE.DEPOSIT) {
      if (sameLocalMonth(d, now)) depositMonth += amt;
      if (sameLocalDay(d, now)) depositToday += amt;
    } else if (type === OPERATION_TYPE.BALANCE_TRANSFER) {
      const vol = amt;
      if (sameLocalMonth(d, now)) withdrawMonth += vol;
      if (sameLocalDay(d, now)) withdrawToday += vol;
    }
  }

  /** تجميع إيداعات واردة من تحويل رصيد (هدف) — للماكينات فقط في الاستخدام */
  for (const op of operations) {
    if (asString(op.targetId) !== ctx.sourceId) continue;
    if (asString(op.type ?? op.operationType) !== OPERATION_TYPE.BALANCE_TRANSFER) continue;
    const d = opToDate(op.createdAt);
    const rawVal = op.operationVal ?? op.amount;
    const amount = Number(rawVal);
    const amt = Number.isFinite(amount) ? amount : 0;
    if (sameLocalMonth(d, now)) depositMonth += amt;
    if (sameLocalDay(d, now)) depositToday += amt;
  }

  return { withdrawToday, withdrawMonth, depositToday, depositMonth };
}

/**
 * متبقي الليميت على مستند الخط (للعرض في الواجهة). الحقول على `numbers` تُخزَّن كمتبقي وتُنقص عند التنفيذ.
 * @param {{
 *   sourceKind: import("./constants").SourceKind;
 *   sourceRow: Record<string, unknown>;
 *   sourceId: string;
 *   operations: Array<Record<string, unknown>>;
 *   now?: Date;
 * }} input
 * @returns {null | {
 *   remDailyWithdraw: number;
 *   remMonthlyWithdraw: number;
 *   remDailyDeposit: number;
 *   remMonthlyDeposit: number;
 * }}
 */
export function getLineLimitUsageSnapshot(input) {
  if (input.sourceKind === SOURCE_KIND.MACHINE) return null;
  const r = lineLimitRemaindersFromRow(input.sourceRow);
  return {
    remDailyWithdraw: r.remDailyWithdraw,
    remMonthlyWithdraw: r.remMonthlyWithdraw,
    remDailyDeposit: r.remDailyDeposit,
    remMonthlyDeposit: r.remMonthlyDeposit,
  };
}

/**
 * @param {{
 *   sourceKind: import("./constants").SourceKind;
 *   sourceRow: Record<string, unknown>;
 *   operationType: import("./constants").OperationType;
 *   amount: number;
 *   commission: number;
 *   operations: Array<Record<string, unknown>>;
 *   sourceId: string;
 *   now?: Date;
 * }} input
 */
export function analyzeOperation(input) {
  const messages = [];
  const amount = Number(input.amount);
  const commission = Number(input.commission);
  const amt = Number.isFinite(amount) && amount > 0 ? amount : 0;
  const com = Number.isFinite(commission) && commission >= 0 ? commission : 0;

  if (amt <= 0) {
    return {
      balanceOk: false,
      dailyOk: false,
      monthlyOk: false,
      executable: false,
      messages: ["أدخل مبلغًا أكبر من صفر."],
    };
  }

  const kind = input.sourceKind;
  const opType = input.operationType;

  if (kind === SOURCE_KIND.MACHINE) {
    if (!isSourceRowActive(input.sourceRow)) {
      return {
        balanceOk: false,
        dailyOk: true,
        monthlyOk: true,
        executable: false,
        messages: ["الوسيلة غير نشطة."],
      };
    }
    const balance = parseMachineBalance(input.sourceRow);
    let balanceOk = true;
    if (opType === OPERATION_TYPE.DEPOSIT) {
      balanceOk = true;
    } else if (isMachineDebitOperation(opType)) {
      const need = opType === OPERATION_TYPE.BALANCE_TRANSFER ? amt + com : amt + com;
      balanceOk = balance >= need;
      if (!balanceOk) messages.push("الرصيد غير كافٍ لتغطية المبلغ والعمولة.");
    }
    return {
      balanceOk,
      dailyOk: true,
      monthlyOk: true,
      executable: balanceOk,
      messages: messages.length ? messages : balanceOk ? ["العملية قابلة للتنفيذ من حيث الرصيد."] : [],
    };
  }

  if (!isSourceRowActive(input.sourceRow)) {
    return {
      balanceOk: false,
      dailyOk: false,
      monthlyOk: false,
      executable: false,
      messages: ["الوسيلة (الخط) غير نشطة."],
    };
  }

  const balance = parseLineAmount(input.sourceRow);
  const rem = lineLimitRemaindersFromRow(input.sourceRow);

  let balanceOk = true;
  let dailyOk = true;
  let monthlyOk = true;

  if (opType === OPERATION_TYPE.WITHDRAW) {
    /** سحب خط: العمولة تُسجّل فقط ولا تُخصم من الرصيد؛ الليميت = متبقي على المستند. */
    const need = amt;
    balanceOk = balance >= need;
    if (!balanceOk) messages.push("الرصيد غير كافٍ لتغطية المبلغ.");

    if (rem.remDailyWithdraw > 0) {
      dailyOk = rem.remDailyWithdraw >= need;
      if (!dailyOk) messages.push("تجاوز المتبقي اليومي للسحب.");
    }
    if (rem.remMonthlyWithdraw > 0) {
      monthlyOk = rem.remMonthlyWithdraw >= need;
      if (!monthlyOk) messages.push("تجاوز المتبقي الشهري للسحب.");
    }
  } else if (opType === OPERATION_TYPE.DEPOSIT) {
    if (rem.remDailyDeposit > 0) {
      dailyOk = rem.remDailyDeposit >= amt;
      if (!dailyOk) messages.push("تجاوز المتبقي اليومي للإيداع.");
    }
    if (rem.remMonthlyDeposit > 0) {
      monthlyOk = rem.remMonthlyDeposit >= amt;
      if (!monthlyOk) messages.push("تجاوز المتبقي الشهري للإيداع.");
    }
  }

  const executable = balanceOk && dailyOk && monthlyOk;
  if (executable && messages.length === 0) {
    messages.push("العملية قابلة للتنفيذ.");
  }

  return { balanceOk, dailyOk, monthlyOk, executable, messages };
}

/** @param {number} n */
export function round2(n) {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

/**
 * متبقي الليميت المخزّن على مستند الخط (حقول dailyWithdraw / withdrawLimit / … = متبقي، 0 = معطّل).
 * @param {Record<string, unknown>} row
 */
export function lineLimitRemaindersFromRow(row) {
  const dw = Number(row.dailyWithdraw);
  const wm = Number(row.withdrawLimit);
  const dd = Number(row.dailyDeposit);
  const dm = Number(row.depositLimit);
  return {
    remDailyWithdraw: Number.isFinite(dw) && dw > 0 ? dw : 0,
    remMonthlyWithdraw: Number.isFinite(wm) && wm > 0 ? wm : 0,
    remDailyDeposit: Number.isFinite(dd) && dd > 0 ? dd : 0,
    remMonthlyDeposit: Number.isFinite(dm) && dm > 0 ? dm : 0,
  };
}

/**
 * اسم عرض للوسيلة (لتخزينه في سجل العملية).
 * @param {Record<string, unknown>} row
 * @param {import("./constants").SourceKind} sourceKind
 */
export function sourceDisplayNameFromRow(row, sourceKind) {
  if (sourceKind === SOURCE_KIND.MACHINE) {
    return asString(row.name).trim() || "";
  }
  const phone = asString(row.phone).trim();
  const name = asString(row.name).trim();
  if (phone && name) return `${phone} — ${name}`;
  return phone || name || "";
}

/**
 * متبقي السماح اليومي/الشهري قبل وبعد العملية (خطوط فقط؛ null = لا سقف).
 * @param {{
 *   sourceKind: import("./constants").SourceKind;
 *   sourceRow: Record<string, unknown>;
 *   sourceId: string;
 *   operationType: import("./constants").OperationType;
 *   amount: number;
 *   commission: number;
 *   operations: Array<Record<string, unknown>>;
 *   now?: Date;
 * }} input
 */
export function computeLineLimitRemainderSnapshots(input) {
  if (input.sourceKind === SOURCE_KIND.MACHINE) {
    return {
      beforeDailyLimit: null,
      afterDailyLimit: null,
      beforeMonthlyLimit: null,
      afterMonthlyLimit: null,
    };
  }

  const amt = Number(input.amount) || 0;
  const rem = lineLimitRemaindersFromRow(input.sourceRow);

  if (input.operationType === OPERATION_TYPE.WITHDRAW) {
    const need = amt;
    const beforeDaily = rem.remDailyWithdraw > 0 ? round2(rem.remDailyWithdraw) : null;
    const afterDaily = beforeDaily !== null ? round2(Math.max(0, rem.remDailyWithdraw - need)) : null;
    const beforeMonthly = rem.remMonthlyWithdraw > 0 ? round2(rem.remMonthlyWithdraw) : null;
    const afterMonthly = beforeMonthly !== null ? round2(Math.max(0, rem.remMonthlyWithdraw - need)) : null;
    return {
      beforeDailyLimit: beforeDaily,
      afterDailyLimit: afterDaily,
      beforeMonthlyLimit: beforeMonthly,
      afterMonthlyLimit: afterMonthly,
    };
  }

  const beforeDaily = rem.remDailyDeposit > 0 ? round2(rem.remDailyDeposit) : null;
  const afterDaily = beforeDaily !== null ? round2(Math.max(0, rem.remDailyDeposit - amt)) : null;
  const beforeMonthly = rem.remMonthlyDeposit > 0 ? round2(rem.remMonthlyDeposit) : null;
  const afterMonthly = beforeMonthly !== null ? round2(Math.max(0, rem.remMonthlyDeposit - amt)) : null;
  return {
    beforeDailyLimit: beforeDaily,
    afterDailyLimit: afterDaily,
    beforeMonthlyLimit: beforeMonthly,
    afterMonthlyLimit: afterMonthly,
  };
}

/**
 * اقتراحات تعديل المبلغ/العمولة لتصبح العملية مسموحة (بدون تنفيذ تلقائي).
 * @param {{
 *   sourceKind: import("./constants").SourceKind;
 *   sourceRow: Record<string, unknown>;
 *   operationType: import("./constants").OperationType;
 *   amount: number;
 *   commission: number;
 *   operations: Array<Record<string, unknown>>;
 *   sourceId: string;
 *   now?: Date;
 * }} input
 * @returns {Array<{ id: string; label: string; patch: { amount?: number; commission?: number } }>}
 */
export function buildOperationSuggestions(input) {
  const amount = Number(input.amount);
  const commission = Number(input.commission);
  const amt = Number.isFinite(amount) && amount > 0 ? amount : 0;
  const com = Number.isFinite(commission) && commission >= 0 ? commission : 0;

  if (!input.sourceId || !input.sourceRow || amt <= 0) return [];

  const snapshot = analyzeOperation({
    ...input,
    amount: amt,
    commission: com,
  });
  if (snapshot.executable) return [];

  const kind = input.sourceKind;
  const opType = input.operationType;

  /** @type {Array<{ id: string; label: string; patch: { amount?: number; commission?: number } }>} */
  const suggestions = [];

  if (kind === SOURCE_KIND.MACHINE) {
    if (opType === OPERATION_TYPE.DEPOSIT || !isMachineDebitOperation(opType)) return [];
    const balance = parseMachineBalance(input.sourceRow);
    const maxCom = round2(Math.max(0, balance - amt));
    const maxAmt = round2(Math.max(0, balance - com));
    if (maxCom < com) {
      suggestions.push({
        id: "machine-commission",
        label: `اضبط العمولة إلى ${maxCom} (أقصى ما يسمح به الرصيد مع المبلغ الحالي).`,
        patch: { commission: maxCom },
      });
    }
    if (maxAmt < amt) {
      if (maxAmt > 0) {
        suggestions.push({
          id: "machine-amount",
          label: `اضبط المبلغ إلى ${maxAmt} (أقصى ما يسمح به الرصيد مع العمولة الحالية).`,
          patch: { amount: maxAmt },
        });
      }
    }
    return suggestions;
  }

  const rem = lineLimitRemaindersFromRow(input.sourceRow);

  if (opType === OPERATION_TYPE.WITHDRAW) {
    const balance = parseLineAmount(input.sourceRow);

    let maxAmt = balance;
    if (rem.remDailyWithdraw > 0) maxAmt = Math.min(maxAmt, rem.remDailyWithdraw);
    if (rem.remMonthlyWithdraw > 0) maxAmt = Math.min(maxAmt, rem.remMonthlyWithdraw);
    maxAmt = round2(Math.max(0, maxAmt));

    if (maxAmt < amt && maxAmt > 0) {
      suggestions.push({
        id: "line-withdraw-amount",
        label: `اضبط المبلغ إلى ${maxAmt} (رصيد ومتبقي سحب يومي/شهري — العمولة لا تؤثر على الخط).`,
        patch: { amount: maxAmt },
      });
    }
    return suggestions;
  }

  if (opType === OPERATION_TYPE.DEPOSIT) {
    let maxDep = Infinity;
    if (rem.remDailyDeposit > 0) maxDep = Math.min(maxDep, rem.remDailyDeposit);
    if (rem.remMonthlyDeposit > 0) maxDep = Math.min(maxDep, rem.remMonthlyDeposit);
    if (!Number.isFinite(maxDep)) return [];
    const capAmt = round2(Math.max(0, maxDep));
    if (capAmt > 0 && capAmt < amt) {
      suggestions.push({
        id: "line-deposit-amount",
        label: `خفّض المبلغ إلى ${capAmt} (متبقي إيداع يومي/شهري على الخط).`,
        patch: { amount: capAmt },
      });
    }
  }

  return suggestions;
}

/**
 * أضيق هامش بعد العملية (قد يكون سالبًا). يطابق منطق recommendationScore دون شرط التنفيذ.
 * @param {{
 *   sourceKind: import("./constants").SourceKind;
 *   sourceRow: Record<string, unknown>;
 *   sourceId: string;
 *   operationType: import("./constants").OperationType;
 *   amount: number;
 *   commission: number;
 *   operations: Array<Record<string, unknown>>;
 *   now?: Date;
 * }} input
 * @returns {number}
 */
export function rawRecommendationMargin(input) {
  const amt = Number(input.amount) || 0;
  const com = Number(input.commission) || 0;
  const kind = input.sourceKind;
  const opType = input.operationType;

  if (kind === SOURCE_KIND.MACHINE) {
    const balance = parseMachineBalance(input.sourceRow);
    if (opType === OPERATION_TYPE.DEPOSIT) return balance + amt;
    return balance - amt - com;
  }

  const balance = parseLineAmount(input.sourceRow);
  const rem = lineLimitRemaindersFromRow(input.sourceRow);

  if (opType === OPERATION_TYPE.WITHDRAW) {
    const need = amt;
    const bMargin = balance - need;
    const dMargin = rem.remDailyWithdraw > 0 ? rem.remDailyWithdraw - need : Infinity;
    const mMargin = rem.remMonthlyWithdraw > 0 ? rem.remMonthlyWithdraw - need : Infinity;
    return Math.min(bMargin, dMargin, mMargin);
  }

  const dMargin = rem.remDailyDeposit > 0 ? rem.remDailyDeposit - amt : Infinity;
  const mMargin = rem.remMonthlyDeposit > 0 ? rem.remMonthlyDeposit - amt : Infinity;
  return Math.min(dMargin, mMargin);
}

/**
 * حجم «الحاجة» لعرض الملاءمة: إيداع = المبلغ؛ سحب خط = المبلغ فقط؛ سحب ماكينة = مبلغ + عمولة.
 * @param {import("./constants").OperationType} operationType
 * @param {number} amt
 * @param {number} com
 * @param {import("./constants").SourceKind} [sourceKind]
 */
export function operationNeedVolume(operationType, amt, com, sourceKind) {
  if (operationType === OPERATION_TYPE.DEPOSIT) return amt;
  if (
    operationType === OPERATION_TYPE.WITHDRAW &&
    (sourceKind === SOURCE_KIND.TELECOM || sourceKind === SOURCE_KIND.INSTAPAY)
  ) {
    return amt;
  }
  return amt + com;
}

/**
 * @param {number} margin
 * @returns {number}
 */
function marginSortKey(margin) {
  if (margin === Infinity || margin === Number.POSITIVE_INFINITY) return Number.MAX_SAFE_INTEGER;
  return margin;
}

/**
 * @param {{
 *   executable: boolean;
 *   margin: number;
 *   sourceKind: import("./constants").SourceKind;
 *   operationType: import("./constants").OperationType;
 *   amount: number;
 *   commission: number;
 * }} input
 * @returns {string}
 */
export function suitabilityDescriptionAr(input) {
  const { executable, margin, sourceKind, operationType } = input;
  const amt = Number(input.amount) || 0;
  const com = Number(input.commission) || 0;
  const need = operationNeedVolume(operationType, amt, com, sourceKind);

  if (!executable) {
    return sourceKind === SOURCE_KIND.MACHINE
      ? "غير مناسب — الرصيد لا يكفي لهذه العملية."
      : "غير مناسب — الرصيد أو المتبقي اليومي/الشهري للّيميت على المستند لا يسمح.";
  }

  if (margin === Infinity) {
    return "مناسب — لا يوجد سقف إيداع يومي/شهري مطبق على هذا الخط.";
  }

  if (sourceKind === SOURCE_KIND.MACHINE && operationType === OPERATION_TYPE.DEPOSIT) {
    return "مناسب للإيداع — رصيد أعلى بعد العملية يعني وسيلة أفضل للترشيح.";
  }

  if (need <= 0) return "مناسب.";

  const ratio = margin / need;
  if (!Number.isFinite(ratio) || ratio === Infinity) return "مناسب جدًا.";
  if (ratio >= 2) return "مناسب جدًا — هامش واسع بعد العملية.";
  if (ratio >= 0.5) return "مناسب.";
  if (ratio > 0) return "هامش ضيق — يمكن التنفيذ لكن المتبقي محدود.";
  return "على الحد — قابل للتنفيذ بلا هامش إضافي.";
}

/**
 * @param {number} margin
 * @returns {string}
 */
export function formatRankingMarginDisplay(margin) {
  if (margin === Infinity) return "∞";
  if (!Number.isFinite(margin)) return "—";
  const r = Math.round(margin * 100) / 100;
  return Number.isInteger(r) ? String(r) : String(r);
}

/**
 * درجة ترشيح بسيطة: أدنى هوامش بعد العملية (رصيد + ليميتات).
 * @param {{
 *   sourceKind: import("./constants").SourceKind;
 *   sourceRow: Record<string, unknown>;
 *   sourceId: string;
 *   operationType: import("./constants").OperationType;
 *   amount: number;
 *   commission: number;
 *   operations: Array<Record<string, unknown>>;
 *   now?: Date;
 * }} input
 */
export function recommendationScore(input) {
  const a = analyzeOperation(input);
  if (!a.executable) return -1;
  return rawRecommendationMargin(input);
}

/**
 * @param {{
 *   candidates: Array<{ id: string; row: Record<string, unknown> }>;
 *   sourceKind: import("./constants").SourceKind;
 *   operationType: import("./constants").OperationType;
 *   amount: number;
 *   commission: number;
 *   operations: Array<Record<string, unknown>>;
 *   now?: Date;
 * }} input
 * @returns {Array<{ id: string; row: Record<string, unknown>; margin: number; executable: boolean }>}
 */
export function rankSourcesForOperation(input) {
  const rows = input.candidates.map((c) => {
    const base = {
      sourceKind: input.sourceKind,
      sourceRow: c.row,
      sourceId: c.id,
      operationType: input.operationType,
      amount: input.amount,
      commission: input.commission,
      operations: input.operations,
      now: input.now,
    };
    const executable = analyzeOperation(base).executable;
    const margin = rawRecommendationMargin(base);
    return { id: c.id, row: c.row, margin, executable };
  });
  rows.sort((a, b) => {
    if (a.executable !== b.executable) return a.executable ? -1 : 1;
    const diff = marginSortKey(b.margin) - marginSortKey(a.margin);
    if (diff !== 0) return diff;
    return a.id.localeCompare(b.id);
  });
  return rows;
}

/**
 * وسائل قابلة للتنفيذ فقط، بنفس ترتيب rankSourcesForOperation.
 * @param {{
 *   candidates: Array<{ id: string; row: Record<string, unknown> }>;
 *   sourceKind: import("./constants").SourceKind;
 *   operationType: import("./constants").OperationType;
 *   amount: number;
 *   commission: number;
 *   operations: Array<Record<string, unknown>>;
 *   now?: Date;
 * }} input
 * @returns {Array<{ id: string; row: Record<string, unknown>; margin: number; executable: boolean }>}
 */
export function listSuitableSourcesForOperation(input) {
  return rankSourcesForOperation(input).filter((r) => r.executable);
}

/**
 * @param {{
 *   candidates: Array<{ id: string; row: Record<string, unknown> }>;
 *   sourceKind: import("./constants").SourceKind;
 *   operationType: import("./constants").OperationType;
 *   amount: number;
 *   commission: number;
 *   operations: Array<Record<string, unknown>>;
 *   now?: Date;
 * }} input
 * @returns {{ id: string; row: Record<string, unknown>; score: number } | null}
 */
export function pickRecommendedSource(input) {
  const ranked = rankSourcesForOperation(input);
  const best = ranked.find((r) => r.executable);
  if (!best) return null;
  const score = Number.isFinite(best.margin) ? best.margin : Number.MAX_SAFE_INTEGER;
  return { id: best.id, row: best.row, score };
}
