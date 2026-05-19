"use client";

import { asString, getOpAmount, getOpCommission, getOpType, opToDate } from "@/lib/dashboard/operation-display";
import { OPERATION_TYPE_LABEL } from "@/lib/operations/constants";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { ReportsListCards } from "./reports-list-cards";

/**
 * @param {{ reports: Array<Record<string, unknown> & { id?: string }> }} props
 */
export function ReportsListTable({ reports }) {
  return (
    <Card className="border-border/60 shadow-[var(--shadow-card)]">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">سجل التقارير</CardTitle>
      </CardHeader>
      <CardContent>
        {reports.length === 0 ? (
          <p className="text-sm text-muted-foreground">لا توجد تقارير.</p>
        ) : (
          <>
            <ReportsListCards reports={reports} />
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>التاريخ</TableHead>
                    <TableHead>النوع</TableHead>
                    <TableHead>المبلغ</TableHead>
                    <TableHead>عمولة</TableHead>
                    <TableHead>الهاتف</TableHead>
                    <TableHead>المستلم</TableHead>
                    <TableHead>المنفّذ</TableHead>
                    <TableHead>ملاحظات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reports.map((row) => {
                    const id = asString(row.id);
                    const created = opToDate(row.createdAt);
                    const dateLabel =
                      created.getTime() === 0
                        ? "—"
                        : created.toLocaleString("ar-EG", { dateStyle: "short", timeStyle: "short" });
                    const typeKey = getOpType(row);
                    const typeLabel =
                      OPERATION_TYPE_LABEL[/** @type {keyof typeof OPERATION_TYPE_LABEL} */ (typeKey)] ?? typeKey;
                    const amt = getOpAmount(row);
                    const com = getOpCommission(row);
                    const archived = row.archivedAt;
                    const archivedLabel =
                      archived && typeof archived === "string"
                        ? archived
                        : archived && typeof archived === "object" && "toDate" in archived
                          ? opToDate(archived).toLocaleString("ar-EG", { dateStyle: "short", timeStyle: "short" })
                          : null;

                    return (
                      <TableRow key={id}>
                        <TableCell className="whitespace-nowrap">
                          <div className="flex flex-col">
                            <span>{dateLabel}</span>
                            {archivedLabel ? (
                              <span className="text-xs text-muted-foreground">أرشفة: {archivedLabel}</span>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell>{typeLabel}</TableCell>
                        <TableCell className="tabular-nums">{amt.toFixed(2)}</TableCell>
                        <TableCell className="tabular-nums">{com.toFixed(2)}</TableCell>
                        <TableCell className="whitespace-nowrap">{asString(row.phone) || "—"}</TableCell>
                        <TableCell>{asString(row.receiver) || "—"}</TableCell>
                        <TableCell>{asString(row.userName) || "—"}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{asString(row.notes) || "—"}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
