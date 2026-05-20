/** @typedef {"telecom" | "instapay" | "machine"} SourceKind */

/** @typedef {"withdraw" | "deposit" | "balance_transfer" | "small_change_cards" | "bills" | "other" | "cash_addition"} OperationType */

export const SOURCE_KIND = {
  TELECOM: "telecom",
  INSTAPAY: "instapay",
  MACHINE: "machine",
};

export const OPERATION_TYPE = {
  WITHDRAW: "withdraw",
  DEPOSIT: "deposit",
  BALANCE_TRANSFER: "balance_transfer",
  SMALL_CHANGE_CARDS: "small_change_cards",
  BILLS: "bills",
  OTHER: "other",
  CASH_ADDITION: "cash_addition",
};

/** @type {Record<SourceKind, string>} */
export const SOURCE_KIND_LABEL = {
  telecom: "اتصالات",
  instapay: "انستاباي",
  machine: "ماكينات",
};

/** @type {Record<OperationType, string>} */
export const OPERATION_TYPE_LABEL = {
  withdraw: "سحب",
  deposit: "إيداع",
  balance_transfer: "تحويل رصيد",
  small_change_cards: "كروت فكة",
  bills: "دفع فواتير",
  other: "أخرى",
  cash_addition: "إضافة نقدي",
};

/** @param {SourceKind} kind */
export function operationTypesForSourceKind(kind) {
  if (kind === SOURCE_KIND.TELECOM || kind === SOURCE_KIND.INSTAPAY) {
    return [OPERATION_TYPE.WITHDRAW, OPERATION_TYPE.DEPOSIT];
  }
  return [
    OPERATION_TYPE.WITHDRAW,
    OPERATION_TYPE.DEPOSIT,
    OPERATION_TYPE.BALANCE_TRANSFER,
    OPERATION_TYPE.SMALL_CHANGE_CARDS,
    OPERATION_TYPE.BILLS,
    OPERATION_TYPE.OTHER,
  ];
}

/** @param {OperationType} op */
export function isMachineDebitOperation(op) {
  return (
    op === OPERATION_TYPE.WITHDRAW ||
    op === OPERATION_TYPE.SMALL_CHANGE_CARDS ||
    op === OPERATION_TYPE.BILLS ||
    op === OPERATION_TYPE.OTHER ||
    op === OPERATION_TYPE.BALANCE_TRANSFER
  );
}
