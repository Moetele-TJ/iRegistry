import ActivityPage from "../ActivityPage.jsx";
import { useAdminSidebar } from "../../hooks/useAdminSidebar";

export default function AdminActivityPage() {
  useAdminSidebar();
  return <ActivityPage />;
}
