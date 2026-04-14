import { useEffect, useMemo } from "react";
import {
  Activity,
  Bell,
  BookOpen,
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
      { to: "/userdashboard", icon: <LayoutDashboard size={20} />, label: "Dashboard" },
      { to: "/userdashboard/profile", icon: <UserCircle size={20} />, label: "Profile" },
      {
        to: "/userdashboard/items",
        icon: <Package size={20} />,
        label: "Items",
        subItems: [
          { to: "/userdashboard/items", label: "Active Items", end: true },
          { to: "/userdashboard/items/deleted", label: "Deleted Items", end: true },
          { to: "/userdashboard/items/legacy", label: "Legacy items", end: true },
        ],
      },
      { to: "/userdashboard/notifications", icon: <Bell size={20} />, label: "Notifications" },
      { to: "/userdashboard/activity", icon: <Activity size={20} />, label: "Activity" },
      { to: "/userdashboard/transactions", icon: <ReceiptText size={20} />, label: "Transactions" },
      { to: "/userdashboard/topup", icon: <Wallet size={20} />, label: "Top up" },
      { to: "/userdashboard/pricing", icon: <Tag size={20} />, label: "Pricing" },
      { to: "/userdashboard/manual", icon: <BookOpen size={20} />, label: "User guide" },
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

