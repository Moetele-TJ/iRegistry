import { useEffect, useMemo } from "react";
import { Activity, Bell, LayoutDashboard, Package, Tag, UserCircle, Wallet } from "lucide-react";
import { useSidebar } from "../contexts/SidebarContext";

export function usePoliceSidebar({ visible = true } = {}) {
  const { setSidebar, clearSidebar } = useSidebar();

  const items = useMemo(
    () => [
      { to: "/policedashboard", icon: <LayoutDashboard size={20} />, label: "Dashboard" },
      { to: "/policedashboard/profile", icon: <UserCircle size={20} />, label: "Profile" },
      { to: "/policedashboard/items", icon: <Package size={20} />, label: "Items" },
      { to: "/policedashboard/items/deleted", icon: <Package size={20} />, label: "Deleted items" },
      { to: "/policedashboard/items/legacy", icon: <Package size={20} />, label: "Legacy items" },
      { to: "/policedashboard/notifications", icon: <Bell size={20} />, label: "Notifications" },
      { to: "/policedashboard/activity", icon: <Activity size={20} />, label: "Activity" },
      { to: "/policedashboard/topup", icon: <Wallet size={20} />, label: "Top up" },
      { to: "/policedashboard/pricing", icon: <Tag size={20} />, label: "Pricing" },
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

