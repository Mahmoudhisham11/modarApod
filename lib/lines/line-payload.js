/** @param {number} y @param {number} m @param {number} d */
function pad2(y, m, d) {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function todayYmdLocal() {
  const t = new Date();
  return pad2(t.getFullYear(), t.getMonth() + 1, t.getDate());
}

export function currentMonthNumber() {
  return new Date().getMonth() + 1;
}

/** @param {string} s */
export function parseFiniteNumberOrZero(s) {
  const n = Number(String(s).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : 0;
}

/** ليميت يومي افتراضي عند إنشاء خط (مثل cashat-main) */
export const DAILY_LIMIT_DEFAULT = 60000;

/**
 * حمولة إنشاء/تحديث مستند خط.
 * @param {{
 *   name: string;
 *   phone: string;
 *   userEmail: string;
 *   shop: string;
 *   dailyDeposit: number;
 *   dailyWithdraw: number;
 *   depositLimit: number;
 *   withdrawLimit: number;
 *   amount?: string;
 *   idNumber?: string;
 *   address?: string;
 *   maternalGrandfatherName?: string;
 *   maternalGrandmotherName?: string;
 *   activationDate?: string;
 *   originalDepositLimit?: string;
 *   originalWithdrawLimit?: string;
 *   channelType?: string;
 * }} input
 */
export function buildLineDocumentPayload(input) {
  const channelType = input.channelType ?? "telecom";
  return {
    name: input.name.trim(),
    phone: input.phone.trim(),
    userEmail: input.userEmail.trim(),
    shop: input.shop.trim(),
    channelType,
    dailyDeposit: input.dailyDeposit,
    dailyWithdraw: input.dailyWithdraw,
    depositLimit: input.depositLimit,
    withdrawLimit: input.withdrawLimit,
    amount: input.amount?.trim() ?? "",
    idNumber: input.idNumber?.trim() ?? "",
    address: input.address?.trim() ?? "",
    maternalGrandfatherName: input.maternalGrandfatherName?.trim() ?? "",
    maternalGrandmotherName: input.maternalGrandmotherName?.trim() ?? "",
    activationDate: input.activationDate?.trim() ?? "",
    originalDepositLimit: input.originalDepositLimit?.trim() ?? "",
    originalWithdrawLimit: input.originalWithdrawLimit?.trim() ?? "",
  };
}
