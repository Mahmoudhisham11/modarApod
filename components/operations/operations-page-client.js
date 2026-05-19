"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fetchInstapayLinesByShop } from "@/lib/instapay/instapay-lines-service";
import { parseFiniteNumberOrZero } from "@/lib/lines/line-payload";
import { fetchNumbersByShop } from "@/lib/lines/numbers-service";
import { fetchMachinesByShop } from "@/lib/machines/machines-service";
import {
  OPERATION_TYPE,
  OPERATION_TYPE_LABEL,
  SOURCE_KIND,
  SOURCE_KIND_LABEL,
  operationTypesForSourceKind,
} from "@/lib/operations/constants";
import {
  analyzeOperation,
  formatRankingMarginDisplay,
  getLineLimitUsageSnapshot,
  listSuitableSourcesForOperation,
  suitabilityDescriptionAr,
} from "@/lib/operations/eligibility";
import { createOperationWithUpdates, fetchOperationsByShop } from "@/lib/operations/operations-service";
import { cn } from "@/lib/utils";

const SELECT_NONE = "__none__";

/** @param {unknown} v */
function asString(v) {
  if (v === null || v === undefined) return "";
  return String(v);
}

/** @param {Record<string, unknown>} row */
function isTelecomRow(row) {
  const ch = asString(row.channelType);
  return !ch || ch === "telecom";
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
    toast.error(
      hint
        ? `Firestore رفض الطلب. راجع قواعد الأمان (${hint}).`
        : "Firestore رفض الطلب. راجع قواعد الأمان.",
    );
    return;
  }
  if (code === "failed-precondition") {
    toast.error(
      hint
        ? `يتطلب Firestore فهرسًا مركّبًا (${hint}). راجع ملف firestore.indexes.json في المشروع أو لوحة Firebase.`
        : "يتطلب Firestore فهرسًا مركّبًا. راجع ملف firestore.indexes.json أو لوحة Firebase.",
    );
    return;
  }
  if (code === "unauthenticated") {
    toast.error(hint ? `انتهت الجلسة أو غير مصرّح (${hint}). سجّل الدخول مجددًا.` : "انتهت الجلسة أو غير مصرّح. سجّل الدخول مجددًا.");
    return;
  }
  if (code === "unavailable" || code === "deadline-exceeded" || code === "resource-exhausted") {
    toast.error(
      hint
        ? `خدمة Firestore غير متاحة مؤقتًا (${hint}). أعد المحاولة لاحقًا.`
        : "خدمة Firestore غير متاحة مؤقتًا. أعد المحاولة لاحقًا.",
    );
    return;
  }

  const trimmed = message.trim();
  if (trimmed) {
    toast.error(hint ? `${trimmed} (${hint})` : trimmed);
    return;
  }
  if (code) {
    toast.error(hint ? `خطأ Firestore: ${code} (${hint})` : `خطأ Firestore: ${code}`);
    return;
  }
  toast.error(hint ? `حدث خطأ أثناء الاتصال بقاعدة البيانات (${hint})` : "حدث خطأ أثناء الاتصال بقاعدة البيانات");
}

/**
 * @param {{ id: string; row: Record<string, unknown> }} item
 * @param {string} kind
 */
function sourceLabel(item, kind) {
  if (kind === SOURCE_KIND.MACHINE) {
    return asString(item.row.name) || item.id;
  }
  const phone = asString(item.row.phone);
  const name = asString(item.row.name);
  if (phone && name) return `${phone} — ${name}`;
  return phone || name || item.id;
}

/** @param {number} n */
function fmtLimitNum(n) {
  if (!Number.isFinite(n)) return "—";
  const r = Math.round(n * 100) / 100;
  return Number.isInteger(r) ? String(r) : String(r);
}

/**
 * @param {{ shop: string; userEmail: string; userName: string }} props
 */
