"use client";

import { useCallback, useEffect, useState } from "react";
import {
  EyeOff,
  HandCoins,
  Lock,
  LogIn,
  MousePointerClick,
  Percent,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  fetchUserDocByEmail,
  updateUserLocks,
  userLocksFromData,
} from "@/lib/auth/user-locks";

const LOCK_ITEMS = [
  { key: "reports", label: "التقارير", description: "يمنع المستخدم من دخول صفحة التقارير", icon: HandCoins },
  { key: "numbers", label: "الخطوط", description: "يمنع المستخدم من دخول صفحة الخطوط", icon: LogIn },
  { key: "money", label: "إخفاء المبالغ", description: "يخفي قيم المبالغ في لوحة التحكم", icon: EyeOff },
  { key: "cash", label: "النقدية", description: "يمنع تعديل رصيد النقدي", icon: MousePointerClick },
  { key: "daily", label: "حذف العمليات", description: "يمنع حذف العمليات", icon: Trash2 },
  { key: "debts", label: "الديون", description: "يمنع المستخدم من دخول صفحة الديون", icon: HandCoins },
];

/**
 * @param {{ userEmail: string }} props
 */
export function SettingsPageClient({ userEmail }) {
  const [loading, setLoading] = useState(true);
  const [userDocId, setUserDocId] = useState("");
  const [hasPassword, setHasPassword] = useState(false);
  const [verified, setVerified] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [locks, setLocks] = useState({
    reports: false,
    numbers: false,
    money: false,
    cash: false,
    daily: false,
    debts: false,
  });
  const [commissionPercentWithdraw, setCommissionPercentWithdraw] = useState(0);
  const [commissionPercentDeposit, setCommissionPercentDeposit] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const found = await fetchUserDocByEmail(userEmail);
      if (cancelled) return;
      if (!found) {
        setLoading(false);
        return;
      }
      setUserDocId(found.id);
      const data = userLocksFromData(found.data);
      setHasPassword(Boolean(data.lockPassword));
      setLocks({
        reports: data.lockReports,
        numbers: data.lockNumbers,
        money: data.lockMoney,
        cash: data.lockCash,
        daily: data.lockDaily,
        debts: data.lockDebts,
      });
      setCommissionPercentWithdraw(data.commissionPercentWithdraw);
      setCommissionPercentDeposit(data.commissionPercentDeposit);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [userEmail]);

  const handleFirstPassword = useCallback(async () => {
    if (!userDocId || !password.trim()) { toast.error("أدخل كلمة المرور"); return; }
    setSaving(true);
    try {
      await updateUserLocks(userDocId, {
        lockPassword: password.trim(),
        lockReports: locks.reports,
        lockNumbers: locks.numbers,
        lockMoney: locks.money,
        lockCash: locks.cash,
        lockDaily: locks.daily,
        lockDebts: locks.debts,
        commissionPercentWithdraw,
        commissionPercentDeposit,
      });
      setHasPassword(true);
      setVerified(true);
      setPassword("");
      toast.success("تم تعيين كلمة المرور");
    } catch { toast.error("تعذر الحفظ"); }
    finally { setSaving(false); }
  }, [userDocId, password, locks, commissionPercentWithdraw, commissionPercentDeposit]);

  const handleVerify = useCallback(() => {
    if (passwordInput === "") { toast.error("أدخل كلمة المرور"); return; }
    fetchUserDocByEmail(userEmail).then((found) => {
      if (!found) return;
      const data = userLocksFromData(found.data);
      if (passwordInput === data.lockPassword) { setVerified(true); toast.success("تم التحقق"); }
      else { toast.error("كلمة المرور غير صحيحة"); }
    });
  }, [userEmail, passwordInput]);

  const handleSaveLocks = useCallback(async () => {
    if (!userDocId || !verified) return;
    setSaving(true);
    try {
      const patch = {
        lockReports: locks.reports,
        lockNumbers: locks.numbers,
        lockMoney: locks.money,
        lockCash: locks.cash,
        lockDaily: locks.daily,
        lockDebts: locks.debts,
        commissionPercentWithdraw,
        commissionPercentDeposit,
      };
      if (newPassword.trim()) patch.lockPassword = newPassword.trim();
      await updateUserLocks(userDocId, patch);
      toast.success("تم تحديث الإعدادات");
      if (newPassword.trim()) setNewPassword("");
    } catch { toast.error("تعذر الحفظ"); }
    finally { setSaving(false); }
  }, [userDocId, verified, locks, commissionPercentWithdraw, commissionPercentDeposit, newPassword]);

  if (loading) {
    return (
      <div className="mt-6 space-y-6">
        <div className="h-48 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-8">

      {/* ──────── كلمة المرور والأقفال ──────── */}
      <Card className="border-border/60 shadow-[var(--shadow-card)]">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg">الأمان والصلاحيات</CardTitle>
              <CardDescription>تحكم في صلاحيات حسابك</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {!hasPassword ? (
            <div className="max-w-md space-y-4">
              <p className="text-sm text-muted-foreground">
                قبل البدء، يجب تعيين كلمة مرور للأقفال. هذه الكلمة ستستخدم للتحقق من هويتك عند تغيير الصلاحيات.
              </p>
              <PasswordField
                id="first-lock-password"
                label="كلمة مرور الأقفال"
                value={password}
                onChange={setPassword}
              />
              <Button type="button" disabled={saving} onClick={handleFirstPassword}>
                تعيين كلمة المرور
              </Button>
            </div>
          ) : !verified ? (
            <div className="max-w-md space-y-4">
              <p className="text-sm text-muted-foreground">
                أدخل كلمة مرور الأقفال للمتابعة وتعديل الصلاحيات.
              </p>
              <PasswordField
                id="verify-lock-password"
                label="كلمة مرور الأقفال"
                value={passwordInput}
                onChange={setPasswordInput}
              />
              <div className="flex gap-2">
                <Button type="button" variant="secondary" onClick={handleVerify}>
                  <Lock className="ms-1 h-4 w-4" /> تحقق
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                <span>تم التحقق — يمكنك تعديل الإعدادات</span>
              </div>

              {/* الصلاحيات — 2-column grid */}
              <div className="grid gap-4 sm:grid-cols-2">
                {LOCK_ITEMS.map(({ key, label, description, icon: Icon }) => (
                  <LockToggle
                    key={key}
                    id={`my-${key}`}
                    label={label}
                    description={description}
                    icon={Icon}
                    checked={locks[key]}
                    onCheckedChange={(v) => setLocks((l) => ({ ...l, [key]: v }))}
                  />
                ))}
              </div>

              {/* Commission percents */}
              <div className="grid gap-4 border-t border-border pt-6 sm:grid-cols-2">
                <div className="max-w-xs flex-1">
                  <div className="space-y-2">
                    <Label htmlFor="commission-withdraw" className="text-sm font-medium">
                      نسبة رسوم السحب (%)
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      تتحسب رسوم السحب تلقائي من النسبة دي. اترك 0 للتحكم اليدوي.
                    </p>
                    <div className="relative">
                      <Input
                        id="commission-withdraw"
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        dir="ltr"
                        className="font-mono pe-8"
                        value={commissionPercentWithdraw || ""}
                        onChange={(e) => setCommissionPercentWithdraw(Number(e.target.value) || 0)}
                      />
                      <Percent className="pointer-events-none absolute end-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    </div>
                  </div>
                </div>
                <div className="max-w-xs flex-1">
                  <div className="space-y-2">
                    <Label htmlFor="commission-deposit" className="text-sm font-medium">
                      نسبة رسوم الإيداع (%)
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      تتحسب رسوم الإيداع تلقائي من النسبة دي. اترك 0 للتحكم اليدوي.
                    </p>
                    <div className="relative">
                      <Input
                        id="commission-deposit"
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        dir="ltr"
                        className="font-mono pe-8"
                        value={commissionPercentDeposit || ""}
                        onChange={(e) => setCommissionPercentDeposit(Number(e.target.value) || 0)}
                      />
                      <Percent className="pointer-events-none absolute end-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    </div>
                  </div>
                </div>
              </div>

              {/* New password + save */}
              <div className="flex flex-col gap-4 border-t border-border pt-6 sm:flex-row sm:items-end">
                <div className="max-w-xs flex-1">
                  <PasswordField
                    id="new-lock-password"
                    label="تغيير كلمة المرور (اختياري)"
                    value={newPassword}
                    onChange={setNewPassword}
                  />
                </div>
                <Button type="button" disabled={saving} onClick={handleSaveLocks}>
                  حفظ التغييرات
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ───────── helpers ───────── */

/** @param {{ id: string; label: string; value: string; onChange: (v: string) => void }} p */
function PasswordField({ id, label, value, onChange }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-sm font-medium">{label}</Label>
      <Input id={id} type="password" value={value} onChange={(e) => onChange(e.target.value)} autoComplete="off" />
    </div>
  );
}

/**
 * @param {{
 *   id: string;
 *   label: string;
 *   description: string;
 *   icon: import("lucide-react").LucideIcon;
 *   checked: boolean;
 *   onCheckedChange: (v: boolean) => void;
 * }} p
 */
function LockToggle({ id, label, description, icon: Icon, checked, onCheckedChange }) {
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-4 transition-colors hover:bg-muted/50 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2"
    >
      <div
        className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors ${
          checked ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"
        }`}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex flex-1 items-center justify-between gap-4">
        <div className="space-y-0.5">
          <p className="text-sm font-medium leading-snug text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <Checkbox id={id} checked={checked} onCheckedChange={onCheckedChange} />
      </div>
    </label>
  );
}
