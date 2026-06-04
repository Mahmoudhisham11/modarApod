import { collection, deleteDoc, doc, getDocs, onSnapshot, query, updateDoc, where } from "firebase/firestore";

import { db } from "@/app/firebase";

/** @typedef {"reports" | "numbers" | "money" | "cash" | "daily" | "debts"} LockKey */

/** @type {Record<LockKey, keyof import("firebase/firestore").DocumentData>} */
export const LOCK_FIELD_BY_KEY = {
  reports: "lockReports",
  numbers: "lockNumbers",
  money: "lockMoney",
  cash: "lockCash",
  daily: "lockDaily",
  debts: "lockDebts",
};

/** @type {Record<LockKey, string>} */
export const LOCK_PROMPT_AR = {
  reports: "تم قفل صفحة التقارير",
  numbers: "تم قفل صفحة الخطوط",
  money: "تم قفل عرض المبالغ",
  cash: "تم قفل تعديل النقدية",
  daily: "تم قفل حذف العمليات اليومية",
  debts: "تم قفل صفحة الديون",
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
    lockDebts: Boolean(data.lockDebts),
    isSubscribed: data.isSubscribed !== false,
    commissionPercent: typeof data.commissionPercent === "number" ? data.commissionPercent : 0,
    commissionPercentWithdraw:
      typeof data.commissionPercentWithdraw === "number"
        ? data.commissionPercentWithdraw
        : typeof data.commissionPercent === "number"
          ? data.commissionPercent
          : 0,
    commissionPercentDeposit:
      typeof data.commissionPercentDeposit === "number"
        ? data.commissionPercentDeposit
        : typeof data.commissionPercent === "number"
          ? data.commissionPercent
          : 0,
    merchantPercent:
      typeof data.merchantPercent === "number"
        ? data.merchantPercent
        : 0,
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
 * @param {string} branch
 * @returns {Promise<Array<{ id: string; email: string; name: string; data: Record<string, unknown> }>>}
 */
export async function fetchUsersByBranch(branch) {
  const b = branch.trim();
  if (!b) return [];
  let q = query(collection(db, "users"), where("shop", "==", b));
  let snap = await getDocs(q);

  // Fallback: بعض المستخدمين القدامى عندهم `branch` بدل `shop`
  if (snap.empty) {
    q = query(collection(db, "users"), where("branch", "==", b));
    snap = await getDocs(q);
  }
  return snap.docs.map((d) => {
    const data = /** @type {Record<string, unknown>} */ (d.data());
    return {
      id: d.id,
      email: typeof data.email === "string" ? data.email : "",
      name: typeof data.name === "string" ? data.name : "",
      data,
    };
  });
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
 *   lockDebts: boolean;
 * }>} patch
 */
export async function updateUserLocks(userDocId, patch) {
  await updateDoc(doc(db, "users", userDocId), patch);
}

/**
 * @param {string} userDocId
 */
export async function deleteUserDoc(userDocId) {
  await deleteDoc(doc(db, "users", userDocId));
}

/**
 * @param {string} field
 * @param {unknown} value
 * @param {string} [excludeDocId]
 */
export async function fetchUserByField(field, value, excludeDocId) {
  if (!value || !field) return null;
  const q = query(collection(db, "users"), where(field, "==", value));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  if (excludeDocId) {
    const match = snap.docs.find((d) => d.id !== excludeDocId);
    return match ? { id: match.id, data: /** @type {Record<string, unknown>} */ (match.data()) } : null;
  }
  const d = snap.docs[0];
  return { id: d.id, data: /** @type {Record<string, unknown>} */ (d.data()) };
}

/**
 * @param {string} userDocId
 * @param {Record<string, unknown>} data
 */
export async function updateUserFields(userDocId, data) {
  await updateDoc(doc(db, "users", userDocId), data);
}
