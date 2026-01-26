// src/Pages/AdminDashboard.jsx
import { NavLink, Outlet } from "react-router-dom"; 
import Header from "../components/Header.jsx";

export default function AdminDashboard() { 
  
  return ( <div className="min-h-screen bg-gray-100"> <Header />

<div className="flex">
    {/* Sidebar */}
    <aside className="w-64 bg-white shadow-lg min-h-[calc(100vh-80px)]">
      <div className="p-6 border-b">
        <h2 className="text-lg font-bold text-iregistrygreen">
          Admin Panel
        </h2>
        <p className="text-xs text-gray-500">System administration</p>
      </div>

      <nav className="p-4 space-y-2 text-sm">
        <NavLink
          to="/admin"
          end
          className={({ isActive }) =>
            `block px-4 py-2 rounded-lg transition ${
              isActive
                ? "bg-iregistrygreen text-white"
                : "text-gray-700 hover:bg-gray-100"
            }`
          }
        >
          📊 Dashboard
        </NavLink>

        <NavLink
          to="/admin/users"
          className={({ isActive }) =>
            `block px-4 py-2 rounded-lg transition ${
              isActive
                ? "bg-iregistrygreen text-white"
                : "text-gray-700 hover:bg-gray-100"
            }`
          }
        >
          👤 Users
        </NavLink>

        <NavLink
          to="/admin/audit-logs"
          className={({ isActive }) =>
            `block px-4 py-2 rounded-lg transition ${
              isActive
                ? "bg-iregistrygreen text-white"
                : "text-gray-700 hover:bg-gray-100"
            }`
          }
        >
          🧾 Audit Logs
        </NavLink>

        <NavLink
          to="/admin/settings"
          className={({ isActive }) =>
            `block px-4 py-2 rounded-lg transition ${
              isActive
                ? "bg-iregistrygreen text-white"
                : "text-gray-700 hover:bg-gray-100"
            }`
          }
        >
          ⚙️ System Settings
        </NavLink>
      </nav>
    </aside>

    {/* Main content */}
    <main className="flex-1 p-6">
      <Outlet />
    </main>
  </div>
</div>

); }