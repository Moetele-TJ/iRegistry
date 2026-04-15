import { useEffect, useMemo } from "react";
import {
  Activity,
  Bell,
  Building2,
  FileText,
  LayoutDashboard,
  MonitorSmartphone,
  Package,
  Coins,
  ReceiptText,
  Tag,
  Settings,
  UserCircle,
  Users,
  Wallet,
} from "lucide-react";
import { useSidebar } from "../contexts/SidebarContext";

export function useAdminSidebar({ visible = true } = {}) {
  const { setSidebar, clearSidebar } = useSidebar();

  const items = useMemo(
    () => [
      { to: "/admin", icon: <LayoutDashboard size={20} />, label: "Dashboard" },
      { to: "/admin/profile", icon: <UserCircle size={20} />, label: "Profile" },
      { to: "/admin/users", icon: <Users size={20} />, label: "Users" },
      { to: "/admin/organizations", icon: <Building2 size={20} />, label: "Organizations" },
      { to: "/admin/audit-logs", icon: <FileText size={20} />, label: "Audit Logs" },
      { to: "/admin/settings", icon: <Settings size={20} />, label: "Settings" },
      { to: "/admin/topup", icon: <Wallet size={20} />, label: "Top up" },
      { to: "/admin/pricing", icon: <Tag size={20} />, label: "Pricing" },
      { to: "/admin/packages", icon: <Tag size={20} />, label: "Packages" },
      { to: "/admin/revenue", icon: <Coins size={20} />, label: "Revenue" },
      { to: "/admin/transactions", icon: <ReceiptText size={20} />, label: "Transactions" },
      { to: "/admin/org-transfer-requests", icon: <FileText size={20} />, label: "Org transfer requests" },
      {
        to: "/admin/items",
        icon: <Package size={20} />,
        label: "Items",
        subItems: [
          { to: "/admin/items", label: "Active Items", end: true },
          { to: "/admin/items/deleted", label: "Deleted Items", end: true },
          { to: "/admin/items/legacy", label: "Legacy items", end: true },
        ],
      },
      { to: "/admin/notifications", icon: <Bell size={20} />, label: "Notifications" },
      { to: "/admin/activity", icon: <Activity size={20} />, label: "Activity" },
      { to: "/admin/sessions", icon: <MonitorSmartphone size={20} />, label: "Sessions" },
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

