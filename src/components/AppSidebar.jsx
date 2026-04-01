import { useMemo, useState } from "react";
import SidebarItem from "./SidebarItem";

export default function AppSidebar({ sidebar }) {
  const [expanded, setExpanded] = useState(false);

  const items = useMemo(() => sidebar?.items || [], [sidebar]);
  const visible = !!sidebar?.visible && items.length > 0;
  const hoverExpand = sidebar?.hoverExpand !== false;

  if (!visible) return null;

  return (
    <aside
      className={`
        fixed left-0 top-[var(--app-header-h)] z-40
        bg-iregistrygreen text-white
        transition-all duration-300 ease-in-out
        ${(expanded && hoverExpand) ? "w-44" : "w-14"}
        rounded-br-3xl
        shadow-lg
        overflow-hidden
      `}
      onMouseEnter={() => hoverExpand && setExpanded(true)}
      onMouseLeave={() => hoverExpand && setExpanded(false)}
    >
      <nav className="py-4 space-y-2 px-2">
        {items.map((it) => (
          <SidebarItem
            key={it.to}
            to={it.to}
            icon={it.icon}
            label={it.label}
            expanded={expanded && hoverExpand}
          />
        ))}
      </nav>
    </aside>
  );
}

