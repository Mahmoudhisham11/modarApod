"use client";

import { useCallback, useEffect, useState } from "react";

import { fetchReportsByShop } from "@/lib/reports/reports-service";

/**
 * @param {string} shop
 */
export function useShopReports(shop) {
  /** @type {[Array<Record<string, unknown> & { id: string }>, import("react").Dispatch<import("react").SetStateAction<Array<Record<string, unknown> & { id: string }>>>]} */
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  /** @type {[unknown, import("react").Dispatch<import("react").SetStateAction<unknown>>]} */
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    const s = typeof shop === "string" ? shop.trim() : "";
    if (!s) {
      setReports([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const list = await fetchReportsByShop(s);
      setReports(list);
    } catch (e) {
      setError(e);
      setReports([]);
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

  return { reports, loading, error, reload };
}
