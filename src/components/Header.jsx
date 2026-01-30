// src/components/Header.jsx
import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import logo from "../assets/iregistry-logo.png";
import { useAuth } from "../contexts/AuthContext.jsx";

export default function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  async function handleLogout() {
    await logout();
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
        onClick={() => navigate(dashboardPath())}
      >
        <img src={logo} alt="iRegistry" className="h-10 md:h-16" />
      </div>

      {/* ===== DESKTOP NAV ===== */}
      <nav className="hidden md:flex items-center gap-6 text-sm text-gray-600">
        <button onClick={() => navigate("/")} className={isActive("/")}>
          Home
        </button>

        {user && (
          <>
            <button onClick={() => navigate(dashboardPath())}>
              Dashboard
            </button>
            <button onClick={() => navigate("/items")}>Items</button>
            <button onClick={handleLogout} className="border px-3 py-1 rounded">
              Logout
            </button>
          </>
        )}

        {!user && (
          <>
            <button onClick={() => navigate("/signup")}>Signup</button>
            <button
              onClick={() => navigate("/login")}
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
          className="text-2xl px-2"
        >
          ☰
        </button>

        {/* ===== MOBILE POPOVER MENU ===== */}
        {open && (
          <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border text-sm">
            <div className="flex flex-col py-2">

              <MenuItem label="Home" onClick={() => navigate("/")} />

              {!user && (
                <>
                  <MenuItem label="Signup" onClick={() => navigate("/signup")} />
                  <MenuItem
                    label="Login"
                    onClick={() => navigate("/login")}
                    accent
                  />
                </>
              )}

              {user && (
                <>
                  <MenuItem
                    label="Dashboard"
                    onClick={() => navigate(dashboardPath())}
                  />
                  <MenuItem
                    label="Items"
                    onClick={() => navigate("/items")}
                  />
                  <MenuItem
                    label="Logout"
                    onClick={handleLogout}
                    danger
                  />
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

/* Reusable menu item */
function MenuItem({ label, onClick, danger, accent }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-left hover:bg-gray-100 transition
        ${danger ? "text-red-600" : ""}
        ${accent ? "text-iregistrygreen font-semibold" : ""}
      `}
    >
      {label}
    </button>
  );
}