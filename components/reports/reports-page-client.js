"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useFeatureLock } from "@/hooks/use-feature-lock";
import { DollarSign, FileDown, FileSpreadsheet, Printer, RefreshCw, Trash2 } from "lucide-react";
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
import { asString } from "@/lib/dashboard/operation-display";
import {
  buildReportSummary,
  filterOperationsByPeriod,
  periodLabelAr,
} from "@/lib/reports/report-aggregates";
import { deleteReportById } from "@/lib/reports/reports-service";
import { downloadReportExcel } from "@/lib/reports/export-report-excel";
import { exportReportPdfViaPrint } from "@/lib/reports/export-report-pdf";
import { printReportSummary } from "@/lib/reports/print-report-summary";
import { fetchShopCapitalData } from "@/lib/shops/cash-service";

import { CashEditDialog } from "./cash-edit-dialog";
import { ReportBreakdownTable } from "./report-breakdown-table";
import { ReportDailyChart } from "./report-daily-chart";
import { ReportKpiCards } from "./report-kpi-cards";
import { ReportPeriodToolbar } from "./report-period-toolbar";
import { ReportsListTable } from "./reports-list-table";
import { useShopReports } from "./use-shop-reports";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fetchDebtPaymentsByShop } from "@/lib/debts/debts-service";

/**
 * @param {{ shop: string; branchLabel: string; userEmail: string }} props
 */
