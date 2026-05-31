import { deleteDoc, doc, setDoc, Timestamp } from "firebase/firestore";

import { db } from "@/app/firebase";

const COL = "notificationTokens";

export async function saveTokenToFirestore(token) {
  const payload = {
    token,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    userAgent: navigator.userAgent || "",
  };

  try {
    await setDoc(doc(db, COL, token), payload, { merge: true });
    return true;
  } catch {
    return false;
  }
}

export async function removeTokenFromFirestore(token) {
  try {
    await deleteDoc(doc(db, COL, token));
    return true;
  } catch {
    return false;
  }
}
