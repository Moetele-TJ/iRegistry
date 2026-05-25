import { fmtLoginWhen, loginDeviceLabel, loginUserLabel } from "../lib/loginDisplay.js";

/**
 * @param {Array} logins
 * @param {{ compact?: boolean, emptyMessage?: string }} props
 */
export default function RecentLoginsList({
  logins = [],
  compact = false,
  emptyMessage = "No recent logins yet.",
}) {
  const list = Array.isArray(logins) ? logins : [];

  if (list.length === 0) {
    return <p className="text-sm text-gray-500 text-center py-2">{emptyMessage}</p>;
  }

  return (
    <div className="space-y-2">
      <ul className={`divide-y divide-gray-100 ${compact ? "" : "rounded-xl border border-gray-100 bg-white"}`}>
        {list.map((row) => {
          const key = row.session_id || `${row.user_id}-${row.created_at}`;
          const role = String(row.role || row.user?.role || "").trim();
          return (
            <li
              key={key}
              className={`flex items-start justify-between gap-3 ${compact ? "py-2" : "px-4 py-3"}`}
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {loginUserLabel(row)}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {role ? `${role} · ` : ""}
                  {loginDeviceLabel(row.device_name)}
                </p>
              </div>
              <time
                className="text-xs text-gray-500 whitespace-nowrap shrink-0"
                dateTime={row.created_at}
                title={row.created_at}
              >
                {fmtLoginWhen(row.created_at)}
              </time>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
