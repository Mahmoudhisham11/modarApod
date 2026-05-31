"use client";

import { useCallback, useEffect, useState } from "react";

import { getMessaging } from "@/app/firebase";
import { isNotificationSupported, getActiveRegistration } from "@/lib/notifications/messaging-client";
import { saveTokenToFirestore, removeTokenFromFirestore } from "@/lib/notifications/register-token";

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || "";

/* Dynamically import the standalone FCM v9+ functions only on the client */
async function getFcmModule() {
  return import("firebase/messaging");
}

function getNotificationPermission() {
  if (typeof Notification === "undefined") return "default";
  return Notification.permission;
}

export function usePushNotifications() {
  const [permission, setPermission] = useState("default");
  const [token, setToken] = useState(null);
  const [supported, setSupported] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setSupported(isNotificationSupported());
    setPermission(getNotificationPermission());
  }, []);

  const getCurrentToken = useCallback(async () => {
    if (!isNotificationSupported()) return null;
    const messaging = await getMessaging();
    if (!messaging) return null;
    try {
      const reg = await getActiveRegistration();
      const { getToken } = await getFcmModule();
      const currentToken = await getToken(messaging, {
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: reg,
      });
      return currentToken || null;
    } catch {
      return null;
    }
  }, []);

  const enableNotifications = useCallback(async () => {
    if (!isNotificationSupported()) {
      throw new Error("المتصفح لا يدعم الإشعارات.");
    }

    if (!VAPID_KEY) {
      throw new Error("VAPID_KEY غير مضبوط. تأكد من تعبئة NEXT_PUBLIC_FIREBASE_VAPID_KEY في .env.local");
    }

    const currentPerm = getNotificationPermission();
    if (currentPerm === "denied") {
      throw new Error(
        "تم رفض صلاحية الإشعارات مسبقاً. اذهب إلى إعدادات الموقع (القفل بجانب الرابط) ← Site Settings ← Notifications ← اختر Allow ثم جرب مرة أخرى.",
      );
    }

    let reg;
    try {
      reg = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
    } catch {
      reg = await getActiveRegistration();
    }

    const perm = await Notification.requestPermission();
    setPermission(perm);

    if (perm !== "granted") {
      throw new Error(
        "لم يتم منح صلاحية الإشعارات. تأكد من:\n" +
          "1. استخدام https:// (أو localhost للتطوير)\n" +
          "2. عدم وجود حظر من إعدادات المتصفح\n" +
          "3. الضغط على 'سماح' عند ظهور النافذة",
      );
    }

    const messaging = await getMessaging();
    if (!messaging) throw new Error("فشل تحميل Firebase Messaging.");

    const { getToken } = await getFcmModule();
    const fcmToken = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: reg,
    });

    if (!fcmToken) throw new Error("فشل الحصول على رمز الإشعارات.");

    setToken(fcmToken);
    await saveTokenToFirestore(fcmToken);
    return fcmToken;
  }, []);

  const refreshToken = useCallback(async () => {
    setLoading(true);
    try {
      const oldToken = await getCurrentToken();
      if (oldToken) await removeTokenFromFirestore(oldToken);

      const messaging = await getMessaging();
      if (messaging && oldToken) {
        const { deleteToken } = await getFcmModule();
        await deleteToken(messaging);
      }

      const newToken = await enableNotifications();
      return newToken;
    } finally {
      setLoading(false);
    }
  }, [enableNotifications, getCurrentToken]);

  return {
    permission,
    token,
    supported,
    loading,
    enableNotifications,
    getCurrentToken,
    refreshToken,
  };
}
