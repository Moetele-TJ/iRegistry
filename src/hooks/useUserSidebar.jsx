import { useEffect, useMemo } from "react";
import {
  Activity,
  Bell,
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
      { to: "/userdashboard", icon: <LayoutDashboard size={20} />, label: "Overview" },
      { to: "/userdashboard/profile", icon: <UserCircle size={20} />, label: "Profile" },
      { to: "/userdashboard/items", icon: <Package size={20} />, label: "Items" },
      { to: "/userdashboard/notifications", icon: <Bell size={20} />, label: "Notifications" },
      { to: "/userdashboard/activity", icon: <Activity size={20} />, label: "Activity" },
      { to: "/userdashboard/transactions", icon: <ReceiptText size={20} />, label: "Transactions" },
      { to: "/userdashboard/topup", icon: <Wallet size={20} />, label: "Top up" },
      { to: "/userdashboard/pricing", icon: <Tag size={20} />, label: "Pricing" },
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

