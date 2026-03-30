// src/components/RoleRedirect.jsx
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";

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

  // Logged in → route by role
  switch (user.role) {
    case "admin":
      return <Navigate to="/admindashboard" replace />;

    case "police":
      return <Navigate to="/policedashboard" replace />;

    default:
      return <Navigate to="/userdashboard" replace />;
  }
}