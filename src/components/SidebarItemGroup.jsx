import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { NavLink, useLocation } from "react-router-dom";

const FLYOUT_Z = 90;
const LEAVE_MS = 160;
const SUBMENU_ENTER_MS = 200;
const SUBMENU_EXIT_MS = 200;

/**
 * Flyout sub-links in a portal; coordinates with AppSidebar width transition + collapse order.
 */
export default function SidebarItemGroup({
  to: baseTo,
  icon,
  label,
  subItems = [],
  expanded,
  expandAnimationComplete = false,
  flyoutCloseNonce = 0,
  onFlyoutExitComplete,
  onFlyoutOpenChange,
  onNavigate,
  touchMode,
  onTouchExpand,
  onFlyoutPointerEnter,
}) {
  const location = useLocation();
  const anchorRef = useRef(null);
  const leaveTimer = useRef(null);
  const prevCloseNonce = useRef(0);
  const [inHoverZone, setInHoverZone] = useState(false);
  const [pos, setPos] = useState(null);
  const [enterVisible, setEnterVisible] = useState(false);
  const [exiting, setExiting] = useState(false);

  const groupPathActive = useMemo(() => {
    const p = location.pathname;
    return p === baseTo || p.startsWith(`${baseTo}/`);
  }, [location.pathname, baseTo]);

  const wantShow =
    expanded &&
    expandAnimationComplete &&
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
    if (exiting) return;

    if (!wantShow) {
      setPos(null);
      return;
    }

    const update = () => {
      const el = anchorRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setPos({ top: r.top, left: r.right });
    };

    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [wantShow, exiting, expanded, location.pathname]);

  // Parent: close submenu first, then collapse rail.
  useEffect(() => {
    if (flyoutCloseNonce === prevCloseNonce.current) return;
    prevCloseNonce.current = flyoutCloseNonce;

    if (!pos) {
      onFlyoutExitComplete?.();
      return;
    }

    setExiting(true);
    onFlyoutOpenChange?.(false);

    const t = window.setTimeout(() => {
      setExiting(false);
      setEnterVisible(false);
      setInHoverZone(false);
      setPos(null);
      onFlyoutExitComplete?.();
    }, SUBMENU_EXIT_MS);

    return () => window.clearTimeout(t);
  }, [flyoutCloseNonce, pos, onFlyoutExitComplete, onFlyoutOpenChange]);

  const showPanel = Boolean(pos && (wantShow || exiting));

  useEffect(() => {
    if (!showPanel || exiting) {
      if (!exiting) setEnterVisible(false);
      return;
    }
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setEnterVisible(true));
    });
    return () => cancelAnimationFrame(id);
  }, [showPanel, exiting]);

  useEffect(() => {
    return () => clearLeaveTimer();
  }, []);

  const flyoutVisible =
    showPanel && !exiting && enterVisible;

  useEffect(() => {
    onFlyoutOpenChange?.(flyoutVisible);
  }, [flyoutVisible, onFlyoutOpenChange]);

  const flyout = showPanel ? (
    <div
      role="group"
      aria-label={`${label} views`}
      className={[
        "flex flex-col overflow-hidden rounded-xl border border-white/15 bg-iregistrygreen shadow-lg min-w-[11.5rem]",
        "transition-[opacity,transform] ease-out",
        exiting
          ? "opacity-0 translate-x-[-6px]"
          : enterVisible
            ? "opacity-100 translate-x-0"
            : "opacity-0 translate-x-[-6px]",
      ].join(" ")}
      style={{
        position: "fixed",
        top: pos?.top,
        left: pos?.left,
        zIndex: FLYOUT_Z,
        transitionDuration: `${exiting ? SUBMENU_EXIT_MS : SUBMENU_ENTER_MS}ms`,
      }}
      onMouseEnter={() => {
        enterZone();
        onFlyoutPointerEnter?.();
      }}
      onMouseLeave={leaveZone}
    >
      {subItems.map((sub, idx) => (
        <NavLink
          key={sub.to}
          to={sub.to}
          end={sub.end !== false}
          onClick={() => onNavigate?.()}
          className={({ isActive }) => {
            const base =
              "block w-full px-3 py-2.5 text-sm text-left whitespace-nowrap border-b border-white/15 last:border-b-0 transition-colors duration-200";
            const bg = isActive ? "bg-white/15 font-medium" : "hover:bg-white/10 text-white/95";
            const corners =
              subItems.length === 1
                ? " rounded-[10px]"
                : idx === 0
                  ? " rounded-t-[10px]"
                  : idx === subItems.length - 1
                    ? " rounded-b-[10px]"
                    : "";
            return `${base} ${bg}${corners}`;
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
