// 📄 src/hooks/useDashboard.js
import { useEffect, useState, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";
import { invokeWithAuth } from "../lib/invokeWithAuth";

export function useDashboard({ page = 1, limit = 5 } = {}) {
  const { user } = useAuth();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDashboard = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      const res = await invokeWithAuth("get-dashboard-data", {
        page,
        limit,
      });

      if (!res?.success) {
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
  }, [fetchDashboard]);

  return {
    data,
    loading,
    error,
    refresh: fetchDashboard,
  };
}