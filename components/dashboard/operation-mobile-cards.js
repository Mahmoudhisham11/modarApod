"use client";

import { Printer, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { OPERATION_TYPE_LABEL, SOURCE_KIND_LABEL } from "@/lib/operations/constants";
import { getOperationTypeTheme } from "@/lib/ui/operation-type-theme";
import { cn } from "@/lib/utils";

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

/**
 * @param {{
 *   operations: Array<Record<string, unknown> & { id?: string }>;
 *   hideMoney?: boolean;
 *   onPrint: (op: Record<string, unknown>) => void;
 *   onDelete: (payload: { id: string; label: string }) => void;
 * }} props
 */
export function OperationMobileCards({ operations, hideMoney = false, onPrint, onDelete }) {
  if (operations.length === 0) {
    return <p className="text-center text-sm text-muted-foreground">لا توجد عمليات مطابقة.</p>;
  }

  return (
    <div className="flex flex-col gap-3 md:hidden">
      {operations.map((op) => {
        const id = asString(op.id);
        const created = opCreatedAtToDate(op.createdAt);
        const dateLabel =
          created.getTime() === 0
            ? "—"
            : created.toLocaleString("ar-EG", { dateStyle: "short", timeStyle: "short" });
        const typeKey = asString(op.type ?? op.operationType);
        const typeLabel = OPERATION_TYPE_LABEL[/** @type {keyof typeof OPERATION_TYPE_LABEL} */ (typeKey)] ?? typeKey;
        const theme = getOperationTypeTheme(typeKey);
        const src = op.source && typeof op.source === "object" ? /** @type {Record<string, unknown>} */ (op.source) : {};
        const srcLabel = asString(src.name) || asString(op.sourceId);
        const st = asString(op.sourceType);
        const stLabel = SOURCE_KIND_LABEL[/** @type {keyof typeof SOURCE_KIND_LABEL} */ (st)] ?? st;
        const val = Number(op.operationVal ?? op.amount ?? 0);
        const valStr = Number.isFinite(val) ? val.toFixed(2) : "0";
        const com = Number(op.commation ?? op.commission ?? 0);
        const comStr = Number.isFinite(com) ? com.toFixed(2) : "0";

        return (
          <article
            key={id}
            className={cn(
              "relative w-full overflow-hidden rounded-xl border-2 p-4 shadow-[var(--shadow-card)]",
              theme.card,
            )}
          >
            <span className={cn("absolute inset-y-0 start-0 w-1", theme.accent)} aria-hidden />
            <div className="flex items-start justify-between gap-3 ps-2">
              <div className="min-w-0 flex-1 space-y-2">
                <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium", theme.badge)}>
                  {typeLabel}
                </span>
                <p className="text-xs text-muted-foreground">{dateLabel}</p>
                <div>
                  <p className="font-medium text-foreground">{srcLabel}</p>
                  <p className="text-xs text-muted-foreground">{stLabel}</p>
                </div>
                <div className="flex flex-wrap gap-4 text-sm tabular-nums">
                  <span>
                    <span className="text-muted-foreground">المبلغ: </span>
                    {hideMoney ? "••••" : valStr}
                  </span>
                  <span>
                    <span className="text-muted-foreground">الرسوم: </span>
                    {hideMoney ? "••••" : comStr}
                  </span>
                </div>
              </div>
              <div className="flex shrink-0 flex-col gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  title="طباعة"
                  aria-label="طباعة"
                  onClick={() => onPrint(op)}
                >
                  <Printer className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:bg-destructive/10"
                  title="حذف"
                  aria-label="حذف"
                  onClick={() =>
                    onDelete({
                      id,
                      label: `${typeLabel} — ${valStr} — ${srcLabel}`,
                    })
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
