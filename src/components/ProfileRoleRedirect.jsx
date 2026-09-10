import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import Spinner from "./Spinner.jsx";
import { roleIs } from "../lib/roleUtils.js";
import { loginHrefWithReturn } from "../lib/postLoginRedirect.js";

/** Sends /profile to the dashboard-scoped profile URL so layout sidebars stay correct. */
export default function ProfileRoleRedirect() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return <Spinner label="Loading…" />;
  }
  const role = user?.role;
  if (!role) {
    const redirect = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={loginHrefWithReturn(redirect)} replace />;
  }
  const target = roleIs(role, "admin")
    ? "/admin/profile"
    : roleIs(role, "police")
      ? "/police/profile"
      : roleIs(role, "cashier")
        ? "/cashier/profile"
        : "/user/profile";
  return <Navigate to={`${target}${location.search}`} replace />;
}
