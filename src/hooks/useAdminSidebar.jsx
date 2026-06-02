import { useEffect, useMemo } from "react";
import { useStaffUserScopeOptional } from "../contexts/StaffUserScopeContext.jsx";
import {
  Activity,
  Bell,
  Building2,
  FileText,
  LayoutDashboard,
  LogIn,
  MessageSquare,
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
import { NAV } from "../lib/navLabels.js";

export function useAdminSidebar({ visible: visibleProp = true } = {}) {
  const staffScope = useStaffUserScopeOptional();
  const { setSidebar, clearSidebar } = useSidebar();
  const visible = visibleProp && !staffScope?.isActive;

  const items = useMemo(
    () => [
      { to: "/admin", end: true, icon: <LayoutDashboard size={20} />, label: NAV.dashboard },
      { to: "/admin/profile", icon: <UserCircle size={20} />, label: NAV.profile },
      { to: "/admin/users", icon: <Users size={20} />, label: NAV.users },
      { to: "/admin/organizations", icon: <Building2 size={20} />, label: NAV.organizations },
      { to: "/admin/audit-logs", icon: <FileText size={20} />, label: NAV.auditLogs },
      { to: "/admin/sms-otp-usage", icon: <MessageSquare size={20} />, label: NAV.smsOtpUsage },
      { to: "/admin/recent-logins", icon: <LogIn size={20} />, label: NAV.recentLogins },
      { to: "/admin/settings", icon: <Settings size={20} />, label: NAV.settings },
      { to: "/admin/topup", icon: <Wallet size={20} />, label: NAV.topUp },
      { to: "/admin/pricing", icon: <Tag size={20} />, label: NAV.pricing },
      { to: "/admin/packages", icon: <Tag size={20} />, label: NAV.packages },
      { to: "/admin/revenue", icon: <Coins size={20} />, label: NAV.revenue },
      { to: "/admin/transactions", icon: <ReceiptText size={20} />, label: NAV.transactions },
      { to: "/admin/transfers", icon: <FileText size={20} />, label: NAV.transfers },
      {
        to: "/admin/items",
        icon: <Package size={20} />,
        label: NAV.items,
        subItems: [
          { to: "/admin/items", label: NAV.activeItems, end: true },
          { to: "/admin/items/deleted", label: NAV.deletedItems, end: true },
          { to: "/admin/items/legacy", label: NAV.legacyItems, end: true },
        ],
      },
      { to: "/admin/notifications", icon: <Bell size={20} />, label: NAV.notifications },
      { to: "/admin/activity", icon: <Activity size={20} />, label: NAV.activity },
      { to: "/admin/sessions", icon: <MonitorSmartphone size={20} />, label: NAV.sessions },
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
