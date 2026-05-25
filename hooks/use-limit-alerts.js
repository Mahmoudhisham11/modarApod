"use client";

import { useCallback, useEffect, useState } from "react";

import { fetchShopActivationAlerts, fetchShopLimitAlerts } from "@/lib/lines/limit-alerts";

/**
 * @param {string} shop
 * @param {{ enabled?: boolean; refreshMs?: number }} [options]
 */
export function useLimitAlerts(shop, options = {}) {
  const { enabled = true, refreshMs = 300_000 } = options;
  const [limitAlerts, setLimitAlerts] = useState(/** @type {Awaited<ReturnType<typeof fetchShopLimitAlerts>>} */ ([]));
  const [activationAlerts, setActivationAlerts] = useState(/** @type {Awaited<ReturnType<typeof fetchShopActivationAlerts>>} */ ([]));
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    const s = shop.trim();
    if (!s) {
      setLimitAlerts([]);
      setActivationAlerts([]);
      return;
    }
    setLoading(true);
    try {
      const [limits, activations] = await Promise.all([
        fetchShopLimitAlerts(s),
        fetchShopActivationAlerts(s),
      ]);
      setLimitAlerts(limits);
      setActivationAlerts(activations);
    } catch (err) {
      console.error("useLimitAlerts", err);
      setLimitAlerts([]);
      setActivationAlerts([]);
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
        const [limits, activations] = await Promise.all([
          fetchShopLimitAlerts(shop.trim()),
          fetchShopActivationAlerts(shop.trim()),
        ]);
        if (!cancelled) {
          setLimitAlerts(limits);
          setActivationAlerts(activations);
        }
      } catch (err) {
        console.error("useLimitAlerts", err);
        if (!cancelled) {
          setLimitAlerts([]);
          setActivationAlerts([]);
        }
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

  const visibleLimits = enabled && shop.trim() ? limitAlerts : [];
  const visibleActivations = enabled && shop.trim() ? activationAlerts : [];

  return {
    alerts: visibleLimits,
    activationAlerts: visibleActivations,
    loading,
    reload,
    count: visibleLimits.length + visibleActivations.length,
  };
}
