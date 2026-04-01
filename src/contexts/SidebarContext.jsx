import { createContext, useCallback, useContext, useMemo, useState } from "react";

const SidebarContext = createContext(null);

const defaultState = {
  visible: false,
  items: [],
  hoverExpand: true,
};

export function SidebarProvider({ children }) {
  const [sidebar, setSidebarState] = useState(defaultState);

  const setSidebar = useCallback((next) => {
    setSidebarState((prev) => {
      const value = typeof next === "function" ? next(prev) : next;
      return {
        ...defaultState,
        ...(value || {}),
      };
    });
  }, []);

  const clearSidebar = useCallback(() => {
    setSidebarState(defaultState);
  }, []);

  const value = useMemo(
    () => ({ sidebar, setSidebar, clearSidebar }),
    [sidebar, setSidebar, clearSidebar]
  );

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar must be used inside SidebarProvider");
  return ctx;
}

