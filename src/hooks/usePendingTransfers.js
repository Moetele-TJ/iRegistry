//  src/hooks/usePendingTransfers.js
import { useState, useEffect } from "react";
import { invokeWithAuth } from "../lib/invokeWithAuth";
import { useAuth } from "../contexts/AuthContext";

export function usePendingTransfers() {
  const { user } = useAuth();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  async function fetchTransfers() {

    if (!user) return;

    setLoading(true);
    const { data, error } = await invokeWithAuth("get-pending-transfer-requests");

    if (!error && data?.success) {
      setData(data.data || []);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (user) {
      fetchTransfers();
    } else {
      setData([]);
      setLoading(false);
    }
  }, [user]);

  return { data, loading, count: data.length, refresh: fetchTransfers };
}