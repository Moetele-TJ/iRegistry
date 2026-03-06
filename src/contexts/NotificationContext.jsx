// src/contexts/NotificationContext.jsx
import { createContext, useContext } from "react";
import { useUserNotifications } from "../hooks/useUserNotifications";

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {

  const {
    total,
    unread,
    loading,
    refreshNotifications,
  } = useUserNotifications();

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