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
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">لا توجد بيانات.</p>
        ) : (
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
        )}
      </CardContent>
    </Card>
  );
}
