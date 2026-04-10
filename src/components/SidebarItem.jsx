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
        const base =
          "group flex items-center justify-start gap-3 rounded-xl transition-colors duration-200 min-h-[2.5rem] px-2 py-1.5";
        const bg = expanded
          ? isActive
            ? "bg-white/20 font-semibold"
            : "hover:bg-white/10"
          : "hover:bg-white/10";
        return `${base} ${bg}`;
      }}
    >
      {({ isActive }) => (
        <>
          {/* Fixed icon column: same left edge + same box in collapsed vs expanded */}
          <span
            className={[
              "shrink-0 flex w-10 h-10 items-center justify-center rounded-xl",
              !expanded && isActive ? "bg-white/20" : "",
            ].join(" ")}
          >
            <span className="flex h-5 w-5 items-center justify-center [&>svg]:h-5 [&>svg]:w-5">
              {icon}
            </span>
          </span>

          {/* Label (auto-hide/show) */}
          {expanded ? (
            <span className="min-w-0 flex-1 truncate text-left whitespace-nowrap">{label}</span>
          ) : null}
        </>
      )}
    </NavLink>
  );
}