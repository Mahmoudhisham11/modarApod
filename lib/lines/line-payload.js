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

/**
 * حمولة إنشاء/تحديث مستند خط اتصالات — channelType ثابت telecom.
 * حقول السقف cap* تُحدَّث من النموذج فقط؛ lastDailyReset/lastMonthlyReset من وظيفة مجدولة.
 * @param {{
 *   name: string;
 *   phone: string;
 *   userEmail: string;
 *   shop: string;
 *   dailyDeposit: number;
 *   dailyWithdraw: number;
 *   depositLimit: number;
 *   withdrawLimit: number;
 *   capDailyWithdraw: number;
 *   capDailyDeposit: number;
 *   capMonthlyWithdraw: number;
 *   capMonthlyDeposit: number;
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
    capDailyWithdraw: input.capDailyWithdraw,
    capDailyDeposit: input.capDailyDeposit,
    capMonthlyWithdraw: input.capMonthlyWithdraw,
    capMonthlyDeposit: input.capMonthlyDeposit,
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
