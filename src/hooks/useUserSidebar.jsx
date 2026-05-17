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

export function useUserSidebar({ visible = true } = {}) {
  const { setSidebar, clearSidebar } = useSidebar();

  const items = useMemo(
    () => [
      { to: "/user", end: true, icon: <LayoutDashboard size={20} />, label: "Dashboard" },
      { to: "/user/profile", icon: <UserCircle size={20} />, label: "Profile" },
      {
        to: "/user/items",
        icon: <Package size={20} />,
        label: "Items",
        subItems: [
          { to: "/user/items", label: "Active Items", end: true },
          { to: "/user/items/deleted", label: "Deleted Items", end: true },
          { to: "/user/items/legacy", label: "Legacy items", end: true },
        ],
      },
      { to: "/user/notifications", icon: <Bell size={20} />, label: "Notifications" },
      { to: "/user/activity", icon: <Activity size={20} />, label: "Activity" },
      { to: "/user/transactions", icon: <ReceiptText size={20} />, label: "Transactions" },
      { to: "/user/organizations", icon: <Building2 size={20} />, label: "Organizations" },
      { to: "/user/topup", icon: <Wallet size={20} />, label: "Top up" },
      { to: "/user/pricing", icon: <Tag size={20} />, label: "Pricing" },
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

