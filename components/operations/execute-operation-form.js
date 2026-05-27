"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

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
import { parseFiniteNumberOrZero } from "@/lib/lines/line-payload";
import { loadSources } from "@/lib/sources/sources-cache";
import {
  OPERATION_TYPE,
  OPERATION_TYPE_LABEL,
  SOURCE_KIND,
  SOURCE_KIND_LABEL,
  isMachineDebitOperation,
  operationTypesForSourceKind,
} from "@/lib/operations/constants";
import { DollarSign, Globe } from "lucide-react";
import {
  analyzeOperation,
  formatRankingMarginDisplay,
  getLineLimitUsageSnapshot,
  listSuitableSourcesForOperation,
  parseLineAmount,
  parseMachineBalance,
  suitabilityDescriptionAr,
} from "@/lib/operations/eligibility";
import { createOperationWithUpdates } from "@/lib/operations/operations-service";
import { fetchUserDocByEmail, userLocksFromData } from "@/lib/auth/user-locks";
import { cn } from "@/lib/utils";

const SELECT_NONE = "__none__";

/** @param {unknown} v */
function asString(v) {
  if (v === null || v === undefined) return "";
  return String(v);
}

/** @param {{ id: string; row: Record<string, unknown> }} item @param {string} kind */
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

/** @param {{ id: string; row: Record<string, unknown> }} row */
function isTelecomRow(row) {
  const ch = asString(row.channelType);
  return !ch || ch === "telecom";
}

/** @param {unknown} err @param {string} [hint] */
function toastFirestoreError(err, hint) {
  let code = "";
  if (err && typeof err === "object" && "code" in err && err.code != null) {
    try { code = String(err.code); } catch { code = ""; }
  }
  let message = "";
  try {
    if (err instanceof Error && err.message) message = String(err.message);
    else if (err && typeof err === "object" && "message" in err && err.message != null) message = String(err.message);
    else if (err != null && err !== undefined) message = String(err);
  } catch { message = ""; }
  if (code === "permission-denied") { toast.error(hint ? `Firestore رفض الطلب (${hint}).` : "Firestore رفض الطلب. راجع قواعد الأمان."); return; }
  const trimmed = message.trim();
  if (trimmed) { toast.error(hint ? `${trimmed} (${hint})` : trimmed); return; }
  toast.error(hint ? `حدث خطأ (${hint})` : "حدث خطأ");
}

/**
 * تحديث التخزين المؤقت بعد تنفيذ عملية بنجاح
 * @param {import("@/lib/operations/constants").SourceKind} kind
 * @param {Array<{ id: string; row: Record<string, unknown> }>} cache
 * @param {string} sourceId
 * @param {import("@/lib/operations/constants").OperationType} opType
 * @param {number} amount
 * @param {number} commission
 * @param {string} [targetId]
 * @returns {Array<{ id: string; row: Record<string, unknown> }>}
 */
function applyOperationToCache(kind, cache, sourceId, opType, amount, commission, targetId) {
  return cache.map((item) => {
    if (item.id !== sourceId && item.id !== targetId) return item;
    const row = { ...item.row };

    if (kind === SOURCE_KIND.MACHINE) {
      const bal = parseMachineBalance(row);
      if (item.id === sourceId && opType === OPERATION_TYPE.DEPOSIT) {
        row.balance = bal + amount;
      } else if (item.id === sourceId && opType === OPERATION_TYPE.BALANCE_TRANSFER) {
        row.balance = bal - amount - commission;
      } else if (item.id === sourceId) {
        row.balance = bal - amount - commission;
      }
      if (item.id === targetId && opType === OPERATION_TYPE.BALANCE_TRANSFER) {
        row.balance = (parseMachineBalance(row)) + amount;
      }
    } else {
      const bal = parseLineAmount(row);
      if (opType === OPERATION_TYPE.WITHDRAW || opType === OPERATION_TYPE.LIQUIDATION || opType === OPERATION_TYPE.EXTERNAL) {
        row.amount = bal + amount;
        if (opType === OPERATION_TYPE.WITHDRAW) {
          const dw = Number(row.dailyWithdraw) || 0;
          if (dw > 0) row.dailyWithdraw = Math.max(0, dw - amount);
          const wm = Number(row.withdrawLimit) || 0;
          if (wm > 0) row.withdrawLimit = Math.max(0, wm - amount);
        }
      } else if (opType === OPERATION_TYPE.DEPOSIT) {
        row.amount = bal - amount;
        const dd = Number(row.dailyDeposit) || 0;
        if (dd > 0) row.dailyDeposit = Math.max(0, dd - amount);
        const dm = Number(row.depositLimit) || 0;
        if (dm > 0) row.depositLimit = Math.max(0, dm - amount);
      }
    }

    return { ...item, row };
  });
}

