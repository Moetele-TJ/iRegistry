// src/components/Header.jsx
import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation, NavLink } from "react-router-dom";
import logo from "../assets/iregistry-logo.png";
import { useAuth } from "../contexts/AuthContext";
import { useTransfers } from "../contexts/TransferContext";
import { useNotificationCenter } from "../contexts/NotificationContext";
import { Repeat, Bell } from "lucide-react";
import ConfirmModal from "./ConfirmModal.jsx";

export default function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { count } = useTransfers();
  const { unread, loading } = useNotificationCenter();

  const [open, setOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [hasShownNotificationBadge, setHasShownNotificationBadge] = useState(false);
  const menuRef = useRef(null);
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
    if (!loading && unread > 0) {
      setHasShownNotificationBadge(true);

      setAnimateBell(true);

      setTimeout(() => {
        setAnimateBell(false);
      }, 700);
    }
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
    if (role === "user") return "/userdashboard";
    return "/";
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

  return (
    <header className="w-full bg-white shadow-lg px-4 md:px-8 py-3 flex items-center justify-between sticky top-0 z-50">

      {/* Logo */}
      <div
        className="flex items-center gap-3 cursor-pointer"
        onClick={() => go(dashboardPath())}
      >
        <img src={logo} alt="iRegistry" className="h-10 md:h-16" />
      </div>

      {/* Unread Notifications Badge */}
      {user && !loading && (unread > 0 || hasShownNotificationBadge) && (

        <div
          className="relative cursor-pointer hover:scale-105 transition-transform duration-200"
          onClick={() => navigate("/notifications")}
          >
          <Bell
            size={20}
            className={`text-gray-600 ${animateBell ? "bell-shake" : ""}`}
          />

          <span
            className={`absolute -top-2 -right-2 text-xs px-2 py-0.5 rounded-full transition-colors duration-300 ${
              unread > 0
                ? "bg-red-600 text-white"
                : "bg-gray-200 text-gray-600"
            }`}
          >
            {unread > 99 ? "99+" : unread}
          </span>
        </div>
      )}

      {/* Transfer Badge */}
      {user && count > 0 && (

        <div
          className="relative cursor-pointer hover:scale-105 transition-transform duration-200"
          onClick={() => navigate("/userdashboard?tab=transfers")}
          >
          <Repeat size={20} className="text-gray-600" />
          <span className="absolute -top-2 -right-2 bg-emerald-600 text-white text-xs px-2 py-0.5 rounded-full">
            {count}
          </span>
        </div>
      )}

      {/* ===== DESKTOP NAV ===== */}
      <nav className="hidden md:flex items-center gap-6 text-sm text-gray-600">

        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            isActive ? "text-iregistrygreen font-semibold" : ""
          }
        >
          Home
        </NavLink>

        {user && (
          <>
            <NavLink
              to={dashboardPath()}
              className={({ isActive }) =>
                isActive ? "text-iregistrygreen font-semibold" : ""
              }
            >
              Dashboard
            </NavLink>

            <NavLink
              to="/items"
              className={({ isActive }) =>
                isActive ? "text-iregistrygreen font-semibold" : ""
              }
            >
              Items
            </NavLink>

            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="border px-3 py-1 rounded"
            >
              Logout
            </button>
          </>
        )}

        {!user && (
          <>
            <NavLink
              to="/signup"
              className={({ isActive }) =>
                isActive ? "text-iregistrygreen font-semibold" : ""
              }
            >
              Signup
            </NavLink>

            <NavLink
              to="/login"
              className="bg-iregistrygreen text-white px-4 py-2 rounded"
            >
              Login
            </NavLink>
          </>
        )}
      </nav>

      {/* ===== MOBILE MENU BUTTON ===== */}
      <div className="relative md:hidden" ref={menuRef}>
        <button
          onClick={() => setOpen(!open)}
          className="text-2xl px-2 text-iregistrygreen"
        >
          ☰
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
                🏠 Home
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
                    ✍️ Signup
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
                    🔐 Login
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
                    📊 Dashboard
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
                    📦 Items
                  </NavLink>

                  <button
                    onClick={() => {
                      setOpen(false);
                      setShowLogoutConfirm(true);
                    }}
                    className="flex items-center gap-3 px-4 py-2 font-medium text-red-600"
                  >
                    🚪 Logout
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