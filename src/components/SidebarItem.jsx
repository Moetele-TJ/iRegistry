// src/components/SidebarItem.jsx
import { NavLink } from "react-router-dom";

export default function SidebarItem({ to, icon, label, expanded }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `
        flex items-center gap-3 px-3 py-2 rounded-lg
        transition-colors duration-200
        ${isActive ? "bg-white/20 font-semibold" : "hover:bg-white/10"}
        `
      }
    >
      {/* Icon (always visible) */}
      <span className="shrink-0">{icon}</span>

      {/* Label (auto-hide/show) */}
      {expanded && (
        <span className="whitespace-nowrap">
          {label}
        </span>
      )}
    </NavLink>
  );
}