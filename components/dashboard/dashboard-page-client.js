"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CircleDollarSign, ListOrdered, PieChart, Printer, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { aggregateWithdrawDepositDayMonth } from "@/lib/dashboard/operation-aggregates";
import { printOperationInvoice } from "@/lib/dashboard/print-operation-invoice";
import {
  OPERATION_TYPE,
  OPERATION_TYPE_LABEL,
  SOURCE_KIND,
  SOURCE_KIND_LABEL,
} from "@/lib/operations/constants";
import { deleteOperationWithReversal } from "@/lib/operations/operations-service";

import { useShopOperations } from "./use-shop-operations";

const FILTER_ALL = "__all__";

/** @param {unknown} v */
function asString(v) {
  if (v === null || v === undefined) return "";
  return String(v);
}

/** @param {unknown} ts */
function opCreatedAtToDate(ts) {
  if (ts && typeof ts === "object" && "toDate" in ts && typeof ts.toDate === "function") {
    return ts.toDate();
  }
  if (ts instanceof Date) return ts;
  return new Date(0);
}

/** @param {Record<string, unknown>} op */
function operationSearchBlob(op) {
  const source = op.source && typeof op.source === "object" ? /** @type {Record<string, unknown>} */ (op.source) : {};
  return [
    asString(op.shop),
    asString(op.type),
    asString(op.operationType),
    asString(op.sourceType),
    asString(op.receiver),
    asString(op.phone),
    asString(op.notes),
    asString(op.userName),
    asString(source.name),
    asString(source.phone),
  ]
    .join(" ")
    .toLowerCase();
}

/** @param {unknown} err @param {string} [hint] */
function toastFirestoreError(err, hint) {
  let code = "";
  if (err && typeof err === "object" && "code" in err && err.code != null) {
    try {
      code = String(err.code);
    } catch {
      code = "";
    }
  }
  let message = "";
  try {
    if (err instanceof Error && err.message) message = String(err.message);
    else if (err && typeof err === "object" && "message" in err && err.message != null) message = String(err.message);
    else if (err != null && err !== undefined) message = String(err);
  } catch {
    message = "";
  }
  if (code === "permission-denied") {
    toast.error(hint ? `Firestore رفض الطلب (${hint}).` : "Firestore رفض الطلب. راجع قواعد الأمان.");
    return;
  }
  const trimmed = message.trim();
  if (trimmed) {
    toast.error(hint ? `${trimmed} (${hint})` : trimmed);
    return;
  }
  toast.error(hint ? `حدث خطأ (${hint})` : "حدث خطأ");
}

/**
 * @param {{ shop: string; branchLabel: string }} props
 */
