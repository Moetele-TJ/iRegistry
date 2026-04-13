import {
  Clock,
  UserPlus,
  Trash2,
  Shield,
  AlertTriangle,
  Pencil,
} from "lucide-react";

function titleFor(event) {
  const a = String(event?.action || "");
  const map = {
    USER_CREATED: "Account created",
    USER_UPDATED: "Profile updated",
    USER_ROLE_CHANGED: "Role changed",
    USER_STATUS_CHANGED: "Status changed",
    USER_DELETED: "Account deleted",
  };
  return map[a] || a.replace(/_/g, " ") || "Activity";
}

function iconFor(action) {
  const a = String(action || "").toUpperCase();
  if (a === "USER_CREATED") return <UserPlus size={14} />;
  if (a === "USER_DELETED") return <Trash2 size={14} />;
  if (a === "USER_ROLE_CHANGED") return <Shield size={14} />;
  if (a === "USER_STATUS_CHANGED") return <AlertTriangle size={14} />;
  if (a === "USER_UPDATED") return <Pencil size={14} />;
  return <Clock size={14} />;
}

function timeAgo(date) {
  const diff = Math.floor((Date.now() - new Date(date)) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function UserActivityTimeline({ events = [], loading = false }) {
  if (loading) {
    return <div className="text-sm text-gray-500">Loading activity…</div>;
  }

  if (!events.length) {
    return (
      <div className="text-sm text-gray-400">
        No registry activity recorded for this account yet. Updates from profile saves and admin
        actions will appear here.
      </div>
    );
  }

  return (
    <div className="relative pl-6">
      <div className="absolute left-2 top-0 bottom-0 w-px bg-gray-200" />
      <div className="space-y-6">
        {events.map((event) => (
          <div key={event.id} className="relative">
            <div className="absolute -left-[18px] top-1 w-7 h-7 rounded-full bg-white border border-gray-300 flex items-center justify-center text-gray-600 shadow-sm">
              {iconFor(event.action)}
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-800">{titleFor(event)}</div>
              <div className="text-sm text-gray-600 mt-0.5">{event.message}</div>
              <div className="text-xs text-gray-400 mt-1">{timeAgo(event.created_at)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
