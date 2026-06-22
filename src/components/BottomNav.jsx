// src/components/BottomNav.jsx
import { Link, useLocation } from "react-router-dom";
import { useAddItemPreflight } from "../hooks/useAddItemPreflight.js";
import { NAV, NAV_HEADER, NAV_MOBILE } from "../lib/navLabels.js";

export default function BottomNav() {
  const location = useLocation();
  const { goToAddItem, tasksLoading } = useAddItemPreflight();

  const links = [
    { to: "/user", icon: "🏠", label: NAV_HEADER.home },
    { to: "/user/items", icon: "📦", label: NAV_MOBILE.myItems },
    { to: "/items/add", icon: "➕", label: NAV_MOBILE.addItem, isAdd: true },
    { to: "/user/profile", icon: "👤", label: NAV.profile },
  ];

  function isLinkActive(to) {
    if (to === "/user") return location.pathname === "/user";
    return location.pathname === to || location.pathname.startsWith(`${to}/`);
  }

  return (
    <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg z-[60] pb-[env(safe-area-inset-bottom)]">
      <ul className="flex justify-around py-2">
        {links.map((link) => {
          const active = link.isAdd
            ? location.pathname === "/items/add"
            : isLinkActive(link.to);

          if (link.isAdd) {
            return (
              <li key={link.to} className="text-center flex-1">
                <button
                  type="button"
                  onClick={() => void goToAddItem()}
                  disabled={tasksLoading}
                  title={tasksLoading ? "Loading credit prices…" : undefined}
                  className={`flex flex-col items-center text-xs w-full mx-auto ${
                    active ? "text-green-600 font-semibold" : "text-gray-500"
                  } disabled:opacity-60`}
                >
                  <span className="text-2xl">{link.icon}</span>
                  <span>{link.label}</span>
                </button>
              </li>
            );
          }

          return (
            <li key={link.to} className="text-center flex-1">
              <Link
                to={link.to}
                className={`flex flex-col items-center text-xs mx-auto ${
                  active ? "text-green-600 font-semibold" : "text-gray-500"
                }`}
              >
                <span className="text-2xl">{link.icon}</span>
                <span>{link.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
