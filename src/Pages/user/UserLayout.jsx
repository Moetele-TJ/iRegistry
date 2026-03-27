import { useState } from "react";
import { Outlet } from "react-router-dom";
import SidebarItem from "../../components/SidebarItem";
import {
  LayoutDashboard,
  Package,
  Bell,
  Activity,
} from "lucide-react";

export default function UserLayout() {
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
              to="/userdashboard"
              icon={<LayoutDashboard size={20} />}
              label="Overview"
              expanded={expanded}
            />
            <SidebarItem
              to="/userdashboard/items"
              icon={<Package size={20} />}
              label="Items"
              expanded={expanded}
            />
            <SidebarItem
              to="/userdashboard/notifications"
              icon={<Bell size={20} />}
              label="Notifications"
              expanded={expanded}
            />
            <SidebarItem
              to="/userdashboard/activity"
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
