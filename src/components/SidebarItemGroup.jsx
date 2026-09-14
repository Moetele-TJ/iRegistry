import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { NavLink, useLocation } from "react-router-dom";

const FLYOUT_Z = 90;
const LEAVE_MS = 160;
/** Slow enough to read; paired with ease curve below */
const SUBMENU_ENTER_MS = 480;
const SUBMENU_EXIT_MS = 420;
/** Slightly larger travel so motion is visible (was 6px) */
const SUBMENU_SLIDE_PX = 14;
const VIEW_PAD = 8;
const SUBITEM_ROW_H = 42;

function readCssPx(name, fallback = 0) {
  if (typeof window === "undefined") return fallback;
  const n = parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue(name),
  );
  return Number.isFinite(n) ? n : fallback;
}

function sidebarViewportBand(pad = VIEW_PAD) {
  const top = readCssPx("--app-header-h") + pad;
  const bottom = window.innerHeight - readCssPx("--app-sidebar-bottom-inset") - pad;
  return { top, bottom, maxHeight: Math.max(0, bottom - top) };
}

function fitFlyoutBox(anchorRect, height) {
  const { top: minTop, bottom: maxBottom, maxHeight } = sidebarViewportBand();
  const h = Math.min(Math.max(height, 0), maxHeight);
  let top = anchorRect.top;
  if (top + h > maxBottom) top = maxBottom - h;
  if (top < minTop) top = minTop;
  return { top, left: anchorRect.right, maxHeight };
}

function estimateSubmenuHeight(count) {
  return Math.max(0, Number(count) || 0) * SUBITEM_ROW_H;
}

/**
 * Flyout sub-links in a portal; coordinates with AppSidebar width transition + collapse order.
 * Only one group flyout is shown at a time (activeFlyoutKey from AppSidebar).
 */
