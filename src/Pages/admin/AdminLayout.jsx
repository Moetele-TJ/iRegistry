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

      <div className="flex self-start rounded-b-3xl">
        {/* Sidebar */}
        <aside
          className={`
            bg-iregistrygreen text-white
            transition-all duration-300 ease-in-out
            ${expanded ? "w-44" : "w-14"}
            self-start
            rounded-br-3xl
            shadow-lg
            overflow-hidden
          `}
          onMouseEnter={() => setExpanded(true)}
          onMouseLeave={() => setExpanded(false)}
        >
          <nav className="py-4 space-y-2 px-2">
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