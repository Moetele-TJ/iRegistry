//  src/utils/iconResolver.js
import {
  Package,
  RefreshCcw,
  Search,
  AlertTriangle,
  ShieldAlert,
  User,
  LogIn,
  FileText
} from "lucide-react";

const iconMap = {
  // ITEMS
  item: Package,

  // TRANSFERS
  transfer: RefreshCcw,

  // VERIFICATIONS
  verify: Search,

  // SECURITY
  stolen: ShieldAlert,
  suspicious: AlertTriangle,

  // USERS
  user: User,

  // AUTH
  login: LogIn
};

export function getIcon(activity) {

  const text = `${activity?.action || ""} ${activity?.entity_type || ""} ${activity?.message || ""}`.toLowerCase();

  const key = Object.keys(iconMap).find(k => text.includes(k));

  return key ? iconMap[key] : FileText;
}