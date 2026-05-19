"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

/**
 * @param {{
 *   title: string;
 *   rows: Array<{ label: string; count: number; volume: number }>;
 *   nameColumn?: string;
 * }} props
 */
export function ReportBreakdownTable({ title, rows, nameColumn = "البند" }) {
  return (
    <Card className="border-border/60 shadow-[var(--shadow-card)]">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">لا توجد بيانات.</p>
        ) : (
          <>
            <div className="divide-y divide-border md:hidden">
              {rows.map((row) => (
                <div key={row.label} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
                  <p className="font-medium text-foreground">{row.label}</p>
                  <div className="flex justify-between text-sm tabular-nums text-muted-foreground">
                    <span>العدد: {row.count}</span>
                    <span>المبلغ: {row.volume.toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{nameColumn}</TableHead>
                    <TableHead>العدد</TableHead>
                    <TableHead>إجمالي المبلغ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.label}>
                      <TableCell>{row.label}</TableCell>
                      <TableCell className="tabular-nums">{row.count}</TableCell>
                      <TableCell className="tabular-nums">{row.volume.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
