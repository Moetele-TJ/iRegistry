import { useMemo, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";

/**
 * Primary nav row + sub-links directly under it (same routes as before).
 * Shown when the rail is expanded and the row is hovered, a child route is active,
 * or on touch/coarse pointers where hover does not exist.
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

  /* Touch / no-hover: show submenu whenever rail is expanded so links are reachable. */
  const showSub =
    expanded &&
    (touchMode || hover || groupPathActive);

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
          className="mt-1.5 ml-2 border-l border-white/25 pl-3 space-y-0.5 pb-0.5"
          role="group"
          aria-label={`${label} views`}
        >
          {subItems.map((sub) => (
            <NavLink
              key={sub.to}
              to={sub.to}
              end={sub.end !== false}
              onClick={() => onNavigate?.()}
              className={({ isActive }) => {
                const base =
                  "block rounded-lg py-1.5 px-2 text-sm transition-colors duration-200 text-left";
                const bg = isActive ? "bg-white/15 font-medium" : "hover:bg-white/10 text-white/95";
                return `${base} ${bg}`;
              }}
            >
              {sub.label}
            </NavLink>
          ))}
        </div>
      ) : null}
    </div>
  );
}
