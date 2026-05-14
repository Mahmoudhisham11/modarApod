"use client";

import { useState } from "react";
import { Cpu, Wallet } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { createMachineDocument, updateMachineDocument } from "@/lib/machines/machines-service";
import { parseFiniteNumberOrZero } from "@/lib/lines/line-payload";
import { cn } from "@/lib/utils";

/** @param {unknown} v */
function asString(v) {
  if (v === null || v === undefined) return "";
  return String(v);
}

/** @param {unknown} err */
function toastFirestoreError(err) {
  if (err && typeof err === "object" && "code" in err && String(err.code) === "permission-denied") {
    toast.error("Firestore رفض الطلب. راجع قواعد الأمان لمجموعة machines.");
    return;
  }
  if (err instanceof Error && err.message) {
    toast.error(err.message);
    return;
  }
  toast.error("حدث خطأ أثناء الحفظ");
}

/**
 * @param {{
 *   open: boolean;
 *   onOpenChange: (open: boolean) => void;
 *   mode: "create" | "edit";
 *   shop: string;
 *   defaultUserEmail: string;
 *   initialRow: (Record<string, unknown> & { id?: string }) | null;
 *   onSaved: () => void | Promise<void>;
 * }} props
 */
export function MachineFormSheet({ open, onOpenChange, mode, shop, defaultUserEmail, initialRow, onSaved }) {
  const [name, setName] = useState(() =>
    mode === "edit" && initialRow ? asString(initialRow.name) : "",
  );
  const [balance, setBalance] = useState(() =>
    mode === "edit" && initialRow ? asString(initialRow.balance) : "",
  );
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("اسم الماكينة مطلوب");
      return;
    }
    const bal = parseFiniteNumberOrZero(balance);
    setSubmitting(true);
    try {
      if (mode === "create") {
        await createMachineDocument({
          name,
          balance: bal,
          shop,
          userEmail: defaultUserEmail.trim(),
        });
        toast.success("تمت إضافة الماكينة");
      } else if (initialRow?.id) {
        await updateMachineDocument(String(initialRow.id), { name, balance: bal });
        toast.success("تم تحديث الماكينة");
      }
      await onSaved();
      onOpenChange(false);
    } catch (err) {
      toastFirestoreError(err);
    } finally {
      setSubmitting(false);
    }
  };

  const iconClass = "ps-9";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-md">
        <SheetHeader className="text-start">
          <SheetTitle>{mode === "create" ? "إضافة ماكينة" : "تعديل ماكينة"}</SheetTitle>
          <SheetDescription>
            الفرع: <span className="font-medium text-foreground">{shop}</span>
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="machine-name">اسم الماكينة</Label>
            <div className="relative">
              <Cpu className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                id="machine-name"
                value={name}
                onChange={(ev) => setName(ev.target.value)}
                className={cn(iconClass)}
                autoComplete="off"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="machine-balance">الرصيد</Label>
            <div className="relative">
              <Wallet className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                id="machine-balance"
                value={balance}
                onChange={(ev) => setBalance(ev.target.value)}
                dir="ltr"
                className={cn(iconClass, "text-start font-mono")}
              />
            </div>
          </div>
          <SheetFooter className="mt-auto gap-2 border-t border-border pt-4 sm:justify-start">
            <Button type="submit" disabled={submitting}>
              {submitting ? "جاري الحفظ…" : "حفظ"}
            </Button>
            <Button type="button" variant="outline" disabled={submitting} onClick={() => onOpenChange(false)}>
              إلغاء
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
