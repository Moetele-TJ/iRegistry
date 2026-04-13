import { useEffect, useMemo } from "react";
import { Activity, Bell, LayoutDashboard, Package, Tag, UserCircle, Wallet } from "lucide-react";
import { useSidebar } from "../contexts/SidebarContext";

export function usePoliceSidebar({ visible = true } = {}) {
  const { setSidebar, clearSidebar } = useSidebar();

  const items = useMemo(
    () => [
      { to: "/policedashboard", icon: <LayoutDashboard size={20} />, label: "Dashboard" },
      { to: "/policedashboard/profile", icon: <UserCircle size={20} />, label: "Profile" },
      {
        to: "/policedashboard/items",
        icon: <Package size={20} />,
        label: "Items",
        subItems: [
          { to: "/policedashboard/items", label: "Active Items", end: true },
          { to: "/policedashboard/items/deleted", label: "Deleted Items", end: true },
          { to: "/policedashboard/items/legacy", label: "Legacy items", end: true },
        ],
      },
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

