/**
 * تطبيع رقم الخط للمقارنة عند منع التكرار (أرقام فقط + معالجة بادئة مصر).
 * @param {unknown} input
 */
export function normalizeLinePhoneForDedup(input) {
  let d = String(input ?? "").replace(/\D/g, "");
  if (d.startsWith("20") && d.length >= 12) d = d.slice(2);
  if (d.startsWith("0") && d.length >= 11) d = d.slice(1);
  return d;
}

/**
 * @param {Array<{ id: string; phone?: unknown }>} rows
 * @param {string} phone
 * @param {string | undefined} excludeDocId مستند يُستثنى (وضع التعديل)
 */
export function isLinePhoneTaken(rows, phone, excludeDocId) {
  const target = normalizeLinePhoneForDedup(phone);
  if (!target) return false;
  return rows.some((r) => {
    if (excludeDocId && r.id === excludeDocId) return false;
    return normalizeLinePhoneForDedup(r.phone) === target;
  });
}
