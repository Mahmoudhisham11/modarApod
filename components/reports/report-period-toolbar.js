"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/** @typedef {"today" | "week" | "month" | "all" | "custom"} ReportPeriodPreset */

const PRESETS = [
  { id: "today", label: "اليوم" },
  { id: "week", label: "هذا الأسبوع" },
  { id: "month", label: "هذا الشهر" },
  { id: "all", label: "الكل" },
  { id: "custom", label: "مخصص" },
];

/**
 * @param {{
 *   preset: ReportPeriodPreset;
 *   onPresetChange: (p: ReportPeriodPreset) => void;
 *   dateFrom: string;
 *   dateTo: string;
 *   onDateFromChange: (v: string) => void;
 *   onDateToChange: (v: string) => void;
 * }} props
 */
export function ReportPeriodToolbar({
  preset,
  onPresetChange,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onPresetChange(/** @type {ReportPeriodPreset} */ (p.id))}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
              preset === p.id
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-foreground hover:bg-muted",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
      {preset === "custom" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="report-from">من تاريخ</Label>
            <Input id="report-from" type="date" value={dateFrom} onChange={(e) => onDateFromChange(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="report-to">إلى تاريخ</Label>
            <Input id="report-to" type="date" value={dateTo} onChange={(e) => onDateToChange(e.target.value)} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
