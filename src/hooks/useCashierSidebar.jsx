import { useEffect, useMemo } from "react";
import {
  Activity,
  Bell,
  Coins,
  FileText,
  Building2,
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
      { to: "/cashier", icon: <LayoutDashboard size={20} />, label: "Dashboard" },
      { to: "/cashier/profile", icon: <UserCircle size={20} />, label: "Profile" },
      {
        to: "/cashier/items",
        icon: <Package size={20} />,
        label: "Items",
        subItems: [
          { to: "/cashier/items", label: "Active Items", end: true },
          { to: "/cashier/items/deleted", label: "Deleted Items", end: true },
          { to: "/cashier/items/legacy", label: "Legacy items", end: true },
        ],
      },
      { to: "/cashier/users", icon: <Users size={20} />, label: "Users" },
      { to: "/cashier/organizations", icon: <Building2 size={20} />, label: "Organizations" },
      { to: "/cashier/topup", icon: <Wallet size={20} />, label: "Top up" },
      { to: "/cashier/transactions", icon: <ReceiptText size={20} />, label: "Transactions" },
      { to: "/cashier/org-transfer-requests", icon: <FileText size={20} />, label: "Org transfer requests" },
      { to: "/cashier/pricing", icon: <Tag size={20} />, label: "Pricing" },
      { to: "/cashier/revenue", icon: <Coins size={20} />, label: "Revenue" },
      { to: "/cashier/notifications", icon: <Bell size={20} />, label: "Notifications" },
      { to: "/cashier/activity", icon: <Activity size={20} />, label: "Activity" },
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

