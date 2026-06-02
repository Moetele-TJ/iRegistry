import { useEffect } from "react";
import { useSidebar } from "../contexts/SidebarContext.jsx";
import StaffProfileUserActions from "../components/staff/StaffProfileUserActions.jsx";
import { NAV_ACTIONS } from "../lib/navLabels.js";
import { staffUsersListPath } from "../lib/staffProfileRoute.js";

/**
 * Replaces the role sidebar with profile-scoped actions while viewing `/…/profile?user=…`.
 */
export function useStaffProfileSidebar({
  enabled,
  targetUser,
  sessionUser,
  onUserUpdated,
}) {
  const { setSidebar, clearSidebar } = useSidebar();

  useEffect(() => {
    if (!enabled || !sessionUser?.id) {
      return;
    }

    const usersPath = staffUsersListPath(sessionUser.role);
    const displayName =
      targetUser?.first_name || targetUser?.last_name
        ? [targetUser.first_name, targetUser.last_name].filter(Boolean).join(" ").trim()
        : "";

    setSidebar({
      visible: true,
      items: [],
      hoverExpand: false,
      forceExpanded: true,
      backLink: {
        to: usersPath,
        label: NAV_ACTIONS.backToUsers,
      },
      panel: (
        <StaffProfileUserActions
          layout="sidebar"
          targetUser={targetUser}
          sessionUser={sessionUser}
          onUserUpdated={onUserUpdated}
          profileDisplayName={displayName || undefined}
        />
      ),
    });

    return () => {
      clearSidebar();
    };
  }, [
    enabled,
    targetUser,
    sessionUser,
    sessionUser?.id,
    sessionUser?.role,
    onUserUpdated,
    setSidebar,
    clearSidebar,
  ]);
}
