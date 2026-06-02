import { Outlet } from "react-router-dom";
import { useAdminSidebar } from "../../hooks/useAdminSidebar.jsx";
import { StaffUserScopeProvider } from "../../contexts/StaffUserScopeContext.jsx";
import StaffUserScopeSidebarBridge from "../../components/staff/StaffUserScopeSidebarBridge.jsx";

export default function AdminLayout() {
  return (
    <StaffUserScopeProvider>
      <AdminLayoutBody />
    </StaffUserScopeProvider>
  );
}

function AdminLayoutBody() {
  useAdminSidebar();
  return (
  <>
      <StaffUserScopeSidebarBridge />
      <div className="p-4 sm:p-6">
        <Outlet />
      </div>
    </>
  );
}