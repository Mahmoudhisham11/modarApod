"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, HandCoins, ImageIcon, Plus, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { useFeatureLock } from "@/hooks/use-feature-lock";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import { AddDebtDialog } from "./add-debt-dialog";
import { DebtPaymentDialog } from "./debt-payment-dialog";
import { DebtReportDialog } from "./debt-report-dialog";

/**
 * @param {{
 *   shop: string;
 *   userEmail: string;
 * }} props
 */
export function DebtsPageClient({ shop, userEmail }) {
  const { loading: lockLoading, authorized } = useFeatureLock(userEmail, "debts");
  const [debts, setDebts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(/** @type {{ id: string; imageUrl?: string } | null} */ (null));
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [previewImage, setPreviewImage] = useState(/** @type {string | null} */ (null));

  const loadDebts = useCallback(async () => {
    const { fetchDebtsByShop } = await import("@/lib/debts/debts-service");
    try {
      const data = await fetchDebtsByShop(shop.trim());
      setDebts(data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "حدث خطأ";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [shop]);

  useEffect(() => {
    void loadDebts();
  }, [loadDebts]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return debts;
    return debts.filter(
      (d) =>
        (typeof d.customerName === "string" ? d.customerName : "").toLowerCase().includes(q),
    );
  }, [debts, search]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    try {
      const { deleteDebt } = await import("@/lib/debts/debts-service");
      await deleteDebt(deleteTarget.id, deleteTarget);
      setDebts((prev) => prev.filter((d) => d.id !== deleteTarget.id));
      toast.success("تم حذف الدين بنجاح.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "حدث خطأ";
      toast.error(msg);
    } finally {
      setDeleteBusy(false);
      setDeleteTarget(null);
    }
  };

  const handlePaymentDone = (debtId, newRemaining) => {
    setDebts((prev) =>
      prev.map((d) => (d.id === debtId ? { ...d, remaining: newRemaining } : d)),
    );
  };

  // Notify about due debts on load
  useEffect(() => {
    if (loading || debts.length === 0) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDebts = debts.filter((d) => {
      if (!d.dueDate || d.remaining <= 0) return false;
      const dd = new Date(d.dueDate + "T00:00:00");
      dd.setHours(0, 0, 0, 0);
      return dd <= today;
    });
    if (dueDebts.length > 0) {
      const names = dueDebts.map((d) => d.customerName).filter(Boolean).join("، ");
      toast.warning(`موعد سداد دين: ${names}`, { duration: 8000 });
    }
  }, [loading, debts]);

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      {!loading && debts.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                إجمالي الديون
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tabular-nums">
                {debts
                  .reduce((s, d) => s + Number(d.amount), 0)
                  .toFixed(2)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                المتبقي الكلي
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tabular-nums">
                {debts
                  .reduce((s, d) => s + Number(d.remaining ?? d.amount), 0)
                  .toFixed(2)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                عدد الديون
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tabular-nums">{debts.length}</p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <Card className="border-border/60 shadow-[var(--shadow-card)]">
        <CardHeader className="pb-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-base font-medium">سجل الديون</CardTitle>
            <AddDebtDialog
              shop={shop}
              userEmail={userEmail}
              onDebtCreated={() => void loadDebts()}
            >
              <Button size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" />
                دين جديد
              </Button>
            </AddDebtDialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="بحث باسم العميل..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="ps-9"
              />
            </div>
          </div>

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-12 animate-pulse rounded-md bg-muted"
                />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {debts.length === 0 ? "لا توجد ديون مسجلة." : "لا توجد نتائج للبحث."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>العميل</TableHead>
                  <TableHead>النوع</TableHead>
                  <TableHead>المبلغ</TableHead>
                  <TableHead>المتبقي</TableHead>
                  <TableHead>ملاحظات</TableHead>
                  <TableHead className="w-16">صورة</TableHead>
                  <TableHead className="w-32">موعد السداد</TableHead>
                  <TableHead className="w-28" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((debt) => {
                  const remaining = debt.remaining ?? debt.amount;
                  const isFullyPaid = remaining <= 0;
                  return (
                    <TableRow key={debt.id} className={cn(isFullyPaid && "opacity-50")}>
                      <TableCell className="font-medium">
                        {debt.customerName ?? ""}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={debt.type === "عليك" ? "destructive" : "default"}
                          className={cn(
                            debt.type === "ليك" &&
                              "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400",
                          )}
                        >
                          {debt.type === "ليك" ? "لك" : "عليك"}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono tabular-nums">
                        {Number(debt.amount).toFixed(2)}
                      </TableCell>
                      <TableCell className="font-mono tabular-nums">
                        {isFullyPaid ? (
                          <span className="text-emerald-600 dark:text-emerald-400">مدفوع بالكامل</span>
                        ) : (
                          Number(remaining).toFixed(2)
                        )}
                      </TableCell>
                      <TableCell className="max-w-[160px] truncate text-muted-foreground">
                        {debt.note ? debt.note : "—"}
                      </TableCell>
                      <TableCell>
                        {debt.imageUrl ? (
                          <button
                            type="button"
                            className="block overflow-hidden rounded-md border"
                            onClick={() => setPreviewImage(/** @type {string} */ (debt.imageUrl))}
                          >
                            <img
                              src={debt.imageUrl}
                              alt=""
                              className="h-10 w-10 object-cover"
                            />
                          </button>
                        ) : (
                          <span className="flex h-10 w-10 items-center justify-center rounded-md border border-dashed text-muted-foreground">
                            <ImageIcon className="h-4 w-4" />
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-nowrap">
                        {debt.dueDate ? (
                          (() => {
                            const dd = new Date(debt.dueDate + "T00:00:00");
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            const isOverdue = dd <= today && !isFullyPaid;
                            return (
                              <span
                                className={cn(
                                  "flex items-center justify-center gap-1 text-xs",
                                  isOverdue ? "font-semibold text-destructive" : "text-muted-foreground",
                                )}
                              >
                                {isOverdue ? <CalendarDays className="h-3 w-3" /> : null}
                                {dd.toLocaleDateString("ar-EG", { year: "numeric", month: "short", day: "numeric" })}
                              </span>
                            );
                          })()
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {!isFullyPaid ? (
                            <DebtPaymentDialog
                              debtId={debt.id}
                              customerName={debt.customerName ?? ""}
                              currentRemaining={remaining}
                              debtType={debt.type}
                              shop={shop}
                              userEmail={userEmail}
                              onPaymentDone={(newRemaining) => handlePaymentDone(debt.id, newRemaining)}
                            >
                              <Button variant="outline" size="sm" className="gap-1">
                                <HandCoins className="h-3.5 w-3.5" />
                                سداد
                              </Button>
                            </DebtPaymentDialog>
                          ) : null}
                          <DebtReportDialog debtId={debt.id} customerName={debt.customerName ?? ""}>
                            <Button variant="ghost" size="sm">
                              التقارير
                            </Button>
                          </DebtReportDialog>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDeleteTarget({ id: debt.id, imageUrl: debt.imageUrl })}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Delete confirmation */}
      <Dialog open={deleteTarget !== null} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" aria-hidden />
              حذف الدين
            </DialogTitle>
            <DialogDescription>
              هل أنت متأكد من حذف هذا الدين؟ سيتم حذف جميع سجلات السداد المرتبطة به أيضًا.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={deleteBusy} onClick={() => setDeleteTarget(null)}>
              إلغاء
            </Button>
            <Button type="button" variant="destructive" disabled={deleteBusy} onClick={() => void handleDelete()}>
              {deleteBusy ? "جاري الحذف…" : "حذف"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image preview */}
      {previewImage ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-h-full max-w-full">
            <button
              type="button"
              className="absolute -end-3 -top-3 flex h-8 w-8 items-center justify-center rounded-full bg-background shadow-md"
              onClick={() => setPreviewImage(null)}
            >
              <X className="h-4 w-4" />
            </button>
            <img
              src={previewImage}
              alt="صورة الدين"
              className="max-h-[80vh] max-w-full rounded-lg object-contain shadow-2xl"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
