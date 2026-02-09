// src/components/Header.jsx
import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import logo from "../assets/iregistry-logo.png";
import { useAuth } from "../contexts/AuthContext.jsx";
import ConfirmModal from "./ConfirmModal.jsx";

export default function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const [open, setOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const menuRef = useRef(null);

  /* Close logout modal on route change */
  useEffect(() => {
    setShowLogoutConfirm(false);
  }, [location.pathname]);

  useEffect(() => {
    if (showLogoutConfirm) {
      setOpen(false);
    }
  }, [showLogoutConfirm]);

  async function handleLogout() {
    await logout();
    setOpen(false);
    navigate("/");
  }

  const role = user?.role;

  function dashboardPath() {
    if (role === "admin") return "/admin";
    if (role === "police") return "/police";
    if (role === "user") return "/user";
    return "/";
  }

  function go(path) {
    setOpen(false);
    navigate(path);
  }

  function isActive(path) {
    return location.pathname.startsWith(path)
      ? "text-iregistrygreen font-semibold"
      : "";
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

      {/* ===== DESKTOP NAV ===== */}
      <nav className="hidden md:flex items-center gap-6 text-sm text-gray-600">
        <button onClick={() => go("/")} className={isActive("/")}>
          Home
        </button>

        {user && (
          <>
            <button onClick={() => go(dashboardPath())}>Dashboard</button>
            <button onClick={() => go("/items")}>Items</button>
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
            <button onClick={() => go("/signup")}>Signup</button>
            <button
              onClick={() => go("/login")}
              className="bg-iregistrygreen text-white px-4 py-2 rounded"
            >
              Login
            </button>
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

              <MenuItem 
                icon="🏠" 
                label="Home" 
                onClick={() => go("/")} 
                active={location.pathname==="/"}
              />
              
              {!user && (
                <>
                  <MenuItem 
                    icon="✍️" 
                    label="Signup" 
                    onClick={() => go("/signup")}
                    active={location.pathname.startsWith("/signup")}
                  />
                  
                  <MenuItem
                    icon="🔐"
                    label="Login"
                    onClick={() => go("/login")}
                    active={location.pathname.startsWith("/login")}
                    accent
                  />
                </>
              )}

              {user && (
                <>
                  <MenuItem
                    icon="📊"
                    label="Dashboard"
                    onClick={() => go(dashboardPath())}
                    active={location.pathname==="/"}
                  />
                  <MenuItem
                    icon="📦"
                    label="Items"
                    onClick={() => go("/items")}
                    active={location.pathname.startsWith("/items")}
                  />
                  <MenuItem
                    icon="🚪"
                    label="Logout"
                    onClick={()=> {setOpen(false); setShowLogoutConfirm(true)
                    }}
                    danger
                  />
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

/* ===== Reusable menu item ===== */
function MenuItem({ icon, label, onClick, danger, accent, active }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-2 text-left font-medium transition
        ${
          active
            ? "bg-iregistrygreen/10 text-iregistrygreen font-semibold"
            : danger
            ? "text-red-600"
            : "text-gray-700 hover:bg-gray-50"
        }
      `}
    >
      <span className="text-base">{icon}</span>
      <span>{label}</span>
    </button>
  );
}