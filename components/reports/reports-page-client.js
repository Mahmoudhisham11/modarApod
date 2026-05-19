"use client";

import { useMemo, useState } from "react";
import { useFeatureLock } from "@/hooks/use-feature-lock";
import { FileDown, FileSpreadsheet, Printer, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { asString } from "@/lib/dashboard/operation-display";
import {
  buildReportSummary,
  filterOperationsByPeriod,
  periodLabelAr,
} from "@/lib/reports/report-aggregates";
import { downloadReportExcel } from "@/lib/reports/export-report-excel";
import { exportReportPdfViaPrint } from "@/lib/reports/export-report-pdf";
import { printReportSummary } from "@/lib/reports/print-report-summary";

import { ReportBreakdownTable } from "./report-breakdown-table";
import { ReportDailyChart } from "./report-daily-chart";
import { ReportKpiCards } from "./report-kpi-cards";
import { ReportPeriodToolbar } from "./report-period-toolbar";
import { ReportsListTable } from "./reports-list-table";
import { useShopReports } from "./use-shop-reports";

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

  const shopReports = useMemo(() => {
    const s = shop.trim();
    if (!s) return [];
    return reports.filter((r) => asString(r.shop).trim() === s);
  }, [reports, shop]);

  const periodReports = useMemo(() => {
    return filterOperationsByPeriod(shopReports, {
      preset,
      dateFrom: preset === "custom" ? dateFrom : undefined,
      dateTo: preset === "custom" ? dateTo : undefined,
    });
  }, [shopReports, preset, dateFrom, dateTo]);

  const summary = useMemo(() => buildReportSummary(periodReports), [periodReports]);

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
          <ReportsListTable reports={periodReports} />
        </>
      )}
    </div>
  );
}
