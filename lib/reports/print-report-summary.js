import { buildReportSummaryHtml } from "./report-export-html";

export { buildReportSummaryHtml };

/**
 * @param {Parameters<typeof buildReportSummaryHtml>[0]} input
 * @returns {boolean}
 */
export function printReportSummary(input) {
  if (typeof window === "undefined" || !document.body) return false;

  const html = buildReportSummaryHtml(input);

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
