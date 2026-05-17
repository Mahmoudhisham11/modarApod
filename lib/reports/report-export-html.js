const DEFAULT_APP_NAME = "مدار";

/** @param {string} s */
function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * @param {number} n
 */
function fmt(n) {
  const v = Number(n);
  return Number.isFinite(v) ? v.toFixed(2) : "0.00";
}

/**
 * @param {{
 *   branchLabel: string;
 *   periodTitle: string;
 *   summary: ReturnType<import("./report-aggregates").buildReportSummary>;
 *   appName?: string;
 * }} input
 */
export function buildReportSummaryHtml(input) {
  const appName = (input.appName ?? DEFAULT_APP_NAME).trim() || DEFAULT_APP_NAME;
  const branch = escapeHtml(input.branchLabel.trim() || "—");
  const period = escapeHtml(input.periodTitle);
  const s = input.summary;
  const exportedAt = escapeHtml(new Date().toLocaleString("ar-EG", { dateStyle: "full", timeStyle: "short" }));

  const typeRows = s.byType
    .map(
      (r) =>
        `<tr><td>${escapeHtml(r.label)}</td><td class="num">${r.count}</td><td class="num">${fmt(r.volume)}</td></tr>`,
    )
    .join("");

  const phoneRows = s.byPhone
    .map(
      (r) =>
        `<tr><td>${escapeHtml(r.label)}</td><td class="num">${r.count}</td><td class="num">${fmt(r.volume)}</td></tr>`,
    )
    .join("");

  const topRows = s.topPhones
    .map(
      (r) =>
        `<tr><td>${escapeHtml(r.label)}</td><td class="num">${r.count}</td><td class="num">${fmt(r.volume)}</td></tr>`,
    )
    .join("");

  const emptyRow = '<tr><td colspan="3" class="empty">—</td></tr>';

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8" />
  <title>تقرير ${period}</title>
  <style>
    * { box-sizing: border-box; }
    @page { margin: 14mm; }
    body {
      margin: 0;
      padding: 20px;
      font-family: system-ui, "Segoe UI", Tahoma, "Arial Unicode MS", Arial, sans-serif;
      font-size: 13px;
      color: #0f172a;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .sheet {
      max-width: 800px;
      margin: 0 auto;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      overflow: hidden;
      background: #fff;
    }
    .brand {
      padding: 20px 24px;
      background: #0f172a;
      color: #f8fafc;
    }
    .brand h1 { margin: 0; font-size: 1.2rem; font-weight: 700; }
    .brand .branch { margin-top: 10px; font-size: 1rem; font-weight: 600; }
    .brand .period { margin-top: 4px; font-size: 0.85rem; opacity: 0.92; }
    .brand .exported { margin-top: 6px; font-size: 0.78rem; opacity: 0.8; }
    .kpis {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      padding: 16px 24px;
      background: #f8fafc;
    }
    @media (max-width: 640px) {
      .kpis { grid-template-columns: repeat(2, 1fr); }
    }
    .kpi {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px 14px;
    }
    .kpi span { display: block; font-size: 0.72rem; color: #64748b; margin-bottom: 4px; }
    .kpi strong { font-size: 1.15rem; font-variant-numeric: tabular-nums; color: #0f172a; }
    h2 {
      margin: 20px 24px 8px;
      font-size: 0.95rem;
      color: #0f172a;
      border-inline-start: 3px solid #0f172a;
      padding-inline-start: 8px;
    }
    .table-wrap { padding: 0 24px 8px; page-break-inside: avoid; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 8px;
    }
    th, td {
      text-align: start;
      padding: 9px 10px;
      border-bottom: 1px solid #e2e8f0;
    }
    th {
      font-size: 0.75rem;
      color: #475569;
      background: #f1f5f9;
      font-weight: 600;
    }
    tbody tr:nth-child(even) td { background: #fafafa; }
    td.num { font-variant-numeric: tabular-nums; text-align: end; }
    td.empty { text-align: center; color: #94a3b8; }
    .footer {
      padding: 14px 24px;
      font-size: 0.75rem;
      color: #64748b;
      border-top: 1px solid #e2e8f0;
      background: #f8fafc;
    }
    .footer strong { color: #334155; }
    @media print {
      body { padding: 0; }
      .sheet { border: none; border-radius: 0; max-width: none; }
      .table-wrap, table { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div id="report-export-sheet" class="sheet">
    <div class="brand">
      <h1>${escapeHtml(appName)} — تقرير ملخّص</h1>
      <div class="branch">الفرع: ${branch}</div>
      <div class="period">الفترة: ${period}</div>
      <div class="exported">تاريخ التصدير: ${exportedAt}</div>
    </div>
    <div class="kpis">
      <div class="kpi"><span>عدد التقارير</span><strong>${s.count}</strong></div>
      <div class="kpi"><span>إجمالي المبالغ</span><strong>${fmt(s.totalAmount)}</strong></div>
      <div class="kpi"><span>إجمالي العمولة</span><strong>${fmt(s.totalCommission)}</strong></div>
      <div class="kpi"><span>متوسط المبلغ</span><strong>${fmt(s.avgAmount)}</strong></div>
    </div>
    <h2>حسب نوع العملية</h2>
    <div class="table-wrap">
      <table><thead><tr><th>النوع</th><th>العدد</th><th>المبلغ</th></tr></thead><tbody>${typeRows || emptyRow}</tbody></table>
    </div>
    <h2>حسب الهاتف</h2>
    <div class="table-wrap">
      <table><thead><tr><th>الهاتف</th><th>العدد</th><th>المبلغ</th></tr></thead><tbody>${phoneRows || emptyRow}</tbody></table>
    </div>
    <h2>أعلى الأرقام</h2>
    <div class="table-wrap">
      <table><thead><tr><th>الهاتف</th><th>العدد</th><th>المبلغ</th></tr></thead><tbody>${topRows || emptyRow}</tbody></table>
    </div>
    <div class="footer">
      <strong>ملاحظة:</strong> التفاصيل الكاملة متوفرة في ملف Excel.
    </div>
  </div>
</body>
</html>`;
}
