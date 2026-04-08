import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import Spinner from "./Spinner.jsx";

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
  if (role === "admin") {
    return <Navigate to="/admindashboard/profile" replace />;
  }
  if (role === "police") {
    return <Navigate to="/policedashboard/profile" replace />;
  }
  if (role === "cashier") {
    return <Navigate to="/cashierdashboard/profile" replace />;
  }
  return <Navigate to="/userdashboard/profile" replace />;
}