export function ReportsPageClient({ shop, branchLabel, userEmail }) {
  const { loading: lockLoading, authorized } = useFeatureLock(userEmail, "reports");
  const { reports, loading, error, reload } = useShopReports(shop);
  const [preset, setPreset] = useState(/** @type {"today" | "week" | "month" | "all" | "custom"} */ ("month"));
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [exportBusy, setExportBusy] = useState(/** @type {"excel" | null} */ (null));
  const [capitalData, setCapitalData] = useState({ cash: 0, sourcesTotal: 0, capital: 0 });
  const [capitalLoading, setCapitalLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState(/** @type {string | null} */ (null));
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [debtPayments, setDebtPayments] = useState([]);
  const [debtPaymentsLoading, setDebtPaymentsLoading] = useState(true);
  const [debtPaymentsError, setDebtPaymentsError] = useState(/** @type {string | null} */ (null));

  const loadCapital = useCallback(async () => {
    const s = shop.trim();
    if (!s) {
      setCapitalData({ cash: 0, sourcesTotal: 0, capital: 0 });
      setCapitalLoading(false);
      return;
    }
    setCapitalLoading(true);
    try {
      const data = await fetchShopCapitalData(s);
      setCapitalData(data);
    } catch {
      setCapitalData({ cash: 0, sourcesTotal: 0, capital: 0 });
    } finally {
      setCapitalLoading(false);
    }
  }, [shop]);

  const shopReports = useMemo(() => {
    const s = shop.trim();
    if (!s) return [];
    return reports.filter((r) => asString(r.shop).trim() === s);
  }, [reports, shop]);

  const periodReports = useMemo(() => {
    return filterOperationsByPeriod(shopReports, {
      preset,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    });
  }, [shopReports, preset, dateFrom, dateTo]);

  const summary = useMemo(() => buildReportSummary(periodReports), [periodReports]);

  const loadDebtPayments = useCallback(async () => {
    const s = shop.trim();
    if (!s) {
      setDebtPayments([]);
      setDebtPaymentsLoading(false);
      return;
    }
    setDebtPaymentsLoading(true);
    setDebtPaymentsError(null);
    try {
      const data = await fetchDebtPaymentsByShop(s);
      setDebtPayments(data);
    } catch (e) {
      setDebtPayments([]);
      setDebtPaymentsError(e instanceof Error ? e.message : "حدث خطأ في تحميل مدفوعات الديون");
    } finally {
      setDebtPaymentsLoading(false);
    }
  }, [shop]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void loadDebtPayments();
    }, 0);
    return () => window.clearTimeout(t);
  }, [loadDebtPayments]);

  const periodDebtPayments = useMemo(() => {
    return filterOperationsByPeriod(debtPayments, {
      preset,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    });
  }, [debtPayments, preset, dateFrom, dateTo]);

  const debtSummary = useMemo(() => {
    let totalAmount = 0;
    let cashCount = 0;
    let walletCount = 0;
    let cashTotal = 0;
    let walletTotal = 0;

    for (const p of periodDebtPayments) {
      const amt = Number(p.amount) || 0;
      totalAmount += amt;
      if (p.paymentMethod === "cash") {
        cashCount += 1;
        cashTotal += amt;
      } else {
        walletCount += 1;
        walletTotal += amt;
      }
    }

    return {
      count: periodDebtPayments.length,
      totalAmount,
      cashCount,
      cashTotal,
      walletCount,
      walletTotal,
      avgAmount: periodDebtPayments.length > 0 ? totalAmount / periodDebtPayments.length : 0,
    };
  }, [periodDebtPayments]);

  const periodTitle = useMemo(
    () => periodLabelAr(preset, { dateFrom, dateTo }),
    [preset, dateFrom, dateTo],
  );

  const exportLabel = branchLabel.trim() || shop.trim();

  const handlePrint = () => {
    const ok = printReportSummary({
      branchLabel: exportLabel,
      periodTitle,
      summary,
    });
    if (!ok) {
      toast.error("تعذّر إعداد الطباعة. أعد المحاولة.");
    }
  };

  const handleExportPdf = () => {
    if (exportBusy || periodReports.length === 0) return;
    const ok = exportReportPdfViaPrint({
      branchLabel: exportLabel,
      periodTitle,
      summary,
    });
    if (ok) {
      toast.info("في نافذة الطباعة اختر «حفظ كـ PDF» كوجهة أو الطابعة.");
    } else {
      toast.error("تعذّر فتح نافذة التصدير. أعد المحاولة.");
    }
  };

  const handleExportExcel = async () => {
    if (exportBusy || periodReports.length === 0) return;
    setExportBusy("excel");
    try {
      await downloadReportExcel({
        branchLabel: exportLabel,
        periodTitle,
        summary,
        reports: periodReports,
      });
      toast.success("تم حميل ملف Excel");
    } catch {
      toast.error("تعذّر تصدير Excel. أعد المحاولة.");
    } finally {
      setExportBusy(null);
    }
  };

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    try {
      await deleteReportById(deleteTarget);
      toast.success("تم حذف التقرير");
      setDeleteTarget(null);
      await reload();
    } catch {
      toast.error("تعذّر حذف التقرير. أعد المحاولة.");
    } finally {
      setDeleteBusy(false);
    }
  }, [deleteTarget, reload]);

  if (!shop.trim()) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>فرع غير معرّف</CardTitle>
        </CardHeader>
      </Card>
    );
  }

  if (lockLoading) {
    return <p className="text-sm text-muted-foreground">جاري التحقق من الصلاحية…</p>;
  }

  if (!authorized) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>لا يمكن عرض التقارير</CardTitle>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="border-border/60 shadow-[var(--shadow-card)]">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0 pb-2">
          <CardTitle className="text-base font-medium">الفترة</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" disabled={loading} onClick={() => void reload()}>
              <RefreshCw className="h-4 w-4" aria-hidden />
              <span className="ms-2">تحديث</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loading || periodReports.length === 0 || exportBusy !== null}
              onClick={handleExportPdf}
            >
              <FileDown className="h-4 w-4" aria-hidden />
              <span className="ms-2">تصدير PDF</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loading || periodReports.length === 0 || exportBusy !== null}
              onClick={() => void handleExportExcel()}
            >
              <FileSpreadsheet className="h-4 w-4" aria-hidden />
              <span className="ms-2">{exportBusy === "excel" ? "جاري التصدير…" : "تصدير Excel"}</span>
            </Button>
            <CashEditDialog shop={shop} userName={userEmail} onCashChanged={loadCapital}>
              <Button type="button" variant="outline" size="sm" className="shrink-0">
                <DollarSign className="h-4 w-4" aria-hidden />
                <span className="ms-2">تعديل النقدي</span>
              </Button>
            </CashEditDialog>
            <Button
              type="button"
              size="sm"
              disabled={loading || periodReports.length === 0 || exportBusy !== null}
              onClick={handlePrint}
            >
              <Printer className="h-4 w-4" aria-hidden />
              <span className="ms-2">طباعة التقرير</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ReportPeriodToolbar
            preset={preset}
            onPresetChange={setPreset}
            dateFrom={dateFrom}
            dateTo={dateTo}
            onDateFromChange={setDateFrom}
            onDateToChange={setDateTo}
          />
        </CardContent>
      </Card>

      {error ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-8">
            <p className="text-sm text-destructive">تعذّر تحميل التقارير.</p>
            <Button type="button" variant="outline" size="sm" onClick={() => void reload()}>
              إعادة المحاولة
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <ReportKpiCards
        count={summary.count}
        totalAmount={summary.totalAmount}
        totalCommission={summary.totalCommission}
        avgAmount={summary.avgAmount}
        loading={loading}
      />

      {!loading && !error && periodReports.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-sm text-muted-foreground">لا توجد تقارير في الفترة المحددة.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <ReportDailyChart dailySeries={summary.dailySeries} />
          <div className="grid gap-6 lg:grid-cols-2">
            <ReportBreakdownTable
              title="حسب نوع العملية"
              nameColumn="نوع العملية"
              rows={summary.byType.map((r) => ({ label: r.label, count: r.count, volume: r.volume }))}
            />
            <ReportBreakdownTable
              title="حسب الهاتف"
              nameColumn="الهاتف"
              rows={summary.byPhone.map((r) => ({ label: r.label, count: r.count, volume: r.volume }))}
            />
          </div>
          <ReportBreakdownTable
            title="أعلى الأرقام"
            nameColumn="الهاتف"
            rows={summary.topPhones.map((r) => ({ label: r.label, count: r.count, volume: r.volume }))}
          />
          <ReportsListTable reports={periodReports} onDelete={setDeleteTarget} />
        </>
      )}

      <Card className="border-border/60 shadow-[var(--shadow-card)]">
        <CardHeader>
          <CardTitle className="text-base font-medium">تقارير السداد</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {debtPaymentsError ? (
            <p className="text-sm text-destructive">{debtPaymentsError}</p>
          ) : debtPaymentsLoading ? (
            <p className="text-sm text-muted-foreground">جاري التحميل…</p>
          ) : periodDebtPayments.length === 0 ? (
            <p className="text-sm text-muted-foreground">لا توجد مدفوعات ديون في الفترة المحددة.</p>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-4">
                <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
                  <p className="text-xs text-muted-foreground">عدد المدفوعات</p>
                  <p className="text-xl font-bold tabular-nums">{debtSummary.count}</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
                  <p className="text-xs text-muted-foreground">إجمالي المدفوعات</p>
                  <p className="text-xl font-bold tabular-nums">{debtSummary.totalAmount.toFixed(2)}</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
                  <p className="text-xs text-muted-foreground">متوسط المدفوعات</p>
                  <p className="text-xl font-bold tabular-nums">{debtSummary.avgAmount.toFixed(2)}</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
                  <p className="text-xs text-muted-foreground">طريقة السداد</p>
                  <p className="text-sm font-semibold">
                    نقدي {debtSummary.cashCount} ({(debtSummary.totalAmount > 0 ? (debtSummary.cashTotal / debtSummary.totalAmount * 100) : 0).toFixed(0)}%)
                    {" | "}
                    محفظة {debtSummary.walletCount} ({(debtSummary.totalAmount > 0 ? (debtSummary.walletTotal / debtSummary.totalAmount * 100) : 0).toFixed(0)}%)
                  </p>
                </div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>التاريخ</TableHead>
                    <TableHead>المبلغ</TableHead>
                    <TableHead>طريقة السداد</TableHead>
                    <TableHead>ملاحظات</TableHead>
                    <TableHead>المسدد</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {periodDebtPayments.map((p) => {
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
                          {p.paymentMethod === "cash" ? "نقدي" : "محفظة"}
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
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>حذف التقرير</DialogTitle>
            <DialogDescription>هل أنت متأكد من حذف هذا التقرير؟ لا يمكن التراجع عن هذا الإجراء.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" disabled={deleteBusy} onClick={() => setDeleteTarget(null)}>
              إلغاء
            </Button>
            <Button type="button" variant="destructive" disabled={deleteBusy} onClick={() => void handleDelete()}>
              <Trash2 className="h-4 w-4" aria-hidden />
              <span className="ms-2">{deleteBusy ? "جاري الحذف…" : "حذف"}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
