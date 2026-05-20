"use client";

import { Building2, Wallet, PiggyBank } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * @param {{
 *   cash: number;
 *   sourcesTotal: number;
 *   capital: number;
 *   loading?: boolean;
 * }} props
 */
export function CapitalCards({ cash, sourcesTotal, capital, loading }) {
  const items = [
    { title: "رأس المال", value: capital.toFixed(2), icon: Building2 },
    { title: "النقدي", value: cash.toFixed(2), icon: Wallet },
    { title: "إجمالي رصيد الوسائل", value: sourcesTotal.toFixed(2), icon: PiggyBank },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-3">
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
