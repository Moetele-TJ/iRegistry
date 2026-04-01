// src/Pages/admin/AdminLayout.jsx
import { useState } from "react";
import { Outlet } from "react-router-dom";
import SidebarItem from "../../components/SidebarItem";
import {
  LayoutDashboard,
  Users,
  FileText,
  Settings,
  Package,
  Bell,
  Activity,
} from "lucide-react";

export default function AdminLayout() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Fixed sidebar: stays visible, does not scroll with content */}
      <aside
        className={`
          fixed left-0 top-16 md:top-20 z-50
          bg-iregistrygreen text-white
          transition-all duration-300 ease-in-out
          ${expanded ? "w-44" : "w-14"}
          rounded-br-3xl
          shadow-lg
          overflow-hidden
        `}
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
      >
        <nav className="py-4 space-y-2 px-2 h-[calc(100vh-4rem)] md:h-[calc(100vh-5rem)] overflow-y-auto">
          <SidebarItem
            to="/admindashboard"
            icon={<LayoutDashboard size={20} />}
            label="Dashboard"
            expanded={expanded}
          />

          <SidebarItem
            to="/admindashboard/users"
            icon={<Users size={20} />}
            label="Users"
            expanded={expanded}
          />

          <SidebarItem
            to="/admindashboard/audit-logs"
            icon={<FileText size={20} />}
            label="Audit Logs"
            expanded={expanded}
          />

          <SidebarItem
            to="/admindashboard/settings"
            icon={<Settings size={20} />}
            label="Settings"
            expanded={expanded}
          />
          <SidebarItem
            to="/admindashboard/items"
            icon={<Package size={20} />}
            label="Items"
            expanded={expanded}
          />
          <SidebarItem
            to="/admindashboard/notifications"
            icon={<Bell size={20} />}
            label="Notifications"
            expanded={expanded}
          />
          <SidebarItem
            to="/admindashboard/activity"
            icon={<Activity size={20} />}
            label="Activity"
            expanded={expanded}
          />
        </nav>
      </aside>

      {/* Main content: reserve space for collapsed sidebar only.
          When sidebar expands it overlays (doesn't push content). */}
      <main className="p-4 sm:p-6 pl-[72px] md:pl-[88px]">
        <Outlet />
      </main>
    </div>
  );
}