import { useEffect, useMemo } from "react";
import { Activity, Bell, LayoutDashboard, Package, Shield, Tag, UserCircle, Wallet } from "lucide-react";
import { useSidebar } from "../contexts/SidebarContext";

export function usePoliceSidebar({ visible = true } = {}) {
  const { setSidebar, clearSidebar } = useSidebar();

  const items = useMemo(
    () => [
      { to: "/police", icon: <LayoutDashboard size={20} />, label: "Dashboard" },
      { to: "/police/profile", icon: <UserCircle size={20} />, label: "Profile" },
      {
        to: "/police/items",
        icon: <Package size={20} />,
        label: "Items",
        subItems: [
          { to: "/police/items", label: "Station stolen queue", end: true },
          { to: "/police/items?mine=1", label: "My active items", end: true },
          { to: "/police/items/deleted", label: "My deleted items", end: true },
          { to: "/police/items/legacy", label: "My legacy items", end: true },
        ],
      },
      { to: "/police/impound", icon: <Shield size={20} />, label: "Impound / Found item" },
      { to: "/police/notifications", icon: <Bell size={20} />, label: "Notifications" },
      { to: "/police/activity", icon: <Activity size={20} />, label: "Activity" },
      { to: "/police/topup", icon: <Wallet size={20} />, label: "Top up" },
      { to: "/police/pricing", icon: <Tag size={20} />, label: "Pricing" },
    ],
    []
  );

  useEffect(() => {
    if (!visible) {
      clearSidebar();
      return;
    }

    setSidebar({
      visible: true,
      items,
      hoverExpand: true,
    });

    return () => {
      clearSidebar();
    };
  }, [clearSidebar, items, setSidebar, visible]);
}