/**
 * @param {{
 *   shop: string;
 *   userEmail: string;
 *   userName: string;
 *   showTitle?: boolean;
 *   onSuccess?: () => void | Promise<void>;
 *   commissionPercentWithdraw?: number;
 *   commissionPercentDeposit?: number;
 * }} props
 */
export function ExecuteOperationForm({ shop, userEmail, userName, showTitle = true, onSuccess, commissionPercentWithdraw: propCommissionPercentWithdraw, commissionPercentDeposit: propCommissionPercentDeposit }) {
  const [sourceKind, setSourceKind] = useState(SOURCE_KIND.TELECOM);
  const [sourceId, setSourceId] = useState("");
  const [operationType, setOperationType] = useState(OPERATION_TYPE.WITHDRAW);
  const [targetId, setTargetId] = useState("");
  const [amount, setAmount] = useState("");
  const [commission, setCommission] = useState("0");
  const [customerPhone, setCustomerPhone] = useState("+20");
  const [notes, setNotes] = useState("");
  const [externalDirection, setExternalDirection] = useState("withdraw");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [commissionPercentWithdraw, setCommissionPercentWithdraw] = useState(propCommissionPercentWithdraw ?? 0);
  const [commissionPercentDeposit, setCommissionPercentDeposit] = useState(propCommissionPercentDeposit ?? 0);
  const [allSourcesCache, setAllSourcesCache] = useState(/** @type {Record<string, Array<{ id: string; row: Record<string, unknown> }>>} */ ({}));

  // Fetch commission percents from user doc if not provided as props
  useEffect(() => {
    if (propCommissionPercentWithdraw !== undefined && propCommissionPercentDeposit !== undefined) return;
    let cancelled = false;
    (async () => {
      if (!userEmail) return;
      const found = await fetchUserDocByEmail(userEmail);
      if (cancelled || !found) return;
      const data = userLocksFromData(found.data);
      if (!cancelled) {
        if (propCommissionPercentWithdraw === undefined) setCommissionPercentWithdraw(data.commissionPercentWithdraw);
        if (propCommissionPercentDeposit === undefined) setCommissionPercentDeposit(data.commissionPercentDeposit);
      }
    })();
    return () => { cancelled = true; };
  }, [userEmail, propCommissionPercentWithdraw, propCommissionPercentDeposit]);

  // Fetch all source types on mount (from module-level cache, 0 reads after first load)
  const loadAllSources = useCallback(async () => {
    const s = shop.trim();
    if (!s) { setAllSourcesCache({}); setLoading(false); return; }
    setLoading(true);
    try {
      const raw = await loadSources(s);
      setAllSourcesCache({
        [SOURCE_KIND.TELECOM]: raw.telecom.filter(isTelecomRow).map((x) => ({ id: x.id, row: x })),
        [SOURCE_KIND.INSTAPAY]: raw.instapay.map((x) => ({ id: x.id, row: x })),
        [SOURCE_KIND.MACHINE]: raw.machines.map((x) => ({ id: x.id, row: x })),
      });
    } catch (e) {
      toastFirestoreError(e, "المصادر");
    } finally { setLoading(false); }
  }, [shop]);

  useEffect(() => {
    let cancelled = false;
    (async () => { await Promise.resolve(); if (cancelled) return; await loadAllSources(); })();
    return () => { cancelled = true; };
  }, [loadAllSources]);

  // Derive current sources from cache based on selected kind
  const sources = useMemo(
    () => allSourcesCache[sourceKind] ?? [],
    [allSourcesCache, sourceKind],
  );

  const allowedTypes = useMemo(() => operationTypesForSourceKind(sourceKind), [sourceKind]);
  const effectiveOperationType = useMemo(
    () => (allowedTypes.includes(operationType) ? operationType : (allowedTypes[0] ?? OPERATION_TYPE.WITHDRAW)),
    [allowedTypes, operationType],
  );
  const selectedItem = useMemo(() => sources.find((x) => x.id === sourceId) ?? null, [sources, sourceId]);
  const amountNum = parseFiniteNumberOrZero(amount);
  const commissionNum = parseFiniteNumberOrZero(commission);

  // Auto-calculate commission when amount, operation type, or percent changes
  useEffect(() => {
    const pct = effectiveOperationType === OPERATION_TYPE.WITHDRAW ? commissionPercentWithdraw : commissionPercentDeposit;
    if (pct > 0 && amount) {
      const amt = parseFiniteNumberOrZero(amount);
      if (amt > 0) {
        const computed = (amt * pct) / 100;
        setCommission(String(computed));
      }
    }
  }, [amount, effectiveOperationType, commissionPercentWithdraw, commissionPercentDeposit]);

  const lineLimitPreview = useMemo(() => {
    if (!shop.trim() || !selectedItem || !sourceId) return null;
    const a = amountNum > 0 ? amountNum : 0;

    if (sourceKind === SOURCE_KIND.MACHINE) {
      const balance = parseMachineBalance(selectedItem.row);
      return {
        kind: "machine",
        balance,
        afterBalance: isMachineDebitOperation(effectiveOperationType)
          ? Math.max(0, balance - a - commissionNum)
          : effectiveOperationType === OPERATION_TYPE.DEPOSIT
            ? balance + a
            : balance,
      };
    }

    const snap = getLineLimitUsageSnapshot({ sourceKind, sourceRow: selectedItem.row, sourceId, operations: [], now: new Date() });
    if (!snap) return null;
    const lineBalance = parseLineAmount(selectedItem.row);
    let afterLineBalance = lineBalance;
    if (effectiveOperationType === OPERATION_TYPE.WITHDRAW || effectiveOperationType === OPERATION_TYPE.LIQUIDATION || effectiveOperationType === OPERATION_TYPE.EXTERNAL) {
      afterLineBalance = Math.max(0, lineBalance + a);
    } else if (effectiveOperationType === OPERATION_TYPE.DEPOSIT) {
      afterLineBalance = Math.max(0, lineBalance - a);
    }
    return {
      kind: "line",
      balance: lineBalance,
      afterBalance: afterLineBalance,
      remDailyWithdraw: snap.remDailyWithdraw,
      remMonthlyWithdraw: snap.remMonthlyWithdraw,
      remDailyDeposit: snap.remDailyDeposit,
      remMonthlyDeposit: snap.remMonthlyDeposit,
      previewDelta: a,
    };
  }, [shop, selectedItem, sourceId, sourceKind, effectiveOperationType, amountNum, commissionNum]);

  const suitableSources = useMemo(() => {
    if (amountNum <= 0 || sources.length === 0) return [];
    return listSuitableSourcesForOperation({ candidates: sources, sourceKind, operationType: effectiveOperationType, amount: amountNum, commission: commissionNum, operations: [] });
  }, [sources, sourceKind, effectiveOperationType, amountNum, commissionNum]);

  const selectedSourceIsSuitable = useMemo(() => {
    if (!sourceId || amountNum <= 0) return true;
    if (effectiveOperationType === OPERATION_TYPE.EXTERNAL) return true;
    return suitableSources.some((s) => s.id === sourceId);
  }, [sourceId, amountNum, suitableSources, effectiveOperationType]);

  const resetForm = useCallback(() => {
    setAmount("");
    setCommission("0");
    setCustomerPhone("+20");
    setNotes("");
    setTargetId("");
    setExternalDirection("withdraw");
  }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!shop.trim()) { toast.error("اسم الفرع غير مضبوط في الجلسة."); return; }
    if (!sourceId.trim()) {
      toast.error(effectiveOperationType === OPERATION_TYPE.EXTERNAL ? "أدخل رقم الوسيلة." : "اختر الوسيلة.");
      return;
    }
    if (effectiveOperationType !== OPERATION_TYPE.EXTERNAL) {
      if (!selectedItem) { toast.error("الوسيلة المختارة غير صالحة."); return; }
      const gate = analyzeOperation({ sourceKind, sourceRow: selectedItem.row, sourceId, operationType: effectiveOperationType, amount: amountNum, commission: commissionNum, operations: [] });
      if (!gate.executable) { toast.error(gate.messages[0] || "العملية غير مسموحة."); return; }
    }
    if (effectiveOperationType === OPERATION_TYPE.BALANCE_TRANSFER && (!targetId || targetId === sourceId)) { toast.error("اختر ماكينة هدف صالحة."); return; }
    setSubmitting(true);
    try {
      const finalSourceKind = effectiveOperationType === OPERATION_TYPE.EXTERNAL ? SOURCE_KIND.TELECOM : sourceKind;
      await createOperationWithUpdates({
        shop: shop.trim(),
        createdBy: userEmail.trim(),
        userName: userName.trim(),
        sourceKind: finalSourceKind,
        sourceId: sourceId.trim(),
        operationType: effectiveOperationType,
        amount: amountNum,
        commission: commissionNum,
        customerPhone,
        notes,
        targetId: effectiveOperationType === OPERATION_TYPE.BALANCE_TRANSFER ? targetId : undefined,
        externalDirection: effectiveOperationType === OPERATION_TYPE.EXTERNAL ? externalDirection : undefined,
      });

      // Update cache locally instead of refetching (skip for external — no real source)
      if (effectiveOperationType !== OPERATION_TYPE.EXTERNAL) {
        setAllSourcesCache((prev) => {
          const updated = { ...prev };
          const cacheKey = sourceKind;
          if (updated[cacheKey]) {
            updated[cacheKey] = applyOperationToCache(
              sourceKind, updated[cacheKey], sourceId,
              effectiveOperationType, amountNum, commissionNum, targetId,
            );
          }
          return updated;
        });
      }

      toast.success("تم تنفيذ العملية وتسجيلها.");
      resetForm();
      if (onSuccess) await onSuccess();
    } catch (err) {
      toastFirestoreError(err, "operations / المصدر");
    } finally { setSubmitting(false); }
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <Card className="border-border/60 shadow-[var(--shadow-card)]">
        {showTitle ? <CardHeader className="pb-2"><CardTitle>نموذج التنفيذ</CardTitle></CardHeader> : null}
        <CardContent className={cn("space-y-5", showTitle ? "" : "pt-6")}>
          {effectiveOperationType !== OPERATION_TYPE.EXTERNAL ? (
            <div className="space-y-1.5">
              <Label>نوع الوسيلة</Label>
              <div className="flex flex-wrap gap-2">
                {[SOURCE_KIND.TELECOM, SOURCE_KIND.INSTAPAY, SOURCE_KIND.MACHINE].map((k) => (
                  <Button
                    key={k}
                    type="button"
                    size="sm"
                    variant={sourceKind === k ? "default" : "outline"}
                    className={cn("rounded-full", sourceKind === k && "pointer-events-none")}
                    onClick={() => { setSourceKind(k); setSourceId(""); setTargetId(""); setOperationType(OPERATION_TYPE.WITHDRAW); }}
                  >
                    {SOURCE_KIND_LABEL[k]}
                  </Button>
                ))}
              </div>
            </div>
          ) : null}

          {effectiveOperationType === OPERATION_TYPE.EXTERNAL ? (
            <div className="space-y-1.5">
              <Label htmlFor="op-external-source">رقم الوسيلة</Label>
              <Input id="op-external-source" value={sourceId} onChange={(ev) => setSourceId(ev.target.value)} dir="ltr" className="font-mono text-start" placeholder="أدخل الرقم" />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="op-source">الوسيلة</Label>
              <Select value={sourceId || SELECT_NONE} onValueChange={(v) => setSourceId(v === SELECT_NONE ? "" : v)} disabled={loading || sources.length === 0}>
                <SelectTrigger id="op-source"><SelectValue placeholder="اختر الوسيلة" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={SELECT_NONE}>— اختر —</SelectItem>
                  {sources.map((item) => (<SelectItem key={item.id} value={item.id}>{sourceLabel(item, sourceKind)}</SelectItem>))}
                </SelectContent>
              </Select>
              {!loading && sources.length === 0 ? <p className="text-xs text-muted-foreground">لا توجد وسائل لهذا النوع في هذا الفرع.</p> : null}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="op-type">نوع العملية</Label>
            {effectiveOperationType === OPERATION_TYPE.LIQUIDATION || effectiveOperationType === OPERATION_TYPE.EXTERNAL ? (
              <div className="flex h-9 w-full items-center rounded-md border border-input bg-muted px-3 py-2 text-sm">
                {OPERATION_TYPE_LABEL[effectiveOperationType]}
              </div>
            ) : (
              <Select value={effectiveOperationType} onValueChange={(v) => setOperationType(v)}>
                <SelectTrigger id="op-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {allowedTypes.filter((t) => t !== OPERATION_TYPE.LIQUIDATION && t !== OPERATION_TYPE.EXTERNAL).map((t) => (<SelectItem key={t} value={t}>{OPERATION_TYPE_LABEL[t]}</SelectItem>))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={effectiveOperationType === OPERATION_TYPE.LIQUIDATION ? "default" : "outline"}
              className={cn("gap-1.5", effectiveOperationType === OPERATION_TYPE.LIQUIDATION && "pointer-events-none")}
              onClick={() => setOperationType(OPERATION_TYPE.LIQUIDATION)}
            >
              <DollarSign className="h-3.5 w-3.5" />
              تسيل أموال
            </Button>
            <Button
              type="button"
              size="sm"
              variant={effectiveOperationType === OPERATION_TYPE.EXTERNAL ? "default" : "outline"}
              className={cn("gap-1.5", effectiveOperationType === OPERATION_TYPE.EXTERNAL && "pointer-events-none")}
              onClick={() => { setOperationType(OPERATION_TYPE.EXTERNAL); setSourceId(""); setSourceKind(SOURCE_KIND.TELECOM); }}
            >
              <Globe className="h-3.5 w-3.5" />
              معاملة خارجية
            </Button>
          </div>

          {effectiveOperationType === OPERATION_TYPE.EXTERNAL ? (
            <div className="space-y-1.5">
              <Label>اتجاه المعاملة</Label>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={externalDirection === "withdraw" ? "default" : "outline"}
                  className={cn("rounded-full", externalDirection === "withdraw" && "pointer-events-none")}
                  onClick={() => setExternalDirection("withdraw")}
                >
                  سحب
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={externalDirection === "deposit" ? "default" : "outline"}
                  className={cn("rounded-full", externalDirection === "deposit" && "pointer-events-none")}
                  onClick={() => setExternalDirection("deposit")}
                >
                  إيداع
                </Button>
              </div>
            </div>
          ) : null}

          {effectiveOperationType === OPERATION_TYPE.BALANCE_TRANSFER && sourceKind === SOURCE_KIND.MACHINE ? (
            <div className="space-y-1.5">
              <Label htmlFor="op-target">ماكينة الهدف</Label>
              <Select value={targetId || SELECT_NONE} onValueChange={(v) => setTargetId(v === SELECT_NONE ? "" : v)} disabled={sources.length === 0}>
                <SelectTrigger id="op-target"><SelectValue placeholder="اختر ماكينة الهدف" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={SELECT_NONE}>— اختر ماكينة الهدف —</SelectItem>
                  {sources.filter((item) => item.id !== sourceId).map((item) => (<SelectItem key={item.id} value={item.id}>{sourceLabel(item, SOURCE_KIND.MACHINE)}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="op-amount">المبلغ</Label>
              <Input id="op-amount" dir="ltr" className="font-mono text-start" value={amount} onChange={(ev) => setAmount(ev.target.value)} placeholder="0" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="op-commission">الرسوم</Label>
              <Input id="op-commission" dir="ltr" className="font-mono text-start" value={commission} onChange={(ev) => setCommission(ev.target.value)} placeholder="0" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="op-client-phone">رقم العميل (اختياري)</Label>
            <Input id="op-client-phone" value={customerPhone} onChange={(ev) => { const v = ev.target.value; if (v.startsWith("+20") || v === "+2" || v === "+") setCustomerPhone(v); }} dir="ltr" className="font-mono text-start" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="op-notes">ملاحظات</Label>
            <Input id="op-notes" value={notes} onChange={(ev) => setNotes(ev.target.value)} />
          </div>

          {lineLimitPreview ? (
            <div className="space-y-2 rounded-lg border border-border bg-muted/30 px-3 py-3 text-sm">
              {lineLimitPreview.kind === "machine" ? (
                <>
                  <p className="font-medium text-foreground">رصيد الماكينة</p>
                  <p className="text-muted-foreground">
                    الرصيد الحالي: <span className="font-mono">{fmtLimitNum(lineLimitPreview.balance)}</span>
                  </p>
                  <p className="text-muted-foreground">
                    الرصيد بعد العملية: <span className="font-mono">{fmtLimitNum(lineLimitPreview.afterBalance)}</span>
                  </p>
                </>
              ) : (
                <>
                  <p className="font-medium text-foreground">رصيد الخط</p>
                  <p className="text-muted-foreground">
                    الرصيد الحالي: <span className="font-mono">{fmtLimitNum(lineLimitPreview.balance)}</span>
                  </p>
                  {lineLimitPreview.previewDelta > 0 ? (
                    <p className="text-muted-foreground">
                      بعد التنفيذ: <span className="font-mono">{fmtLimitNum(lineLimitPreview.afterBalance)}</span>
                    </p>
                  ) : null}
                  <p className="font-medium text-foreground mt-2">الليميت على الخط (من مستند الوسيلة)</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">السحب</p>
                      <p className="text-muted-foreground">
                        يومي: {lineLimitPreview.remDailyWithdraw > 0 ? fmtLimitNum(lineLimitPreview.remDailyWithdraw) : "غير مفعّل"}
                      </p>
                      {lineLimitPreview.previewDelta > 0 && lineLimitPreview.remDailyWithdraw > 0 ? (
                        <p className="text-xs text-muted-foreground">
                          بعد التنفيذ: {fmtLimitNum(Math.max(0, lineLimitPreview.remDailyWithdraw - lineLimitPreview.previewDelta))}
                        </p>
                      ) : null}
                      <p className="text-muted-foreground">
                        شهري: {lineLimitPreview.remMonthlyWithdraw > 0 ? fmtLimitNum(lineLimitPreview.remMonthlyWithdraw) : "غير مفعّل"}
                      </p>
                      {lineLimitPreview.previewDelta > 0 && lineLimitPreview.remMonthlyWithdraw > 0 ? (
                        <p className="text-xs text-muted-foreground">
                          بعد التنفيذ: {fmtLimitNum(Math.max(0, lineLimitPreview.remMonthlyWithdraw - lineLimitPreview.previewDelta))}
                        </p>
                      ) : null}
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">الإيداع</p>
                      <p className="text-muted-foreground">
                        يومي: {lineLimitPreview.remDailyDeposit > 0 ? fmtLimitNum(lineLimitPreview.remDailyDeposit) : "غير مفعّل"}
                      </p>
                      {lineLimitPreview.previewDelta > 0 && lineLimitPreview.remDailyDeposit > 0 ? (
                        <p className="text-xs text-muted-foreground">
                          بعد التنفيذ: {fmtLimitNum(Math.max(0, lineLimitPreview.remDailyDeposit - lineLimitPreview.previewDelta))}
                        </p>
                      ) : null}
                      <p className="text-muted-foreground">
                        شهري: {lineLimitPreview.remMonthlyDeposit > 0 ? fmtLimitNum(lineLimitPreview.remMonthlyDeposit) : "غير مفعّل"}
                      </p>
                      {lineLimitPreview.previewDelta > 0 && lineLimitPreview.remMonthlyDeposit > 0 ? (
                        <p className="text-xs text-muted-foreground">
                          بعد التنفيذ: {fmtLimitNum(Math.max(0, lineLimitPreview.remMonthlyDeposit - lineLimitPreview.previewDelta))}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">القيم على الخط هي «متبقي» وتنقص عند كل عملية؛ لا إعادة تعبئة يومية/شهرية تلقائية — عُد للخطوط لتعديل المتبقي عند الحاجة.</p>
                </>
              )}
            </div>
          ) : null}

          <Button type="submit" disabled={submitting || loading || (amountNum > 0 && !!sourceId && !selectedSourceIsSuitable)}>
            {submitting ? "جاري التنفيذ…" : "تنفيذ العملية"}
          </Button>
        </CardContent>
      </Card>

      {effectiveOperationType !== OPERATION_TYPE.EXTERNAL ? (
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
            <p className="text-destructive">لا توجد وسيلة تغطي العملية الحالية ضمن النوع المختار (رصيد أو ليميت أو حالة غير نشطة).</p>
          ) : (
            <>
              {sourceId && !selectedSourceIsSuitable ? (
                <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-destructive">
                  الوسيلة المختارة حاليًا في الحقل «الوسيلة» غير ضمن الترشيحات لهذا المبلغ. اختر «اختيار» من القائمة أدناه أو غيّر المبلغ/الرسوم.
                </p>
              ) : null}
              <p className="text-xs text-muted-foreground">
                {sourceKind === SOURCE_KIND.MACHINE
                  ? "الترتيب حسب الرصيد فقط (بعد خصم المبلغ والرسوم عند السحب/التحويل، أو رصيد أعلى بعد الإيداع)."
                  : "الترتيب حسب أضيق هامش بين رصيد الخط ومتبقي الليميت اليومي/الشهري على المستند."}
              </p>
              <ol className="list-decimal space-y-3 pe-5 marker:text-muted-foreground">
                {suitableSources.map((r) => (
                  <li key={r.id} className="min-w-0">
                    <div className={cn("flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between", r.id === sourceId && "border-primary/60 bg-muted/40")}>
                      <div className="min-w-0 space-y-1">
                        <p className="font-medium text-foreground">{sourceLabel({ id: r.id, row: r.row }, sourceKind)}</p>
                        <p className="text-muted-foreground">{suitabilityDescriptionAr({ executable: r.executable, margin: r.margin, sourceKind, operationType: effectiveOperationType, amount: amountNum, commission: commissionNum })}</p>
                        <p dir="ltr" className="font-mono text-xs text-muted-foreground">مؤشر الهامش: {formatRankingMarginDisplay(r.margin)}</p>
                        <p dir="ltr" className="font-mono text-xs text-muted-foreground">الرصيد المتاح: {sourceKind === SOURCE_KIND.MACHINE ? parseMachineBalance(r.row).toFixed(2) : parseLineAmount(r.row).toFixed(2)}</p>
                      </div>
                      <Button type="button" size="sm" variant="outline" className="shrink-0" onClick={() => setSourceId(r.id)}>اختيار</Button>
                    </div>
                  </li>
                ))}
              </ol>
            </>
          )}
        </CardContent>
      </Card>
      ) : null}
    </form>
  );
}
