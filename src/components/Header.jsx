// src/components/Header.jsx
import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import logo from "../assets/iregistry-logo.png";
import { useAuth } from "../contexts/AuthContext.jsx";

export default function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleLogout() {
    await logout();
    setMobileOpen(false);
    navigate("/");
  }

  const role = user?.role;

  function dashboardPath() {
    if (role === "admin") return "/admin";
    if (role === "police") return "/police";
    if (role === "user") return "/user";
    return "/";
  }

  function isActive(path) {
    return location.pathname.startsWith(path)
      ? "text-iregistrygreen font-semibold"
      : "hover:text-gray-900";
  }

  return (
    <>
      {/* ===== HEADER ===== */}
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

        {/* ===== DESKTOP NAV ===== */}
        <div className="hidden md:flex items-center gap-6 text-gray-600 text-sm">

          <button className={isActive("/")} onClick={() => navigate("/")}>
            Home
          </button>

          {!user && (
            <button
              className={isActive("/signup")}
              onClick={() => navigate("/signup")}
            >
              Signup
            </button>
          )}

          {user && (
            <>
              <button
                className={isActive(dashboardPath())}
                onClick={() => navigate(dashboardPath())}
              >
                Dashboard
              </button>

              <button
                className={isActive("/items")}
                onClick={() => navigate("/items")}
              >
                Items
              </button>

              <button
                onClick={handleLogout}
                className="ml-4 px-3 py-1 rounded-md border hover:bg-gray-50"
              >
                Logout
              </button>
            </>
          )}

          {!user && (
            <button
              onClick={() => navigate("/login")}
              className="ml-4 px-4 py-2 rounded-md bg-iregistrygreen text-white"
            >
              Login
            </button>
          )}
        </div>

        {/* ===== MOBILE MENU BUTTON ===== */}
        <button
          className="md:hidden text-2xl"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          ☰
        </button>
      </header>

      {/* ===== MOBILE MENU ===== */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          {/* Background overlay */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />

          {/* Menu panel */}
          <div className="absolute right-0 top-0 h-full w-64 bg-white shadow-xl p-6 space-y-4">
            <button
              onClick={() => setMobileOpen(false)}
              className="text-right w-full text-gray-500"
            >
              ✕
            </button>

            <nav className="flex flex-col gap-4 text-sm">
              <button onClick={() => navigate("/")}>Home</button>

              {!user && (
                <>
                  <button onClick={() => navigate("/signup")}>Signup</button>
                  <button
                    onClick={() => navigate("/login")}
                    className="text-iregistrygreen font-semibold"
                  >
                    Login
                  </button>
                </>
              )}

              {user && (
                <>
                  <button onClick={() => navigate(dashboardPath())}>
                    Dashboard
                  </button>

                  <button onClick={() => navigate("/items")}>
                    Items
                  </button>

                  <button
                    onClick={handleLogout}
                    className="text-red-600 font-semibold"
                  >
                    Logout
                  </button>
                </>
              )}
            </nav>
          </div>
        </div>
      )}
    </>
  );
}