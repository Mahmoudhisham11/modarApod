"use client";

import { BarChart3, CircleDollarSign, ListOrdered, Wallet } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * @param {{
 *   count: number;
 *   totalAmount: number;
 *   totalCommission: number;
 *   avgAmount: number;
 *   loading?: boolean;
 * }} props
 */
export function ReportKpiCards({ count, totalAmount, totalCommission, avgAmount, loading }) {
  const items = [
    { title: "عدد التقارير", value: String(count), icon: ListOrdered },
    { title: "إجمالي المبالغ", value: totalAmount.toFixed(2), icon: Wallet },
    { title: "إجمالي العمولة", value: totalCommission.toFixed(2), icon: CircleDollarSign },
    { title: "متوسط المبلغ", value: avgAmount.toFixed(2), icon: BarChart3 },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Card key={item.title} className="border-border/60 shadow-[var(--shadow-card)]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base font-medium">{item.title}</CardTitle>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Icon className="h-5 w-5" aria-hidden />
              </div>
            </CardHeader>
            <CardContent className="text-2xl font-semibold tabular-nums">
              {loading ? <span className="inline-block h-8 w-20 animate-pulse rounded bg-muted" /> : item.value}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
