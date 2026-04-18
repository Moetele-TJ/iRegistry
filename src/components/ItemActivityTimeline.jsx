//  src/components/ItemActivityTimeline.jsx
import { Clock, Search, AlertTriangle, MapPin } from "lucide-react";

function iconFor(action) {
  if (action?.includes("verify")) return <Search size={14} />;
  if (action?.includes("stolen")) return <AlertTriangle size={14} />;
  if (action?.includes("location")) return <MapPin size={14} />;
  return <Clock size={14} />;
}

function timeAgo(date) {
  const diff = Math.floor((Date.now() - new Date(date)) / 1000);

  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function fmtWhen(iso) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return "";
  }
}

function actorLine(event) {
  const role = event.actor_role ? String(event.actor_role) : null;
  const id = event.actor_id ? String(event.actor_id) : null;
  if (!role && !id) return null;
  const tail = id && id.length > 8 ? `…${id.slice(-6)}` : id;
  if (role && tail) return `${role} · ${tail}`;
  if (role) return role;
  return tail;
}

export default function ItemActivityTimeline({ events = [], loading = false }) {

  if (loading) {
    return (
      <div className="text-sm text-gray-400 animate-pulse">
        Loading activity…
      </div>
    );
  }

  if (!events.length) {
    return (
      <div className="text-sm text-gray-400">
        No activity recorded for this item yet.
      </div>
    );
  }

  return (
    <div className="relative pl-6">

      {/* vertical line */}
      <div className="absolute left-2 top-0 bottom-0 w-px bg-gray-200"></div>

      <div className="space-y-6">

        {events.map((event) => {
          const actor = actorLine(event);
          return (

          <div key={event.id} className="relative">

            {/* timeline dot */}
            <div className="absolute -left-[18px] top-1 w-7 h-7 rounded-full bg-white border border-gray-300 flex items-center justify-center text-gray-600 shadow-sm">
              {iconFor(event.action)}
            </div>

            {/* event content */}
            <div>

              <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-gray-800">
                <span>{event.entity_name || "Item activity"}</span>
                {event.source === "org_item" && (
                  <span className="text-[10px] font-medium uppercase tracking-wide px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100">
                    Org
                  </span>
                )}
              </div>

              <div className="text-sm text-gray-600 mt-0.5">
                {event.message || "—"}
              </div>

              {actor && (
                <div className="text-xs text-gray-500 mt-1">
                  By {actor}
                </div>
              )}

              <div
                className="text-xs text-gray-400 mt-1"
                title={fmtWhen(event.created_at)}
              >
                {timeAgo(event.created_at)}
                <span className="text-gray-300"> · </span>
                <span className="text-gray-400">{fmtWhen(event.created_at)}</span>
              </div>

            </div>

          </div>

        );
        })}

      </div>
    </div>
  );
}