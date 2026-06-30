import { useCallback, useEffect, useState } from "react";
import { invokeWithAuth } from "../lib/invokeWithAuth.js";

/** Whether cashiers should see the referral leaderboard nav/page. */
export function useReferralLeaderboardNavVisible() {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await invokeWithAuth("admin-api", {
        body: { operation: "admin-get-referral-competition-config" },
      });
      setVisible(!error && Boolean(data?.success && data?.leaderboard_visible));
    } catch {
      setVisible(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { visible, loading, refresh };
}
