import { Outlet } from "react-router-dom";
import { useAdminSidebar } from "../../hooks/useAdminSidebar.jsx";

export default function AdminLayout() {
  useAdminSidebar();
  return (
    <div className="p-4 sm:p-6">
      <Outlet />
    </div>
  );
}