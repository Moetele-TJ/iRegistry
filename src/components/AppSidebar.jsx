import { useEffect, useMemo, useState } from "react";
import SidebarItem from "./SidebarItem";
import { useLocation } from "react-router-dom";

export default function AppSidebar({ sidebar }) {
  const [expanded, setExpanded] = useState(false);
  const location = useLocation();

  const items = useMemo(() => sidebar?.items || [], [sidebar]);
  const visible = !!sidebar?.visible && items.length > 0;
  const hoverExpand = sidebar?.hoverExpand !== false;
  const [canHover, setCanHover] = useState(true);
  const touchMode = !canHover;

  useEffect(() => {
    const mq = window.matchMedia?.("(hover: hover) and (pointer: fine)");
    if (!mq) return;
    const update = () => setCanHover(!!mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);

  // On touch devices, "hover" can stick until the next tap; collapse immediately on navigation.
  useEffect(() => {
    setExpanded(false);
  }, [location.pathname]);

  if (!visible) return null;

  return (
    <aside
      className={`
        fixed left-0 top-[var(--app-header-h)] bottom-auto z-[70]
        flex flex-col overflow-hidden
        bg-iregistrygreen text-white
        transition-[width] duration-300 ease-in-out
        ${(expanded && hoverExpand) ? "w-[var(--app-sidebar-expanded-w)]" : "w-[var(--app-sidebar-collapsed-w)]"}
        rounded-br-3xl
        shadow-lg
      `}
      onMouseEnter={() => (canHover && hoverExpand) && setExpanded(true)}
      onMouseLeave={() => (canHover && hoverExpand) && setExpanded(false)}
    >
      <nav
        className="app-sidebar-nav max-h-[calc(100vh-var(--app-header-h))] overflow-y-auto overflow-x-hidden overscroll-y-contain py-4 px-0 space-y-2"
        aria-label="Main navigation"
      >
        {items.map((it) => (
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
        ))}
      </nav>
    </aside>
  );
}

