"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { addDoc, collection, doc, getDocs, query, updateDoc, where } from "firebase/firestore";
import { ArrowLeft, Building2, Lock, Mail, ShieldCheck, User } from "lucide-react";
import { toast } from "sonner";

import { db } from "@/app/firebase";
import { AuthShell } from "@/components/layout/auth-shell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const USERS_COLLECTION = "users";

const SUBSCRIPTION_TOAST = "يجب تفعيل البرنامج أولًا برجاء التواصل مع المطور";

/** @param {unknown} err */
function toastFirestoreError(err) {
  if (err && typeof err === "object" && "code" in err && String(err.code) === "permission-denied") {
    toast.error(
      "Firestore رفض الطلب. راجع قواعد Firestore في Console للسماح بقراءة/كتابة users من العميل.",
    );
    return;
  }
  if (err instanceof Error && err.message) {
    toast.error(err.message);
    return;
  }
  toast.error("حدث خطأ أثناء الاتصال بقاعدة البيانات");
}

async function postSessionCookie({ email, name, branch, role, remember }) {
  const res = await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, name, branch, role, remember }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "تعذر إنشاء الجلسة");
  }
  return data;
}

/**
 * تسجيل دخول + إنشاء حساب (Firestore على users + كوكي جلسة لـ middleware).
 */
