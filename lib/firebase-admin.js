import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

let adminApp = getApps().find((a) => a.name === "[DEFAULT]");

if (!adminApp && projectId && clientEmail && privateKey) {
  adminApp = initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
    projectId,
  });
}

export const adminDb = adminApp ? getFirestore(adminApp) : null;

/**
 * @returns {import("firebase-admin/messaging").Messaging | null}
 */
export function getMessagingAdmin() {
  if (!adminApp) return null;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { getMessaging } = require("firebase-admin/messaging");
  return getMessaging();
}
