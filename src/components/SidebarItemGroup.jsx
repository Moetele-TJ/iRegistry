import { useMemo, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";

/**
 * Primary nav row + flyout sub-links (routes unchanged).
 * Flyout extends to the right when the sidebar is expanded and the group is hovered
 * or a child route is active.
 */
export default function SidebarItemGroup({
  to: baseTo,
  icon,
  label,
  subItems = [],
  expanded,
  onNavigate,
  touchMode,
  onTouchExpand,
}) {
  const location = useLocation();
  const [hover, setHover] = useState(false);

  const groupPathActive = useMemo(() => {
    const p = location.pathname;
    return p === baseTo || p.startsWith(`${baseTo}/`);
  }, [location.pathname, baseTo]);

  const showSub = expanded && (hover || groupPathActive);

  return (
    <div
      className="relative"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <NavLink
        to={baseTo}
        end
        onClick={(e) => {
          if (touchMode && !expanded) {
            e.preventDefault();
            onTouchExpand?.();
            return;
          }
          onNavigate?.();
        }}
        className={() => {
          const base =
            "group flex w-full items-center rounded-xl transition-colors duration-200 min-h-[2.5rem] px-2 py-1.5";
          const layout = expanded ? "justify-start gap-3" : "justify-center";
          const bg = expanded
            ? groupPathActive
              ? "bg-white/20 font-semibold"
              : "hover:bg-white/10"
            : "hover:bg-white/10";
          return `${base} ${layout} ${bg}`;
        }}
      >
        <>
          <span
            className={[
              "shrink-0 flex w-10 h-10 items-center justify-center rounded-xl",
              !expanded && groupPathActive ? "bg-white/20" : "",
            ].join(" ")}
          >
            <span className="flex h-5 w-5 items-center justify-center [&>svg]:h-5 [&>svg]:w-5">
              {icon}
            </span>
          </span>
          {expanded ? (
            <span className="min-w-0 flex-1 truncate text-left whitespace-nowrap">{label}</span>
          ) : null}
        </>
      </NavLink>

      {showSub && subItems.length > 0 ? (
        <div
          className="absolute left-full top-0 z-[80] ml-0 pl-1.5 py-0"
          role="group"
          aria-label={`${label} views`}
        >
          <div className="min-w-[11.5rem] rounded-xl border border-white/15 bg-iregistrygreen py-1.5 shadow-lg">
            {subItems.map((sub) => (
              <NavLink
                key={sub.to}
                to={sub.to}
                end={sub.end !== false}
                onClick={() => onNavigate?.()}
                className={({ isActive }) => {
                  const base =
                    "block px-3 py-2 text-sm transition-colors duration-200 text-left whitespace-nowrap";
                  const bg = isActive ? "bg-white/15 font-medium" : "hover:bg-white/10 text-white/95";
                  return `${base} ${bg}`;
                }}
              >
                {sub.label}
              </NavLink>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
