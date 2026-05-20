"use client";

import { asString, getOpAmount, getOpCommission, getOpType, opToDate } from "@/lib/dashboard/operation-display";
import { OPERATION_TYPE_LABEL } from "@/lib/operations/constants";
import { getOperationTypeTheme } from "@/lib/ui/operation-type-theme";
import { cn } from "@/lib/utils";

/**
 * @param {{ reports: Array<Record<string, unknown> & { id?: string }> }} props
 */
export function ReportsListCards({ reports }) {
  if (reports.length === 0) {
    return <p className="text-sm text-muted-foreground">لا توجد تقارير.</p>;
  }

  return (
    <div className="flex flex-col gap-3 md:hidden">
      {reports.map((row) => {
        const id = asString(row.id);
        const created = opToDate(row.createdAt);
        const dateLabel =
          created.getTime() === 0
            ? "—"
            : created.toLocaleString("ar-EG", { dateStyle: "short", timeStyle: "short" });
        const typeKey = getOpType(row);
        const typeLabel = OPERATION_TYPE_LABEL[/** @type {keyof typeof OPERATION_TYPE_LABEL} */ (typeKey)] ?? typeKey;
        const theme = getOperationTypeTheme(typeKey);
        const amt = getOpAmount(row);
        const com = getOpCommission(row);

        return (
          <article
            key={id}
            className={cn(
              "relative w-full overflow-hidden rounded-xl border-2 p-4 shadow-[var(--shadow-card)]",
              theme.card,
            )}
          >
            <span className={cn("absolute inset-y-0 start-0 w-1", theme.accent)} aria-hidden />
            <div className="space-y-2 ps-2">
              <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium", theme.badge)}>
                {typeLabel}
              </span>
              <p className="text-xs text-muted-foreground">{dateLabel}</p>
              <p className="font-mono text-sm">{asString(row.phone) || "—"}</p>
              <div className="flex flex-wrap gap-3 text-sm tabular-nums">
                <span>مبلغ: {amt.toFixed(2)}</span>
                <span>الرسوم: {com.toFixed(2)}</span>
              </div>
              {asString(row.receiver) ? (
                <p className="text-xs text-muted-foreground">مستلم: {asString(row.receiver)}</p>
              ) : null}
              {asString(row.notes) ? (
                <p className="text-xs text-muted-foreground line-clamp-2">{asString(row.notes)}</p>
              ) : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}
