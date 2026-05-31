"use client";

import { useState } from "react";
import { Bell, Send, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePushNotifications } from "@/hooks/use-push-notifications";

export default function NotificationsTestPage() {
  const { permission, token, supported, loading, enableNotifications, refreshToken } =
    usePushNotifications();
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("إشعار تجريبي");
  const [body, setBody] = useState("هذا إشعار تجريبي من النظام.");
  const [sending, setSending] = useState(false);

  const handleEnable = async () => {
    setSaving(true);
    try {
      await enableNotifications();
      toast.success("تم تفعيل الإشعارات بنجاح.");
    } catch (err) {
      toast.error(err.message || "فشل تفعيل الإشعارات.");
    } finally {
      setSaving(false);
    }
  };

  const handleRefreshToken = async () => {
    setSaving(true);
    try {
      await refreshToken();
      toast.success("تم تحديث رمز الإشعارات.");
    } catch (err) {
      toast.error(err.message || "فشل تحديث الرمز.");
    } finally {
      setSaving(false);
    }
  };

  const handleSendTest = async () => {
    if (!title.trim() || !body.trim()) {
      toast.error("يرجى إدخال عنوان ونص الإشعار.");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/send-notification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), body: body.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`تم الإرسال: ${data.sent} نجاح, ${data.failed} فشل.`);
      } else {
        toast.error(data.error || "فشل إرسال الإشعار.");
      }
    } catch (err) {
      toast.error(err.message || "فشل الاتصال بالخادم.");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <PageHeader
        title="اختبار الإشعارات"
        description="تفعيل الإشعارات وإرسال إشعار تجريبي"
      />

      <div className="space-y-6">
        {/* Section 1: Enable */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="h-5 w-5" />
              تفعيل الإشعارات
            </CardTitle>
            <CardDescription>
              {permission === "granted"
                ? "الإشعارات مفعّلة حالياً."
                : "اضغط على الزر لتفعيل الإشعارات في المتصفح."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleEnable} disabled={saving || !supported || permission === "granted"}>
              {saving
                ? "جاري التفعيل..."
                : permission === "granted"
                  ? "مفعل"
                  : "تفعيل الإشعارات"}
            </Button>
          </CardContent>
        </Card>

        {/* Section 2: Token */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="h-5 w-5" />
              رمز الإشعارات
            </CardTitle>
            <CardDescription>
              {token
                ? "الرمز الحالي المستخدم لإرسال الإشعارات."
                : "ليس لديك رمز بعد. فعّل الإشعارات أولاً."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {token ? (
              <code className="block max-w-full truncate rounded bg-muted px-3 py-2 text-xs font-mono dir-ltr text-start">
                {token}
              </code>
            ) : null}
            {token ? (
              <Button variant="outline" onClick={handleRefreshToken} disabled={saving}>
                <RefreshCw className="h-4 w-4" />
                تحديث الرمز
              </Button>
            ) : null}
          </CardContent>
        </Card>

        {/* Section 3: Send Test */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Send className="h-5 w-5" />
              إرسال إشعار تجريبي
            </CardTitle>
            <CardDescription>
              أرسل إشعاراً لجميع الأجهزة المسجّلة.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="test-title">العنوان</Label>
              <Input id="test-title" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="test-body">النص</Label>
              <Input id="test-body" value={body} onChange={(e) => setBody(e.target.value)} />
            </div>
            <Button onClick={handleSendTest} disabled={sending}>
              {sending ? "جاري الإرسال..." : "إرسال إشعار تجريبي"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
