import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBjfPS9z-KBPCv-QQMZhU-Puf3461a2BFU",
  authDomain: "cashatabod.firebaseapp.com",
  projectId: "cashatabod",
  storageBucket: "cashatabod.firebasestorage.app",
  messagingSenderId: "422137345819",
  appId: "1:422137345819:web:df9513752c0722172545be",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const db = getFirestore(app);

/** Lazy async getter for FCM messaging — returns null on SSR / unsupported browsers */
let _messagingPromise = null;
export function getMessaging() {
  if (_messagingPromise) return _messagingPromise;
  if (typeof window === "undefined") {
    _messagingPromise = Promise.resolve(null);
    return _messagingPromise;
  }
  _messagingPromise = (async () => {
    try {
      const { getMessaging: getFcm } = await import("firebase/messaging");
      const instance = getFcm(app);
      return instance;
    } catch {
      return null;
    }
  })();
  return _messagingPromise;
}


