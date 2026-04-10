import { Outlet } from "react-router-dom";
import { useUserSidebar } from "../../hooks/useUserSidebar.jsx";

export default function UserLayout() {
  useUserSidebar();

  return (
    <div className="p-4 sm:p-6">
      <Outlet />
    </div>
  );
}
