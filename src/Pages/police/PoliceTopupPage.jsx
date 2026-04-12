import { usePoliceSidebar } from "../../hooks/usePoliceSidebar.jsx";
import { UserTopupContent } from "../user/UserTopupPage.jsx";

export default function PoliceTopupPage() {
  usePoliceSidebar();
  return <UserTopupContent />;
}
