"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Camera, CalendarDays, HandCoins, Landmark, Trash2, Upload, Wallet } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SOURCE_KIND, SOURCE_KIND_LABEL } from "@/lib/operations/constants";
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
  const [dueDate, setDueDate] = useState("");
  const [paymentMethod, setPaymentMethod] = useState(/** @type {"cash" | "wallet" | ""} */ (""));
  const [sourceKind, setSourceKind] = useState(/** @type {import("@/lib/operations/constants").SourceKind} */ (SOURCE_KIND.TELECOM));
  const [sourceId, setSourceId] = useState("");
  const [sources, setSources] = useState(/** @type {Array<{ id: string; label: string; balance: number }>} */ ([]));
  const [sourcesLoading, setSourcesLoading] = useState(false);
  const cameraRef = useRef(/** @type {HTMLInputElement | null} */ (null));
  const fileRef = useRef(/** @type {HTMLInputElement | null} */ (null));

  const amt = Number(amount);
  const amtValid = Number.isFinite(amt) && amt > 0;
  const selectedSource = useMemo(() => sources.find((s) => s.id === sourceId), [sources, sourceId]);

  const loadSources = useCallback(async () => {
    if (paymentMethod !== "wallet") return;
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
        return { id: d.id, label: String(label), balance };
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
  }, [sourceKind, shop, sourceId, paymentMethod]);

  useEffect(() => {
    if (paymentMethod === "wallet") void loadSources();
  }, [paymentMethod, sourceKind, loadSources]);

  const reset = () => {
    setCustomerName("");
    setAmount("");
    setType("ليك");
    setNote("");
    setImageFile(null);
    setImagePreview(null);
    setDueDate("");
    setPaymentMethod("");
    setSourceKind(SOURCE_KIND.TELECOM);
    setSourceId("");
    setSources([]);
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
    if (paymentMethod === "wallet" && !sourceId) {
      toast.error("اختر الوسيلة.");
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
        dueDate: dueDate.trim(),
        paymentMethod: paymentMethod || undefined,
        sourceId: paymentMethod === "wallet" ? sourceId : undefined,
        sourceKind: paymentMethod === "wallet" ? sourceKind : undefined,
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

          {/* Payment method */}
          <div className="space-y-2">
            <Label>طريقة الدفع (اختياري)</Label>
            <div className="flex gap-2">
              <button
                type="button"
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                  paymentMethod === "cash"
                    ? "border-primary/50 bg-primary/10 text-primary"
                    : "border-border bg-background text-muted-foreground hover:bg-muted",
                )}
                onClick={() => { setPaymentMethod(paymentMethod === "cash" ? "" : "cash"); setSourceId(""); }}
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
                onClick={() => { setPaymentMethod(paymentMethod === "wallet" ? "" : "wallet"); }}
              >
                <Wallet className="h-4 w-4" />
                محفظة
              </button>
            </div>
            {paymentMethod === "cash" ? (
              <p className="text-xs text-muted-foreground">
                {type === "ليك" ? "سيتم خصم المبلغ من النقدي" : "سيتم إيداع المبلغ في النقدي"}
              </p>
            ) : null}
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
                  <Label>اختر الوسيلة</Label>
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
                  <div className="rounded-md border border-border bg-background px-3 py-2 text-xs">
                    <span className="text-muted-foreground">الرصيد الحالي: </span>
                    <span className="font-mono tabular-nums">{selectedSource.balance.toFixed(2)}</span>
                    {amt <= selectedSource.balance ? (
                      <>
                        <span className="mx-1 text-muted-foreground">→</span>
                        <span className="font-mono tabular-nums">
                          {type === "ليك"
                            ? (selectedSource.balance - amt).toFixed(2)
                            : (selectedSource.balance + amt).toFixed(2)}
                        </span>
                      </>
                    ) : null}
                  </div>
                ) : null}
                {amtValid && selectedSource && amt > selectedSource.balance && type === "ليك" ? (
                  <p className="text-xs text-destructive">الرصيد لا يكفي.</p>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* Due date */}
          <div className="space-y-2">
            <Label htmlFor="debt-due-date">موعد السداد (اختياري)</Label>
            <div className="relative">
              <CalendarDays className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="debt-due-date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="ps-3 pe-9"
              />
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
