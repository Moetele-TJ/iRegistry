import { Outlet } from "react-router-dom";
import { useUserSidebar } from "../../hooks/useUserSidebar.jsx";
import { useFirstItemOnboarding } from "../../hooks/useFirstItemOnboarding.js";
import FirstItemWelcomeModal from "../../components/FirstItemWelcomeModal.jsx";

export default function UserLayout() {
  useUserSidebar({ visible: true });

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
