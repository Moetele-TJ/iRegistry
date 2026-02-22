//  src/hooks/usePublicStats.js
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export function usePublicStats() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const { data, error } =
          await supabase.functions.invoke("get-public-stats");

        if (error || !data?.success) {
          throw new Error("Failed to fetch stats");
        }

        setStats(data.stats);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  return { stats, loading, error };
}