export function AuthFormInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mode = searchParams.get("mode") === "register" ? "register" : "login";

  const goLogin = useCallback(() => {
    router.replace("/login", { scroll: false });
  }, [router]);

  const goRegister = useCallback(() => {
    router.replace("/login?mode=register", { scroll: false });
  }, [router]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [name, setName] = useState("");
  const [branch, setBranch] = useState("");
  const [loading, setLoading] = useState(false);

  // forgot password state
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotStep, setForgotStep] = useState(/** @type {"email" | "password"} */ ("email"));
  const [forgotEmail, setForgotEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [forgotBusy, setForgotBusy] = useState(false);

  const onSubmitLogin = async (e) => {
    e.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      toast.error("يرجى إدخال البريد وكلمة المرور");
      return;
    }
    setLoading(true);
    try {
      const q = query(collection(db, USERS_COLLECTION), where("email", "==", normalizedEmail));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        toast.error("البريد الإلكتروني غير صحيح");
        return;
      }

      const userDoc = querySnapshot.docs[0];
      const userData = userDoc.data();

      if (userData.password !== password) {
        toast.error("كلمة المرور غير صحيحة");
        return;
      }

      if (userData.isSubscribed === false) {
        toast.error(SUBSCRIPTION_TOAST);
        return;
      }

      const displayName = typeof userData.name === "string" ? userData.name : "";
      const shop = typeof userData.shop === "string" ? userData.shop.trim() : "";
      const role = typeof userData.role === "string" ? userData.role : "cashier";

      await postSessionCookie({
        email: typeof userData.email === "string" ? userData.email : normalizedEmail,
        name: displayName || normalizedEmail.split("@")[0],
        branch: shop,
        role,
        remember,
      });

      toast.success("تم تسجيل الدخول");
      router.replace("/");
      router.refresh();
    } catch (err) {
      toastFirestoreError(err);
    } finally {
      setLoading(false);
    }
  };

  const onSubmitRegister = async (e) => {
    e.preventDefault();
    const normalizedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedShop = branch.trim();

    if (!normalizedName) {
      toast.error("يجب إدخال اسم المستخدم");
      return;
    }
    if (!normalizedEmail) {
      toast.error("يجب إدخال البريد الإلكتروني");
      return;
    }
    if (!password) {
      toast.error("يجب إدخال كلمة المرور");
      return;
    }
    if (!normalizedShop) {
      toast.error("يجب إدخال اسم الفرع");
      return;
    }
    if (normalizedShop.length < 2) {
      toast.error("يرجى إدخال اسم الفرع (حرفين على الأقل)");
      return;
    }

    setLoading(true);
    try {
      const q = query(collection(db, USERS_COLLECTION), where("email", "==", normalizedEmail));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        toast.error("البريد الإلكتروني مستخدم بالفعل");
        return;
      }

      await addDoc(collection(db, USERS_COLLECTION), {
        name: normalizedName,
        email: normalizedEmail,
        password,
        shop: normalizedShop,
        role: "cashier",
        isSubscribed: false,
      });

      toast.success("تم إنشاء حساب للمستخدم");
      setName("");
      setEmail("");
      setPassword("");
      setBranch("");
      goLogin();
    } catch (err) {
      toastFirestoreError(err);
    } finally {
      setLoading(false);
    }
  };

  const isLogin = mode === "login";

  return (
    <AuthShell
      title={isLogin ? "مرحبًا بعودتك" : "إنشاء حساب جديد"}
      subtitle={
        isLogin
          ? "سجّل الدخول لإدارة العمليات والفروع والخطوط."
          : "أدخل بياناتك واسم الفرع لإنشاء حسابك."
      }
    >
      {isLogin ? (
        <form onSubmit={onSubmitLogin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">البريد الإلكتروني</Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="ps-9"
                placeholder="you@example.com"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="password">كلمة المرور</Label>
              <button
                type="button"
                onClick={() => { setForgotOpen(true); setForgotStep("email"); setForgotEmail(email); setOtp(""); setNewPassword(""); }}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                نسيت؟
              </button>
            </div>
            <div className="relative">
              <Lock className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="ps-9"
                placeholder="••••••••"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox id="remember" checked={remember} onCheckedChange={(v) => setRemember(v === true)} />
            <Label htmlFor="remember" className="text-xs font-normal text-muted-foreground">
              إبقائي مسجّلًا على هذا الجهاز
            </Label>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "جاري الدخول…" : "تسجيل الدخول"}
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </form>
      ) : (
        <form onSubmit={onSubmitRegister} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reg-name">الاسم الكامل</Label>
            <div className="relative">
              <User className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="reg-name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="ps-9"
                placeholder="مثال: محمد أحمد"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reg-email">البريد الإلكتروني</Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="reg-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="ps-9"
                placeholder="you@company.com"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reg-branch">اسم الفرع</Label>
            <div className="relative">
              <Building2 className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="reg-branch"
                type="text"
                autoComplete="organization"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                className="ps-9"
                placeholder="مثال: فرع وسط البلد"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reg-password">كلمة المرور</Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="reg-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="ps-9"
                placeholder="كلمة المرور"
                required
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox id="reg-remember" checked={remember} onCheckedChange={(v) => setRemember(v === true)} />
            <Label htmlFor="reg-remember" className="text-xs font-normal text-muted-foreground">
              إبقائي مسجّلًا بعد إنشاء الحساب
            </Label>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "جاري الإنشاء…" : "إنشاء الحساب"}
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </form>
      )}

      <p className="mt-6 text-center text-sm text-muted-foreground">
        {isLogin ? (
          <>
            ليس لديك حساب؟{" "}
            <button
              type="button"
              onClick={goRegister}
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              إنشاء حساب جديد
            </button>
          </>
        ) : (
          <>
            لديك حساب بالفعل؟{" "}
            <button
              type="button"
              onClick={goLogin}
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              تسجيل الدخول
            </button>
          </>
        )}
      </p>

      {/* Forgot password dialog */}
      <Dialog open={forgotOpen} onOpenChange={(o) => { if (!o) { setForgotOpen(false); setForgotStep("email"); setOtp(""); setNewPassword(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" aria-hidden />
              {forgotStep === "email" ? "استعادة كلمة المرور" : "تغيير كلمة المرور"}
            </DialogTitle>
            <DialogDescription>
              {forgotStep === "email"
                ? "أدخل بريدك الإلكتروني لاستلام رمز التحقق."
                : "أدخل رمز التحقق الذي تلقيته وكلمة المرور الجديدة."}
            </DialogDescription>
          </DialogHeader>

          {forgotStep === "email" ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="forgot-email">البريد الإلكتروني</Label>
                <Input
                  id="forgot-email"
                  type="email"
                  dir="ltr"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="your@email.com"
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" disabled={forgotBusy} onClick={() => setForgotOpen(false)}>
                  إلغاء
                </Button>
                <Button
                  type="button"
                  disabled={forgotBusy || !forgotEmail.trim()}
                  onClick={async () => {
                    setForgotBusy(true);
                    try {
                      const normalizedEmail = forgotEmail.trim().toLowerCase();
                      // Check if email exists in Firestore (client-side like login)
                      const q = query(collection(db, USERS_COLLECTION), where("email", "==", normalizedEmail));
                      const userSnap = await getDocs(q);
                      if (userSnap.empty) {
                        toast.error("البريد الإلكتروني غير موجود.");
                        return;
                      }
                      // Generate OTP
                      const otpCode = String(Math.floor(100000 + Math.random() * 900000));
                      // Store OTP in Firestore
                      await addDoc(collection(db, "otps"), {
                        email: normalizedEmail,
                        otp: otpCode,
                        createdAt: new Date(),
                        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
                        used: false,
                      });
                      // Send OTP via API (server-side nodemailer)
                      const res = await fetch("/api/auth/send-otp", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ email: normalizedEmail, otp: otpCode }),
                      });
                      const data = await res.json();
                      if (data.noSmtp) {
                        toast.warning(`لم يتم إعداد SMTP — رمز التحقق: ${otpCode}`, { duration: 15000 });
                      } else if (!data.success) {
                        toast.error(data.error || "فشل إرسال الرمز.");
                        return;
                      } else {
                        toast.success(data.message || "تم إرسال رمز التحقق.");
                      }
                      setForgotStep("password");
                    } catch {
                      toast.error("حدث خطأ في الاتصال.");
                    } finally {
                      setForgotBusy(false);
                    }
                  }}
                >
                  {forgotBusy ? "جاري الإرسال…" : "إرسال رمز التحقق"}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="forgot-otp">رمز التحقق</Label>
                <Input
                  id="forgot-otp"
                  type="text"
                  dir="ltr"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="123456"
                  maxLength={6}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="forgot-new-password">كلمة المرور الجديدة</Label>
                <Input
                  id="forgot-new-password"
                  type="password"
                  dir="ltr"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="كلمة المرور الجديدة"
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  disabled={forgotBusy}
                  onClick={() => setForgotStep("email")}
                >
                  رجوع
                </Button>
                <Button
                  type="button"
                  disabled={forgotBusy || otp.length < 4 || !newPassword}
                  onClick={async () => {
                    setForgotBusy(true);
                    try {
                      const normalizedEmail = forgotEmail.trim().toLowerCase();
                      // Verify OTP from Firestore (client-side)
                      const otpQuery = query(
                        collection(db, "otps"),
                        where("email", "==", normalizedEmail),
                        where("otp", "==", otp.trim()),
                        where("used", "==", false),
                      );
                      const otpSnap = await getDocs(otpQuery);
                      if (otpSnap.empty) {
                        toast.error("رمز التحقق غير صحيح.");
                        return;
                      }
                      const otpDoc = otpSnap.docs[0];
                      const otpData = otpDoc.data();
                      const expiresAt = otpData.expiresAt?.toDate?.() ?? new Date(otpData.expiresAt);
                      if (expiresAt < new Date()) {
                        toast.error("انتهت صلاحية رمز التحقق.");
                        return;
                      }
                      // Find user
                      const userQuery = query(collection(db, USERS_COLLECTION), where("email", "==", normalizedEmail));
                      const userSnap = await getDocs(userQuery);
                      if (userSnap.empty) {
                        toast.error("المستخدم غير موجود.");
                        return;
                      }
                      const userDoc = userSnap.docs[0];
                      // Update password + mark OTP used
                      await updateDoc(doc(db, USERS_COLLECTION, userDoc.id), { password: newPassword });
                      await updateDoc(doc(db, "otps", otpDoc.id), { used: true });
                      toast.success("تم تغيير كلمة المرور بنجاح.");
                      setForgotOpen(false);
                      setForgotStep("email");
                      setOtp("");
                      setNewPassword("");
                      setEmail(normalizedEmail);
                    } catch {
                      toast.error("حدث خطأ في الاتصال.");
                    } finally {
                      setForgotBusy(false);
                    }
                  }}
                >
                  {forgotBusy ? "جاري الحفظ…" : "تغيير كلمة المرور"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AuthShell>
  );
}
