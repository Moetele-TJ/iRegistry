// 📄 src/hooks/useDashboard.js
import { useEffect, useState, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";
import { invokeWithAuth } from "../lib/invokeWithAuth";
import { supabase } from "../lib/supabase";

export function useDashboard({ page = 1, limit = 5 } = {}) {
  const { user } = useAuth();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDashboard = useCallback(async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      setError(null);

      const { data: res, error } = await invokeWithAuth("get-dashboard-data", {
        body: { page, limit },
      });

      if (error || !res?.success) {
        throw new Error(res?.message || "Failed to fetch dashboard");
      }

      setData(res);
      
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user, page, limit]);

  useEffect(() => {
    fetchDashboard();

    if (!user?.id) return;

    const channel = supabase
      .channel("dashboard-notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "item_notifications",
          filter: `ownerid=eq.${user.id}`,
        },
        () => {
          fetchDashboard(); // refresh dashboard instantly
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchDashboard, user?.id]);

  return {
    data,
    loading,
    error,
    refresh: fetchDashboard,
  };
}