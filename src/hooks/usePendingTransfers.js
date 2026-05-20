//  src/hooks/usePendingTransfers.js
import { useCallback, useState, useEffect } from "react";
import { invokeWithAuth } from "../lib/invokeWithAuth";
import { useAuth } from "../contexts/AuthContext";

export function usePendingTransfers() {
  const { user } = useAuth();
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchTransfers = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    const { data, error } = await invokeWithAuth("get-pending-transfer-requests");

    if (!error && data?.success) {
      const inList = Array.isArray(data.incoming)
        ? data.incoming
        : Array.isArray(data.data)
          ? data.data
          : [];
      const outList = Array.isArray(data.outgoing) ? data.outgoing : [];
      setIncoming(inList);
      setOutgoing(outList);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchTransfers();
    } else {
      setIncoming([]);
      setOutgoing([]);
      setLoading(false);
    }
  }, [user, fetchTransfers]);

  return {
    incoming,
    outgoing,
    /** Incoming only — for header badge (owner actions needed). */
    data: incoming,
    count: incoming.length,
    loading,
    refresh: fetchTransfers,
  };
}
