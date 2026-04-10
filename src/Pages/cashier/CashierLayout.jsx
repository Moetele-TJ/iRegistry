import { Outlet } from "react-router-dom";
import { useCashierSidebar } from "../../hooks/useCashierSidebar.jsx";

export default function CashierLayout() {
  useCashierSidebar();

  return (
    <div className="p-4 sm:p-6">
      <Outlet />
    </div>
  );
}
