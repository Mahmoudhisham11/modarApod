"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { HandCoins, Landmark, Wallet } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { SOURCE_KIND, SOURCE_KIND_LABEL } from "@/lib/operations/constants";
import { getLineLimitUsageSnapshot, lineLimitRemaindersFromRow } from "@/lib/operations/eligibility";
import { cn } from "@/lib/utils";

/**
 * @param {{
 *   debtId: string;
 *   customerName: string;
 *   currentRemaining: number;
 *   debtType: "ليك" | "عليك";
 *   shop: string;
 *   userEmail: string;
 *   onPaymentDone: (newRemaining: number) => void;
 *   children: import("react").ReactNode;
 * }} props
 */
export function DebtPaymentDialog({
  debtId,
  customerName,
  currentRemaining,
  debtType,
  shop,
  userEmail,
  onPaymentDone,
  children,
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState(/** @type {"cash" | "wallet"} */ ("cash"));
  const [sourceKind, setSourceKind] = useState(/** @type {import("@/lib/operations/constants").SourceKind} */ (SOURCE_KIND.TELECOM));
  const [sourceId, setSourceId] = useState("");
  const [sources, setSources] = useState(/** @type {Array<{ id: string; label: string; balance: number; row: Record<string, unknown> }>} */ ([]));
  const [sourcesLoading, setSourcesLoading] = useState(false);

  const amt = Number(amount);
  const amtValid = Number.isFinite(amt) && amt > 0;
  const exceedsRemaining = amtValid && amt > currentRemaining;
  const selectedSource = useMemo(() => sources.find((s) => s.id === sourceId), [sources, sourceId]);
  const exceedsSourceBalance = selectedSource && amtValid && amt > selectedSource.balance;

  const lineLimitPreview = useMemo(() => {
    if (!selectedSource || !amtValid || sourceKind === SOURCE_KIND.MACHINE) return null;
    const snap = getLineLimitUsageSnapshot({ sourceKind, sourceRow: selectedSource.row, sourceId, operations: [], now: new Date() });
    if (!snap) return null;
    return {
      remDailyWithdraw: snap.remDailyWithdraw,
      remMonthlyWithdraw: snap.remMonthlyWithdraw,
      remDailyDeposit: snap.remDailyDeposit,
      remMonthlyDeposit: snap.remMonthlyDeposit,
      previewDelta: amt,
    };
  }, [selectedSource, amtValid, sourceKind, sourceId, amt]);

  const loadSources = useCallback(async () => {
    setSourcesLoading(true);
    try {
      const col = sourceKind === SOURCE_KIND.TELECOM
        ? "numbers"
        : sourceKind === SOURCE_KIND.INSTAPAY
          ? "instapayLines"
          : "machines";
      const { collection, getDocs, limit, query, where } = await import("firebase/firestore");
      const { db } = await import("@/app/firebase");
      const q = query(collection(db, col), where("shop", "==", shop.trim()), limit(200));
      const snap = await getDocs(q);
      const list = snap.docs.map((d) => {
        const row = d.data();
        let balance = 0;
        if (sourceKind === SOURCE_KIND.MACHINE) {
          balance = Number(row.balance) || 0;
        } else {
          balance = Number(row.amount ?? row.balance ?? 0) || 0;
        }
        const label = row.name ?? row.phone ?? row.number ?? row.line ?? d.id;
        return { id: d.id, label: String(label), balance, row };
      });
      setSources(list);
      if (list.length > 0 && !list.find((s) => s.id === sourceId)) {
        setSourceId(list[0].id);
      }
    } catch {
      setSources([]);
    } finally {
      setSourcesLoading(false);
    }
  }, [sourceKind, shop, sourceId]);

  useEffect(() => {
    if (paymentMethod === "wallet") void loadSources();
  }, [paymentMethod, loadSources]);

  const reset = () => {
    setAmount("");
    setNote("");
    setPaymentMethod("cash");
    setSourceKind(SOURCE_KIND.TELECOM);
    setSourceId("");
  };

  const handleSubmit = async () => {
    if (!amtValid) {
      toast.error("أدخل مبلغًا صحيحًا أكبر من صفر.");
      return;
    }
    if (exceedsRemaining) {
      toast.error("المبلغ المسدد أكبر من المتبقي.");
      return;
    }
    if (paymentMethod === "wallet") {
      if (!sourceId) {
        toast.error("اختر الوسيلة.");
        return;
      }
      if (exceedsSourceBalance) {
        toast.error("المبلغ يتجاوز رصيد الوسيلة.");
        return;
      }
    }
    setBusy(true);
    try {
      const { makeDebtPayment } = await import("@/lib/debts/debts-service");
      await makeDebtPayment({
        debtId,
        amount: amt,
        shop: shop.trim(),
        createdBy: userEmail,
        note: note.trim(),
        paymentMethod,
        sourceId: paymentMethod === "wallet" ? sourceId : undefined,
        sourceKind: paymentMethod === "wallet" ? sourceKind : undefined,
        debtType,
      });
      const newRemaining = currentRemaining - amt;
      toast.success("تم تسجيل السداد بنجاح.");
      setOpen(false);
      reset();
      onPaymentDone(Math.max(0, newRemaining));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "حدث خطأ";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HandCoins className="h-5 w-5" aria-hidden />
            سداد دين
          </DialogTitle>
          <DialogDescription>
            تسديد دفعة من دين "{customerName}".
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-4 overflow-y-auto px-1">
          <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm">
            <span className="text-muted-foreground">المتبقي: </span>
            <span className="font-mono font-semibold tabular-nums text-foreground">
              {currentRemaining.toFixed(2)}
            </span>
            {amtValid && !exceedsRemaining ? (
              <span className="me-2 text-muted-foreground">
                → <span className="font-mono tabular-nums text-foreground">
                  {Math.max(0, currentRemaining - amt).toFixed(2)}
                </span>
              </span>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label>طريقة السداد</Label>
            <div className="flex gap-2">
              <button
                type="button"
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                  paymentMethod === "cash"
                    ? "border-primary/50 bg-primary/10 text-primary"
                    : "border-border bg-background text-muted-foreground hover:bg-muted",
                )}
                onClick={() => setPaymentMethod("cash")}
              >
                <Landmark className="h-4 w-4" />
                نقدي
              </button>
              <button
                type="button"
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                  paymentMethod === "wallet"
                    ? "border-primary/50 bg-primary/10 text-primary"
                    : "border-border bg-background text-muted-foreground hover:bg-muted",
                )}
                onClick={() => setPaymentMethod("wallet")}
              >
                <Wallet className="h-4 w-4" />
                محفظة
              </button>
            </div>
            {paymentMethod === "cash" ? (
              <p className="text-xs text-muted-foreground">
                {debtType === "ليك" ? "سيتم إيداع المبلغ في النقدي (زيادة الرصيد)" : "سيتم خصم المبلغ من النقدي (نقص الرصيد)"}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment-amount">المبلغ المسدد</Label>
            <Input
              id="payment-amount"
              type="number"
              step="0.01"
              min="0"
              max={currentRemaining}
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              dir="ltr"
            />
            {exceedsRemaining ? (
              <p className="text-xs text-destructive">المبلغ يتجاوز المتبقي ({currentRemaining.toFixed(2)})</p>
            ) : null}
            {exceedsSourceBalance ? (
              <p className="text-xs text-destructive">المبلغ يتجاوز رصيد الوسيلة ({selectedSource?.balance.toFixed(2)})</p>
            ) : null}
          </div>

          {paymentMethod === "wallet" ? (
            <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
              <div className="space-y-2">
                <Label>نوع الوسيلة</Label>
                <Select
                  value={sourceKind}
                  onValueChange={(v) => { setSourceKind(/** @type {import("@/lib/operations/constants").SourceKind} */ (v)); setSourceId(""); }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SOURCE_KIND.TELECOM}>{SOURCE_KIND_LABEL.telecom}</SelectItem>
                    <SelectItem value={SOURCE_KIND.INSTAPAY}>{SOURCE_KIND_LABEL.instapay}</SelectItem>
                    <SelectItem value={SOURCE_KIND.MACHINE}>{SOURCE_KIND_LABEL.machine}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>اختر الخط</Label>
                {sourcesLoading ? (
                  <p className="text-xs text-muted-foreground">جاري التحميل…</p>
                ) : sources.length === 0 ? (
                  <p className="text-xs text-muted-foreground">لا توجد وسائل متاحة.</p>
                ) : (
                  <Select value={sourceId} onValueChange={setSourceId}>
                    <SelectTrigger>
                      <SelectValue placeholder="اختر…" />
                    </SelectTrigger>
                    <SelectContent>
                      {sources.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.label} (الرصيد: {s.balance.toFixed(2)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {selectedSource && amtValid ? (
                <>
                  <div className="rounded-md border border-border bg-background px-3 py-2 text-xs">
                    <span className="text-muted-foreground">الرصيد الحالي: </span>
                    <span className="font-mono tabular-nums">{selectedSource.balance.toFixed(2)}</span>
                    {!exceedsSourceBalance ? (
                      <>
                        <span className="mx-1 text-muted-foreground">→</span>
                        <span className="font-mono tabular-nums">
                          {(selectedSource.balance - amt).toFixed(2)}
                        </span>
                      </>
                    ) : null}
                  </div>
                  {lineLimitPreview && sourceKind !== SOURCE_KIND.MACHINE ? (
                    <div className="rounded-md border border-border bg-background px-3 py-2 text-xs space-y-1">
                      <p className="font-medium text-foreground">الليميت على الخط</p>
                      <div className="grid gap-1 sm:grid-cols-2">
                        <div>
                          <p className="text-muted-foreground">
                            سحب يومي: {lineLimitPreview.remDailyWithdraw > 0 ? lineLimitPreview.remDailyWithdraw.toFixed(2) : "غير مفعّل"}
                          </p>
                          {lineLimitPreview.remDailyWithdraw > 0 ? (
                            <p className="text-muted-foreground">
                              بعد السداد: {Math.max(0, lineLimitPreview.remDailyWithdraw - lineLimitPreview.previewDelta).toFixed(2)}
                            </p>
                          ) : null}
                          <p className="text-muted-foreground">
                            سحب شهري: {lineLimitPreview.remMonthlyWithdraw > 0 ? lineLimitPreview.remMonthlyWithdraw.toFixed(2) : "غير مفعّل"}
                          </p>
                          {lineLimitPreview.remMonthlyWithdraw > 0 ? (
                            <p className="text-muted-foreground">
                              بعد السداد: {Math.max(0, lineLimitPreview.remMonthlyWithdraw - lineLimitPreview.previewDelta).toFixed(2)}
                            </p>
                          ) : null}
                        </div>
                        <div>
                          <p className="text-muted-foreground">
                            إيداع يومي: {lineLimitPreview.remDailyDeposit > 0 ? lineLimitPreview.remDailyDeposit.toFixed(2) : "غير مفعّل"}
                          </p>
                          {lineLimitPreview.remDailyDeposit > 0 ? (
                            <p className="text-muted-foreground">
                              بعد السداد: {Math.max(0, lineLimitPreview.remDailyDeposit + lineLimitPreview.previewDelta).toFixed(2)}
                            </p>
                          ) : null}
                          <p className="text-muted-foreground">
                            إيداع شهري: {lineLimitPreview.remMonthlyDeposit > 0 ? lineLimitPreview.remMonthlyDeposit.toFixed(2) : "غير مفعّل"}
                          </p>
                          {lineLimitPreview.remMonthlyDeposit > 0 ? (
                            <p className="text-muted-foreground">
                              بعد السداد: {Math.max(0, lineLimitPreview.remMonthlyDeposit + lineLimitPreview.previewDelta).toFixed(2)}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="payment-note">ملاحظة (اختياري)</Label>
            <Input
              id="payment-note"
              placeholder="ملاحظة"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={() => { setOpen(false); reset(); }}>
            إلغاء
          </Button>
          <Button
            type="button"
            disabled={busy || exceedsRemaining || (paymentMethod === "wallet" && exceedsSourceBalance)}
            onClick={() => void handleSubmit()}
          >
            {busy ? "جاري التسجيل…" : "تسديد"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
