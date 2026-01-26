// src/components/Header.jsx
import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import logo from "../assets/iregistry-logo.png";
import { useAuth } from "../contexts/AuthContext.jsx";

export default function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const role = user?.role;

  // Decide dashboard path based on role
  function dashboardPath() {
    if (role === "admin") return "/admin";
    if (role === "police") return "/police";
    if (role === "user") return "/user";
    return "/"; // not logged in
  }

  function isActive(path) {
    return location.pathname.startsWith(path)
      ? "text-iregistrygreen font-semibold"
      : "hover:text-gray-900";
  }

  return (
    <header className="w-full bg-white shadow-lg py-3 px-4 md:px-8 flex items-center justify-between sticky top-0 z-50">

      {/* Logo */}
      <div
        className="flex items-center gap-3 cursor-pointer"
        onClick={() => navigate(dashboardPath())}
      >
        <img
          src={logo}
          alt="iRegistry Logo"
          className="h-10 md:h-20 object-contain"
        />
      </div>

      {/* Navigation */}
      <div className="hidden md:flex items-center gap-6 text-gray-600 text-sm">

        {/* Dashboard (role-aware) */}
        {role && (
          <button
            className={isActive(dashboardPath())}
            onClick={() => navigate(dashboardPath())}
          >
            Dashboard
          </button>
        )}

        {/* Items (all logged-in roles) */}
        {role && (
          <button
            className={isActive("/items")}
            onClick={() => navigate("/items")}
          >
            Items
          </button>
        )}

        {role && (
          <button
            className={isActive("/signup")}
            onClick={() => navigate("/signup")}
          >
            Signup
          </button>
        )}


        {/* User-only */}
        {role === "user" && (
          <button
            className={isActive("/items/add")}
            onClick={() => navigate("/items/add")}
          >
            Register Item
          </button>
        )}

        {/* Police-only */}
        {role === "police" && (
          <button
            className={isActive("/police")}
            onClick={() => navigate("/police")}
          >
            Police Desk
          </button>
        )}

        {/* Admin-only */}
        {role === "admin" && (
          <>
            <button
              className={isActive("/admin")}
              onClick={() => navigate("/admin")}
            >
              Admin Panel
            </button>

            <button
              className={isActive("/admin/users")}
              onClick={() => navigate("/admin/users")}
            >
              Manage Users
            </button>
          </>
        )}

        {/* Auth actions */}
        {user ? (
          <button
            onClick={logout}
            className="ml-4 px-3 py-1 rounded-md border hover:bg-gray-50"
          >
            Logout
          </button>
        ) : (
          <button
            onClick={() => navigate("/login")}
            className="ml-4 px-4 py-2 rounded-md bg-iregistrygreen text-white"
          >
            Login
          </button>
        )}
      </div>
    </header>
  );
}