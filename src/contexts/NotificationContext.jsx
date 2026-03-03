// src/contexts/NotificationContext.jsx

import { createContext, useContext } from "react";
import { useUserNotifications } from "../hooks/useUserNotifications";

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const notifications = useUserNotifications();

  return (
    <NotificationContext.Provider value={notifications}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotificationCenter() {
  return useContext(NotificationContext);
}