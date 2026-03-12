// src/contexts/NotificationContext.jsx
import { createContext, useContext, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useUserNotifications } from "../hooks/useUserNotifications";
import { useAuth } from "./AuthContext";

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {

  const { user } = useAuth();

  const {
    total,
    unread,
    loading,
    refreshNotifications,
  } = useUserNotifications();

  useEffect(() => {

    if (!user?.id) return;

    const channel = supabase
      .channel("notifications-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "item_notifications",
          filter: `ownerid=eq.${user.id}`,
        },
        () => {
          refreshNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };

  }, [user?.id]);

  const value = {
    total,
    unread,
    loading,
    refreshNotifications,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotificationCenter() {

  const ctx = useContext(NotificationContext);

  if (!ctx) {
    throw new Error(
      "useNotificationCenter must be used inside NotificationProvider"
    );
  }

  return ctx;
}