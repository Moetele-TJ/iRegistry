// src/components/SidebarItem.jsx
import { NavLink } from "react-router-dom";

export default function SidebarItem({
  to,
  icon,
  label,
  expanded,
  onNavigate,
  touchMode,
  onTouchExpand,
}) {
  return (
    <NavLink
      to={to}
      onClick={(e) => {
        if (touchMode && !expanded) {
          e.preventDefault();
          onTouchExpand?.();
          return;
        }
        onNavigate?.();
      }}
      className={({ isActive }) => {
        const base = "group flex items-center rounded-xl transition-colors duration-200";
        const layout = expanded ? "justify-start gap-3 px-3 py-2" : "justify-center px-2 py-1.5";
        const bg = expanded
          ? (isActive ? "bg-white/20 font-semibold" : "hover:bg-white/10")
          : "hover:bg-white/10";
        return `${base} ${layout} ${bg}`;
      }}
    >
      {({ isActive }) => (
        <>
          {/* Icon (always visible) */}
          <span
            className={[
              "shrink-0 flex items-center justify-center rounded-xl",
              expanded ? "w-5 h-5" : "w-10 h-10",
              !expanded && isActive ? "bg-white/20" : "",
            ].join(" ")}
          >
            {icon}
          </span>

          {/* Label (auto-hide/show) */}
          {expanded && <span className="whitespace-nowrap">{label}</span>}
        </>
      )}
    </NavLink>
  );
}