export function OperationsPageClient({ shop, userEmail, userName }) {
  const [sourceKind, setSourceKind] = useState(SOURCE_KIND.TELECOM);
  const [sources, setSources] = useState([]);
  const [operations, setOperations] = useState([]);
  const [sourceId, setSourceId] = useState("");
  const [operationType, setOperationType] = useState(OPERATION_TYPE.WITHDRAW);
  const [targetId, setTargetId] = useState("");
  const [amount, setAmount] = useState("");
  const [commission, setCommission] = useState("0");
  const [customerPhone, setCustomerPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const loadOperations = useCallback(async () => {
    const s = shop.trim();
    if (!s) {
      setOperations([]);
      return;
    }
    try {
      const data = await fetchOperationsByShop(s);
      setOperations(data);
    } catch (e) {
      toastFirestoreError(e, "operations");
    }
  }, [shop]);

  const loadSources = useCallback(async () => {
    const s = shop.trim();
    if (!s) {
      setSources([]);
      return;
    }
    setLoading(true);
    try {
      if (sourceKind === SOURCE_KIND.TELECOM) {
        const data = await fetchNumbersByShop(s);
        setSources(data.filter(isTelecomRow).map((d) => ({ id: d.id, row: d })));
      } else if (sourceKind === SOURCE_KIND.INSTAPAY) {
        const data = await fetchInstapayLinesByShop(s);
        setSources(data.map((d) => ({ id: d.id, row: d })));
      } else {
        const data = await fetchMachinesByShop(s);
        setSources(data.map((d) => ({ id: d.id, row: d })));
      }
    } catch (e) {
      toastFirestoreError(e, "المصدر");
      setSources([]);
    } finally {
      setLoading(false);
    }
  }, [shop, sourceKind]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await Promise.resolve();
      if (cancelled) return;
      await loadOperations();
    })();
    return () => {
      cancelled = true;
    };
  }, [loadOperations]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await Promise.resolve();
      if (cancelled) return;
      setSourceId("");
      setTargetId("");
      await loadSources();
    })();
    return () => {
      cancelled = true;
    };
  }, [loadSources]);

  const allowedTypes = useMemo(() => operationTypesForSourceKind(sourceKind), [sourceKind]);

  const effectiveOperationType = useMemo(
    () => (allowedTypes.includes(operationType) ? operationType : (allowedTypes[0] ?? OPERATION_TYPE.WITHDRAW)),
    [allowedTypes, operationType],
  );

  const selectedItem = useMemo(() => sources.find((x) => x.id === sourceId) ?? null, [sources, sourceId]);

  const amountNum = parseFiniteNumberOrZero(amount);
  const commissionNum = parseFiniteNumberOrZero(commission);

  const lineLimitPreview = useMemo(() => {
    if (!shop.trim() || !selectedItem || !sourceId) return null;
    if (sourceKind === SOURCE_KIND.MACHINE) return null;
    if (
      effectiveOperationType !== OPERATION_TYPE.WITHDRAW &&
      effectiveOperationType !== OPERATION_TYPE.DEPOSIT
    ) {
      return null;
    }
    const snap = getLineLimitUsageSnapshot({
      sourceKind,
      sourceRow: selectedItem.row,
      sourceId,
      operations: [],
      now: new Date(),
    });
    if (!snap) return null;
    const a = amountNum > 0 ? amountNum : 0;
    if (effectiveOperationType === OPERATION_TYPE.WITHDRAW) {
      return {
        kind: "withdraw",
        remDaily: snap.remDailyWithdraw,
        remMonthly: snap.remMonthlyWithdraw,
        previewDelta: a,
      };
    }
    return {
      kind: "deposit",
      remDaily: snap.remDailyDeposit,
      remMonthly: snap.remMonthlyDeposit,
      previewDelta: a,
    };
  }, [shop, selectedItem, sourceId, sourceKind, effectiveOperationType, amountNum]);

  const suitableSources = useMemo(() => {
    if (amountNum <= 0 || sources.length === 0) return [];
    return listSuitableSourcesForOperation({
      candidates: sources,
      sourceKind,
      operationType: effectiveOperationType,
      amount: amountNum,
      commission: commissionNum,
      operations,
    });
  }, [sources, sourceKind, effectiveOperationType, amountNum, commissionNum, operations]);

  const selectedSourceIsSuitable = useMemo(() => {
    if (!sourceId || amountNum <= 0) return true;
    return suitableSources.some((s) => s.id === sourceId);
  }, [sourceId, amountNum, suitableSources]);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!shop.trim()) {
      toast.error("اسم الفرع غير مضبوط في الجلسة.");
      return;
    }
    if (!sourceId) {
      toast.error("اختر الوسيلة.");
      return;
    }
    if (!selectedItem) {
      toast.error("الوسيلة المختارة غير صالحة.");
      return;
    }
    if (effectiveOperationType === OPERATION_TYPE.BALANCE_TRANSFER && (!targetId || targetId === sourceId)) {
      toast.error("اختر ماكينة هدف صالحة.");
      return;
    }
    const gate = analyzeOperation({
      sourceKind,
      sourceRow: selectedItem.row,
      sourceId,
      operationType: effectiveOperationType,
      amount: amountNum,
      commission: commissionNum,
      operations,
    });
    if (!gate.executable) {
      toast.error(gate.messages[0] || "العملية غير مسموحة.");
      return;
    }
    setSubmitting(true);
    try {
      await createOperationWithUpdates({
        shop: shop.trim(),
        createdBy: userEmail.trim(),
        userName: userName.trim(),
        sourceKind,
        sourceId,
        operationType: effectiveOperationType,
        amount: amountNum,
        commission: commissionNum,
        customerPhone,
        notes,
        targetId: effectiveOperationType === OPERATION_TYPE.BALANCE_TRANSFER ? targetId : undefined,
      });
      toast.success("تم تنفيذ العملية وتسجيلها.");
      setAmount("");
      setCommission("0");
      setCustomerPhone("");
      setNotes("");
      setTargetId("");
      try {
        await Promise.all([loadSources(), loadOperations()]);
      } catch (refreshErr) {
        console.error("Reload after operation failed", refreshErr);
        toast.warning("تم تنفيذ العملية لكن تعذّر تحديث القائمة. حدّث الصفحة يدويًا إن لزم.");
      }
    } catch (err) {
      toastFirestoreError(err, "operations / المصدر");
    } finally {
      setSubmitting(false);
    }
  };

  if (!shop.trim()) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="العمليات" />
        <Card className="border-border/60 shadow-[var(--shadow-card)]">
          <CardHeader>
            <CardTitle>اسم الفرع غير مضبوط</CardTitle>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="العمليات" />

      <form onSubmit={onSubmit} className="flex flex-col gap-6">
        <Card className="border-border/60 shadow-[var(--shadow-card)]">
          <CardHeader className="pb-2">
            <CardTitle>نموذج التنفيذ</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-1.5">
              <Label>نوع الوسيلة</Label>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    SOURCE_KIND.TELECOM,
                    SOURCE_KIND.INSTAPAY,
                    SOURCE_KIND.MACHINE,
                  ]
                ).map((k) => (
                  <Button
                    key={k}
                    type="button"
                    size="sm"
                    variant={sourceKind === k ? "default" : "outline"}
                    className={cn("rounded-full", sourceKind === k && "pointer-events-none")}
                    onClick={() => {
                      setSourceKind(k);
                      setSourceId("");
                      setTargetId("");
                      setOperationType(OPERATION_TYPE.WITHDRAW);
                    }}
                  >
                    {SOURCE_KIND_LABEL[k]}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="op-source">الوسيلة</Label>
              <Select
                value={sourceId || SELECT_NONE}
                onValueChange={(v) => setSourceId(v === SELECT_NONE ? "" : v)}
                disabled={loading || sources.length === 0}
              >
                <SelectTrigger id="op-source">
                  <SelectValue placeholder="اختر الوسيلة" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SELECT_NONE}>— اختر —</SelectItem>
                  {sources.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {sourceLabel(item, sourceKind)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!loading && sources.length === 0 ? (
                <p className="text-xs text-muted-foreground">لا توجد وسائل لهذا النوع في هذا الفرع.</p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="op-type">نوع العملية</Label>
              <Select value={effectiveOperationType} onValueChange={(v) => setOperationType(v)}>
                <SelectTrigger id="op-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {allowedTypes.map((t) => (
                    <SelectItem key={t} value={t}>
                      {OPERATION_TYPE_LABEL[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {effectiveOperationType === OPERATION_TYPE.BALANCE_TRANSFER && sourceKind === SOURCE_KIND.MACHINE ? (
              <div className="space-y-1.5">
                <Label htmlFor="op-target">ماكينة الهدف</Label>
                <Select
                  value={targetId || SELECT_NONE}
                  onValueChange={(v) => setTargetId(v === SELECT_NONE ? "" : v)}
                  disabled={sources.length === 0}
                >
                  <SelectTrigger id="op-target">
                    <SelectValue placeholder="اختر ماكينة الهدف" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SELECT_NONE}>— اختر ماكينة الهدف —</SelectItem>
                    {sources
                      .filter((item) => item.id !== sourceId)
                      .map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {sourceLabel(item, SOURCE_KIND.MACHINE)}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="op-amount">المبلغ</Label>
                <Input
                  id="op-amount"
                  dir="ltr"
                  className="font-mono text-start"
                  value={amount}
                  onChange={(ev) => setAmount(ev.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="op-commission">العمولة</Label>
                <Input
                  id="op-commission"
                  dir="ltr"
                  className="font-mono text-start"
                  value={commission}
                  onChange={(ev) => setCommission(ev.target.value)}
                  placeholder="0"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="op-client-phone">رقم العميل (اختياري)</Label>
              <Input
                id="op-client-phone"
                value={customerPhone}
                onChange={(ev) => setCustomerPhone(ev.target.value)}
                dir="ltr"
                className="font-mono text-start"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="op-notes">ملاحظات</Label>
              <Input id="op-notes" value={notes} onChange={(ev) => setNotes(ev.target.value)} />
            </div>

            {lineLimitPreview ? (
              <div className="space-y-2 rounded-lg border border-border bg-muted/30 px-3 py-3 text-sm">
                <p className="font-medium text-foreground">متبقي الليميت على الخط (من مستند الوسيلة)</p>
                {lineLimitPreview.kind === "withdraw" ? (
                  <>
                    <p className="text-muted-foreground">
                      متبقي يومي سحب:{" "}
                      {lineLimitPreview.remDaily > 0
                        ? fmtLimitNum(lineLimitPreview.remDaily)
                        : "غير مفعّل (0 في المستند)."}
                    </p>
                    {lineLimitPreview.previewDelta > 0 && lineLimitPreview.remDaily > 0 ? (
                      <p className="text-xs text-muted-foreground">
                        بعد التنفيذ ({fmtLimitNum(lineLimitPreview.previewDelta)}): متبقي يومي تقريبي{" "}
                        {fmtLimitNum(lineLimitPreview.remDaily - lineLimitPreview.previewDelta)}
                      </p>
                    ) : null}
                    <p className="text-muted-foreground">
                      متبقي شهري سحب:{" "}
                      {lineLimitPreview.remMonthly > 0
                        ? fmtLimitNum(lineLimitPreview.remMonthly)
                        : "غير مفعّل (0 في المستند)."}
                    </p>
                    {lineLimitPreview.previewDelta > 0 && lineLimitPreview.remMonthly > 0 ? (
                      <p className="text-xs text-muted-foreground">
                        بعد التنفيذ ({fmtLimitNum(lineLimitPreview.previewDelta)}): متبقي شهري تقريبي{" "}
                        {fmtLimitNum(lineLimitPreview.remMonthly - lineLimitPreview.previewDelta)}
                      </p>
                    ) : null}
                  </>
                ) : (
                  <>
                    <p className="text-muted-foreground">
                      متبقي يومي إيداع:{" "}
                      {lineLimitPreview.remDaily > 0
                        ? fmtLimitNum(lineLimitPreview.remDaily)
                        : "غير مفعّل (0 في المستند)."}
                    </p>
                    {lineLimitPreview.previewDelta > 0 && lineLimitPreview.remDaily > 0 ? (
                      <p className="text-xs text-muted-foreground">
                        بعد التنفيذ ({fmtLimitNum(lineLimitPreview.previewDelta)}): متبقي يومي تقريبي{" "}
                        {fmtLimitNum(lineLimitPreview.remDaily - lineLimitPreview.previewDelta)}
                      </p>
                    ) : null}
                    <p className="text-muted-foreground">
                      متبقي شهري إيداع:{" "}
                      {lineLimitPreview.remMonthly > 0
                        ? fmtLimitNum(lineLimitPreview.remMonthly)
                        : "غير مفعّل (0 في المستند)."}
                    </p>
                    {lineLimitPreview.previewDelta > 0 && lineLimitPreview.remMonthly > 0 ? (
                      <p className="text-xs text-muted-foreground">
                        بعد التنفيذ ({fmtLimitNum(lineLimitPreview.previewDelta)}): متبقي شهري تقريبي{" "}
                        {fmtLimitNum(lineLimitPreview.remMonthly - lineLimitPreview.previewDelta)}
                      </p>
                    ) : null}
                  </>
                )}
                <p className="text-xs text-muted-foreground">
                  القيم على الخط هي «متبقي» وتنقص عند كل عملية؛ لا إعادة تعبئة يومية/شهرية تلقائية — عُد للخطوط
                  لتعديل المتبقي عند الحاجة.
                </p>
              </div>
            ) : null}

            <Button
              type="submit"
              disabled={submitting || loading || (amountNum > 0 && !!sourceId && !selectedSourceIsSuitable)}
            >
              {submitting ? "جاري التنفيذ…" : "تنفيذ العملية"}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-[var(--shadow-card)]">
          <CardHeader className="pb-2">
            <CardTitle>ترشيح الوسائل المناسبة</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {amountNum <= 0 ? (
              <p className="text-muted-foreground">أدخل مبلغًا أكبر من صفر لعرض الوسائل المناسبة.</p>
            ) : sources.length === 0 ? (
              <p className="text-muted-foreground">لا توجد وسائل لهذا النوع في هذا الفرع.</p>
            ) : suitableSources.length === 0 ? (
              <p className="text-destructive">
                لا توجد وسيلة تغطي العملية الحالية ضمن النوع المختار (رصيد أو ليميت أو حالة غير نشطة).
              </p>
            ) : (
              <>
                {sourceId && !selectedSourceIsSuitable ? (
                  <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-destructive">
                    الوسيلة المختارة حاليًا في الحقل «الوسيلة» غير ضمن الترشيحات لهذا المبلغ. اختر «اختيار» من
                    القائمة أدناه أو غيّر المبلغ/العمولة.
                  </p>
                ) : null}
                <p className="text-xs text-muted-foreground">
                  {sourceKind === SOURCE_KIND.MACHINE
                    ? "الترتيب حسب الرصيد فقط (بعد خصم المبلغ والعمولة عند السحب/التحويل، أو رصيد أعلى بعد الإيداع)."
                    : "الترتيب حسب أضيق هامش بين رصيد الخط ومتبقي الليميت اليومي/الشهري على المستند."}
                </p>
                <ol className="list-decimal space-y-3 pe-5 marker:text-muted-foreground">
                  {suitableSources.map((r) => (
                    <li key={r.id} className="min-w-0">
                      <div
                        className={cn(
                          "flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between",
                          r.id === sourceId && "border-primary/60 bg-muted/40",
                        )}
                      >
                        <div className="min-w-0 space-y-1">
                          <p className="font-medium text-foreground">
                            {sourceLabel({ id: r.id, row: r.row }, sourceKind)}
                          </p>
                          <p className="text-muted-foreground">
                            {suitabilityDescriptionAr({
                              executable: r.executable,
                              margin: r.margin,
                              sourceKind,
                              operationType: effectiveOperationType,
                              amount: amountNum,
                              commission: commissionNum,
                            })}
                          </p>
                          <p dir="ltr" className="font-mono text-xs text-muted-foreground">
                            مؤشر الهامش: {formatRankingMarginDisplay(r.margin)}
                          </p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="shrink-0"
                          onClick={() => setSourceId(r.id)}
                        >
                          اختيار
                        </Button>
                      </div>
                    </li>
                  ))}
                </ol>
              </>
            )}
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
