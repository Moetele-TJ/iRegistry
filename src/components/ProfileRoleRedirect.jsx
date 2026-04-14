import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import Spinner from "./Spinner.jsx";
import { roleIs } from "../lib/roleUtils.js";

/** Sends /profile to the dashboard-scoped profile URL so layout sidebars stay correct. */
export default function ProfileRoleRedirect() {
  const { user, loading } = useAuth();
  if (loading) {
    return <Spinner label="Loading…" />;
  }
  const role = user?.role;
  if (!role) {
    return <Navigate to="/login" replace />;
  }
  if (roleIs(role, "admin")) {
    return <Navigate to="/admin/profile" replace />;
  }
  if (roleIs(role, "police")) {
    return <Navigate to="/police/profile" replace />;
  }
  if (roleIs(role, "cashier")) {
    return <Navigate to="/cashier/profile" replace />;
  }
  return <Navigate to="/user/profile" replace />;
}
