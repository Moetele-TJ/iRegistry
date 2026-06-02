import { useEffect, useMemo } from "react";
import { Activity, Bell, LayoutDashboard, Package, Shield, Tag, UserCircle, Wallet } from "lucide-react";
import { useSidebar } from "../contexts/SidebarContext";
import { NAV, NAV_POLICE_ITEMS } from "../lib/navLabels.js";

export function usePoliceSidebar({ visible = true } = {}) {
  const { setSidebar, clearSidebar } = useSidebar();

  const items = useMemo(
    () => [
      { to: "/police", end: true, icon: <LayoutDashboard size={20} />, label: NAV.dashboard },
      { to: "/police/profile", icon: <UserCircle size={20} />, label: NAV.profile },
      {
        to: "/police/items",
        icon: <Package size={20} />,
        label: NAV.items,
        subItems: [
          { to: "/police/items", label: NAV_POLICE_ITEMS.stationStolenQueue, end: true },
          { to: "/police/items?mine=1", label: NAV_POLICE_ITEMS.myActiveItems, end: true },
          { to: "/police/items/deleted", label: NAV_POLICE_ITEMS.myDeletedItems, end: true },
          { to: "/police/items/legacy", label: NAV_POLICE_ITEMS.myLegacyItems, end: true },
        ],
      },
      { to: "/police/impound", icon: <Shield size={20} />, label: NAV.impoundFoundItem },
      { to: "/police/notifications", icon: <Bell size={20} />, label: NAV.notifications },
      { to: "/police/activity", icon: <Activity size={20} />, label: NAV.activity },
      { to: "/police/topup", icon: <Wallet size={20} />, label: NAV.topUp },
      { to: "/police/pricing", icon: <Tag size={20} />, label: NAV.pricing },
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
