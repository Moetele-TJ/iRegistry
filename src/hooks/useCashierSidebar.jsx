import { useEffect, useMemo } from "react";
import {
  Activity,
  Bell,
  Coins,
  LayoutDashboard,
  Package,
  ReceiptText,
  Tag,
  Users,
  UserCircle,
  Wallet,
} from "lucide-react";
import { useSidebar } from "../contexts/SidebarContext";

export function useCashierSidebar({ visible = true } = {}) {
  const { setSidebar, clearSidebar } = useSidebar();

  const items = useMemo(
    () => [
      { to: "/cashierdashboard", icon: <LayoutDashboard size={20} />, label: "Dashboard" },
      { to: "/cashierdashboard/profile", icon: <UserCircle size={20} />, label: "Profile" },
      { to: "/cashierdashboard/items", icon: <Package size={20} />, label: "Items" },
      { to: "/cashierdashboard/users", icon: <Users size={20} />, label: "Users" },
      { to: "/cashierdashboard/topup", icon: <Wallet size={20} />, label: "Top up" },
      { to: "/cashierdashboard/transactions", icon: <ReceiptText size={20} />, label: "Transactions" },
      { to: "/cashierdashboard/pricing", icon: <Tag size={20} />, label: "Pricing" },
      { to: "/cashierdashboard/revenue", icon: <Coins size={20} />, label: "Revenue" },
      { to: "/cashierdashboard/notifications", icon: <Bell size={20} />, label: "Notifications" },
      { to: "/cashierdashboard/activity", icon: <Activity size={20} />, label: "Activity" },
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

