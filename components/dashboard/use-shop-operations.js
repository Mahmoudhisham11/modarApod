"use client";

import { useCallback, useEffect, useState } from "react";

import { fetchOperationsByShop } from "@/lib/operations/operations-service";

/**
 * @param {string} shop
 */
export function useShopOperations(shop) {
  /** @type {[Array<Record<string, unknown> & { id: string }>, import("react").Dispatch<import("react").SetStateAction<Array<Record<string, unknown> & { id: string }>>>]} */
  const [ops, setOps] = useState([]);
  const [loading, setLoading] = useState(true);
  /** @type {[unknown, import("react").Dispatch<import("react").SetStateAction<unknown>>]} */
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    const s = typeof shop === "string" ? shop.trim() : "";
    if (!s) {
      setOps([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const list = await fetchOperationsByShop(s);
      setOps(list);
    } catch (e) {
      setError(e);
      setOps([]);
    } finally {
      setLoading(false);
    }
  }, [shop]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void reload();
    }, 0);
    return () => window.clearTimeout(t);
  }, [reload]);

  return { ops, loading, error, reload };
}
