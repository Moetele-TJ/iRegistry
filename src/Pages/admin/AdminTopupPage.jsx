import CashierTopupPage from "../cashier/CashierTopupPage.jsx";
import { useAdminSidebar } from "../../hooks/useAdminSidebar.jsx";

export default function AdminTopupPage() {
  useAdminSidebar();
  return <CashierTopupPage />;
}

