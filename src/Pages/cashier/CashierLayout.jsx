import { Outlet } from "react-router-dom";
import { useCashierSidebar } from "../../hooks/useCashierSidebar.jsx";
import { StaffUserScopeProvider } from "../../contexts/StaffUserScopeContext.jsx";
import StaffUserScopeSidebarBridge from "../../components/staff/StaffUserScopeSidebarBridge.jsx";

export default function CashierLayout() {
  return (
    <StaffUserScopeProvider>
      <CashierLayoutBody />
    </StaffUserScopeProvider>
  );
}

function CashierLayoutBody() {
  useCashierSidebar();

  return (
    <>
      <StaffUserScopeSidebarBridge />
      <div className="p-4 sm:p-6">
        <Outlet />
      </div>
    </>
  );
}
