import { Outlet } from "react-router-dom";
import { useOrganizationSidebar } from "../hooks/useOrganizationSidebar.jsx";

/**
 * Shared shell for `/organizations/:orgKey/*`: same horizontal padding as user/admin layouts,
 * org-scoped sidebar (app home + org nav, gated by org role).
 */
export default function OrganizationLayout() {
  useOrganizationSidebar();

  return (
    <div className="w-full max-w-full min-h-0 p-4 sm:p-6 pt-5 sm:pt-7">
      <Outlet />
    </div>
  );
}