export function DashboardPageClient({ shop, branchLabel }) {
  const { ops, loading, error, reload } = useShopOperations(shop);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState(FILTER_ALL);
  const [sourceTypeFilter, setSourceTypeFilter] = useState(FILTER_ALL);
  const [deleteTarget, setDeleteTarget] = useState(/** @type {{ id: string; label: string } | null} */ (null));
  const [deleteBusy, setDeleteBusy] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput.trim().toLowerCase()), 280);
    return () => clearTimeout(t);
  }, [searchInput]);

  const filteredOps = useMemo(() => {
    const s = shop.trim();
    if (!s) return [];
    return ops.filter((op) => {
      if (asString(op.shop).trim() !== s) return false;
      const t = asString(op.type ?? op.operationType);
      if (typeFilter !== FILTER_ALL && t !== typeFilter) return false;
      const st = asString(op.sourceType);
      if (sourceTypeFilter !== FILTER_ALL && st !== sourceTypeFilter) return false;
      if (debouncedSearch) {
        if (!operationSearchBlob(op).includes(debouncedSearch)) return false;
      }
      return true;
    });
  }, [ops, shop, typeFilter, sourceTypeFilter, debouncedSearch]);

  const kpisFiltered = useMemo(() => aggregateWithdrawDepositDayMonth(filteredOps), [filteredOps]);

  const totalCommissionFiltered = useMemo(() => {
    let sum = 0;
    for (const op of filteredOps) {
      const c = Number(op.commation ?? op.commission ?? 0);
      sum += Number.isFinite(c) ? c : 0;
    }
    return Math.round(sum * 100) / 100;
  }, [filteredOps]);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget || !shop.trim()) return;
    setDeleteBusy(true);
    try {
      await deleteOperationWithReversal({ shop: shop.trim(), operationId: deleteTarget.id });
      toast.success("تم حذف العملية وعكس التأثير على الوسيلة.");
      setDeleteTarget(null);
      await reload();
    } catch (e) {
      toastFirestoreError(e, "حذف عملية");
    } finally {
      setDeleteBusy(false);
    }
  }, [deleteTarget, shop, reload]);

  const handlePrintInvoice = useCallback(
    (op) => {
      const ok = printOperationInvoice(op, { branchLabel: branchLabel.trim() || shop.trim() });
      if (!ok) {
        toast.error("تعذّر إعداد الطباعة. أعد المحاولة.");
      }
    },
    [branchLabel, shop],
  );

  if (!shop.trim()) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>فرع غير معرّف</CardTitle>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-medium">العمليات</CardTitle>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <ListOrdered className="h-5 w-5" aria-hidden />
            </div>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">{filteredOps.length}</CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-medium">الأرباح</CardTitle>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <CircleDollarSign className="h-5 w-5" aria-hidden />
            </div>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">{totalCommissionFiltered.toFixed(2)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-medium">ليميت مستهلك (سحب/إيداع)</CardTitle>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <Wallet className="h-5 w-5" aria-hidden />
            </div>
          </CardHeader>
          <CardContent className="space-y-1 text-sm tabular-nums">
            <div>
              اليوم: سحب {kpisFiltered.dayWithdraw.toFixed(2)} — إيداع {kpisFiltered.dayDeposit.toFixed(2)}
            </div>
            <div>
              الشهر: سحب {kpisFiltered.monthWithdraw.toFixed(2)} — إيداع {kpisFiltered.monthDeposit.toFixed(2)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base font-medium">بحث وفلترة</CardTitle>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <PieChart className="h-5 w-5" aria-hidden />
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="dash-search">بحث</Label>
            <Input
              id="dash-search"
              placeholder="اسم الخط، هاتف، ملاحظات، نوع..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>نوع العملية</Label>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="الكل" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={FILTER_ALL}>الكل</SelectItem>
                {Object.values(OPERATION_TYPE).map((t) => (
                  <SelectItem key={t} value={t}>
                    {OPERATION_TYPE_LABEL[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>نوع الوسيلة</Label>
            <Select value={sourceTypeFilter} onValueChange={setSourceTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="الكل" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={FILTER_ALL}>الكل</SelectItem>
                <SelectItem value={SOURCE_KIND.TELECOM}>{SOURCE_KIND_LABEL.telecom}</SelectItem>
                <SelectItem value={SOURCE_KIND.INSTAPAY}>{SOURCE_KIND_LABEL.instapay}</SelectItem>
                <SelectItem value={SOURCE_KIND.MACHINE}>{SOURCE_KIND_LABEL.machine}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">قائمة العمليات</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="mb-3 text-sm text-muted-foreground">جاري التحميل…</p>
          ) : error ? (
            <p className="mb-3 text-sm text-destructive">تعذّر التحميل.</p>
          ) : null}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>التاريخ</TableHead>
                <TableHead>النوع</TableHead>
                <TableHead>الوسيلة</TableHead>
                <TableHead>المبلغ</TableHead>
                <TableHead>عمولة</TableHead>
                <TableHead className="min-w-[5.5rem] whitespace-nowrap">إجراء</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOps.map((op) => {
                const id = asString(op.id);
                const created = opCreatedAtToDate(op.createdAt);
                const dateLabel =
                  created.getTime() === 0 ? "—" : created.toLocaleString("ar-EG", { dateStyle: "short", timeStyle: "short" });
                const typeKey = asString(op.type ?? op.operationType);
                const typeLabel = OPERATION_TYPE_LABEL[/** @type {keyof typeof OPERATION_TYPE_LABEL} */ (typeKey)] ?? typeKey;
                const src = op.source && typeof op.source === "object" ? /** @type {Record<string, unknown>} */ (op.source) : {};
                const srcLabel = asString(src.name) || asString(op.sourceId);
                const st = asString(op.sourceType);
                const stLabel = SOURCE_KIND_LABEL[/** @type {keyof typeof SOURCE_KIND_LABEL} */ (st)] ?? st;
                const val = Number(op.operationVal ?? op.amount ?? 0);
                const valStr = Number.isFinite(val) ? val.toFixed(2) : "0";
                const com = Number(op.commation ?? op.commission ?? 0);
                const comStr = Number.isFinite(com) ? com.toFixed(2) : "0";
                return (
                  <TableRow key={id}>
                    <TableCell className="whitespace-nowrap">{dateLabel}</TableCell>
                    <TableCell>{typeLabel}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span>{srcLabel}</span>
                        <span className="text-xs text-muted-foreground">{stLabel}</span>
                      </div>
                    </TableCell>
                    <TableCell className="tabular-nums">{valStr}</TableCell>
                    <TableCell className="tabular-nums">{comStr}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 shrink-0"
                          title="طباعة فاتورة"
                          aria-label="طباعة فاتورة"
                          onClick={() => handlePrintInvoice(op)}
                        >
                          <Printer className="h-4 w-4" aria-hidden />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                          title="حذف العملية"
                          aria-label="حذف"
                          onClick={() =>
                            setDeleteTarget({
                              id,
                              label: `${typeLabel} — ${valStr} — ${srcLabel}`,
                            })
                          }
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {!loading && filteredOps.length === 0 && (
            <p className="mt-4 text-center text-sm text-muted-foreground">لا توجد عمليات مطابقة.</p>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && !deleteBusy && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تأكيد حذف العملية</DialogTitle>
            <DialogDescription>
              سيتم عكس الرصيد والحدود على الوسيلة المرتبطة ثم حذف السجل نهائيًا. {deleteTarget ? `(${deleteTarget.label})` : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={deleteBusy} onClick={() => setDeleteTarget(null)}>
              إلغاء
            </Button>
            <Button type="button" variant="destructive" disabled={deleteBusy} onClick={confirmDelete}>
              {deleteBusy ? "جاري الحذف…" : "حذف نهائي"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
