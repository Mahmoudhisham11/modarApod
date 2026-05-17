import { printReportSummary } from "./print-report-summary";

/**
 * يفتح نافذة الطباعة؛ المستخدم يختار «حفظ كـ PDF» من الوجهة.
 * @param {Parameters<typeof printReportSummary>[0]} input
 * @returns {boolean}
 */
export function exportReportPdfViaPrint(input) {
  return printReportSummary(input);
}
