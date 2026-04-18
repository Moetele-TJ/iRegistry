import { useEffect, useMemo } from "react";
import {
  Building2,
  LayoutDashboard,
  ReceiptText,
  Users,
  Wallet,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useSidebar } from "../contexts/SidebarContext.jsx";
import { useOrgRouteResolution } from "./useOrgRouteResolution.js";

/** App (session) role → home route for “leave organization” nav. */
function appHomeForRole(role) {
  const r = String(role || "user").toLowerCase();
  if (r === "admin") return { to: "/admin", label: "Admin home" };
  if (r === "cashier") return { to: "/cashier", label: "Cashier home" };
  if (r === "police") return { to: "/police", label: "Police home" };
  return { to: "/user", label: "User home" };
}

/**
 * Org role from get-org-wallet / list-org-items (ORG_* or STAFF for app staff acting on org).
 * Members management is limited to org admins/managers and app staff.
 */
function canSeeOrgMembersNav(orgRole) {
  if (!orgRole) return false;
  const u = String(orgRole).toUpperCase();
  return (
    u === "ORG_ADMIN" ||
    u === "ORG_MANAGER" ||
    u === "STAFF"
  );
}

/**
 * Sidebar for `/organizations/:orgKey/*`: combines app role (dashboard link) and org role (Members link).
 */
export function useOrganizationSidebar() {
  const { user } = useAuth();
  const { orgKey, role: orgRole, loading: orgLoading } = useOrgRouteResolution();
  const { setSidebar, clearSidebar } = useSidebar();

  const appRole = user?.role;
  const home = useMemo(() => appHomeForRole(appRole), [appRole]);
  const base = orgKey ? `/organizations/${orgKey}` : "";

  const items = useMemo(() => {
    if (!base) return [];
    const list = [
      { to: home.to, icon: <LayoutDashboard size={20} />, label: home.label },
      {
        to: `${base}/items`,
        icon: <Building2 size={20} />,
        label: "Items",
      },
      { to: `${base}/wallet`, icon: <Wallet size={20} />, label: "Wallet" },
      {
        to: `${base}/transactions`,
        icon: <ReceiptText size={20} />,
        label: "Transactions",
      },
    ];
    if (!orgLoading && canSeeOrgMembersNav(orgRole)) {
      list.push({
        to: `${base}/members`,
        icon: <Users size={20} />,
        label: "Members",
      });
    }
    return list;
  }, [base, home, orgLoading, orgRole]);

  useEffect(() => {
    if (!base) {
      clearSidebar();
      return;
    }
    setSidebar({
      visible: true,
      items,
      hoverExpand: true,
    });
    return () => clearSidebar();
  }, [base, items, setSidebar, clearSidebar]);
}
