"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Calculator,
  EyeOff,
  HandCoins,
  Lock,
  LogIn,
  MousePointerClick,
  Percent,
  ShieldCheck,
  Trash2,
  UserCog,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  fetchUserDocByEmail,
  fetchUsersByBranch,
  updateUserLocks,
  userLocksFromData,
} from "@/lib/auth/user-locks";

const SELECT_NONE = "__none__";

const LOCK_ITEMS = [
  { key: "reports", label: "التقارير", description: "يمنع المستخدم من دخول صفحة التقارير", icon: HandCoins },
  { key: "numbers", label: "الخطوط", description: "يمنع المستخدم من دخول صفحة الخطوط", icon: LogIn },
  { key: "money", label: "إخفاء المبالغ", description: "يخفي قيم المبالغ في لوحة التحكم", icon: EyeOff },
  { key: "cash", label: "النقدية", description: "يمنع تعديل رصيد النقدي", icon: MousePointerClick },
  { key: "daily", label: "حذف العمليات", description: "يمنع حذف العمليات", icon: Trash2 },
  { key: "debts", label: "الديون", description: "يمنع المستخدم من دخول صفحة الديون", icon: HandCoins },
];

/**
 * @param {{ userEmail: string; shop: string }} props
 */
export function SettingsPageClient({ userEmail, shop }) {
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
  const [merchantPercent, setMerchantPercent] = useState(0);
  const [saving, setSaving] = useState(false);

  const [branchUsers, setBranchUsers] = useState(/** @type {Array<{ id: string; email: string; name: string }>} */ ([]));
  const [usersLoading, setUsersLoading] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedUserLocks, setSelectedUserLocks] = useState({
    reports: false,
    numbers: false,
    money: false,
    cash: false,
    daily: false,
    debts: false,
  });
  const [selectedUserCommissionWithdraw, setSelectedUserCommissionWithdraw] = useState(0);
  const [selectedUserCommissionDeposit, setSelectedUserCommissionDeposit] = useState(0);
  const [selectedUserMerchantPercent, setSelectedUserMerchantPercent] = useState(0);
  const [selectedUserLoading, setSelectedUserLoading] = useState(false);
  const [savingUser, setSavingUser] = useState(false);

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
      setMerchantPercent(data.merchantPercent);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [userEmail]);

  const loadBranchUsers = useCallback(async () => {
    if (!shop.trim()) return;
    setUsersLoading(true);
    try {
      const users = await fetchUsersByBranch(shop.trim());
      setBranchUsers(users.filter((u) => u.email !== userEmail));
    } catch {
      toast.error("تعذّر تحميل المستخدمين");
    } finally {
      setUsersLoading(false);
    }
  }, [shop, userEmail]);

  useEffect(() => {
    if (!selectedUserId || selectedUserId === SELECT_NONE) {
      setSelectedUserLocks({ reports: false, numbers: false, money: false, cash: false, daily: false });
      setSelectedUserCommissionWithdraw(0);
      setSelectedUserCommissionDeposit(0);
      setSelectedUserMerchantPercent(0);
      return;
    }
    let cancelled = false;
    (async () => {
      setSelectedUserLoading(true);
      try {
        const found = await fetchUserDocByEmail(
          branchUsers.find((u) => u.id === selectedUserId)?.email ?? "",
        );
        if (cancelled || !found) return;
        const data = userLocksFromData(found.data);
        if (!cancelled) {
          setSelectedUserLocks({
            reports: data.lockReports,
            numbers: data.lockNumbers,
            money: data.lockMoney,
            cash: data.lockCash,
            daily: data.lockDaily,
            debts: data.lockDebts,
          });
          setSelectedUserCommissionWithdraw(data.commissionPercentWithdraw);
          setSelectedUserCommissionDeposit(data.commissionPercentDeposit);
          setSelectedUserMerchantPercent(data.merchantPercent);
        }
      } catch {
        if (!cancelled) toast.error("تعذّر تحميل صلاحيات المستخدم");
      } finally {
        if (!cancelled) setSelectedUserLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedUserId, branchUsers]);

  const selectedUser = useMemo(
    () => branchUsers.find((u) => u.id === selectedUserId) ?? null,
    [branchUsers, selectedUserId],
  );

  const handleFirstPassword = async () => {
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
        merchantPercent,
      });
      setHasPassword(true);
      setVerified(true);
      setPassword("");
      toast.success("تم تعيين كلمة المرور");
    } catch { toast.error("تعذر الحفظ"); }
    finally { setSaving(false); }
  };

  const handleVerify = () => {
    if (passwordInput === "") { toast.error("أدخل كلمة المرور"); return; }
    fetchUserDocByEmail(userEmail).then((found) => {
      if (!found) return;
      const data = userLocksFromData(found.data);
      if (passwordInput === data.lockPassword) { setVerified(true); toast.success("تم التحقق"); }
      else { toast.error("كلمة المرور غير صحيحة"); }
    });
  };

  const handleSaveLocks = async () => {
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
        merchantPercent,
      };
      if (newPassword.trim()) patch.lockPassword = newPassword.trim();
      await updateUserLocks(userDocId, patch);
      toast.success("تم تحديث الإعدادات");
      if (newPassword.trim()) setNewPassword("");
    } catch { toast.error("تعذر الحفظ"); }
    finally { setSaving(false); }
  };

  const handleSaveUserLocks = async () => {
    if (!selectedUserId) { toast.error("اختر مستخدم أولاً"); return; }
    setSavingUser(true);
    try {
      await updateUserLocks(selectedUserId, {
        lockReports: selectedUserLocks.reports,
        lockNumbers: selectedUserLocks.numbers,
        lockMoney: selectedUserLocks.money,
        lockCash: selectedUserLocks.cash,
        lockDaily: selectedUserLocks.daily,
        lockDebts: selectedUserLocks.debts,
        commissionPercentWithdraw: selectedUserCommissionWithdraw,
        commissionPercentDeposit: selectedUserCommissionDeposit,
        merchantPercent: selectedUserMerchantPercent,
      });
      toast.success("تم تحديث صلاحيات المستخدم");
    } catch { toast.error("تعذر الحفظ"); }
    finally { setSavingUser(false); }
  };

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

              {/* Merchant percent */}
              <div className="grid gap-4 border-t border-border pt-6 sm:grid-cols-2">
                <div className="max-w-xs flex-1">
                  <div className="space-y-2">
                    <Label htmlFor="merchant-percent" className="text-sm font-medium">
                      نسبة رسوم التجار (%)
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      تتحسب رسوم التجار تلقائي من النسبة دي. اترك 0 للتحكم اليدوي.
                    </p>
                    <div className="relative">
                      <Input
                        id="merchant-percent"
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        dir="ltr"
                        className="font-mono pe-8"
                        value={merchantPercent || ""}
                        onChange={(e) => setMerchantPercent(Number(e.target.value) || 0)}
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

      {/* ──────── إدارة صلاحيات المستخدمين ──────── */}
      {verified ? (
        <Card className="border-border/60 shadow-[var(--shadow-card)]">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg">صلاحيات المستخدمين</CardTitle>
                <CardDescription>اختر مستخدم من فرعك وعدّل صلاحياته</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="max-w-sm space-y-1.5">
              <Label htmlFor="user-select" className="text-sm font-medium">اختر مستخدم</Label>
              <Select
                value={selectedUserId || SELECT_NONE}
                onValueChange={(v) => setSelectedUserId(v === SELECT_NONE ? "" : v)}
                disabled={usersLoading || branchUsers.length === 0}
                onOpenChange={(open) => { if (open) void loadBranchUsers(); }}
              >
                <SelectTrigger id="user-select">
                  <SelectValue placeholder="اختر مستخدم…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SELECT_NONE}>— اختر —</SelectItem>
                  {branchUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name || u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {usersLoading ? <p className="text-xs text-muted-foreground">جاري التحميل…</p> : null}
              {!usersLoading && branchUsers.length === 0 ? (
                <p className="text-xs text-muted-foreground">لا يوجد مستخدمون آخرون في هذا الفرع.</p>
              ) : null}
            </div>

            {selectedUser ? (
              <div className="space-y-6">
                <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 px-4 py-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <UserCog className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {selectedUser.name || "مستخدم"}
                    </p>
                    <p className="text-xs text-muted-foreground">{selectedUser.email}</p>
                  </div>
                </div>

                {selectedUserLoading ? (
                  <div className="h-32 animate-pulse rounded-lg bg-muted" />
                ) : (
                  <>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {LOCK_ITEMS.map(({ key, label, description, icon: Icon }) => (
                        <LockToggle
                          key={key}
                          id={`user-${key}`}
                          label={label}
                          description={description}
                          icon={Icon}
                          checked={selectedUserLocks[key]}
                          onCheckedChange={(v) => setSelectedUserLocks((l) => ({ ...l, [key]: v }))}
                        />
                      ))}
                    </div>

                    <div className="grid gap-4 border-t border-border pt-6 sm:grid-cols-2">
                      <div className="max-w-xs flex-1">
                        <div className="space-y-2">
                          <Label htmlFor="user-commission-withdraw" className="text-sm font-medium">
                            نسبة رسوم السحب (%)
                          </Label>
                          <div className="relative">
                            <Input
                              id="user-commission-withdraw"
                              type="number"
                              step="0.01"
                              min="0"
                              max="100"
                              dir="ltr"
                              className="font-mono pe-8"
                              value={selectedUserCommissionWithdraw || ""}
                              onChange={(e) => setSelectedUserCommissionWithdraw(Number(e.target.value) || 0)}
                            />
                            <Percent className="pointer-events-none absolute end-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          </div>
                        </div>
                      </div>
                      <div className="max-w-xs flex-1">
                        <div className="space-y-2">
                          <Label htmlFor="user-commission-deposit" className="text-sm font-medium">
                            نسبة رسوم الإيداع (%)
                          </Label>
                          <div className="relative">
                            <Input
                              id="user-commission-deposit"
                              type="number"
                              step="0.01"
                              min="0"
                              max="100"
                              dir="ltr"
                              className="font-mono pe-8"
                              value={selectedUserCommissionDeposit || ""}
                              onChange={(e) => setSelectedUserCommissionDeposit(Number(e.target.value) || 0)}
                            />
                            <Percent className="pointer-events-none absolute end-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-4 border-t border-border pt-6 sm:grid-cols-2">
                      <div className="max-w-xs flex-1">
                        <div className="space-y-2">
                          <Label htmlFor="user-merchant-percent" className="text-sm font-medium">
                            نسبة رسوم التجار (%)
                          </Label>
                          <div className="relative">
                            <Input
                              id="user-merchant-percent"
                              type="number"
                              step="0.01"
                              min="0"
                              max="100"
                              dir="ltr"
                              className="font-mono pe-8"
                              value={selectedUserMerchantPercent || ""}
                              onChange={(e) => setSelectedUserMerchantPercent(Number(e.target.value) || 0)}
                            />
                            <Percent className="pointer-events-none absolute end-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end border-t border-border pt-6">
                      <Button type="button" disabled={savingUser} onClick={handleSaveUserLocks}>
                        {savingUser ? "جاري الحفظ…" : "حفظ صلاحيات المستخدم"}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
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
