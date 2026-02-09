// src/components/RoleRedirect.jsx
import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";

export default function RoleRedirect() {
  const { user, loading } = useAuth();

  // Wait until session check finishes
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        Checking session...
      </div>
    );
  }

  // NOT logged in → go to login
  if (!user) return null;

  // Logged in → route by role
  switch (user.role) {
    case "admin":
      return <Navigate to="/admin" replace />;

    case "police":
      return <Navigate to="/police" replace />;

    default:
      return <Navigate to="/user" replace />;
  }
}