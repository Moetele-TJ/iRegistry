// 📁 src/hooks/useUserNotifications.js

import { useEffect, useState } from "react";
import { invokeWithAuth } from "../lib/invokeWithAuth";
import { useAuth } from "../contexts/AuthContext.jsx";

export function useUserNotifications() {

  const { user } = useAuth();

  const [total, setTotal] = useState(0);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;

    async function fetchNotifications() {

      setLoading(true);

      const { data: res, error } = await invokeWithAuth(
        "get-dashboard-data"
      );

      if (!error && res?.success) {

        const summary = res.personal?.summary || {};

        setTotal(summary.notifications ?? 0);
        setUnread(summary.unreadNotifications ?? 0);
      }

      setLoading(false);
    }

    fetchNotifications();

  }, [user?.id]);

  return { total, unread, loading };
}