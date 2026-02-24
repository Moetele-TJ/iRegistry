//  src/hooks/usePublicStats.js
import { useEffect, useState, useRef } from "react";
import { supabase } from "../lib/supabase";

export function usePublicStats() {
  const [stats, setStats] = useState(null);

  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const intervalRef = useRef(null);

  async function fetchStats({ silent = false } = {}) {
    try {
      if (!silent) {
        setInitialLoading(true);
      } else {
        setRefreshing(true);
      }

      const { data, error } =
        await supabase.functions.invoke("get-public-stats");

      if (error || !data?.success) {
        throw new Error("Failed to fetch stats");
      }

      setStats(data.stats);
      setLastUpdated(new Date());

    } catch (err) {
      setError(err.message);
    } finally {
      setInitialLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    // First load
    fetchStats();

    // Auto refresh every 60 seconds (silent)
    intervalRef.current = setInterval(() => {
      fetchStats({ silent: true });
    }, 30000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    stats,
    initialLoading,
    refreshing,
    error,
    lastUpdated,
    refresh: () => fetchStats({ silent: true }),
  };
}