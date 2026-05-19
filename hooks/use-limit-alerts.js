"use client";

import { useCallback, useEffect, useState } from "react";

import { fetchShopLimitAlerts } from "@/lib/lines/limit-alerts";

/**
 * @param {string} shop
 * @param {{ enabled?: boolean; refreshMs?: number }} [options]
 */
export function useLimitAlerts(shop, options = {}) {
  const { enabled = true, refreshMs = 60_000 } = options;
  const [alerts, setAlerts] = useState(/** @type {Awaited<ReturnType<typeof fetchShopLimitAlerts>>} */ ([]));
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    const s = shop.trim();
    if (!s) {
      setAlerts([]);
      return;
    }
    setLoading(true);
    try {
      const data = await fetchShopLimitAlerts(s);
      setAlerts(data);
    } catch (err) {
      console.error("useLimitAlerts", err);
      setAlerts([]);
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
        const data = await fetchShopLimitAlerts(shop.trim());
        if (!cancelled) setAlerts(data);
      } catch (err) {
        console.error("useLimitAlerts", err);
        if (!cancelled) setAlerts([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();
    if (refreshMs <= 0) {
      return () => {
        cancelled = true;
      };
    }
    const id = setInterval(() => void run(), refreshMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [enabled, shop, refreshMs]);

  const visibleAlerts = enabled && shop.trim() ? alerts : [];

  return { alerts: visibleAlerts, loading, reload, count: visibleAlerts.length };
}
