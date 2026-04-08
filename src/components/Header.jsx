// src/components/Header.jsx
import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation, NavLink } from "react-router-dom";
import logo from "../assets/iregistry-logo.png";
import { useAuth } from "../contexts/AuthContext";
import { useTransfers } from "../contexts/TransferContext";
import { useNotificationCenter } from "../contexts/NotificationContext";
import {
  Repeat,
  Bell,
  UserCircle,
  Home,
  LayoutDashboard,
  Package,
  LogOut,
  UserPlus,
  LogIn,
  Menu,
} from "lucide-react";
import ConfirmModal from "./ConfirmModal.jsx";

export default function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { count } = useTransfers();
  const { unread, loading } = useNotificationCenter();

  const headerRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const menuRef = useRef(null);
  const previousUnread = useRef(0);
  const [animateBell, setAnimateBell] = useState(false);

  /* Close logout modal on route change */
  useEffect(() => {
    setShowLogoutConfirm(false);
  }, [location.pathname]);

  useEffect(() => {
    if (showLogoutConfirm) {
      setOpen(false);
    }
  }, [showLogoutConfirm]);

  useEffect(() => {

    if (!loading && unread > previousUnread.current) {

      setAnimateBell(true);

      setTimeout(() => {
        setAnimateBell(false);
      }, 700);

    }

    previousUnread.current = unread;

  }, [loading, unread]);

  async function handleLogout() {
    await logout();
    setOpen(false);
    navigate("/");
  }

  const role = user?.role;

  function dashboardPath() {
    if (role === "admin") return "/admindashboard";
    if (role === "police") return "/policedashboard";
    if (role === "cashier") return "/cashierdashboard";
    if (role === "user") return "/userdashboard";
    return "/";
  }

  function profilePath() {
    if (role === "admin") return "/admindashboard/profile";
    if (role === "police") return "/policedashboard/profile";
    if (role === "cashier") return "/cashierdashboard/profile";
    if (role === "user") return "/userdashboard/profile";
    return "/profile";
  }

  function go(path) {
    setOpen(false);
    navigate(path);
  }

  /* Close menu when clicking outside */
  useEffect(() => {
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Keep a CSS variable in sync with the header height so
  // fixed UI (like sidebars) can sit exactly underneath it.
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;

    function update() {
      const h = Math.ceil(el.getBoundingClientRect().height || 0);
      if (h > 0) {
        document.documentElement.style.setProperty("--app-header-h", `${h}px`);
      }
    }

    update();

    const ro = new ResizeObserver(() => update());
    ro.observe(el);

    window.addEventListener("resize", update);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  return (
    <header
      ref={headerRef}
      className="w-full bg-white shadow-lg px-4 md:px-8 py-3 flex items-center justify-between sticky top-0 z-50"
    >

      {/* Logo */}
      <div
        className="flex items-center gap-3 cursor-pointer"
        onClick={() => go(dashboardPath())}
      >
        <img src={logo} alt="iRegistry" className="h-10 md:h-16" />
      </div>

      {user && (
        <div className="flex items-center gap-4">

          {/* Notifications */}
          {!loading && unread > 0 && (
            <div
              className="relative cursor-pointer hover:scale-105 transition-transform"
              onClick={() => navigate("/notifications")}
            >
              <Bell
                size={20}
                className={`text-gray-600 ${animateBell ? "bell-shake" : ""}`}
              />

              <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs px-2 py-0.5 rounded-full">
                {unread > 99 ? "99+" : unread}
              </span>
            </div>
          )}

          {/* Transfers (owner queue; not used on cashier accounts) */}
          {count > 0 && role !== "cashier" && (
            <div
              className="relative cursor-pointer hover:scale-105 transition-transform"
              onClick={() => navigate("/userdashboard?tab=transfers")}
            >
              <Repeat size={20} className="text-gray-600" />

              <span className="absolute -top-2 -right-2 bg-emerald-600 text-white text-xs px-2 py-0.5 rounded-full">
                {count}
              </span>
            </div>
          )}

        </div>
      )}

      {/* ===== DESKTOP NAV ===== */}
      <nav className="hidden md:flex items-center gap-6 text-sm text-gray-600">

        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `inline-flex items-center gap-1.5 ${isActive ? "text-iregistrygreen font-semibold" : ""}`
          }
        >
          <Home size={18} className="shrink-0 opacity-80" />
          Home
        </NavLink>

        {user && (
          <>
            <NavLink
              to={dashboardPath()}
              className={({ isActive }) =>
                `inline-flex items-center gap-1.5 ${isActive ? "text-iregistrygreen font-semibold" : ""}`
              }
            >
              <LayoutDashboard size={18} className="shrink-0 opacity-80" />
              Dashboard
            </NavLink>

            <NavLink
              to="/items"
              className={({ isActive }) =>
                `inline-flex items-center gap-1.5 ${isActive ? "text-iregistrygreen font-semibold" : ""}`
              }
            >
              <Package size={18} className="shrink-0 opacity-80" />
              Items
            </NavLink>

            <NavLink
              to={profilePath()}
              className={({ isActive }) =>
                `inline-flex items-center gap-1.5 ${isActive ? "text-iregistrygreen font-semibold" : ""}`
              }
            >
              <UserCircle size={18} className="shrink-0 opacity-80" />
              Profile
            </NavLink>

            <button
              type="button"
              onClick={() => setShowLogoutConfirm(true)}
              className="inline-flex items-center gap-1.5 border px-3 py-1 rounded hover:bg-gray-50 transition-colors"
            >
              <LogOut size={18} className="shrink-0 opacity-80" />
              Logout
            </button>
          </>
        )}

        {!user && (
          <>
            <NavLink
              to="/signup"
              className={({ isActive }) =>
                `inline-flex items-center gap-1.5 ${isActive ? "text-iregistrygreen font-semibold" : ""}`
              }
            >
              <UserPlus size={18} className="shrink-0 opacity-80" />
              Signup
            </NavLink>

            <NavLink
              to="/login"
              className={({ isActive }) =>
                `inline-flex items-center gap-1.5 bg-iregistrygreen text-white px-4 py-2 rounded ${isActive ? "ring-2 ring-offset-2 ring-iregistrygreen/40" : ""}`
              }
            >
              <LogIn size={18} className="shrink-0 opacity-95" />
              Login
            </NavLink>
          </>
        )}
      </nav>

      {/* ===== MOBILE MENU BUTTON ===== */}
      <div className="relative md:hidden" ref={menuRef}>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="p-2 rounded-lg text-iregistrygreen hover:bg-gray-100 transition-colors"
          aria-expanded={open}
          aria-label={open ? "Close menu" : "Open menu"}
        >
          <Menu size={26} strokeWidth={2} />
        </button>

        {/* ===== MOBILE POPOVER MENU ===== */}
        {open && (
          <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border text-sm">
            <div className="flex flex-col py-2">

              <NavLink
                to="/"
                end
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-2 font-medium transition ${
                    isActive
                      ? "bg-iregistrygreen/10 text-iregistrygreen font-semibold"
                      : "text-gray-700 hover:bg-gray-50"
                  }`
                }
              >
                <Home size={18} className="shrink-0 opacity-80" />
                Home
              </NavLink>

              {!user && (
                <>
                  <NavLink
                    to="/signup"
                    onClick={() => setOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-4 py-2 font-medium transition ${
                        isActive
                          ? "bg-iregistrygreen/10 text-iregistrygreen font-semibold"
                          : "text-gray-700 hover:bg-gray-50"
                      }`
                    }
                  >
                    <UserPlus size={18} className="shrink-0 opacity-80" />
                    Signup
                  </NavLink>

                  <NavLink
                    to="/login"
                    onClick={() => setOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-4 py-2 font-medium transition ${
                        isActive
                          ? "bg-iregistrygreen/10 text-iregistrygreen font-semibold"
                          : "text-gray-700 hover:bg-gray-50"
                      }`
                    }
                  >
                    <LogIn size={18} className="shrink-0 opacity-80" />
                    Login
                  </NavLink>
                </>
              )}

              {user && (
                <>
                  <NavLink
                    to={dashboardPath()}
                    onClick={() => setOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-4 py-2 font-medium transition ${
                        isActive
                          ? "bg-iregistrygreen/10 text-iregistrygreen font-semibold"
                          : "text-gray-700 hover:bg-gray-50"
                      }`
                    }
                  >
                    <LayoutDashboard size={18} className="shrink-0 opacity-80" />
                    Dashboard
                  </NavLink>

                  <NavLink
                    to="/items"
                    onClick={() => setOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-4 py-2 font-medium transition ${
                        isActive
                          ? "bg-iregistrygreen/10 text-iregistrygreen font-semibold"
                          : "text-gray-700 hover:bg-gray-50"
                      }`
                    }
                  >
                    <Package size={18} className="shrink-0 opacity-80" />
                    Items
                  </NavLink>

                  <NavLink
                    to={profilePath()}
                    onClick={() => setOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-4 py-2 font-medium transition ${
                        isActive
                          ? "bg-iregistrygreen/10 text-iregistrygreen font-semibold"
                          : "text-gray-700 hover:bg-gray-50"
                      }`
                    }
                  >
                    <UserCircle size={18} className="shrink-0 opacity-80" />
                    Profile
                  </NavLink>

                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      setShowLogoutConfirm(true);
                    }}
                    className="flex w-full items-center gap-3 px-4 py-2 font-medium text-red-600 text-left hover:bg-red-50/80 transition-colors"
                  >
                    <LogOut size={18} className="shrink-0 opacity-90" />
                    Logout
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={handleLogout}
        title="Confirm logout"
        message="Are you sure you want to log out now?"
        confirmLabel="Logout"
        cancelLabel="Cancel"
        danger
      />
    </header>
  );
}