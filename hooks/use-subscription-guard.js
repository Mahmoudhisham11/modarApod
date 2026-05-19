"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";

import { subscribeUserLocks } from "@/lib/auth/user-locks";

const SUBSCRIPTION_TOAST = "يجب تفعيل البرنامج أولًا برجاء التواصل مع المطور";

/**
 * مراقبة isSubscribed أثناء الجلسة (مثل cashat-main Main).
 * @param {string} userEmail
 */
export function useSubscriptionGuard(userEmail) {
  const router = useRouter();

  useEffect(() => {
    const email = userEmail.trim().toLowerCase();
    if (!email) return undefined;

    return subscribeUserLocks(email, (locks) => {
      if (locks.isSubscribed === false) {
        toast.error(SUBSCRIPTION_TOAST);
        fetch("/api/auth/logout", { method: "POST", credentials: "include" })
          .catch(() => {})
          .finally(() => {
            router.replace("/login");
            router.refresh();
          });
      }
    });
  }, [userEmail, router]);
}
