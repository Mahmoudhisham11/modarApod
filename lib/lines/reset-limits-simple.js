/**
 * نظام إعادة الليميت البسيط
 * ملهم من cashat-main
 * 
 * الفكرة:
 * - كل يوم: أعد الحد اليومي للسحب/الإيداع إلى 60000
 * - كل شهر: أعد الحد الشهري للسحب/الإيداع إلى original* values
 */

/** @param {unknown} v */
function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * احصل على التاريخ الحالي بصيغة YYYY-MM-DD
 * @returns {string}
 */
export function getTodayDate() {
  const today = new Date();
  return today.toLocaleDateString("en-CA"); // YYYY-MM-DD
}

/**
 * احصل على الشهر الحالي (0-11)
 * @returns {number}
 */
export function getCurrentMonth() {
  return new Date().getMonth();
}

/**
 * تحقق ما إذا كان يجب إعادة الليميت اليومي
 * @param {Record<string, unknown>} line
 * @param {string} [todayDate]
 * @returns {boolean}
 */
export function shouldResetDaily(line, todayDate = getTodayDate()) {
  const lastDaily = line.lastDailyReset;
  return lastDaily !== todayDate;
}

/**
 * تحقق ما إذا كان يجب إعادة الليميت الشهري
 * @param {Record<string, unknown>} line
 * @param {number} [currentMonth]
 * @returns {boolean}
 */
export function shouldResetMonthly(line, currentMonth = getCurrentMonth()) {
  const lastMonth = num(line.lastMonthlyReset);
  return lastMonth !== currentMonth;
}

/**
 * بناء الحقول المطلوبة لإعادة الليميت
 * @param {Record<string, unknown>} line
 * @param {string} [todayDate]
 * @param {number} [currentMonth]
 * @returns {Record<string, unknown> | null} null إذا لم يحتج إلى تحديث
 */
export function buildResetUpdates(
  line,
  todayDate = getTodayDate(),
  currentMonth = getCurrentMonth()
) {
  const updates = {};
  let hasChanges = false;

  // 🔷 إعادة الليميت اليومي
  if (shouldResetDaily(line, todayDate)) {
    updates.dailyWithdraw = 60000;
    updates.dailyDeposit = 60000;
    updates.lastDailyReset = todayDate;
    hasChanges = true;
  }

  // 🔶 إعادة الليميت الشهري
  if (shouldResetMonthly(line, currentMonth)) {
    const originalWithdraw = num(line.originalWithdrawLimit) || 60000;
    const originalDeposit = num(line.originalDepositLimit) || 60000;

    updates.withdrawLimit = originalWithdraw;
    updates.depositLimit = originalDeposit;
    updates.lastMonthlyReset = currentMonth;
    hasChanges = true;
  }

  return hasChanges ? updates : null;
}

/**
 * دالة شاملة لحساب تحديثات إعادة الليميت
 * @param {Record<string, unknown>} line بيانات الخط
 * @param {string} [todayDate] التاريخ الحالي (YYYY-MM-DD)
 * @param {number} [currentMonth] الشهر الحالي (0-11)
 * @returns {Record<string, unknown> | null} null إذا لم يحتج إلى تحديث
 */
export function computeResetUpdates(
  line,
  todayDate = getTodayDate(),
  currentMonth = getCurrentMonth()
) {
  return buildResetUpdates(line, todayDate, currentMonth);
}
