"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

import { LockDialog } from "@/components/common/lock-dialog";
import { LOCK_PROMPT_AR, verifyLockPassword } from "@/lib/auth/user-locks";

/**
 * @typedef {import("@/lib/auth/user-locks").LockKey} LockKey
 */

/**
 * @typedef {{
 *   prompt: (lockKey: LockKey, locks: ReturnType<import("@/lib/auth/user-locks").userLocksFromData>) => Promise<string | null>;
 * }} LockDialogContextValue
 */

const LockDialogContext = createContext(/** @type {LockDialogContextValue | null} */ (null));

/**
 * @param {{ children: import("react").ReactNode }} props
 */
export function LockDialogProvider({ children }) {
  const [open, setOpen] = useState(false);
  const [lockKey, setLockKey] = useState(/** @type {LockKey | ""} */ (""));
  const resolveRef = useRef(/** @type {((value: string | null) => void) | null} */ (null));

  const prompt = useCallback(async (lk, locks) => {
    const key = /** @type {LockKey} */ (lk);
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setLockKey(key);
      setOpen(true);
    });
  }, []);

  const handleConfirm = useCallback((password) => {
    const resolve = resolveRef.current;
    resolveRef.current = null;
    setOpen(false);
    if (resolve) resolve(password);
  }, []);

  const handleCancel = useCallback(() => {
    const resolve = resolveRef.current;
    resolveRef.current = null;
    setOpen(false);
    if (resolve) resolve(null);
  }, []);

  const title = lockKey ? (LOCK_PROMPT_AR[/** @type {LockKey} */ (lockKey)] ?? "تم قفل هذه الميزة") : "";

  return (
    <LockDialogContext.Provider value={{ prompt }}>
      {children}
      <LockDialog
        open={open}
        title={title}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </LockDialogContext.Provider>
  );
}

/**
 * @returns {LockDialogContextValue}
 */
export function useLockDialogContext() {
  const ctx = useContext(LockDialogContext);
  if (!ctx) throw new Error("useLockDialogContext must be used within a LockDialogProvider");
  return ctx;
}
