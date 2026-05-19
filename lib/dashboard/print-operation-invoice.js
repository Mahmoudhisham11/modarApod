import { OPERATION_TYPE_LABEL, SOURCE_KIND_LABEL } from "@/lib/operations/constants";

/** @param {unknown} v */
function asString(v) {
  if (v === null || v === undefined) return "";
  return String(v);
}

/** @param {unknown} ts */
function opCreatedAtToDate(ts) {
  if (ts && typeof ts === "object" && "toDate" in ts && typeof ts.toDate === "function") {
    return ts.toDate();
  }
  if (ts instanceof Date) return ts;
  return new Date(0);
}

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
 * @param {Record<string, unknown> & { id?: string }} op
 * @param {{ branchLabel?: string }} options
 */
export function buildOperationInvoiceHtml(op, options) {
  const branchLabel = (options?.branchLabel ?? "").trim() || "—";

  const id = escapeHtml(asString(op.id));
  const created = opCreatedAtToDate(op.createdAt);
  const dateStr =
    created.getTime() === 0
      ? "—"
      : escapeHtml(created.toLocaleString("ar-EG", { dateStyle: "full", timeStyle: "short" }));

  const typeKey = asString(op.type ?? op.operationType);
  const typeLabel = escapeHtml(OPERATION_TYPE_LABEL[/** @type {keyof typeof OPERATION_TYPE_LABEL} */ (typeKey)] ?? typeKey);

  const st = asString(op.sourceType);
  const stLabel = escapeHtml(SOURCE_KIND_LABEL[/** @type {keyof typeof SOURCE_KIND_LABEL} */ (st)] ?? st);

  const src = op.source && typeof op.source === "object" ? /** @type {Record<string, unknown>} */ (op.source) : {};
  const sourceName = escapeHtml(asString(src.name));
  const sourcePhone = escapeHtml(asString(src.phone));
  const sourceId = escapeHtml(asString(op.sourceId));

  const val = Number(op.operationVal ?? op.amount ?? 0);
  const valStr = escapeHtml(Number.isFinite(val) ? val.toFixed(2) : "0");
  const com = Number(op.commation ?? op.commission ?? 0);
  const comStr = escapeHtml(Number.isFinite(com) ? com.toFixed(2) : "0");

  const receiver = escapeHtml(asString(op.receiver));
  const phone = escapeHtml(asString(op.phone));
  const notes = escapeHtml(asString(op.notes));
  const userName = escapeHtml(asString(op.userName));
  const shopInDoc = escapeHtml(asString(op.shop));

  const targetId = asString(op.targetId);
  const extraRows = [];
  if (targetId) {
    extraRows.push(
      `<tr><th>ماكينة الهدف</th><td>${escapeHtml(targetId)}</td></tr>`,
      `<tr><th>رصيد الهدف قبل</th><td>${escapeHtml(asString(op.beforeBalanceTarget))}</td></tr>`,
      `<tr><th>رصيد الهدف بعد</th><td>${escapeHtml(asString(op.afterBalanceTarget))}</td></tr>`,
    );
  }

  const printedAt = escapeHtml(new Date().toLocaleString("ar-EG", { dateStyle: "full", timeStyle: "short" }));

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>فاتورة عملية ${id}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 24px;
      font-family: system-ui, "Segoe UI", Tahoma, Arial, sans-serif;
      font-size: 14px;
      line-height: 1.5;
      color: #111;
      background: #fafafa;
    }
    .sheet {
      max-width: 720px;
      margin: 0 auto;
      background: #fff;
      border: 1px solid #e5e5e5;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0,0,0,.06);
    }
    .brand {
      padding: 20px 24px;
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      color: #f8fafc;
    }
    .brand h1 { margin: 0; font-size: 1.25rem; font-weight: 700; letter-spacing: -0.02em; }
    .brand .sub { margin: 6px 0 0; font-size: 0.8rem; opacity: 0.85; }
    .branch {
      margin-top: 14px;
      padding: 12px 16px;
      background: rgba(255,255,255,.1);
      border-radius: 8px;
      font-size: 1.05rem;
      font-weight: 600;
    }
    .branch span { opacity: 0.75; font-weight: 500; font-size: 0.85rem; display: block; margin-bottom: 4px; }
    .title {
      padding: 16px 24px 0;
      font-size: 1.1rem;
      font-weight: 600;
      color: #0f172a;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 12px 0 20px;
    }
    th, td {
      text-align: start;
      padding: 10px 24px;
      border-bottom: 1px solid #f1f5f9;
      vertical-align: top;
    }
    th {
      width: 34%;
      font-weight: 600;
      color: #64748b;
      font-size: 0.8rem;
      text-transform: none;
    }
    td { color: #0f172a; font-variant-numeric: tabular-nums; }
    tr:last-child th, tr:last-child td { border-bottom: none; }
    .footer {
      padding: 16px 24px 20px;
      font-size: 0.75rem;
      color: #94a3b8;
      border-top: 1px solid #f1f5f9;
    }
    @media print {
      body { padding: 0; background: #fff; }
      .sheet { border: none; border-radius: 0; box-shadow: none; max-width: none; }
      .brand { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="brand">
      <h1>سند عملية</h1>
      <p class="sub">فاتورة</p>
      <div class="branch"><span>الفرع</span>${escapeHtml(branchLabel)}</div>
    </div>
    <p class="title">تفاصيل العملية</p>
    <table>
      <tbody>
        <tr><th>رقم العملية</th><td>${id}</td></tr>
        <tr><th>التاريخ والوقت</th><td>${dateStr}</td></tr>
        <tr><th>نوع العملية</th><td>${typeLabel}</td></tr>
        <tr><th>نوع الوسيلة</th><td>${stLabel}</td></tr>
        <tr><th>معرّف الوسيلة</th><td>${sourceId}</td></tr>
        <tr><th>اسم الوسيلة</th><td>${sourceName || "—"}</td></tr>
        <tr><th>هاتف الوسيلة</th><td>${sourcePhone || "—"}</td></tr>
        <tr><th>المبلغ</th><td>${valStr}</td></tr>
        <tr><th>العمولة</th><td>${comStr}</td></tr>
        <tr><th>المستلم / العميل</th><td>${receiver || "—"}</td></tr>
        <tr><th>هاتف مسجّل</th><td>${phone || "—"}</td></tr>
        <tr><th>ملاحظات</th><td>${notes || "—"}</td></tr>
        <tr><th>منفّذ العملية</th><td>${userName || "—"}</td></tr>
        <tr><th>معرّف الفرع في السجل</th><td>${shopInDoc || "—"}</td></tr>
        ${extraRows.join("")}
      </tbody>
    </table>
    <div class="footer">تاريخ الطباعة: ${printedAt}</div>
  </div>
</body>
</html>`;
}

/**
 * @param {Record<string, unknown> & { id?: string }} op
 * @param {{ branchLabel?: string }} [options]
 * @returns {boolean} false إذا تعذّر إنشاء إطار الطباعة
 */
export function printOperationInvoice(op, options) {
  if (typeof window === "undefined" || !document.body) return false;

  const html = buildOperationInvoiceHtml(op, options ?? {});

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.setAttribute("tabindex", "-1");
  Object.assign(iframe.style, {
    position: "fixed",
    inset: "0",
    width: "1px",
    height: "1px",
    margin: "-1px",
    border: "0",
    clipPath: "inset(50%)",
    overflow: "hidden",
    pointerEvents: "none",
  });

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    try {
      iframe.remove();
    } catch {
      /* ignore */
    }
  };

  document.body.appendChild(iframe);

  const win = iframe.contentWindow;
  const doc = iframe.contentDocument;
  if (!win || !doc) {
    cleanup();
    return false;
  }

  doc.open();
  doc.write(html);
  doc.close();

  window.setTimeout(() => {
    try {
      win.focus();
      win.print();
    } catch {
      cleanup();
      return;
    }
    const onAfterPrint = () => {
      win.removeEventListener("afterprint", onAfterPrint);
      cleanup();
    };
    win.addEventListener("afterprint", onAfterPrint);
    window.setTimeout(() => {
      if (!cleaned) cleanup();
    }, 2000);
  }, 200);

  return true;
}
