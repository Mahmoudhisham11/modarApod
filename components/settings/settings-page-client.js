"use client";

import { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchUserDocByEmail, updateUserLocks, userLocksFromData } from "@/lib/auth/user-locks";

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
  });
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
      });
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userEmail]);

  const handleFirstPassword = async () => {
    if (!userDocId || !password.trim()) {
      toast.error("أدخل كلمة المرور");
      return;
    }
    setSaving(true);
    try {
      await updateUserLocks(userDocId, {
        lockPassword: password.trim(),
        lockReports: locks.reports,
        lockNumbers: locks.numbers,
        lockMoney: locks.money,
        lockCash: locks.cash,
        lockDaily: locks.daily,
      });
      setHasPassword(true);
      setVerified(true);
      setPassword("");
      toast.success("تم تعيين كلمة المرور");
    } catch {
      toast.error("تعذر الحفظ");
    } finally {
      setSaving(false);
    }
  };

  const handleVerify = () => {
    if (passwordInput === "") {
      toast.error("أدخل كلمة المرور");
      return;
    }
    fetchUserDocByEmail(userEmail).then((found) => {
      if (!found) return;
      const data = userLocksFromData(found.data);
      if (passwordInput === data.lockPassword) {
        setVerified(true);
        toast.success("تم التحقق");
      } else {
        toast.error("كلمة المرور غير صحيحة");
      }
    });
  };

  const handleSaveLocks = async () => {
    if (!userDocId || !verified) return;
    setSaving(true);
    try {
      /** @type {Record<string, unknown>} */
      const patch = {
        lockReports: locks.reports,
        lockNumbers: locks.numbers,
        lockMoney: locks.money,
        lockCash: locks.cash,
        lockDaily: locks.daily,
      };
      if (newPassword.trim()) patch.lockPassword = newPassword.trim();
      await updateUserLocks(userDocId, patch);
      toast.success("تم تحديث الإعدادات");
      if (newPassword.trim()) setNewPassword("");
    } catch {
      toast.error("تعذر الحفظ");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">جاري التحميل…</p>;
  }

  return (
    <div className="mt-6 max-w-lg space-y-6">
      <Card className="border-border/60 shadow-[var(--shadow-card)]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Lock className="h-4 w-4" aria-hidden />
            كلمات المرور والأقفال
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!hasPassword ? (
            <>
              <PasswordField
                id="first-lock-password"
                label="كلمة مرور الأقفال (أول مرة)"
                value={password}
                onChange={setPassword}
              />
              <Button type="button" disabled={saving} onClick={handleFirstPassword}>
                حفظ كلمة المرور
              </Button>
            </>
          ) : !verified ? (
            <>
              <PasswordField
                id="verify-lock-password"
                label="أدخل كلمة المرور للمتابعة"
                value={passwordInput}
                onChange={setPasswordInput}
              />
              <Button type="button" variant="secondary" onClick={handleVerify}>
                تحقق
              </Button>
            </>
          ) : (
            <>
              <div className="space-y-3">
                <LockToggle
                  id="lock-reports"
                  label="قفل صفحة التقارير"
                  checked={locks.reports}
                  onCheckedChange={(v) => setLocks((l) => ({ ...l, reports: v }))}
                />
                <LockToggle
                  id="lock-numbers"
                  label="قفل صفحة الخطوط"
                  checked={locks.numbers}
                  onCheckedChange={(v) => setLocks((l) => ({ ...l, numbers: v }))}
                />
                <LockToggle
                  id="lock-money"
                  label="إخفاء المبالغ في لوحة التحكم"
                  checked={locks.money}
                  onCheckedChange={(v) => setLocks((l) => ({ ...l, money: v }))}
                />
                <LockToggle
                  id="lock-cash"
                  label="قفل تعديل النقدية"
                  checked={locks.cash}
                  onCheckedChange={(v) => setLocks((l) => ({ ...l, cash: v }))}
                />
                <LockToggle
                  id="lock-daily"
                  label="قفل حذف العمليات"
                  checked={locks.daily}
                  onCheckedChange={(v) => setLocks((l) => ({ ...l, daily: v }))}
                />
              </div>
              <PasswordField
                id="new-lock-password"
                label="كلمة مرور جديدة (اختياري)"
                value={newPassword}
                onChange={setNewPassword}
              />
              <Button type="button" disabled={saving} onClick={handleSaveLocks}>
                حفظ التغييرات
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/** @param {{ id: string; label: string; value: string; onChange: (v: string) => void }} p */
function PasswordField({ id, label, value, onChange }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type="password" value={value} onChange={(e) => onChange(e.target.value)} autoComplete="off" />
    </div>
  );
}

/** @param {{ id: string; label: string; checked: boolean; onCheckedChange: (v: boolean) => void }} p */
function LockToggle({ id, label, checked, onCheckedChange }) {
  return (
    <div className="flex items-center gap-2">
      <Checkbox id={id} checked={checked} onCheckedChange={onCheckedChange} />
      <Label htmlFor={id} className="cursor-pointer font-normal">
        {label}
      </Label>
    </div>
  );
}
