"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  EyeOff,
  HandCoins,
  LogIn,
  Mail,
  MousePointerClick,
  Pencil,
  Percent,
  ShieldCheck,
  Trash2,
  User,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  deleteUserDoc,
  fetchUserByField,
  fetchUserDocByEmail,
  fetchUsersByBranch,
  updateUserFields,
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
 * @param {{ userEmail: string; userBranch: string }} props
 */
export function SettingsPageClient({ userEmail, userBranch }) {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [selectedUserEmail, setSelectedUserEmail] = useState("");
  const [selectedUserDocId, setSelectedUserDocId] = useState("");
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

  // User data editing state
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editBranch, setEditBranch] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [savingUserData, setSavingUserData] = useState(false);

  // Delete confirmation
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadUserData = useCallback(async (email) => {
    const found = await fetchUserDocByEmail(email);
    if (!found) return;
    setSelectedUserDocId(found.id);
    const data = userLocksFromData(found.data);
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
    setEditName(typeof found.data.name === "string" ? found.data.name : "");
    setEditEmail(typeof found.data.email === "string" ? found.data.email : "");
    setEditBranch(typeof found.data.shop === "string" ? found.data.shop : typeof found.data.branch === "string" ? found.data.branch : "");
    setEditPassword("");
    setConfirmDelete(false);
  }, []);

  // Load users from the same branch on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const branchUsers = await fetchUsersByBranch(userBranch);
      if (cancelled) return;
      setUsers(branchUsers);
      const currentUser = branchUsers.find((u) => u.email === userEmail);
      const target = currentUser || branchUsers[0];
      if (target) {
        setSelectedUserEmail(target.email);
        await loadUserData(target.email);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [userBranch, userEmail, loadUserData]);

  // When selected user changes, load their data
  const handleUserChange = useCallback(async (email) => {
    setSelectedUserEmail(email);
    await loadUserData(email);
  }, [loadUserData]);

  const handleSaveLocks = useCallback(async () => {
    if (!selectedUserDocId) return;
    setSaving(true);
    try {
      await updateUserLocks(selectedUserDocId, {
        lockReports: locks.reports,
        lockNumbers: locks.numbers,
        lockMoney: locks.money,
        lockCash: locks.cash,
        lockDaily: locks.daily,
        lockDebts: locks.debts,
        commissionPercentWithdraw,
        commissionPercentDeposit,
      });
      toast.success("تم تحديث الصلاحيات");
    } catch { toast.error("تعذر الحفظ"); }
    finally { setSaving(false); }
  }, [selectedUserDocId, locks, commissionPercentWithdraw, commissionPercentDeposit]);

  const handleSaveUserData = useCallback(async () => {
    if (!selectedUserDocId) return;
    if (!editName.trim()) { toast.error("الاسم مطلوب"); return; }
    if (!editEmail.trim()) { toast.error("البريد الإلكتروني مطلوب"); return; }

    // Check if email is taken by another user
    const emailMatch = await fetchUserByField("email", editEmail.trim().toLowerCase(), selectedUserDocId);
    if (emailMatch) { toast.error("البريد الإلكتروني مستخدم من قبل مستخدم آخر"); return; }

    // Check if name is taken by another user
    const nameMatch = await fetchUserByField("name", editName.trim(), selectedUserDocId);
    if (nameMatch) { toast.error("الاسم مستخدم من قبل مستخدم آخر"); return; }

    setSavingUserData(true);
    try {
      const patch = {
        name: editName.trim(),
        email: editEmail.trim().toLowerCase(),
        shop: editBranch.trim() || userBranch,
        branch: editBranch.trim() || userBranch,
      };
      if (editPassword.trim()) patch.password = editPassword.trim();
      await updateUserFields(selectedUserDocId, patch);

      // Refresh the users list
      const branchUsers = await fetchUsersByBranch(userBranch);
      setUsers(branchUsers);

      toast.success("تم تحديث بيانات المستخدم");
      setEditPassword("");
    } catch { toast.error("تعذر الحفظ"); }
    finally { setSavingUserData(false); }
  }, [selectedUserDocId, editName, editEmail, editBranch, editPassword, userBranch]);

  const handleDeleteUser = useCallback(async () => {
    if (!selectedUserDocId) return;
    setDeleting(true);
    try {
      await deleteUserDoc(selectedUserDocId);
      toast.success("تم حذف المستخدم");

      // Refresh users list
      const branchUsers = await fetchUsersByBranch(userBranch);
      setUsers(branchUsers);

      // Select another user
      if (branchUsers.length > 0) {
        const next = branchUsers[0];
        setSelectedUserEmail(next.email);
        await loadUserData(next.email);
      } else {
        setSelectedUserEmail("");
        setSelectedUserDocId("");
      }
    } catch { toast.error("تعذر الحذف"); }
    finally { setDeleting(false); setConfirmDelete(false); }
  }, [selectedUserDocId, userBranch, loadUserData]);

  const selectedUserName = useMemo(() => {
    const u = users.find((u) => u.email === selectedUserEmail);
    return u ? u.name : "";
  }, [users, selectedUserEmail]);

  if (loading) {
    return (
      <div className="mt-6 space-y-6">
        <div className="h-48 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-8">

      {/* ──────── User selector ──────── */}
      <div className="max-w-md space-y-2">
        <Label htmlFor="user-select" className="text-sm font-medium">اختر المستخدم</Label>
        <div className="relative">
          <Users className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <select
            id="user-select"
            dir="rtl"
            value={selectedUserEmail}
            onChange={(e) => handleUserChange(e.target.value)}
            className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 [appearance:none]"
          >
            {users.map((u) => (
              <option key={u.id} value={u.email}>
                {u.name} ({u.email})
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        </div>
      </div>

      {selectedUserEmail && (
        <>
          {/* ──────── بيانات المستخدم ──────── */}
          <Card className="border-border/60 shadow-[var(--shadow-card)]">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <User className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-lg">بيانات المستخدم</CardTitle>
                  <CardDescription>تعديل بيانات المستخدم <strong>{selectedUserName}</strong></CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="edit-name" className="text-sm font-medium">الاسم</Label>
                  <div className="relative">
                    <User className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="edit-name"
                      type="text"
                      className="pe-10"
                      dir="rtl"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-email" className="text-sm font-medium">البريد الإلكتروني</Label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="edit-email"
                      type="email"
                      className="pe-10"
                      dir="ltr"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-branch" className="text-sm font-medium">الفرع</Label>
                  <div className="relative">
                    <Users className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="edit-branch"
                      type="text"
                      className="pe-10"
                      dir="rtl"
                      value={editBranch}
                      onChange={(e) => setEditBranch(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-password" className="text-sm font-medium">كلمة المرور (اتركها فارغة إن لم ترد التغيير)</Label>
                  <div className="relative">
                    <Pencil className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="edit-password"
                      type="password"
                      className="pe-10"
                      dir="ltr"
                      value={editPassword}
                      onChange={(e) => setEditPassword(e.target.value)}
                      autoComplete="off"
                    />
                  </div>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="button" disabled={savingUserData} onClick={handleSaveUserData}>
                  حفظ بيانات المستخدم
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* ──────── الصلاحيات ──────── */}
          <Card className="border-border/60 shadow-[var(--shadow-card)]">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-lg">الصلاحيات</CardTitle>
                  <CardDescription>تحكم في صلاحيات المستخدم</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-4 py-3 text-sm">
                <Users className="h-4 w-4 text-primary" />
                <span>جار تعديل صلاحيات: <strong>{selectedUserName}</strong></span>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {LOCK_ITEMS.map(({ key, label, description, icon: Icon }) => (
                  <LockToggle
                    key={key}
                    id={`lock-${key}`}
                    label={label}
                    description={description}
                    icon={Icon}
                    checked={locks[key]}
                    onCheckedChange={(v) => setLocks((l) => ({ ...l, [key]: v }))}
                  />
                ))}
              </div>

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

              <div className="flex border-t border-border pt-6">
                <Button type="button" disabled={saving || !selectedUserDocId} onClick={handleSaveLocks}>
                  حفظ الصلاحيات
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* ──────── حذف المستخدم ──────── */}
          <Card className="border-border/60 shadow-[var(--shadow-card)] border-destructive/30">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                  <Trash2 className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-lg text-destructive">حذف المستخدم</CardTitle>
                  <CardDescription>هذا الإجراء لا يمكن التراجع عنه</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {!confirmDelete ? (
                <Button
                  type="button"
                  variant="destructive"
                  disabled={selectedUserEmail === userEmail}
                  title={selectedUserEmail === userEmail ? "لا يمكن حذف حسابك الحالي" : ""}
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="ms-1 h-4 w-4" /> حذف المستخدم
                </Button>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-destructive">
                    هل أنت متأكد من حذف المستخدم <strong>{selectedUserName}</strong>؟ هذا الإجراء لا يمكن التراجع عنه.
                  </p>
                  <div className="flex gap-2">
                    <Button type="button" variant="destructive" disabled={deleting} onClick={handleDeleteUser}>
                      {deleting ? "جار الحذف..." : "تأكيد الحذف"}
                    </Button>
                    <Button type="button" variant="outline" disabled={deleting} onClick={() => setConfirmDelete(false)}>
                      إلغاء
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

/* ───────── helpers ───────── */

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
