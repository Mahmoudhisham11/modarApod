"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
  fetchUserDocByEmail,
  isLockEnabled,
  promptLockPassword,
  subscribeUserLocks,
  userLocksFromData,
  verifyLockPassword,
} from "@/lib/auth/user-locks";

/**
 * @param {string} userEmail
 * @param {import("@/lib/auth/user-locks").LockKey} lockKey
 * @param {{ redirectTo?: string }} [options]
 */
export function useFeatureLock(userEmail, lockKey, options = {}) {
  const router = useRouter();
  const redirectTo = options.redirectTo ?? "/";
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [locks, setLocks] = useState(/** @type {ReturnType<typeof userLocksFromData> | null} */ (null));

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const email = userEmail.trim().toLowerCase();
      if (!email) {
        if (!cancelled) {
          setAuthorized(false);
          setLoading(false);
        }
        return;
      }

      const found = await fetchUserDocByEmail(email);
      if (cancelled) return;

      if (!found) {
        setAuthorized(false);
        setLocks(null);
        setLoading(false);
        return;
      }

      const parsed = userLocksFromData(found.data);
      setLocks(parsed);

      if (!isLockEnabled(parsed, lockKey)) {
        setAuthorized(true);
        setLoading(false);
        return;
      }

      const pass = promptLockPassword(lockKey);
      if (cancelled) return;

      if (pass !== null && verifyLockPassword(parsed, lockKey, pass)) {
        setAuthorized(true);
      } else {
        if (pass !== null) toast.error("كلمة المرور غير صحيحة");
        setAuthorized(false);
        router.replace(redirectTo);
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [userEmail, lockKey, redirectTo, router]);

  return { loading, authorized, locks };
}

/**
 * @param {string} userEmail
 */
export function useUserLocks(userEmail) {
  const email = userEmail.trim().toLowerCase();
  const [locks, setLocks] = useState(/** @type {ReturnType<typeof userLocksFromData> | null} */ (null));

  useEffect(() => {
    if (!email) return undefined;
    return subscribeUserLocks(email, setLocks);
  }, [email]);

  return email ? locks : null;
}

/**
 * @param {ReturnType<typeof userLocksFromData> | null} locks
 * @param {import("@/lib/auth/user-locks").LockKey} lockKey
 */
export function requireLockPassword(locks, lockKey) {
  if (!locks || !isLockEnabled(locks, lockKey)) return true;
  const pass = promptLockPassword(lockKey);
  if (pass === null) return false;
  if (!verifyLockPassword(locks, lockKey, pass)) {
    toast.error("كلمة المرور غير صحيحة");
    return false;
  }
  return true;
}
