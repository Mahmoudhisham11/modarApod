"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Receipt } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

/**
 * @param {{
 *   debtId: string;
 *   customerName: string;
 *   children: import("react").ReactNode;
 * }} props
 */
export function DebtReportDialog({ debtId, customerName, children }) {
  const [open, setOpen] = useState(false);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const filteredPayments = useMemo(() => {
    if (dateFrom || dateTo) {
      const from = dateFrom ? new Date(dateFrom + "T00:00:00") : null;
      const to = dateTo ? new Date(dateTo + "T23:59:59") : null;
      return payments.filter((p) => {
        const ts = p.createdAt?.toDate?.() ?? new Date(p.createdAt);
        if (from && ts < from) return false;
        if (to && ts > to) return false;
        return true;
      });
    }
    return payments;
  }, [payments, dateFrom, dateTo]);

  const loadPayments = useCallback(async () => {
    setLoading(true);
    try {
      const { fetchDebtPayments } = await import("@/lib/debts/debts-service");
      const data = await fetchDebtPayments(debtId);
      setPayments(data);
    } catch {
      setPayments([]);
    } finally {
      setLoading(false);
    }
  }, [debtId]);

  useEffect(() => {
    if (open) void loadPayments();
  }, [open, loadPayments]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" aria-hidden />
            تقارير السداد — {customerName}
          </DialogTitle>
          <DialogDescription>سجل جميع المدفوعات لهذا الدين.</DialogDescription>
        </DialogHeader>

        <div className="flex gap-2 pb-2">
          <div className="flex-1">
            <label className="mb-1 block text-xs text-muted-foreground">من تاريخ</label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs text-muted-foreground">إلى تاريخ</label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          {(dateFrom || dateTo) ? (
            <Button variant="ghost" size="sm" className="self-end" onClick={() => { setDateFrom(""); setDateTo(""); }}>
              إلغاء
            </Button>
          ) : null}
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-8 animate-pulse rounded bg-muted" />
            ))}
          </div>
        ) : filteredPayments.length === 0 ? (
          <p className="text-sm text-muted-foreground">{dateFrom || dateTo ? "لا توجد مدفوعات في الفترة المحددة." : "لا توجد مدفوعات مسجلة بعد."}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>التاريخ</TableHead>
                <TableHead>المبلغ</TableHead>
                <TableHead>طريقة الدفع</TableHead>
                <TableHead>ملاحظات</TableHead>
                <TableHead>المسدد</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPayments.map((p) => {
                const ts = p.createdAt?.toDate?.() ?? new Date(p.createdAt);
                return (
                  <TableRow key={p.id}>
                    <TableCell className="text-nowrap">
                      {ts.toLocaleDateString("ar-EG", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </TableCell>
                    <TableCell className="font-mono tabular-nums">
                      {Number(p.amount).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {p.paymentMethod === "cash" ? "نقدي" : p.paymentMethod === "wallet" ? "محفظة" : "—"}
                    </TableCell>
                    <TableCell className="max-w-[120px] truncate text-muted-foreground">
                      {p.note ? p.note : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.createdBy ?? "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        {filteredPayments.length > 0 ? (
          <div className="flex justify-between rounded-lg border border-border bg-muted/30 px-4 py-2 text-sm">
            <span className="text-muted-foreground">إجمالي المدفوعات</span>
            <span className="font-mono font-semibold tabular-nums">
              {filteredPayments.reduce((s, p) => s + Number(p.amount), 0).toFixed(2)}
            </span>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
