// src/Pages/admin/AdminLayout.jsx
import { useState } from "react";
import { Outlet } from "react-router-dom";
import Header from "../../components/Header";
import SidebarItem from "../../components/SidebarItem";
import {
  LayoutDashboard,
  Users,
  FileText,
  Settings,
} from "lucide-react";

export default function AdminLayout() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="min-h-screen bg-gray-100">

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={`
            bg-iregistrygreen text-white
            transition-all duration-300
            ${expanded ? "w-64" : "w-16"}
            flex-shrink-0
            overflow-hidden
          `}
          onMouseEnter={() => setExpanded(true)}
          onMouseLeave={() => setExpanded(false)}
        >
          <nav className="mt-6 space-y-2 px-2">
            <SidebarItem
              to="/admin"
              icon={<LayoutDashboard size={20} />}
              label="Dashboard"
              expanded={expanded}
            />

            <SidebarItem
              to="/admin/users"
              icon={<Users size={20} />}
              label="Users"
              expanded={expanded}
            />

            <SidebarItem
              to="/admin/audit-logs"
              icon={<FileText size={20} />}
              label="Audit Logs"
              expanded={expanded}
            />

            <SidebarItem
              to="/admin/settings"
              icon={<Settings size={20} />}
              label="Settings"
              expanded={expanded}
            />
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}