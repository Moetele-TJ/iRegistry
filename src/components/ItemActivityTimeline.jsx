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

export default function ItemActivityTimeline({ events = [] }) {

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

        {events.map((event) => (

          <div key={event.id} className="relative">

            {/* timeline dot */}
            <div className="absolute -left-[18px] top-1 w-7 h-7 rounded-full bg-white border border-gray-300 flex items-center justify-center text-gray-600 shadow-sm">
              {iconFor(event.action)}
            </div>

            {/* event content */}
            <div>

              <div className="text-sm font-semibold text-gray-800">
                {event.entity_name || "Item activity"}
              </div>

              <div className="text-sm text-gray-600 mt-0.5">
                {event.message}
              </div>

              <div className="text-xs text-gray-400 mt-1">
                {timeAgo(event.created_at)}
              </div>

            </div>

          </div>

        ))}

      </div>
    </div>
  );
}