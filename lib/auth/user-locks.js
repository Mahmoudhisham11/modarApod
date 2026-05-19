import { collection, doc, getDocs, onSnapshot, query, updateDoc, where } from "firebase/firestore";

import { db } from "@/app/firebase";

/** @typedef {"reports" | "numbers" | "money" | "cash" | "daily"} LockKey */

/** @type {Record<LockKey, keyof import("firebase/firestore").DocumentData>} */
export const LOCK_FIELD_BY_KEY = {
  reports: "lockReports",
  numbers: "lockNumbers",
  money: "lockMoney",
  cash: "lockCash",
  daily: "lockDaily",
};

/** @type {Record<LockKey, string>} */
export const LOCK_PROMPT_AR = {
  reports: "تم قفل صفحة التقارير",
  numbers: "تم قفل صفحة الخطوط",
  money: "تم قفل عرض المبالغ",
  cash: "تم قفل تعديل النقدية",
  daily: "تم قفل حذف العمليات اليومية",
};

/**
 * @param {Record<string, unknown>} data
 */
export function userLocksFromData(data) {
  return {
    lockPassword: typeof data.lockPassword === "string" ? data.lockPassword : "",
    lockReports: Boolean(data.lockReports),
    lockNumbers: Boolean(data.lockNumbers),
    lockMoney: Boolean(data.lockMoney),
    lockCash: Boolean(data.lockCash),
    lockDaily: Boolean(data.lockDaily),
    isSubscribed: data.isSubscribed !== false,
  };
}

/**
 * @param {string} email
 * @returns {Promise<{ id: string; data: Record<string, unknown> } | null>}
 */
export async function fetchUserDocByEmail(email) {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;
  const q = query(collection(db, "users"), where("email", "==", normalized));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, data: /** @type {Record<string, unknown>} */ (d.data()) };
}

/**
 * @param {ReturnType<typeof userLocksFromData>} locks
 * @param {LockKey} lockKey
 */
export function isLockEnabled(locks, lockKey) {
  const field = LOCK_FIELD_BY_KEY[lockKey];
  return Boolean(locks[field]);
}

/**
 * @param {ReturnType<typeof userLocksFromData>} locks
 * @param {LockKey} lockKey
 * @param {string} password
 */
export function verifyLockPassword(locks, lockKey, password) {
  if (!isLockEnabled(locks, lockKey)) return true;
  return password === locks.lockPassword;
}

/**
 * @param {LockKey} lockKey
 * @returns {string | null} null = ألغى المستخدم
 */
export function promptLockPassword(lockKey) {
  if (typeof window === "undefined") return null;
  const label = LOCK_PROMPT_AR[lockKey] ?? "تم قفل هذه الميزة";
  return window.prompt(`${label}\nمن فضلك أدخل كلمة المرور:`);
}

/**
 * @param {string} email
 * @param {(locks: ReturnType<typeof userLocksFromData>) => void} onChange
 * @returns {() => void}
 */
export function subscribeUserLocks(email, onChange) {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return () => {};

  const q = query(collection(db, "users"), where("email", "==", normalized));
  return onSnapshot(q, (snap) => {
    if (snap.empty) return;
    onChange(userLocksFromData(snap.docs[0].data()));
  });
}

/**
 * @param {string} userDocId
 * @param {Partial<{
 *   lockPassword: string;
 *   lockReports: boolean;
 *   lockNumbers: boolean;
 *   lockMoney: boolean;
 *   lockCash: boolean;
 *   lockDaily: boolean;
 * }>} patch
 */
export async function updateUserLocks(userDocId, patch) {
  await updateDoc(doc(db, "users", userDocId), patch);
}
