import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import SidebarItem from "./SidebarItem";
import SidebarItemGroup from "./SidebarItemGroup";

/** Width transition when opening (matches submenu unlock) */
const SIDEBAR_EXPAND_MS = 320;
/** Slower ease-out when collapsing so the rail doesn’t feel like it snaps shut */
const SIDEBAR_COLLAPSE_MS = 520;
const ASIDE_LEAVE_DELAY_MS = 180;

export default function AppSidebar({ sidebar }) {
  /** Drives aside `width` only — can animate while labels stay visible during collapse */
  const [railExpanded, setRailExpanded] = useState(false);
  /** Labels + icon layout; stays true until width collapse finishes */
  const [contentExpanded, setContentExpanded] = useState(false);
  const [expandAnimationComplete, setExpandAnimationComplete] = useState(false);
  const [flyoutCloseNonce, setFlyoutCloseNonce] = useState(0);
  const location = useLocation();

  const items = useMemo(() => sidebar?.items || [], [sidebar?.items]);
  const panelMode = Boolean(sidebar?.panel);
  const forceExpanded = !!sidebar?.forceExpanded;
  const visible = !!sidebar?.visible && (panelMode || items.length > 0);
  const hoverExpand = !panelMode && sidebar?.hoverExpand !== false;
  const backLink = sidebar?.backLink || null;
  const [canHover, setCanHover] = useState(true);
  const touchMode = !canHover;

  const asideRef = useRef(null);
  const flyoutOpenRef = useRef(false);
  const expandFallbackTimer = useRef(null);
  const collapseContentTimer = useRef(null);
  const asideLeaveTimer = useRef(null);
  const pendingCollapseRef = useRef(false);

  const clearAsideLeaveTimer = useCallback(() => {
    if (asideLeaveTimer.current != null) {
      window.clearTimeout(asideLeaveTimer.current);
      asideLeaveTimer.current = null;
    }
  }, []);

  const clearCollapseContentTimer = useCallback(() => {
    if (collapseContentTimer.current != null) {
      window.clearTimeout(collapseContentTimer.current);
      collapseContentTimer.current = null;
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

  // Opening: after width finishes expanding, submenu may animate in.
  useEffect(() => {
    if (!railExpanded) {
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
    expandFallbackTimer.current = window.setTimeout(finish, SIDEBAR_EXPAND_MS + 50);

    return () => {
      el?.removeEventListener("transitionend", onTransitionEnd);
      if (expandFallbackTimer.current != null) {
        window.clearTimeout(expandFallbackTimer.current);
        expandFallbackTimer.current = null;
      }
    };
  }, [railExpanded]);

  // Collapsing: keep labels until width ease-out finishes, then hide text (no instant pop).
  useEffect(() => {
    clearCollapseContentTimer();

    if (railExpanded) {
      setContentExpanded(true);
      return;
    }

    const el = asideRef.current;
    const finishContent = () => {
      setContentExpanded(false);
      clearCollapseContentTimer();
    };

    const onTransitionEnd = (e) => {
      if (e.propertyName === "width" && e.target === el) finishContent();
    };

    el?.addEventListener("transitionend", onTransitionEnd);
    collapseContentTimer.current = window.setTimeout(finishContent, SIDEBAR_COLLAPSE_MS + 80);

    return () => {
      el?.removeEventListener("transitionend", onTransitionEnd);
      clearCollapseContentTimer();
    };
  }, [railExpanded, clearCollapseContentTimer]);

  useEffect(() => {
    if (panelMode || forceExpanded) {
      setRailExpanded(true);
      setContentExpanded(true);
      setExpandAnimationComplete(true);
      return;
    }
    setRailExpanded(false);
    setContentExpanded(false);
    setExpandAnimationComplete(false);
    pendingCollapseRef.current = false;
    clearAsideLeaveTimer();
  }, [location.pathname, panelMode, forceExpanded, clearAsideLeaveTimer]);

  const setFlyoutOpenFromChild = useCallback((open) => {
    flyoutOpenRef.current = open;
  }, []);

  const handleAsideMouseEnter = () => {
    if (panelMode || forceExpanded || !canHover || !hoverExpand) return;
    clearAsideLeaveTimer();
    pendingCollapseRef.current = false;
    setRailExpanded(true);
    setContentExpanded(true);
  };

  const handleAsideMouseLeave = () => {
    if (panelMode || forceExpanded || !canHover || !hoverExpand) return;
    clearAsideLeaveTimer();
    asideLeaveTimer.current = window.setTimeout(() => {
      asideLeaveTimer.current = null;
      if (flyoutOpenRef.current) {
        pendingCollapseRef.current = true;
        setFlyoutCloseNonce((n) => n + 1);
      } else {
        setRailExpanded(false);
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
    setRailExpanded(false);
  }, []);

  const collapseTouchSidebar = useCallback(() => {
    clearAsideLeaveTimer();
    pendingCollapseRef.current = false;
    if (flyoutOpenRef.current) {
      setFlyoutCloseNonce((n) => n + 1);
    }
    setRailExpanded(false);
  }, [clearAsideLeaveTimer]);

  /** Touch / coarse pointer: collapse expanded rail when tapping outside sidebar + flyouts. */
  useEffect(() => {
    if (panelMode || forceExpanded) return;
    if (!touchMode || !railExpanded) return;

    function isSidebarTarget(node) {
      if (!(node instanceof Node)) return false;
      if (asideRef.current?.contains(node)) return true;
      if (node instanceof Element && node.closest("[data-app-sidebar-flyout]")) return true;
      return false;
    }

    function onPointerDown(e) {
      if (isSidebarTarget(e.target)) return;
      collapseTouchSidebar();
    }

    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [panelMode, forceExpanded, touchMode, railExpanded, collapseTouchSidebar]);

  const isWide = panelMode || forceExpanded || (railExpanded && (hoverExpand || panelMode));
  const childExpanded = panelMode || forceExpanded || (contentExpanded && hoverExpand);

  if (!visible) return null;

  return (
    <aside
      ref={asideRef}
      className={`
        fixed left-0 top-[var(--app-header-h)] bottom-auto z-[70]
        flex flex-col overflow-hidden
        bg-iregistrygreen text-white
        rounded-br-3xl shadow-lg
        max-h-[calc(100dvh-var(--app-header-h)-var(--app-footer-h))]
        transition-[width] ease-out
        ${
          isWide
            ? "w-[var(--app-sidebar-expanded-w)] duration-[320ms]"
            : "w-[var(--app-sidebar-collapsed-w)] duration-[520ms]"
        }
      `}
      onMouseEnter={handleAsideMouseEnter}
      onMouseLeave={handleAsideMouseLeave}
    >
      <nav
        className="app-sidebar-nav max-h-[calc(100dvh-var(--app-header-h)-var(--app-footer-h))] overflow-y-auto overflow-x-hidden overscroll-y-contain py-4 px-0 space-y-2"
        aria-label={panelMode ? "User profile actions" : "Main navigation"}
      >
        {backLink ? (
          <div className="px-2 pb-2 mb-1 border-b border-white/15">
            <NavLink
              to={backLink.to}
              className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-sm font-medium text-white hover:bg-white/10 transition-colors min-h-[2.5rem]"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
                <ArrowLeft className="h-5 w-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1 truncate">{backLink.label}</span>
            </NavLink>
          </div>
        ) : null}
        {panelMode ? (
          <div className="px-2 pb-4 space-y-1">{sidebar.panel}</div>
        ) : (
          items.map((it) =>
          Array.isArray(it.subItems) && it.subItems.length > 0 ? (
            <SidebarItemGroup
              key={it.to}
              to={it.to}
              icon={it.icon}
              label={it.label}
              subItems={it.subItems}
              expanded={childExpanded}
              expandAnimationComplete={expandAnimationComplete}
              flyoutCloseNonce={flyoutCloseNonce}
              onFlyoutExitComplete={handleFlyoutExitComplete}
              onFlyoutOpenChange={setFlyoutOpenFromChild}
              onFlyoutPointerEnter={handleFlyoutPointerEnter}
              onNavigate={() => setRailExpanded(false)}
              touchMode={touchMode}
              onTouchExpand={() => {
                setRailExpanded(true);
                setContentExpanded(true);
              }}
            />
          ) : (
            <SidebarItem
              key={it.to}
              to={it.to}
              end={!!it.end}
              icon={it.icon}
              label={it.label}
              expanded={childExpanded}
              onNavigate={() => setRailExpanded(false)}
              touchMode={touchMode}
              onTouchExpand={() => {
                setRailExpanded(true);
                setContentExpanded(true);
              }}
            />
          ),
        )
        )}
      </nav>
    </aside>
  );
}
