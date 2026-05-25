import {
  fmtLoginWhen,
  fmtLoginWhenFull,
  loginDeviceLabel,
  loginUserLabel,
} from "../lib/loginDisplay.js";

/**
 * @param {Array} groups — admin_recent_logins_stats.by_user rows
 * @param {{ expandedUserId: string | null, onToggleUser: (userId: string) => void, emptyMessage?: string }} props
 */
export default function RecentLoginsByUser({
  groups = [],
  expandedUserId = null,
  onToggleUser,
  emptyMessage = "No logins in this range.",
}) {
  const list = Array.isArray(groups) ? groups : [];

  if (list.length === 0) {
    return <p className="text-sm text-gray-500">{emptyMessage}</p>;
  }

  return (
    <div className="rounded-xl border border-gray-100 bg-white divide-y divide-gray-100 overflow-hidden">
      {list.map((group) => {
        const uid = String(group.user_id);
        const open = expandedUserId === uid;
        const label = loginUserLabel({ user: group.user }) || uid;
        const count = Number(group.login_count || 0);
        const logins = Array.isArray(group.logins) ? group.logins : [];
        const role = String(group.user?.role || "user");

        return (
          <div key={uid}>
            <button
              type="button"
              className={`w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-gray-50 transition ${
                open ? "bg-emerald-50/50" : ""
              }`}
              aria-expanded={open}
              onClick={() => onToggleUser?.(uid)}
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-iregistrygreen truncate">
                  {label} ({count})
                </p>
                <p className="text-xs text-gray-500">
                  {role} · last {fmtLoginWhen(group.last_login_at)}
                </p>
              </div>
              <span className="text-gray-400 text-lg shrink-0" aria-hidden>
                {open ? "▾" : "▸"}
              </span>
            </button>
            {open ? (
              <div className="px-4 pb-4 bg-gray-50/80 border-t border-gray-100">
                <ul className="space-y-2 pt-2">
                  {logins.map((lg) => (
                    <li
                      key={lg.session_id || lg.created_at}
                      className="flex justify-between gap-3 text-sm bg-white rounded-lg border border-gray-100 px-3 py-2"
                    >
                      <span className="text-gray-700">
                        {loginDeviceLabel(lg.device_name)}
                        {lg.ip_address ? (
                          <span className="text-gray-400 text-xs block">{lg.ip_address}</span>
                        ) : null}
                      </span>
                      <time
                        className="text-xs text-gray-500 whitespace-nowrap"
                        dateTime={lg.created_at}
                      >
                        {fmtLoginWhenFull(lg.created_at)}
                      </time>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
