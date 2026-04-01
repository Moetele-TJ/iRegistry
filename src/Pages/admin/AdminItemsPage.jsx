import Items from "../Items.jsx";
import { useAdminSidebar } from "../../hooks/useAdminSidebar";

export default function AdminItemsPage() {
  useAdminSidebar();
  return <Items />;
}
