import { collection, doc, getDoc, getDocs, query, runTransaction, serverTimestamp, where } from "firebase/firestore";
import { db } from "@/app/firebase";
import { OPERATION_TYPE } from "@/lib/operations/constants";
import { parseLineAmount } from "@/lib/operations/eligibility";

const SHOPS_COLLECTION = "shops";

function asString(v) {
  if (v === null || v === undefined) return "";
  return String(v);
}

/** @param {string} shop */
function shopDocRef(shop) {
  return doc(db, SHOPS_COLLECTION, shop);
}

/**
 * @param {string} shop
 * @returns {Promise<number>}
 */
export async function fetchShopCash(shop) {
  const s = shop.trim();
  if (!s) return 0;
  try {
    const snap = await getDoc(shopDocRef(s));
    const d = snap.data();
    if (!d) return 0;
    const cash = Number(d.cash);
    return Number.isFinite(cash) ? cash : 0;
  } catch {
    return 0;
  }
}

/**
 * @param {string} shop
 * @returns {Promise<{ cash: number; sourcesTotal: number; capital: number }>}
 */
export async function fetchShopCapitalData(shop) {
  const s = shop.trim();
  if (!s) return { cash: 0, sourcesTotal: 0, capital: 0 };

  const cash = await fetchShopCash(s);

  let sourcesTotal = 0;

  try {
    const collections = ["numbers", "instapayLines", "machines"];
    for (const colName of collections) {
      const colRef = collection(db, colName);
      const q = query(colRef, where("shop", "==", s));
      const snap = await getDocs(q);
      for (const d of snap.docs) {
        const row = d.data();
        let bal = 0;
        if (colName === "machines") {
          const n = Number(row.balance);
          bal = Number.isFinite(n) ? n : 0;
        } else {
          bal = parseLineAmount(row);
        }
        sourcesTotal += bal;
      }
    }
  } catch {
    /* ignore */
  }

  return {
    cash,
    sourcesTotal,
    capital: cash + sourcesTotal,
  };
}

/**
 * @param {{
 *   shop: string;
 *   amount: number;
 *   note: string;
 *   userName: string;
 *   createdBy: string;
 * }} payload
 * @returns {Promise<string>} operation id
 */
export async function createCashAdditionOperation(payload) {
  const shop = payload.shop.trim();
  const amount = Number(payload.amount);
  const amt = Number.isFinite(amount) && amount > 0 ? amount : 0;
  const note = asString(payload.note).trim();
  const userName = asString(payload.userName).trim() || payload.createdBy.trim();
  const createdBy = payload.createdBy.trim();

  if (!shop || !createdBy || amt <= 0) {
    throw new Error("بيانات غير كاملة.");
  }

  return runTransaction(db, async (transaction) => {
    const shopRef = shopDocRef(shop);
    const shopSnap = await transaction.get(shopRef);
    const shopData = shopSnap.data();
    const oldCash = shopData ? Number(shopData.cash) || 0 : 0;
    const newCash = oldCash + amt;

    transaction.set(shopRef, { cash: newCash }, { merge: true });

    const opRef = doc(collection(db, "operations"));
    const opDoc = {
      shop,
      type: OPERATION_TYPE.CASH_ADDITION,
      operationVal: String(amt),
      commation: 0,
      notes: note || "",
      userName,
      createdBy,
      createdAt: serverTimestamp(),
    };
    transaction.set(opRef, opDoc);

    return opRef.id;
  });
}
