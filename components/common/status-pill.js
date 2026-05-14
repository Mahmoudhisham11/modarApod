import { cn } from "@/lib/utils";

const toneMap = {
  success: "bg-success/15 text-success",
  warning: "bg-warning/20 text-warning-foreground",
  muted: "bg-muted text-muted-foreground",
  destructive: "bg-destructive/15 text-destructive",
};

/**
 * @param {{ children: import("react").ReactNode; tone?: keyof typeof toneMap }} props
 */
export function StatusPill({ children, tone = "muted" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        toneMap[tone] ?? toneMap.muted,
      )}
    >
      {children}
    </span>
  );
}

/** @param {string} status */
export function statusToneFromArabic(status) {
  if (status === "مكتمل" || status === "نشط") return "success";
  if (status === "قيد المراجعة" || status === "تحذير رصيد") return "warning";
  if (status === "صيانة" || status === "معلّق") return "muted";
  return "muted";
}
