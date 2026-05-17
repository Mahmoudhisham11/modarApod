/**
 * دالة Cloud Function مجدولة
 * تعيد ضبط الليميتات كل يوم الساعة 12:00 صباحاً (بتوقيت مصر)
 * 
 * ملهم من cashat-main
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");

const db = admin.firestore();

/**
 * احصل على التاريخ بصيغة YYYY-MM-DD
 * @param {Date} date
 * @returns {string}
 */
function formatDateYmd(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * تحويل قيمة إلى رقم
 * @param {unknown} v
 * @returns {number}
 */
function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * تحقق ما إذا كان يجب إعادة الليميت اليومي
 * @param {Record<string, any>} line
 * @param {string} todayDate
 * @returns {boolean}
 */
function shouldResetDaily(line, todayDate) {
  return line.lastDailyReset !== todayDate;
}

/**
 * تحقق ما إذا كان يجب إعادة الليميت الشهري
 * @param {Record<string, any>} line
 * @param {number} currentMonth
 * @returns {boolean}
 */
function shouldResetMonthly(line, currentMonth) {
  const lastMonth = num(line.lastMonthlyReset);
  return lastMonth !== currentMonth;
}

/**
 * بناء تحديثات إعادة الليميت
 * @param {Record<string, any>} line
 * @param {string} todayDate
 * @param {number} currentMonth
 * @returns {Record<string, any> | null}
 */
function buildResetUpdates(line, todayDate, currentMonth) {
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
 * معالجة إعادة ضبط الليميتات لمجموعة من الوثائق
 * @param {string} collectionName اسم المجموعة
 * @param {string} todayDate التاريخ الحالي
 * @param {number} currentMonth الشهر الحالي
 * @returns {Promise<{ updated: number; errors: string[] }>}
 */
async function resetCollectionLimits(collectionName, todayDate, currentMonth) {
  let updated = 0;
  const errors = [];

  try {
    const snapshot = await db.collection(collectionName).get();

    for (const doc of snapshot.docs) {
      const line = doc.data();
      const updates = buildResetUpdates(line, todayDate, currentMonth);

      if (updates) {
        try {
          await doc.ref.update(updates);
          updated++;
          console.log(`✅ ${collectionName}/${doc.id} updated`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          errors.push(`❌ ${collectionName}/${doc.id}: ${msg}`);
          console.error(`Error updating ${collectionName}/${doc.id}:`, err);
        }
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`❌ Failed to process ${collectionName}: ${msg}`);
    console.error(`Error processing ${collectionName}:`, err);
  }

  return { updated, errors };
}

/**
 * إعادة ضبط الليميتات كل يوم الساعة 12:00 صباحاً
 * تشغيل: Cloud Scheduler أو وقت محدد
 */
exports.resetLineLimitsAtMidnight = functions
  .region("europe-west1")
  .pubsub.schedule("0 0 * * *")
  .timeZone("Africa/Cairo")
  .onRun(async (context) => {
    const now = new Date();
    const todayDate = formatDateYmd(now);
    const currentMonth = now.getMonth();

    console.log("🔄 Starting limit reset...");
    console.log(`📅 Date: ${todayDate}, 📆 Month: ${currentMonth}`);

    let totalUpdated = 0;
    let totalErrors = 0;

    try {
      // 📞 إعادة ضبط خطوط الاتصالات
      console.log("\n📞 Processing numbers...");
      let result = await resetCollectionLimits("numbers", todayDate, currentMonth);
      totalUpdated += result.updated;
      totalErrors += result.errors.length;

      // 💳 إعادة ضبط المحافظ الرقمية
      console.log("\n💳 Processing instapayLines...");
      result = await resetCollectionLimits(
        "instapayLines",
        todayDate,
        currentMonth
      );
      totalUpdated += result.updated;
      totalErrors += result.errors.length;

      // 🏧 إعادة ضبط الماكينات
      console.log("\n🏧 Processing machines...");
      result = await resetCollectionLimits("machines", todayDate, currentMonth);
      totalUpdated += result.updated;
      totalErrors += result.errors.length;

      // 📊 ملخص النتائج
      console.log("\n" + "=".repeat(50));
      console.log(`📊 Reset Complete!`);
      console.log(`✅ Total Updated: ${totalUpdated}`);
      console.log(`⚠️ Total Errors: ${totalErrors}`);
      console.log(`📅 Date: ${todayDate}`);
      console.log(`📆 Month: ${currentMonth}`);
      console.log("=".repeat(50));

      return {
        success: true,
        updatedCount: totalUpdated,
        errorCount: totalErrors,
        date: todayDate,
        month: currentMonth,
      };
    } catch (error) {
      console.error("🔴 Fatal Error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });
