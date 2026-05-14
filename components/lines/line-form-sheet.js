"use client";

import { useState } from "react";
import {
  Calendar,
  IdCard,
  MapPin,
  Smartphone,
  TrendingDown,
  TrendingUp,
  User,
  UserRound,
  UsersRound,
  Wallet,
} from "lucide-react";
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
import {
  buildLineDocumentPayload,
  parseFiniteNumberOrZero,
  todayYmdLocal,
  currentMonthNumber,
} from "@/lib/lines/line-payload";
import { isLinePhoneTaken } from "@/lib/lines/phone-normalize";
import { createNumberDocument, updateNumberDocument } from "@/lib/lines/numbers-service";
import {
  createInstapayLineDocument,
  updateInstapayLineDocument,
} from "@/lib/instapay/instapay-lines-service";
import { cn } from "@/lib/utils";

/** @param {unknown} v */
function asString(v) {
  if (v === null || v === undefined) return "";
  return String(v);
}

/** @param {unknown} err @param {string} [collectionHint] */
function toastFirestoreError(err, collectionHint) {
  if (err && typeof err === "object" && "code" in err && String(err.code) === "permission-denied") {
    toast.error(
      collectionHint
        ? `Firestore رفض الطلب. راجع قواعد الأمان لمجموعة ${collectionHint}.`
        : "Firestore رفض الطلب. راجع قواعد الأمان.",
    );
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
 *   htmlFor: string;
 *   label: string;
 *   icon: (props: { className?: string; "aria-hidden"?: boolean }) => import("react").JSX.Element;
 *   children: import("react").ReactNode;
 *   className?: string;
 * }} props
 */
function FieldWithIcon({ htmlFor, label, icon: Icon, children, className }) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      <div className="relative">
        <Icon
          className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        {children}
      </div>
    </div>
  );
}

/**
 * يُعاد تركيب المكوّن من الأب عبر `key` عند كل فتح (إنشاء/تعديل) لمزامنة الحقول.
 * @param {{
 *   open: boolean;
 *   onOpenChange: (open: boolean) => void;
 *   mode: "create" | "edit";
 *   shop: string;
 *   defaultUserEmail: string;
 *   initialRow: (Record<string, unknown> & { id?: string }) | null;
 *   existingRows: Array<{ id: string; phone?: unknown }>;
 *   onSaved: () => void | Promise<void>;
 *   persistTarget?: "numbers" | "instapayLines";
 *   lineKind?: "telecom" | "instapay";
 * }} props
 */
