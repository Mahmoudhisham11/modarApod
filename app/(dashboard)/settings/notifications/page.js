"use client";

import { useState } from "react";
import { Bell, CheckCircle2, RefreshCw, XCircle } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { usePushNotifications } from "@/hooks/use-push-notifications";

export default function NotificationsSettingsPage() {
  const { permission, token, supported, loading, enableNotifications, refreshToken } =
    usePushNotifications();
  const [saving, setSaving] = useState(false);

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

  const handleRefresh = async () => {
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

  return (
    <>
      <PageHeader title="إعدادات الإشعارات" description="إدارة إشعارات المتصفح والـ PWA" />

      <div className="space-y-6">
        {/* Browser Support */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="h-5 w-5" />
              دعم المتصفح
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {supported ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  <span className="text-sm text-muted-foreground">المتصفح يدعم الإشعارات</span>
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-destructive" />
                  <span className="text-sm text-muted-foreground">المتصفح لا يدعم الإشعارات</span>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Permission State */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="h-5 w-5" />
              حالة الصلاحية
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {permission === "granted" ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  <span className="text-sm text-muted-foreground">الصلاحية ممنوحة</span>
                </>
              ) : permission === "denied" ? (
                <>
                  <XCircle className="h-5 w-5 text-destructive" />
                  <span className="text-sm text-muted-foreground">
                    تم رفض الصلاحية — يمكنك تفعيلها من إعدادات المتصفح
                  </span>
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">لم يتم طلب الصلاحية بعد</span>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Current Token */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="h-5 w-5" />
              رمز الإشعارات
            </CardTitle>
            <CardDescription>
              {token
                ? "الرمز الحالي المستخدم لإرسال الإشعارات"
                : "ليس لديك رمز إشعارات مفعّل بعد"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {token ? (
              <code className="block max-w-full truncate rounded bg-muted px-3 py-2 text-xs font-mono dir-ltr text-start">
                {token}
              </code>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {permission !== "granted" ? (
                <Button onClick={handleEnable} disabled={saving || !supported}>
                  {saving ? "جاري التفعيل..." : "تفعيل الإشعارات"}
                </Button>
              ) : null}
              {token ? (
                <Button variant="outline" onClick={handleRefresh} disabled={saving}>
                  <RefreshCw className="h-4 w-4" />
                  تحديث الرمز
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
