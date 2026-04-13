import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { NavLink, useLocation } from "react-router-dom";

const FLYOUT_Z = 90;
const LEAVE_MS = 140;

/**
 * Primary row + flyout sub-links rendered in a portal (avoids sidebar overflow clipping).
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
  const anchorRef = useRef(null);
  const leaveTimer = useRef(null);
  const [inHoverZone, setInHoverZone] = useState(false);
  const [pos, setPos] = useState(null);

  const groupPathActive = useMemo(() => {
    const p = location.pathname;
    return p === baseTo || p.startsWith(`${baseTo}/`);
  }, [location.pathname, baseTo]);

  const showFlyout =
    expanded &&
    subItems.length > 0 &&
    (touchMode || groupPathActive || inHoverZone);

  const clearLeaveTimer = () => {
    if (leaveTimer.current != null) {
      window.clearTimeout(leaveTimer.current);
      leaveTimer.current = null;
    }
  };

  const enterZone = () => {
    clearLeaveTimer();
    setInHoverZone(true);
  };

  const leaveZone = () => {
    clearLeaveTimer();
    leaveTimer.current = window.setTimeout(() => setInHoverZone(false), LEAVE_MS);
  };

  useLayoutEffect(() => {
    if (!showFlyout || !anchorRef.current) {
      setPos(null);
      return;
    }

    const update = () => {
      const el = anchorRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setPos({ top: r.top, left: r.right + 6 });
    };

    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [showFlyout, expanded, location.pathname]);

  useEffect(() => () => clearLeaveTimer(), []);

  const flyout =
    showFlyout && pos ? (
      <div
        role="group"
        aria-label={`${label} views`}
        className="min-w-[11.5rem] rounded-xl border border-white/15 bg-iregistrygreen py-1.5 shadow-lg"
        style={{
          position: "fixed",
          top: pos.top,
          left: pos.left,
          zIndex: FLYOUT_Z,
        }}
        onMouseEnter={enterZone}
        onMouseLeave={leaveZone}
      >
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
    ) : null;

  return (
    <>
      <div
        ref={anchorRef}
        className="relative"
        onMouseEnter={enterZone}
        onMouseLeave={leaveZone}
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
      </div>

      {typeof document !== "undefined" && flyout ? createPortal(flyout, document.body) : null}
    </>
  );
}
