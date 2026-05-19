import ExcelJS from "exceljs";

import {
  asString,
  getOpAmount,
  getOpCommission,
  getOpType,
  opToDate,
} from "@/lib/dashboard/operation-display";

import { buildReportExportFilename } from "./export-filename";

const HEADER_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
const HEADER_FONT = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
const THIN_BORDER = {
  top: { style: "thin", color: { argb: "FFE2E8F0" } },
  left: { style: "thin", color: { argb: "FFE2E8F0" } },
  bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
  right: { style: "thin", color: { argb: "FFE2E8F0" } },
};
const NUM_FMT = "#,##0.00";
const STRIPE_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };

/**
 * @param {import("exceljs").Worksheet} ws
 * @param {number} row
 * @param {number} colCount
 */
function styleDataRow(ws, row, colCount) {
  for (let c = 1; c <= colCount; c += 1) {
    const cell = ws.getCell(row, c);
    cell.border = THIN_BORDER;
    if (row % 2 === 0) {
      cell.fill = STRIPE_FILL;
    }
  }
}

/**
 * @param {import("exceljs").Worksheet} ws
 * @param {number} headerRow
 * @param {string[]} headers
 * @param {number[]} widths
 */
function addTableHeader(ws, headerRow, headers, widths) {
  headers.forEach((label, i) => {
    const col = i + 1;
    const cell = ws.getCell(headerRow, col);
    cell.value = label;
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = THIN_BORDER;
    ws.getColumn(col).width = widths[i] ?? 14;
  });
  ws.views = [{ rightToLeft: true, state: "frozen", ySplit: headerRow }];
}

/**
 * @param {Record<string, unknown>} row
 */
function formatReportDate(row) {
  const created = opToDate(row.createdAt);
  if (created.getTime() === 0) return "—";
  return created.toLocaleString("ar-EG", { dateStyle: "short", timeStyle: "short" });
}

/**
 * @param {{
 *   branchLabel: string;
 *   periodTitle: string;
 *   summary: ReturnType<import("./report-aggregates").buildReportSummary>;
 *   reports: Array<Record<string, unknown> & { id?: string }>;
 * }} input
 */
export async function downloadReportExcel(input) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "";
  wb.created = new Date();

  const summaryWs = wb.addWorksheet("ملخص", { views: [{ rightToLeft: true }] });
  let row = 1;

  summaryWs.getCell(row, 1).value = "تقرير ملخّص";
  summaryWs.getCell(row, 1).font = { bold: true, size: 16, color: { argb: "FF0F172A" } };
  summaryWs.mergeCells(row, 1, row, 3);
  row += 1;

  summaryWs.getCell(row, 1).value = "الفرع";
  summaryWs.getCell(row, 2).value = input.branchLabel.trim() || "—";
  row += 1;
  summaryWs.getCell(row, 1).value = "الفترة";
  summaryWs.getCell(row, 2).value = input.periodTitle;
  row += 1;
  summaryWs.getCell(row, 1).value = "تاريخ التصدير";
  summaryWs.getCell(row, 2).value = new Date().toLocaleString("ar-EG", {
    dateStyle: "full",
    timeStyle: "short",
  });
  row += 2;

  const kpiHeaders = ["المؤشر", "القيمة"];
  addTableHeader(summaryWs, row, kpiHeaders, [28, 18]);
  const kpiStart = row;
  row += 1;

  const kpis = [
    ["عدد التقارير", input.summary.count],
    ["إجمالي المبالغ", input.summary.totalAmount],
    ["إجمالي العمولة", input.summary.totalCommission],
    ["متوسط المبلغ", input.summary.avgAmount],
  ];

  for (const [label, value] of kpis) {
    summaryWs.getCell(row, 1).value = label;
    const valCell = summaryWs.getCell(row, 2);
    valCell.value = value;
    if (typeof value === "number" && label !== "عدد التقارير") {
      valCell.numFmt = NUM_FMT;
    }
    styleDataRow(summaryWs, row, 2);
    row += 1;
  }
  summaryWs.views = [{ rightToLeft: true, state: "frozen", ySplit: kpiStart }];

  /**
   * @param {string} title
   * @param {Array<{ label: string; count: number; volume: number }>} data
   */
  const addBreakdown = (title, data) => {
    row += 1;
    summaryWs.getCell(row, 1).value = title;
    summaryWs.getCell(row, 1).font = { bold: true, size: 12 };
    row += 1;
    const headers = ["البند", "العدد", "المبلغ"];
    const headerRow = row;
    addTableHeader(summaryWs, headerRow, headers, [24, 10, 14]);
    row += 1;
    if (data.length === 0) {
      summaryWs.getCell(row, 1).value = "—";
      summaryWs.mergeCells(row, 1, row, 3);
      row += 1;
      return;
    }
    for (const item of data) {
      summaryWs.getCell(row, 1).value = item.label;
      summaryWs.getCell(row, 2).value = item.count;
      summaryWs.getCell(row, 3).value = item.volume;
      summaryWs.getCell(row, 3).numFmt = NUM_FMT;
      styleDataRow(summaryWs, row, 3);
      row += 1;
    }
  };

  addBreakdown("حسب نوع العملية", input.summary.byType);
  addBreakdown("حسب الهاتف", input.summary.byPhone);
  addBreakdown("أعلى الأرقام", input.summary.topPhones);

  const reportsWs = wb.addWorksheet("التقارير");
  const reportHeaders = [
    "التاريخ",
    "النوع",
    "المبلغ",
    "العمولة",
    "الهاتف",
    "المستلم",
    "المنفّذ",
    "ملاحظات",
    "الفرع",
  ];
  const reportWidths = [20, 14, 12, 12, 14, 16, 14, 24, 12];
  addTableHeader(reportsWs, 1, reportHeaders, reportWidths);

  let dataRow = 2;
  for (const report of input.reports) {
    reportsWs.getCell(dataRow, 1).value = formatReportDate(report);
    reportsWs.getCell(dataRow, 2).value = getOpType(report) || "—";
    reportsWs.getCell(dataRow, 3).value = getOpAmount(report);
    reportsWs.getCell(dataRow, 3).numFmt = NUM_FMT;
    reportsWs.getCell(dataRow, 4).value = getOpCommission(report);
    reportsWs.getCell(dataRow, 4).numFmt = NUM_FMT;
    reportsWs.getCell(dataRow, 5).value = asString(report.phone) || "—";
    reportsWs.getCell(dataRow, 6).value = asString(report.receiver) || "—";
    reportsWs.getCell(dataRow, 7).value = asString(report.userName) || "—";
    reportsWs.getCell(dataRow, 8).value = asString(report.notes) || "—";
    reportsWs.getCell(dataRow, 9).value = asString(report.shop) || "—";
    styleDataRow(reportsWs, dataRow, reportHeaders.length);
    dataRow += 1;
  }

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const filename = buildReportExportFilename({
    branchLabel: input.branchLabel,
    extension: "xlsx",
  });

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
