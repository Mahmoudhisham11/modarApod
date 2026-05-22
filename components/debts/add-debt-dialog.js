"use client";

import { useRef, useState } from "react";
import { Camera, HandCoins, ImageIcon, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Check } from "lucide-react";

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
import { cn } from "@/lib/utils";

/**
 * @param {{
 *   shop: string;
 *   userEmail: string;
 *   onDebtCreated: () => void;
 *   children: import("react").ReactNode;
 * }} props
 */
export function AddDebtDialog({ shop, userEmail, onDebtCreated, children }) {
  const [open, setOpen] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState("ليك");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [imageFile, setImageFile] = useState(/** @type {File | null} */ (null));
  const [imagePreview, setImagePreview] = useState(/** @type {string | null} */ (null));
  const cameraRef = useRef(/** @type {HTMLInputElement | null} */ (null));
  const fileRef = useRef(/** @type {HTMLInputElement | null} */ (null));

  const amt = Number(amount);
  const amtValid = Number.isFinite(amt) && amt > 0;

  const reset = () => {
    setCustomerName("");
    setAmount("");
    setType("ليك");
    setNote("");
    setImageFile(null);
    setImagePreview(null);
  };

  const handleImageSelect = (file) => {
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(/** @type {string} */ (e.target?.result));
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (cameraRef.current) cameraRef.current.value = "";
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleSubmit = async () => {
    const name = customerName.trim();
    if (!name) {
      toast.error("أدخل اسم العميل.");
      return;
    }
    if (!amtValid) {
      toast.error("أدخل مبلغًا صحيحًا أكبر من صفر.");
      return;
    }
    setBusy(true);
    try {
      let imageUrl = "";
      if (imageFile) {
        const { uploadToCloudinary } = await import("@/lib/cloudinary/upload");
        imageUrl = await uploadToCloudinary(imageFile);
      }
      const { createDebt } = await import("@/lib/debts/debts-service");
      await createDebt({
        customerName: name,
        amount: amt,
        type: /** @type {"ليك" | "عليك"} */ (type),
        shop: shop.trim(),
        createdBy: userEmail,
        note: note.trim(),
        imageUrl,
      });
      toast.success("تم تسجيل الدين بنجاح.");
      setOpen(false);
      reset();
      onDebtCreated();
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
            دين جديد
          </DialogTitle>
          <DialogDescription>سجل دينًا جديدًا على عميل.</DialogDescription>
        </DialogHeader>

        <div className="max-h-[75vh] space-y-4 overflow-y-auto px-1">
          <div className="space-y-2">
            <Label htmlFor="debt-customer">اسم العميل</Label>
            <Input
              id="debt-customer"
              placeholder="اسم العميل"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="debt-amount">المبلغ</Label>
            <Input
              id="debt-amount"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              dir="ltr"
            />
          </div>

          <div className="space-y-2">
            <Label>نوع الدين</Label>
            <div className="flex gap-2">
              <button
                type="button"
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                  type === "ليك"
                    ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400"
                    : "border-border bg-background text-muted-foreground hover:bg-muted",
                )}
                onClick={() => setType("ليك")}
              >
                {type === "ليك" ? <Check className="h-3.5 w-3.5" /> : null}
                لك (مستحق لك)
              </button>
              <button
                type="button"
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                  type === "عليك"
                    ? "border-red-300 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-950/50 dark:text-red-400"
                    : "border-border bg-background text-muted-foreground hover:bg-muted",
                )}
                onClick={() => setType("عليك")}
              >
                {type === "عليك" ? <Check className="h-3.5 w-3.5" /> : null}
                عليك (مستحق عليك)
              </button>
            </div>
          </div>

          {/* Image upload */}
          <div className="space-y-2">
            <Label>صورة (اختياري)</Label>
            {imagePreview ? (
              <div className="relative overflow-hidden rounded-lg border">
                <img
                  src={imagePreview}
                  alt="معاينة الصورة"
                  className="h-40 w-full object-cover"
                />
                <button
                  type="button"
                  className="absolute end-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-background/80 text-destructive shadow"
                  onClick={removeImage}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  ref={cameraRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => handleImageSelect(e.target.files?.[0] ?? null)}
                />
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleImageSelect(e.target.files?.[0] ?? null)}
                />
                <button
                  type="button"
                  className="flex flex-1 items-center justify-center gap-2 rounded-md border border-dashed px-3 py-3 text-sm text-muted-foreground transition-colors hover:bg-muted"
                  onClick={() => cameraRef.current?.click()}
                >
                  <Camera className="h-5 w-5" />
                  تصوير
                </button>
                <button
                  type="button"
                  className="flex flex-1 items-center justify-center gap-2 rounded-md border border-dashed px-3 py-3 text-sm text-muted-foreground transition-colors hover:bg-muted"
                  onClick={() => fileRef.current?.click()}
                >
                  <Upload className="h-5 w-5" />
                  رفع صورة
                </button>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="debt-note">ملاحظة (اختياري)</Label>
            <Input
              id="debt-note"
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
          <Button type="button" disabled={busy} onClick={() => void handleSubmit()}>
            {busy ? "جاري التسجيل…" : "تسجيل الدين"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
