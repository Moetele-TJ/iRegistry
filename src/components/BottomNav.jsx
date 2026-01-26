// src/components/BottomNav.jsx
import { Link, useLocation } from "react-router-dom";

export default function BottomNav() {
  const location = useLocation();

  const links = [
    { to: "/", icon: "🏠", label: "Home" },
    { to: "/items", icon: "📦", label: "My Items" },
    { to: "/items/add", icon: "➕", label: "Add Item" },
    { to: "/profile", icon: "👤", label: "Profile" }
  ];

  return (
    <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg z-50">
      <ul className="flex justify-around py-2">
        {links.map(link => {
          const active = location.pathname === link.to;

          return (
            <li key={link.to} className="text-center">
              <Link
                to={link.to}
                className={`flex flex-col items-center text-xs ${
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
