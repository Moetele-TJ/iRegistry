import { useState } from "react";
import { Outlet } from "react-router-dom";
import SidebarItem from "../../components/SidebarItem.jsx";
import {
  LayoutDashboard,
  Package,
  Bell,
  Activity,
  UserCircle,
} from "lucide-react";

export default function PoliceLayout() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="flex self-start rounded-b-3xl">
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
              to="/policedashboard"
              icon={<LayoutDashboard size={20} />}
              label="Dashboard"
              expanded={expanded}
            />
            <SidebarItem
              to="/policedashboard/profile"
              icon={<UserCircle size={20} />}
              label="Profile"
              expanded={expanded}
            />
            <SidebarItem
              to="/policedashboard/items"
              icon={<Package size={20} />}
              label="Items"
              expanded={expanded}
            />
            <SidebarItem
              to="/policedashboard/notifications"
              icon={<Bell size={20} />}
              label="Notifications"
              expanded={expanded}
            />
            <SidebarItem
              to="/policedashboard/activity"
              icon={<Activity size={20} />}
              label="Activity"
              expanded={expanded}
            />
          </nav>
        </aside>

        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
