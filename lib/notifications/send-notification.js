import { adminDb, getMessagingAdmin } from "@/lib/firebase-admin";

const COL = "notificationTokens";

export async function sendToAllTokens({ title, body }) {
  const messaging = getMessagingAdmin();
  if (!messaging || !adminDb) {
    return { success: false, sent: 0, failed: 0, error: "Admin SDK not initialized. Check FIREBASE_* env vars." };
  }

  const snapshot = await adminDb.collection(COL).get();
  const tokens = snapshot.docs.map((d) => d.id);

  if (tokens.length === 0) {
    return { success: true, sent: 0, failed: 0 };
  }

  const message = {
    notification: { title, body },
    tokens,
  };

  let sent = 0;
  let failed = 0;

  try {
    const response = await messaging.sendEachForMulticast(message);
    sent = response.successCount;
    failed = response.failureCount;

    const invalidTokens = [];
    if (response.responses) {
      response.responses.forEach((resp, idx) => {
        const err = resp.error;
        if (
          err &&
          (err.code === "messaging/invalid-registration-token" ||
            err.code === "messaging/registration-token-not-registered" ||
            err.code === "messaging/invalid-argument")
        ) {
          invalidTokens.push(tokens[idx]);
        }
      });
    }

    if (invalidTokens.length > 0) {
      const batch = adminDb.batch();
      invalidTokens.forEach((t) => {
        batch.delete(adminDb.collection(COL).doc(t));
      });
      await batch.commit();
    }

    return { success: true, sent, failed };
  } catch (err) {
    return { success: false, sent, failed, error: err.message };
  }
}
