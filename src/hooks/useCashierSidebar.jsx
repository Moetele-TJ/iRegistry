import { useEffect, useMemo } from "react";
import { useStaffUserScopeOptional } from "../contexts/StaffUserScopeContext.jsx";
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
import { NAV } from "../lib/navLabels.js";

export function useCashierSidebar({ visible: visibleProp = true } = {}) {
  const staffScope = useStaffUserScopeOptional();
  const { setSidebar, clearSidebar } = useSidebar();
  const visible = visibleProp && !staffScope?.isActive;

  const items = useMemo(
    () => [
      { to: "/cashier", end: true, icon: <LayoutDashboard size={20} />, label: NAV.dashboard },
      { to: "/cashier/profile", icon: <UserCircle size={20} />, label: NAV.profile },
      {
        to: "/cashier/items",
        icon: <Package size={20} />,
        label: NAV.items,
        subItems: [
          { to: "/cashier/items", label: NAV.activeItems, end: true },
          { to: "/cashier/items/deleted", label: NAV.deletedItems, end: true },
          { to: "/cashier/items/legacy", label: NAV.legacyItems, end: true },
        ],
      },
      { to: "/cashier/users", icon: <Users size={20} />, label: NAV.users },
      { to: "/cashier/organizations", icon: <Building2 size={20} />, label: NAV.organizations },
      { to: "/cashier/topup", icon: <Wallet size={20} />, label: NAV.topUp },
      { to: "/cashier/transactions", icon: <ReceiptText size={20} />, label: NAV.transactions },
      {
        to: "/cashier/org-transfer-requests",
        icon: <FileText size={20} />,
        label: NAV.orgTransferRequests,
      },
      { to: "/cashier/pricing", icon: <Tag size={20} />, label: NAV.pricing },
      { to: "/cashier/revenue", icon: <Coins size={20} />, label: NAV.revenue },
      { to: "/cashier/notifications", icon: <Bell size={20} />, label: NAV.notifications },
      { to: "/cashier/activity", icon: <Activity size={20} />, label: NAV.activity },
    ],
    []
  );

  useEffect(() => {
    if (staffScope?.isActive) {
      return;
    }

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
  }, [clearSidebar, items, setSidebar, visible, staffScope?.isActive]);
}
