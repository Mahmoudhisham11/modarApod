"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * @param {{ dailySeries: Array<{ dateKey: string; volume: number; commission: number; count: number }> }} props
 */
export function ReportDailyChart({ dailySeries }) {
  if (!dailySeries.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">النشاط اليومي</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">لا توجد بيانات يومية في هذه الفترة.</p>
        </CardContent>
      </Card>
    );
  }

  const maxVal = Math.max(...dailySeries.flatMap((d) => [d.volume, d.commission]), 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium">النشاط اليومي (آخر {dailySeries.length} يوم)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {dailySeries.map((day) => {
          const volPct = Math.round((day.volume / maxVal) * 100);
          const comPct = Math.round((day.commission / maxVal) * 100);
          return (
            <div key={day.dateKey} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{day.dateKey}</span>
                <span className="tabular-nums">{day.count} تقرير</span>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-14 shrink-0 text-xs">مبلغ</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary/70" style={{ width: `${volPct}%` }} />
                  </div>
                  <span className="w-16 shrink-0 text-end text-xs tabular-nums">{day.volume.toFixed(2)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-14 shrink-0 text-xs">عمولة</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-emerald-500/80" style={{ width: `${comPct}%` }} />
                  </div>
                  <span className="w-16 shrink-0 text-end text-xs tabular-nums">{day.commission.toFixed(2)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
