"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, Wallet } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createCashAdditionOperation, fetchShopCash } from "@/lib/shops/cash-service";
import { cn } from "@/lib/utils";

/**
 * @param {{
 *   shop: string;
 *   userName: string;
 *   onCashChanged: () => void;
 *   children: import("react").ReactNode;
 * }} props
 */
export function CashEditDialog({ shop, userName, onCashChanged, children }) {
  const [open, setOpen] = useState(false);
  const [direction, setDirection] = useState(/** @type {"add" | "subtract"} */ ("add"));
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [currentCash, setCurrentCash] = useState(/** @type {number | null} */ (null));
  const [cashLoading, setCashLoading] = useState(false);

  const loadCash = useCallback(async () => {
    setCashLoading(true);
    try {
      const c = await fetchShopCash(shop.trim());
      setCurrentCash(c);
    } catch {
      setCurrentCash(null);
    } finally {
      setCashLoading(false);
    }
  }, [shop]);

  useEffect(() => {
    if (open) void loadCash();
  }, [open, loadCash]);

  const amt = Number(amount);
  const amtValid = Number.isFinite(amt) && amt > 0;
  const previewBalance = currentCash !== null && amtValid
    ? (direction === "add" ? currentCash + amt : currentCash - amt)
    : null;

  const handleSubmit = async () => {
    if (!amtValid) {
      toast.error("أدخل مبلغًا صحيحًا أكبر من صفر.");
      return;
    }
    setBusy(true);
    try {
      await createCashAdditionOperation({
        shop: shop.trim(),
        amount: amt,
        note: note.trim(),
        userName,
        createdBy: userName,
        direction,
      });
      toast.success(direction === "add" ? "تم إيداع النقدي بنجاح." : "تم سحب النقدي بنجاح.");
      setOpen(false);
      setAmount("");
      setNote("");
      setDirection("add");
      onCashChanged();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "حدث خطأ";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const isAdd = direction === "add";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" aria-hidden />
            تعديل النقدي
          </DialogTitle>
          <DialogDescription>اختر إيداع أو سحب وأدخل المبلغ.</DialogDescription>
        </DialogHeader>

        {/* الرصيد الحالي */}
        <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm">
          <span className="text-muted-foreground">الرصيد الحالي: </span>
          {cashLoading ? (
            <span className="inline-block h-4 w-16 animate-pulse rounded bg-muted align-middle" />
          ) : (
            <span className="font-mono font-semibold tabular-nums text-foreground">
              {currentCash !== null ? currentCash.toFixed(2) : "—"}
            </span>
          )}
          {previewBalance !== null ? (
            <span className="me-2 text-muted-foreground">
              → <span className="font-mono tabular-nums text-foreground">{previewBalance.toFixed(2)}</span>
            </span>
          ) : null}
        </div>

        <div className="space-y-4">
          <div className="flex gap-2">
            <Button
              type="button"
              variant={isAdd ? "default" : "outline"}
              size="sm"
              className={cn("flex-1 gap-1.5", isAdd && "pointer-events-none")}
              onClick={() => setDirection("add")}
            >
              <ArrowDownToLine className="h-4 w-4" />
              إيداع
            </Button>
            <Button
              type="button"
              variant={!isAdd ? "default" : "outline"}
              size="sm"
              className={cn("flex-1 gap-1.5", !isAdd && "pointer-events-none")}
              onClick={() => setDirection("subtract")}
            >
              <ArrowUpFromLine className="h-4 w-4" />
              سحب
            </Button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cash-amount">المبلغ</Label>
            <Input
              id="cash-amount"
              type="number"
              step="0.01"
              min="0"
              placeholder={isAdd ? "المبلغ النقدي المضاف" : "المبلغ النقدي المسحوب"}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              dir="ltr"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cash-note">ملاحظة</Label>
            <Input
              id="cash-note"
              placeholder="اختياري — سبب العملية"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={() => setOpen(false)}>
            إلغاء
          </Button>
          <Button type="button" disabled={busy} onClick={() => void handleSubmit()}>
            {busy ? "جاري التنفيذ…" : isAdd ? "إيداع" : "سحب"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
