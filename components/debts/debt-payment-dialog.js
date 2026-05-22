"use client";

import { useState } from "react";
import { HandCoins } from "lucide-react";
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

/**
 * @param {{
 *   debtId: string;
 *   customerName: string;
 *   currentRemaining: number;
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
  shop,
  userEmail,
  onPaymentDone,
  children,
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const amt = Number(amount);
  const amtValid = Number.isFinite(amt) && amt > 0;
  const exceedsRemaining = amtValid && amt > currentRemaining;

  const reset = () => {
    setAmount("");
    setNote("");
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
    setBusy(true);
    try {
      const { makeDebtPayment } = await import("@/lib/debts/debts-service");
      const newRemaining = await makeDebtPayment({
        debtId,
        amount: amt,
        shop: shop.trim(),
        createdBy: userEmail,
        note: note.trim(),
      });
      toast.success("تم تسجيل السداد بنجاح.");
      setOpen(false);
      reset();
      onPaymentDone(newRemaining);
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

        <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm">
          <span className="text-muted-foreground">المتبقي: </span>
          <span className="font-mono font-semibold tabular-nums text-foreground">
            {currentRemaining.toFixed(2)}
          </span>
          {amtValid && !exceedsRemaining ? (
            <span className="me-2 text-muted-foreground">
              → <span className="font-mono tabular-nums text-foreground">
                {(currentRemaining - amt).toFixed(2)}
              </span>
            </span>
          ) : null}
        </div>

        <div className="space-y-4">
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
          </div>
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
          <Button type="button" disabled={busy || exceedsRemaining} onClick={() => void handleSubmit()}>
            {busy ? "جاري التسجيل…" : "تسديد"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
