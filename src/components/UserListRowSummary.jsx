import { Link } from "react-router-dom";
import { Mail } from "lucide-react";
import { displayUser } from "../lib/userDisplay.js";

export function formatUserLocation(u) {
  const village = String(u?.village || "").trim();
  const ward = String(u?.ward || "").trim();
  const station = String(u?.police_station || "").trim();
  const parts = [];
  if (village) parts.push(village);
  if (ward) parts.push(ward);
  if (station) parts.push(station);
  return parts.length ? parts.join(", ") : "—";
}

function DetailRow({ label, value, children, mono = false, breakAll = false }) {
  const text = children ?? (value != null && String(value).trim() !== "" ? value : "—");
  return (
    <div className="grid grid-cols-[minmax(6.5rem,40%)_1fr] gap-x-3 items-start py-1.5 border-b border-gray-50 last:border-0">
      <dt className="text-xs font-semibold text-gray-500 text-left leading-snug pt-0.5">{label}</dt>
      <dd
        className={`text-xs text-gray-800 text-right leading-snug min-w-0 flex flex-col items-end justify-start ${
          mono ? "font-mono tabular-nums" : ""
        } ${breakAll ? "[&_*]:break-all break-all" : "break-words"}`}
      >
        {text}
      </dd>
    </div>
  );
}

/**
 * Users list row: name (link), email on its own line, then label/value detail rows.
 */
export default function UserListRowSummary({
  user,
  profileHref,
  statusLower,
  roleLabel,
  fmtDateTime,
  showUserId = true,
}) {
  const name = displayUser(user) || "—";
  const email = String(user?.email || "").trim();
  const role = roleLabel?.[user?.role] || user?.role || "—";
  const status = statusLower || "—";

  return (
    <div className="min-w-0 flex-1">
      <div className="font-semibold text-gray-900 min-w-0">
        {profileHref ? (
          <Link
            to={profileHref}
            className="text-iregistrygreen hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-iregistrygreen/35 rounded-sm break-words"
          >
            {name}
          </Link>
        ) : (
          <span className="break-words">{name}</span>
        )}
      </div>

      {email ? (
        <p className="mt-2 text-sm text-gray-700 flex items-start gap-2 min-w-0">
          <Mail size={15} className="shrink-0 text-gray-400 mt-0.5" aria-hidden />
          <span className="break-all min-w-0">{email}</span>
        </p>
      ) : (
        <p className="mt-2 text-sm text-gray-500">—</p>
      )}

      <dl className="mt-3 pt-3 border-t border-gray-100">
        <DetailRow label="Role" value={role} />
        <DetailRow
          label="Status"
          value={
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${
                status === "active"
                  ? "bg-emerald-50 text-emerald-800 border border-emerald-100"
                  : status === "suspended" || status === "disabled"
                    ? "bg-amber-50 text-amber-900 border border-amber-100"
                    : "bg-gray-100 text-gray-700 border border-gray-200"
              }`}
            >
              {status}
            </span>
          }
        />
        <DetailRow label="Phone" value={user?.phone || "—"} />
        <DetailRow label="ID / Passport" value={user?.id_number || "—"} mono breakAll />
        <DetailRow label="Location" value={formatUserLocation(user)} />
        <DetailRow label="Last login" value={fmtDateTime ? fmtDateTime(user?.last_login_at) : "—"} />
        {showUserId ? <DetailRow label="User ID" value={user?.id ? String(user.id) : "—"} mono breakAll /> : null}
      </dl>

      {(user?.suspended_reason || user?.disabled_reason) && status !== "active" ? (
        <div className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-md px-2 py-1.5 mt-3 max-w-xl text-left">
          <span className="font-semibold">Reason: </span>
          {user.suspended_reason || user.disabled_reason}
        </div>
      ) : null}
    </div>
  );
}
