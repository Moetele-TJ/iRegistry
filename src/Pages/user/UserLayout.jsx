import { Outlet } from "react-router-dom";
import { useCallback } from "react";
import { useUserSidebar } from "../../hooks/useUserSidebar.jsx";
import { useAddItemPreflight } from "../../hooks/useAddItemPreflight.js";
import { useFirstItemOnboarding } from "../../hooks/useFirstItemOnboarding.js";
import FirstItemWelcomeModal from "../../components/FirstItemWelcomeModal.jsx";

export default function UserLayout() {
  const { goToAddItem, tasksLoading } = useAddItemPreflight();
  const onRegisterItem = useCallback(() => void goToAddItem(), [goToAddItem]);

  useUserSidebar({
    onRegisterItem,
    registerLoading: tasksLoading,
  });

  const { open, dismiss } = useFirstItemOnboarding();

  return (
    <>
      <div className="p-4 sm:p-6">
        <Outlet />
      </div>
      <FirstItemWelcomeModal open={open} onDismiss={dismiss} />
    </>
  );
}
