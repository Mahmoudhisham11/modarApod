"use client";

import { useCallback, useEffect, useState } from "react";

import { fetchDebtsDueSoon } from "@/lib/debts/debts-service";

/**
 * @param {string} shop
 * @param {{ enabled?: boolean; refreshMs?: number }} [options]
 */
export function useDebtAlerts(shop, options = {}) {
  const { enabled = true } = options;
  const [debts, setDebts] = useState(/** @type {Awaited<ReturnType<typeof fetchDebtsDueSoon>>} */ ([]));
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    const s = shop.trim();
    if (!s) {
      setDebts([]);
      return;
    }
    setLoading(true);
    try {
      const list = await fetchDebtsDueSoon(s);
      setDebts(list);
    } catch {
      setDebts([]);
    } finally {
      setLoading(false);
    }
  }, [shop]);

  useEffect(() => {
    if (!enabled || !shop.trim()) {
      return undefined;
    }

    let cancelled = false;

    const run = async () => {
      setLoading(true);
      try {
        const list = await fetchDebtsDueSoon(shop.trim());
        if (!cancelled) setDebts(list);
      } catch {
        if (!cancelled) setDebts([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();
    const id = setInterval(() => void run(), 300_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [enabled, shop]);

  return {
    debts,
    loading,
    reload,
    count: debts.length,
  };
}
