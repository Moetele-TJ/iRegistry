// src/components/RoleRedirect.jsx
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import { normalizeRole } from "../lib/roleUtils.js";

export default function RoleRedirect() {
  const { user, loading } = useAuth();
  const location = useLocation();

  // Wait until session check finishes
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        Checking session...
      </div>
    );
  }

  // NOT logged in → go to login
  if (!user) {
    const redirect = `${location.pathname}${location.search}${location.hash}`;
    return (
      <Navigate
        to={`/login?redirect=${encodeURIComponent(redirect)}`}
        replace
      />
    );
  }

  // Logged in → route by role (case-insensitive)
  const r = normalizeRole(user.role);
  if (r === "admin") return <Navigate to="/admin" replace />;
  if (r === "police") return <Navigate to="/police" replace />;
  if (r === "cashier") return <Navigate to="/cashier" replace />;
  return <Navigate to="/user" replace />;
}