export default function SidebarItemGroup({
  groupKey,
  to: baseTo,
  icon,
  label,
  subItems = [],
  expanded,
  expandAnimationComplete = false,
  flyoutCloseNonce = 0,
  activeFlyoutKey = null,
  onClaimFlyout,
  onReleaseFlyout,
  onFlyoutExitComplete,
  onFlyoutOpenChange,
  onNavigate,
  touchMode,
  onTouchExpand,
  onFlyoutPointerEnter,
}) {
  const location = useLocation();
  const key = groupKey || baseTo || label;
  const anchorRef = useRef(null);
  const flyoutRef = useRef(null);
  const leaveTimer = useRef(null);
  const prevCloseNonce = useRef(0);
  const [inHoverZone, setInHoverZone] = useState(false);
  /** Touch / coarse pointer: show submenu flyout only after user taps Items, not when the rail expands. */
  const [touchFlyoutOpen, setTouchFlyoutOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const [enterVisible, setEnterVisible] = useState(false);
  const [exiting, setExiting] = useState(false);

  const groupPathActive = useMemo(() => {
    const p = location.pathname;
    return p === baseTo || p.startsWith(`${baseTo}/`);
  }, [location.pathname, baseTo]);

  // Desktop: path-active groups show by default unless another group claimed the flyout.
  // Hover / touch claim takes exclusive ownership so Items + Livestock never overlap.
  const claimed = activeFlyoutKey === key;
  const defaultSectionOpen = !touchMode && activeFlyoutKey == null && groupPathActive;

  const wantShow =
    expanded &&
    expandAnimationComplete &&
    subItems.length > 0 &&
    (touchMode ? touchFlyoutOpen && claimed : claimed || defaultSectionOpen);

  const clearLeaveTimer = () => {
    if (leaveTimer.current != null) {
      window.clearTimeout(leaveTimer.current);
      leaveTimer.current = null;
    }
  };

  const enterZone = () => {
    clearLeaveTimer();
    setInHoverZone(true);
    if (!touchMode) onClaimFlyout?.(key);
  };

  const leaveZone = () => {
    clearLeaveTimer();
    leaveTimer.current = window.setTimeout(() => {
      setInHoverZone(false);
      if (!touchMode) onReleaseFlyout?.(key);
    }, LEAVE_MS);
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
      const measured =
        flyoutRef.current?.offsetHeight || estimateSubmenuHeight(subItems.length);
      const next = fitFlyoutBox(el.getBoundingClientRect(), measured);
      setPos((prev) => {
        if (
          prev &&
          prev.top === next.top &&
          prev.left === next.left &&
          prev.maxHeight === next.maxHeight
        ) {
          return prev;
        }
        return next;
      });
    };

    update();
    let ro = null;
    const frame = window.requestAnimationFrame(() => {
      update();
      if (flyoutRef.current) {
        ro = new ResizeObserver(update);
        ro.observe(flyoutRef.current);
      }
    });
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
      ro?.disconnect();
    };
  }, [wantShow, exiting, expanded, location.pathname, subItems.length]);

  useEffect(() => {
    if (!expanded) {
      setTouchFlyoutOpen(false);
      onReleaseFlyout?.(key);
    }
  }, [expanded, key, onReleaseFlyout]);

  // Another group claimed the flyout — drop local hover/touch open state.
  useEffect(() => {
    if (activeFlyoutKey == null || activeFlyoutKey === key) return;
    clearLeaveTimer();
    setInHoverZone(false);
    setTouchFlyoutOpen(false);
  }, [activeFlyoutKey, key]);

  // Parent: close submenu first, then collapse rail.
  useEffect(() => {
    if (flyoutCloseNonce === prevCloseNonce.current) return;
    prevCloseNonce.current = flyoutCloseNonce;
    setTouchFlyoutOpen(false);
    onReleaseFlyout?.(key);

    if (!pos) {
      onFlyoutExitComplete?.();
      return;
    }

    setExiting(true);
    onFlyoutOpenChange?.(key, false);

    const t = window.setTimeout(() => {
      setExiting(false);
      setEnterVisible(false);
      setInHoverZone(false);
      setPos(null);
      onFlyoutExitComplete?.();
    }, SUBMENU_EXIT_MS + 40);

    return () => window.clearTimeout(t);
  }, [flyoutCloseNonce, pos, onFlyoutExitComplete, onFlyoutOpenChange, onReleaseFlyout, key]);

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

  const flyoutVisible = showPanel && !exiting && enterVisible;

  useEffect(() => {
    onFlyoutOpenChange?.(key, flyoutVisible);
  }, [flyoutVisible, onFlyoutOpenChange, key]);

  const flyout = showPanel ? (
    <div
      ref={flyoutRef}
      role="group"
      data-app-sidebar-flyout
      aria-label={`${label} views`}
      className={[
        "flex flex-col overflow-x-hidden overflow-y-auto rounded-xl border border-white/15 bg-iregistrygreen shadow-lg min-w-[11.5rem]",
        "transition-[opacity,transform]",
        exiting
          ? "opacity-0"
          : enterVisible
            ? "opacity-100 translate-x-0"
            : "opacity-0",
      ].join(" ")}
      style={{
        position: "fixed",
        top: pos?.top,
        left: pos?.left,
        maxHeight: pos?.maxHeight,
        zIndex: FLYOUT_Z,
        transform: exiting || !enterVisible ? `translateX(-${SUBMENU_SLIDE_PX}px)` : "translateX(0)",
        transitionProperty: "opacity, transform",
        transitionDuration: `${exiting ? SUBMENU_EXIT_MS : SUBMENU_ENTER_MS}ms`,
        transitionTimingFunction: exiting
          ? "cubic-bezier(0.4, 0, 1, 1)"
          : "cubic-bezier(0.22, 1, 0.36, 1)",
        willChange: "opacity, transform",
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
        data-sidebar-current={groupPathActive ? "true" : undefined}
        data-sidebar-flyout-open={wantShow ? "true" : undefined}
        data-sidebar-submenu-count={subItems.length}
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
            if (touchMode && expanded) {
              e.preventDefault();
              setTouchFlyoutOpen((o) => {
                const next = !o;
                if (next) onClaimFlyout?.(key);
                else onReleaseFlyout?.(key);
                return next;
              });
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
