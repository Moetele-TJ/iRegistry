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
    const res = await invokeWithAuth("get-pending-transfer-requests");

    if (res?.success) {
      setData(res.data || []);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (user) {
      fetchTransfers();
    } else {
      setData([]);
    }
  }, [user]);

  return { data, loading, count: data.length, refresh: fetchTransfers };
}