// src/components/ProtectedRoute.jsx
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import Spinner from "./Spinner";
import { normalizeRole } from "../lib/roleUtils.js";

export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <Spinner label="Checking your session..."/>;
  }

  if (!user || !user.role) {
    const redirect = `${location.pathname}${location.search}${location.hash}`;
    return (
      <Navigate
        to={`/login?redirect=${encodeURIComponent(redirect)}`}
        replace
      />
    );
  }

  if (allowedRoles?.length) {
    const ur = normalizeRole(user.role);
    const ok = allowedRoles.some((r) => normalizeRole(r) === ur);
    if (!ok) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  return children;
}