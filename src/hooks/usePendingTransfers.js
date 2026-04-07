//  src/hooks/usePendingTransfers.js
import { useCallback, useState, useEffect } from "react";
import { invokeWithAuth } from "../lib/invokeWithAuth";
import { useAuth } from "../contexts/AuthContext";

export function usePendingTransfers() {
  const { user } = useAuth();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchTransfers = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    const { data, error } = await invokeWithAuth("get-pending-transfer-requests");

    if (!error && data?.success) {
      setData(data.data || []);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchTransfers();
    } else {
      setData([]);
      setLoading(false);
    }
  }, [user, fetchTransfers]);

  return { data, loading, count: data.length, refresh: fetchTransfers };
}