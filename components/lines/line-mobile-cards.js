"use client";

import { Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * @param {{
 *   rows: Array<Record<string, unknown> & { id: string }>;
 *   columns: Array<{ key: string; header: string; format?: (v: unknown) => string; phoneLatin?: boolean; dateLatin?: boolean }>;
 *   cellValue: (row: Record<string, unknown> & { id: string }, col: { key: string; header: string; format?: (v: unknown) => string }) => string;
 *   onEdit: (row: Record<string, unknown> & { id: string }) => void;
 *   onDelete: (row: Record<string, unknown> & { id: string }) => void;
 *   primaryKeys?: string[];
 * }} props
 */
export function LineMobileCards({
  rows,
  columns,
  cellValue,
  onEdit,
  onDelete,
  primaryKeys = ["phone", "name", "amount", "dailyWithdraw", "withdrawLimit"],
}) {

  return (
    <div className="flex flex-col gap-3 md:hidden">
      {rows.map((row) => (
        <article
          key={row.id}
          className="w-full rounded-xl border border-border/60 bg-card p-4 shadow-[var(--shadow-card)]"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-3">
              {primaryKeys.map((key) => {
                const col = columns.find((c) => c.key === key);
                if (!col) return null;
                return (
                  <div key={key} className="flex justify-between gap-2 text-sm">
                    <span className="shrink-0 text-muted-foreground">{col.header}</span>
                    <span className={cn("tabular-nums text-end font-medium", col.phoneLatin && "font-mono")}>
                      {cellValue(row, col)}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="flex shrink-0 gap-1">
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(row)} aria-label="تعديل">
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive"
                onClick={() => onDelete(row)}
                aria-label="حذف"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
