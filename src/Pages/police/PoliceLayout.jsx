import { Outlet } from "react-router-dom";
import { usePoliceSidebar } from "../../hooks/usePoliceSidebar.jsx";

export default function PoliceLayout() {
  usePoliceSidebar();

  return (
    <div className="p-4 sm:p-6">
      <Outlet />
    </div>
  );
}
