import { useEffect, useMemo } from "react";
import {
  Activity,
  Bell,
  FileText,
  LayoutDashboard,
  Package,
  Settings,
  Users,
} from "lucide-react";
import { useSidebar } from "../contexts/SidebarContext";

export function useAdminSidebar({ visible = true } = {}) {
  const { setSidebar, clearSidebar } = useSidebar();

  const items = useMemo(
    () => [
      { to: "/admindashboard", icon: <LayoutDashboard size={20} />, label: "Dashboard" },
      { to: "/admindashboard/users", icon: <Users size={20} />, label: "Users" },
      { to: "/admindashboard/audit-logs", icon: <FileText size={20} />, label: "Audit Logs" },
      { to: "/admindashboard/settings", icon: <Settings size={20} />, label: "Settings" },
      { to: "/admindashboard/items", icon: <Package size={20} />, label: "Items" },
      { to: "/admindashboard/notifications", icon: <Bell size={20} />, label: "Notifications" },
      { to: "/admindashboard/activity", icon: <Activity size={20} />, label: "Activity" },
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