export function LineFormSheet({
  open,
  onOpenChange,
  mode,
  shop,
  defaultUserEmail,
  initialRow,
  existingRows,
  onSaved,
  persistTarget = "numbers",
  lineKind = "telecom",
}) {
  const [phone, setPhone] = useState(() =>
    mode === "edit" && initialRow ? asString(initialRow.phone) : "",
  );
  const [name, setName] = useState(() =>
    mode === "edit" && initialRow ? asString(initialRow.name) : "",
  );
  const [idNumber, setIdNumber] = useState(() =>
    mode === "edit" && initialRow ? asString(initialRow.idNumber) : "",
  );
  const [amount, setAmount] = useState(() =>
    mode === "edit" && initialRow ? asString(initialRow.amount) : "",
  );
  const [depositLimit, setDepositLimit] = useState(() =>
    mode === "edit" && initialRow ? asString(initialRow.depositLimit) : "0",
  );
  const [withdrawLimit, setWithdrawLimit] = useState(() =>
    mode === "edit" && initialRow ? asString(initialRow.withdrawLimit) : "0",
  );
  const [dailyDeposit, setDailyDeposit] = useState(() =>
    mode === "edit" && initialRow ? asString(initialRow.dailyDeposit) : "0",
  );
  const [dailyWithdraw, setDailyWithdraw] = useState(() =>
    mode === "edit" && initialRow ? asString(initialRow.dailyWithdraw) : "0",
  );
  const [address, setAddress] = useState(() =>
    mode === "edit" && initialRow ? asString(initialRow.address) : "",
  );
  const [maternalGrandfatherName, setMaternalGrandfatherName] = useState(() =>
    mode === "edit" && initialRow ? asString(initialRow.maternalGrandfatherName) : "",
  );
  const [maternalGrandmotherName, setMaternalGrandmotherName] = useState(() =>
    mode === "edit" && initialRow ? asString(initialRow.maternalGrandmotherName) : "",
  );
  const [activationDate, setActivationDate] = useState(() => {
    if (mode === "edit" && initialRow) {
      const raw = asString(initialRow.activationDate).trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
      return "";
    }
    return "";
  });
  const [submitting, setSubmitting] = useState(false);

  const excludeId = mode === "edit" && initialRow?.id ? String(initialRow.id) : undefined;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      toast.error("اسم المالك ورقم الخط مطلوبان");
      return;
    }
    if (isLinePhoneTaken(existingRows, phone, excludeId)) {
      toast.error("رقم الخط مسجل مسبقًا في القائمة الحالية");
      return;
    }

    const userEmail =
      mode === "edit" && initialRow
        ? asString(initialRow.userEmail).trim() || defaultUserEmail.trim()
        : defaultUserEmail.trim();
    const originalDepositLimit =
      mode === "edit" && initialRow ? asString(initialRow.originalDepositLimit) : "";
    const originalWithdrawLimit =
      mode === "edit" && initialRow ? asString(initialRow.originalWithdrawLimit) : "";
    const lastDailyReset =
      mode === "edit" && initialRow
        ? asString(initialRow.lastDailyReset).trim() || todayYmdLocal()
        : todayYmdLocal();
    const lastMonthlyReset =
      mode === "edit" && initialRow
        ? parseFiniteNumberOrZero(asString(initialRow.lastMonthlyReset)) || currentMonthNumber()
        : currentMonthNumber();

    const payload = buildLineDocumentPayload({
      name,
      phone,
      userEmail,
      shop,
      channelType: lineKind === "instapay" ? "instapay" : "telecom",
      dailyDeposit: parseFiniteNumberOrZero(dailyDeposit),
      dailyWithdraw: parseFiniteNumberOrZero(dailyWithdraw),
      depositLimit: parseFiniteNumberOrZero(depositLimit),
      withdrawLimit: parseFiniteNumberOrZero(withdrawLimit),
      amount,
      idNumber,
      address,
      maternalGrandfatherName,
      maternalGrandmotherName,
      activationDate,
      originalDepositLimit,
      originalWithdrawLimit,
      lastDailyReset,
      lastMonthlyReset,
    });

    const collectionHint = persistTarget === "instapayLines" ? "instapayLines" : "numbers";

    setSubmitting(true);
    try {
      if (mode === "create") {
        if (persistTarget === "instapayLines") {
          await createInstapayLineDocument(payload);
        } else {
          await createNumberDocument(payload);
        }
        toast.success(lineKind === "instapay" ? "تمت إضافة سجل انستاباي" : "تمت إضافة الخط");
      } else if (initialRow?.id) {
        if (persistTarget === "instapayLines") {
          await updateInstapayLineDocument(String(initialRow.id), payload);
        } else {
          await updateNumberDocument(String(initialRow.id), payload);
        }
        toast.success(lineKind === "instapay" ? "تم تحديث سجل انستاباي" : "تم تحديث الخط");
      }
      await onSaved();
      onOpenChange(false);
    } catch (err) {
      toastFirestoreError(err, collectionHint);
    } finally {
      setSubmitting(false);
    }
  };

  const sheetTitleCreate = lineKind === "instapay" ? "إضافة انستاباي" : "إضافة خط اتصالات";
  const sheetTitleEdit = lineKind === "instapay" ? "تعديل انستاباي" : "تعديل خط اتصالات";

  const iconInputClass = "ps-9";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-md">
        <SheetHeader className="text-start">
          <SheetTitle>{mode === "create" ? sheetTitleCreate : sheetTitleEdit}</SheetTitle>
          <SheetDescription>
            الفرع: <span className="font-medium text-foreground">{shop}</span>. حقول الليميت أدناه تُخزَّن كـ«متبقي»
            وتنقص عند تنفيذ عمليات من صفحة العمليات؛ أعد القيم يدويًا عند بداية يوم/شهر أو عند التعبئة.
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-4 py-4">
          <div className="grid gap-4 sm:grid-cols-1">
            <FieldWithIcon htmlFor="line-phone" label="رقم الخط" icon={Smartphone}>
              <Input
                id="line-phone"
                value={phone}
                onChange={(ev) => setPhone(ev.target.value)}
                dir="ltr"
                className={cn(iconInputClass, "text-start font-mono")}
                autoComplete="off"
              />
            </FieldWithIcon>
            <FieldWithIcon htmlFor="line-owner" label="اسم المالك" icon={User}>
              <Input
                id="line-owner"
                value={name}
                onChange={(ev) => setName(ev.target.value)}
                className={iconInputClass}
                autoComplete="off"
              />
            </FieldWithIcon>
            <FieldWithIcon htmlFor="line-nid" label="الرقم القومي" icon={IdCard}>
              <Input
                id="line-nid"
                value={idNumber}
                onChange={(ev) => setIdNumber(ev.target.value)}
                dir="ltr"
                className={cn(iconInputClass, "text-start font-mono")}
              />
            </FieldWithIcon>
            <FieldWithIcon htmlFor="line-balance" label="الرصيد" icon={Wallet}>
              <Input
                id="line-balance"
                value={amount}
                onChange={(ev) => setAmount(ev.target.value)}
                dir="ltr"
                className={cn(iconInputClass, "text-start font-mono")}
              />
            </FieldWithIcon>

            <div className="grid grid-cols-2 gap-3">
              <FieldWithIcon htmlFor="line-wd-month" label="متبقي سحب شهري" icon={TrendingDown}>
                <Input
                  id="line-wd-month"
                  value={withdrawLimit}
                  onChange={(ev) => setWithdrawLimit(ev.target.value)}
                  dir="ltr"
                  className={cn(iconInputClass, "text-start font-mono")}
                />
              </FieldWithIcon>
              <FieldWithIcon htmlFor="line-dep-month" label="متبقي إيداع شهري" icon={TrendingUp}>
                <Input
                  id="line-dep-month"
                  value={depositLimit}
                  onChange={(ev) => setDepositLimit(ev.target.value)}
                  dir="ltr"
                  className={cn(iconInputClass, "text-start font-mono")}
                />
              </FieldWithIcon>
              <FieldWithIcon htmlFor="line-wd-day" label="متبقي يومي سحب" icon={TrendingDown}>
                <Input
                  id="line-wd-day"
                  value={dailyWithdraw}
                  onChange={(ev) => setDailyWithdraw(ev.target.value)}
                  dir="ltr"
                  className={cn(iconInputClass, "text-start font-mono")}
                />
              </FieldWithIcon>
              <FieldWithIcon htmlFor="line-dep-day" label="متبقي يومي إيداع" icon={TrendingUp}>
                <Input
                  id="line-dep-day"
                  value={dailyDeposit}
                  onChange={(ev) => setDailyDeposit(ev.target.value)}
                  dir="ltr"
                  className={cn(iconInputClass, "text-start font-mono")}
                />
              </FieldWithIcon>
            </div>

            <FieldWithIcon htmlFor="line-addr" label="العنوان" icon={MapPin}>
              <Input id="line-addr" value={address} onChange={(ev) => setAddress(ev.target.value)} className={iconInputClass} />
            </FieldWithIcon>
            <FieldWithIcon htmlFor="line-gf" label="الجد" icon={UsersRound}>
              <Input
                id="line-gf"
                value={maternalGrandfatherName}
                onChange={(ev) => setMaternalGrandfatherName(ev.target.value)}
                className={iconInputClass}
              />
            </FieldWithIcon>
            <FieldWithIcon htmlFor="line-gm" label="الجدة" icon={UserRound}>
              <Input
                id="line-gm"
                value={maternalGrandmotherName}
                onChange={(ev) => setMaternalGrandmotherName(ev.target.value)}
                className={iconInputClass}
              />
            </FieldWithIcon>
            <FieldWithIcon htmlFor="line-act" label="تاريخ التفعيل" icon={Calendar}>
              <Input
                id="line-act"
                type="date"
                value={activationDate}
                onChange={(ev) => setActivationDate(ev.target.value)}
                dir="ltr"
                className={cn(iconInputClass, "text-start font-mono")}
              />
            </FieldWithIcon>
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
