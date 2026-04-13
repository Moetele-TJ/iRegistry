import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import SidebarItem from "./SidebarItem";
import SidebarItemGroup from "./SidebarItemGroup";
import { useLocation } from "react-router-dom";

/** Matches `transition-[width] duration-300` on the aside */
const SIDEBAR_WIDTH_MS = 300;
/** Delay before treating aside mouse leave as real (lets pointer reach portaled flyout) */
const ASIDE_LEAVE_DELAY_MS = 180;

export default function AppSidebar({ sidebar }) {
  const [expanded, setExpanded] = useState(false);
  /** After width transition finishes so submenu can animate in */
  const [expandAnimationComplete, setExpandAnimationComplete] = useState(false);
  /** Bump to request flyout close + exit animation before collapsing rail */
  const [flyoutCloseNonce, setFlyoutCloseNonce] = useState(0);
  const location = useLocation();

  const items = useMemo(() => sidebar?.items || [], [sidebar]);
  const visible = !!sidebar?.visible && items.length > 0;
  const hoverExpand = sidebar?.hoverExpand !== false;
  const [canHover, setCanHover] = useState(true);
  const touchMode = !canHover;

  const asideRef = useRef(null);
  const flyoutOpenRef = useRef(false);
  const expandFallbackTimer = useRef(null);
  const asideLeaveTimer = useRef(null);
  const pendingCollapseRef = useRef(false);

  const clearAsideLeaveTimer = useCallback(() => {
    if (asideLeaveTimer.current != null) {
      window.clearTimeout(asideLeaveTimer.current);
      asideLeaveTimer.current = null;
    }
  }, []);

  useEffect(() => {
    const mq = window.matchMedia?.("(hover: hover) and (pointer: fine)");
    if (!mq) return;
    const update = () => setCanHover(!!mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);

  useEffect(() => {
    if (!expanded) {
      setExpandAnimationComplete(false);
      if (expandFallbackTimer.current != null) {
        window.clearTimeout(expandFallbackTimer.current);
        expandFallbackTimer.current = null;
      }
      return;
    }

    const el = asideRef.current;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      setExpandAnimationComplete(true);
      if (expandFallbackTimer.current != null) {
        window.clearTimeout(expandFallbackTimer.current);
        expandFallbackTimer.current = null;
      }
    };

    const onTransitionEnd = (e) => {
      if (e.propertyName === "width" && e.target === el) finish();
    };

    el?.addEventListener("transitionend", onTransitionEnd);
    expandFallbackTimer.current = window.setTimeout(finish, SIDEBAR_WIDTH_MS + 40);

    return () => {
      el?.removeEventListener("transitionend", onTransitionEnd);
      if (expandFallbackTimer.current != null) {
        window.clearTimeout(expandFallbackTimer.current);
        expandFallbackTimer.current = null;
      }
    };
  }, [expanded]);

  useEffect(() => {
    setExpanded(false);
    pendingCollapseRef.current = false;
    clearAsideLeaveTimer();
  }, [location.pathname, clearAsideLeaveTimer]);

  const setFlyoutOpenFromChild = useCallback((open) => {
    flyoutOpenRef.current = open;
  }, []);

  const handleAsideMouseEnter = () => {
    if (!canHover || !hoverExpand) return;
    clearAsideLeaveTimer();
    pendingCollapseRef.current = false;
    setExpanded(true);
  };

  const handleAsideMouseLeave = () => {
    if (!canHover || !hoverExpand) return;
    clearAsideLeaveTimer();
    asideLeaveTimer.current = window.setTimeout(() => {
      asideLeaveTimer.current = null;
      if (flyoutOpenRef.current) {
        pendingCollapseRef.current = true;
        setFlyoutCloseNonce((n) => n + 1);
      } else {
        setExpanded(false);
      }
    }, ASIDE_LEAVE_DELAY_MS);
  };

  const handleFlyoutPointerEnter = useCallback(() => {
    clearAsideLeaveTimer();
  }, [clearAsideLeaveTimer]);

  const handleFlyoutExitComplete = useCallback(() => {
    if (!pendingCollapseRef.current) return;
    pendingCollapseRef.current = false;
    flyoutOpenRef.current = false;
    setExpanded(false);
  }, []);

  if (!visible) return null;

  return (
    <aside
      ref={asideRef}
      className={`
        fixed left-0 top-[var(--app-header-h)] bottom-auto z-[70]
        flex flex-col overflow-hidden
        bg-iregistrygreen text-white
        transition-[width] duration-300 ease-in-out
        ${expanded && hoverExpand ? "w-[var(--app-sidebar-expanded-w)]" : "w-[var(--app-sidebar-collapsed-w)]"}
        rounded-br-3xl
        shadow-lg
      `}
      onMouseEnter={handleAsideMouseEnter}
      onMouseLeave={handleAsideMouseLeave}
    >
      <nav
        className="app-sidebar-nav max-h-[calc(100vh-var(--app-header-h))] overflow-y-auto overflow-x-hidden overscroll-y-contain py-4 px-0 space-y-2"
        aria-label="Main navigation"
      >
        {items.map((it) =>
          Array.isArray(it.subItems) && it.subItems.length > 0 ? (
            <SidebarItemGroup
              key={it.to}
              to={it.to}
              icon={it.icon}
              label={it.label}
              subItems={it.subItems}
              expanded={expanded && hoverExpand}
              expandAnimationComplete={expandAnimationComplete}
              flyoutCloseNonce={flyoutCloseNonce}
              onFlyoutExitComplete={handleFlyoutExitComplete}
              onFlyoutOpenChange={setFlyoutOpenFromChild}
              onFlyoutPointerEnter={handleFlyoutPointerEnter}
              onNavigate={() => setExpanded(false)}
              touchMode={touchMode}
              onTouchExpand={() => setExpanded(true)}
            />
          ) : (
            <SidebarItem
              key={it.to}
              to={it.to}
              icon={it.icon}
              label={it.label}
              expanded={expanded && hoverExpand}
              onNavigate={() => setExpanded(false)}
              touchMode={touchMode}
              onTouchExpand={() => setExpanded(true)}
            />
          ),
        )}
      </nav>
    </aside>
  );
}
