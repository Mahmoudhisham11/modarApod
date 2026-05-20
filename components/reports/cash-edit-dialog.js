"use client";

import { useState } from "react";
import { Wallet } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createCashAdditionOperation } from "@/lib/shops/cash-service";

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
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSubmit = async () => {
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
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
      });
      toast.success("تم إضافة النقدي بنجاح.");
      setOpen(false);
      setAmount("");
      setNote("");
      onCashChanged();
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
            <Wallet className="h-5 w-5" aria-hidden />
            إضافة نقدي
          </DialogTitle>
          <DialogDescription>أدخل المبلغ النقدي المضاف وملاحظة إن وجدت.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cash-amount">المبلغ</Label>
            <Input
              id="cash-amount"
              type="number"
              step="0.01"
              min="0"
              placeholder="المبلغ النقدي المضاف"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              dir="ltr"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cash-note">ملاحظة</Label>
            <Input
              id="cash-note"
              placeholder="اختياري — سبب الإضافة"
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
            {busy ? "جاري الحفظ…" : "حفظ"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
