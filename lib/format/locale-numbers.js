/**
 * عرض أرقام بأرقام لاتينية (en-US) — مناسب للجداول والمبالغ.
 * @param {unknown} value
 * @param {{ minimumFractionDigits?: number; maximumFractionDigits?: number }} [opts]
 */
export function formatEnglishNumber(value, opts) {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  return n.toLocaleString("en-US", {
    maximumFractionDigits: 2,
    ...opts,
  });
}

/** تحويل الأرقام العربية/الفارسية إلى أرقام لاتينية للعرض */
export function normalizeDigitsToLatin(input) {
  if (input === null || input === undefined) return "";
  const s = String(input);
  const map = {
    "٠": "0",
    "١": "1",
    "٢": "2",
    "٣": "3",
    "٤": "4",
    "٥": "5",
    "٦": "6",
    "٧": "7",
    "٨": "8",
    "٩": "9",
    "۰": "0",
    "۱": "1",
    "۲": "2",
    "۳": "3",
    "۴": "4",
    "۵": "5",
    "۶": "6",
    "۷": "7",
    "۸": "8",
    "۹": "9",
  };
  return s.replace(/[٠-٩۰-۹]/g, (ch) => map[ch] ?? ch);
}
