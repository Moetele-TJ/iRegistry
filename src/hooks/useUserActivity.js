import { useCallback, useEffect, useState } from "react";
import { invokeWithAuth } from "../lib/invokeWithAuth.js";

export function useUserActivity(userId) {
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!userId) {
      setActivity([]);
      return;
    }
    try {
      setLoading(true);
      const { data, error } = await invokeWithAuth("get-user-activity", {
        body: { userId: String(userId) },
      });
      if (!error && data?.success) {
        setActivity(data.activity || []);
      } else {
        setActivity([]);
      }
    } catch {
      setActivity([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { activity, loading, refresh };
}
