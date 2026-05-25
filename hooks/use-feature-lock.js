"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { useLockDialogContext } from "@/contexts/lock-dialog-context";
import {
  fetchUserDocByEmail,
  isLockEnabled,
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
  const { prompt } = useLockDialogContext();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [locks, setLocks] = useState(/** @type {ReturnType<typeof userLocksFromData> | null} */ (null));

  const check = useCallback(async () => {
    const email = userEmail.trim().toLowerCase();
    if (!email) {
      setAuthorized(false);
      setLoading(false);
      return;
    }

    const found = await fetchUserDocByEmail(email);

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

    const pass = await prompt(lockKey, parsed);
    if (pass !== null && verifyLockPassword(parsed, lockKey, pass)) {
      setAuthorized(true);
    } else {
      if (pass !== null) toast.error("كلمة المرور غير صحيحة");
      setAuthorized(false);
      router.replace(redirectTo);
    }
    setLoading(false);
  }, [userEmail, lockKey, redirectTo, router, prompt]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await check();
    })();
    return () => { cancelled = true; };
  }, [check]);

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
 * @param {(lockKey: import("@/lib/auth/user-locks").LockKey, locks: ReturnType<typeof userLocksFromData>) => Promise<string | null>} promptFn
 */
export async function requireLockPassword(locks, lockKey, promptFn) {
  if (!locks || !isLockEnabled(locks, lockKey)) return true;
  const pass = await promptFn(lockKey, locks);
  if (pass === null) return false;
  if (!verifyLockPassword(locks, lockKey, pass)) {
    toast.error("كلمة المرور غير صحيحة");
    return false;
  }
  return true;
}
