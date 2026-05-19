"use client";

import { useSubscriptionGuard } from "@/hooks/use-subscription-guard";

/**
 * @param {{ userEmail: string; children: import("react").ReactNode }} props
 */
export function SubscriptionGuard({ userEmail, children }) {
  useSubscriptionGuard(userEmail);
  return children;
}
