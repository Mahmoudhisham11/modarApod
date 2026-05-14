/** تبويبات الصفحة الرئيسية: اتصالات / انستاباي / ماكينات */
export const LINES_HUB_TABS = [
  { id: "telecom", label: "الاتصالات" },
  { id: "instapay", label: "انستاباي" },
  { id: "machines", label: "الماكينات" },
];

/** مرجع قديم لعرض channelType في بيانات قديمة (لا تُعرض كتبويب في الواجهة) */
export const LINE_CHANNEL_TABS = [
  { id: "all", label: "كل الخطوط" },
  { id: "telecom", label: "الاتصالات" },
  { id: "instapay", label: "انستاباي" },
  { id: "machines", label: "الماكينات" },
  { id: "bank_cards", label: "البطاقات البنكية" },
];

/** @param {string} channelId */
export function channelLabel(channelId) {
  const id = typeof channelId === "string" ? channelId : "";
  const t = LINE_CHANNEL_TABS.find((x) => x.id === id);
  if (t) return t.label;
  return id || "—";
}
