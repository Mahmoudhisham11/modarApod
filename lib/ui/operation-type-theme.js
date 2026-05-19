import { OPERATION_TYPE } from "@/lib/operations/constants";

/** @type {Record<string, { card: string; badge: string; accent: string }>} */
const THEME = {
  [OPERATION_TYPE.WITHDRAW]: {
    card: "border-destructive/40 bg-destructive/10",
    badge: "bg-destructive/15 text-destructive",
    accent: "bg-destructive",
  },
  [OPERATION_TYPE.DEPOSIT]: {
    card: "border-success/40 bg-success/10",
    badge: "bg-success/15 text-success",
    accent: "bg-success",
  },
  [OPERATION_TYPE.BALANCE_TRANSFER]: {
    card: "border-accent/40 bg-accent/10",
    badge: "bg-accent/15 text-accent",
    accent: "bg-accent",
  },
  [OPERATION_TYPE.SMALL_CHANGE_CARDS]: {
    card: "border-chart-2/40 bg-chart-2/10",
    badge: "bg-chart-2/15 text-chart-2",
    accent: "bg-chart-2",
  },
  [OPERATION_TYPE.BILLS]: {
    card: "border-chart-3/40 bg-chart-3/10",
    badge: "bg-chart-3/15 text-chart-3",
    accent: "bg-chart-3",
  },
  [OPERATION_TYPE.OTHER]: {
    card: "border-chart-4/40 bg-chart-4/10",
    badge: "bg-chart-4/15 text-chart-4",
    accent: "bg-chart-4",
  },
};

const FALLBACK = {
  card: "border-border/60 bg-muted/30",
  badge: "bg-muted text-muted-foreground",
  accent: "bg-muted-foreground",
};

/**
 * @param {string} typeKey
 */
export function getOperationTypeTheme(typeKey) {
  const key = String(typeKey || "").trim();
  return THEME[key] ?? FALLBACK;
}

/**
 * @param {string} typeKey
 */
export function operationTypeCardClassName(typeKey) {
  const t = getOperationTypeTheme(typeKey);
  return cnCard(t.card);
}

/**
 * @param {string} base
 */
function cnCard(base) {
  return `w-full rounded-xl border-2 p-4 shadow-[var(--shadow-card)] ${base}`;
}

/**
 * @param {string} typeKey
 */
export function operationTypeBadgeClassName(typeKey) {
  return getOperationTypeTheme(typeKey).badge;
}
