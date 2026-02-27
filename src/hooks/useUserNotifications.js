//  📁 src/hooks/useUserNotifications.js
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
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

      const { data, error } = await supabase
        .from("item_notifications")
        .select("id, isread", { count: "exact" })
        .eq("ownerid", user.id);

      if (!error && data) {
        setTotal(data.length);
        setUnread(data.filter(n => !n.isread).length);
      }

      setLoading(false);
    }

    fetchNotifications();
  }, [user?.id]);

  return { total, unread, loading };
}