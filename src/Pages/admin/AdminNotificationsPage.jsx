import NotificationsPage from "../NotificationsPage.jsx";
import { useAdminSidebar } from "../../hooks/useAdminSidebar";

export default function AdminNotificationsPage() {
  useAdminSidebar();
  return <NotificationsPage />;
}
