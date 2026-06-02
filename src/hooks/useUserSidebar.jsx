import { useEffect, useMemo } from "react";
import {
  Activity,
  Bell,
  Building2,
  LayoutDashboard,
  Package,
  ReceiptText,
  Tag,
  UserCircle,
  Wallet,
} from "lucide-react";
import { useSidebar } from "../contexts/SidebarContext";
import { NAV } from "../lib/navLabels.js";

export function useUserSidebar({ visible = true } = {}) {
  const { setSidebar, clearSidebar } = useSidebar();

  const items = useMemo(
    () => [
      { to: "/user", end: true, icon: <LayoutDashboard size={20} />, label: NAV.dashboard },
      { to: "/user/profile", icon: <UserCircle size={20} />, label: NAV.profile },
      {
        to: "/user/items",
        icon: <Package size={20} />,
        label: NAV.items,
        subItems: [
          { to: "/user/items", label: NAV.activeItems, end: true },
          { to: "/user/items/deleted", label: NAV.deletedItems, end: true },
          { to: "/user/items/legacy", label: NAV.legacyItems, end: true },
        ],
      },
      { to: "/user/notifications", icon: <Bell size={20} />, label: NAV.notifications },
      { to: "/user/activity", icon: <Activity size={20} />, label: NAV.activity },
      { to: "/user/transactions", icon: <ReceiptText size={20} />, label: NAV.transactions },
      { to: "/user/organizations", icon: <Building2 size={20} />, label: NAV.organizations },
      { to: "/user/topup", icon: <Wallet size={20} />, label: NAV.topUp },
      { to: "/user/pricing", icon: <Tag size={20} />, label: NAV.pricing },
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
