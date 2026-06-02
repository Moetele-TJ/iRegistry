import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MessageSquare, RefreshCw } from "lucide-react";
import RippleButton from "../../components/RippleButton.jsx";
import { invokeWithAuth } from "../../lib/invokeWithAuth.js";
import { displayUser } from "../../lib/userDisplay.js";
import { useListUsers } from "../../hooks/useListUsers.js";
import { useToast } from "../../contexts/ToastContext.jsx";
import PageSectionCard from "../shared/PageSectionCard.jsx";
import { PAGE_TITLES } from "../../lib/navLabels.js";

const RANGE_OPTIONS = [
  { value: 7, label: "Last 7 days" },
  { value: 30, label: "Last 30 days" },
  { value: 90, label: "Last 90 days" },
];

function fmtDay(isoDate) {
  if (!isoDate) return "—";
  try {
    return new Date(`${isoDate}T12:00:00Z`).toLocaleDateString(undefined, {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return String(isoDate);
  }
}

export default function AdminSmsOtpUsagePage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [days, setDays] = useState(30);
  const [userIdFilter, setUserIdFilter] = useState("");
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [userQuery, setUserQuery] = useState("");
  const userComboWrapRef = useRef(null);
  const {
    users,
    loading: loadingUsers,
    error: usersFetchError,
  } = useListUsers();
  const [loading, setLoading] = useState(true);
  const [totals, setTotals] = useState({ sms_otp_sent_success: 0, sms_send_failed: 0 });
  const [byDay, setByDay] = useState([]);

  useEffect(() => {
    if (!usersFetchError) return;
    addToast({ type: "error", message: usersFetchError });
  }, [usersFetchError, addToast]);

  const filteredUserOptions = useMemo(() => {
    const list = [...(users || [])];
    const q = userQuery.trim().toLowerCase();
    if (!q) return list.slice(0, 200);
    return list
      .filter((u) => {
        const hay = [displayUser(u), u?.email, u?.phone, u?.id_number, u?.id]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 200);
  }, [users, userQuery]);

  useEffect(() => {
    if (!userMenuOpen) return undefined;
    function onDocMouseDown(e) {
      const el = userComboWrapRef.current;
      if (el && !el.contains(e.target)) setUserMenuOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [userMenuOpen]);

  const selectedUserLabel = useMemo(() => {
    if (!userIdFilter) return null;
    const u = users.find((x) => String(x?.id) === String(userIdFilter));
    return displayUser(u) || userIdFilter;
  }, [userIdFilter, users]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const body = { days };
      if (userIdFilter) body.user_id = userIdFilter;
      const { data, error } = await invokeWithAuth("admin-sms-otp-usage", {
        body,
      });
      if (error || !data?.success) {
        throw new Error(data?.message || error?.message || "Failed to load usage");
      }
      setTotals({
        sms_otp_sent_success: Number(data?.totals?.sms_otp_sent_success ?? 0),
        sms_send_failed: Number(data?.totals?.sms_send_failed ?? 0),
      });
      setByDay(Array.isArray(data?.by_day) ? data.by_day : []);
    } catch (e) {
      addToast({ type: "error", message: e.message || "Failed to load" });
      setTotals({ sms_otp_sent_success: 0, sms_send_failed: 0 });
      setByDay([]);
    } finally {
      setLoading(false);
    }
  }, [addToast, days, userIdFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Only days with at least one send or failure (defensive if API returns zero rows). */
  const byDayWithActivity = useMemo(
    () =>
      byDay.filter(
        (row) =>
          Number(row?.sms_otp_sent_success ?? 0) > 0 ||
          Number(row?.sms_send_failed ?? 0) > 0
      ),
    [byDay]
  );

  const maxSent = useMemo(() => {
    let m = 0;
    for (const row of byDayWithActivity) {
      const n = Number(row?.sms_otp_sent_success ?? 0);
      if (n > m) m = n;
    }
    return m || 1;
  }, [byDayWithActivity]);

  const pageSubtitle = userIdFilter
    ? `SMS OTP sends for ${selectedUserLabel || "selected user"} — each send after credits are debited (audit: OTP_SENT, channel sms). Failures after debit are listed separately.`
    : "Counts each time an SMS code is actually sent after credits are debited (audit: OTP_SENT, channel sms). Provider failures after debit are listed separately. Use User to filter by account.";

  return (
    <div className="max-w-5xl mx-auto w-full">
      <PageSectionCard
        maxWidthClass="max-w-5xl"
        title={PAGE_TITLES.smsLoginOtpUsage}
        subtitle={pageSubtitle}
        icon={<MessageSquare className="w-6 h-6 text-iregistrygreen shrink-0" />}
        actions={
          <RippleButton
            className="py-2 px-3 rounded-xl border border-gray-200 bg-white text-sm text-gray-800 shadow-sm hover:bg-gray-50"
            onClick={() => navigate("/admin")}
          >
            Back
          </RippleButton>
        }
      >
        <div className="p-4 sm:p-6 space-y-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="text-xs text-gray-600 block" htmlFor="sms-otp-range">
                  Range
                </label>
                <select
                  id="sms-otp-range"
                  value={days}
                  onChange={(e) => setDays(Number(e.target.value))}
                  className="mt-1 border rounded-lg px-3 py-2 text-sm bg-white min-w-[11rem]"
                  disabled={loading}
                >
                  {RANGE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div
                ref={userComboWrapRef}
                className="flex-1 min-w-[12rem] max-w-md"
              >
                <label className="text-xs text-gray-600 block" htmlFor="sms-otp-user-combo">
                  User
                </label>
                <div className="relative mt-1">
                  <input
                    id="sms-otp-user-combo"
                    type="text"
                    role="combobox"
                    aria-expanded={userMenuOpen}
                    aria-controls="sms-otp-user-listbox"
                    aria-autocomplete="list"
                    autoComplete="off"
                    placeholder="Select user"
                    value={userMenuOpen ? userQuery : selectedUserLabel || ""}
                    onChange={(e) => {
                      setUserQuery(e.target.value);
                      if (!userMenuOpen) setUserMenuOpen(true);
                    }}
                    onFocus={() => {
                      setUserMenuOpen(true);
                      setUserQuery(selectedUserLabel || "");
                    }}
                    disabled={loadingUsers || loading}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-iregistrygreen/25 focus:border-iregistrygreen/40 pr-9"
                  />
                  {userIdFilter ? (
                    <button
                      type="button"
                      title="Clear user filter"
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 text-lg leading-none"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setUserIdFilter("");
                        setUserQuery("");
                        setUserMenuOpen(false);
                      }}
                      disabled={loading}
                    >
                      ×
                    </button>
                  ) : null}
                  {userMenuOpen ? (
                    <ul
                      id="sms-otp-user-listbox"
                      role="listbox"
                      className="absolute z-30 mt-1 w-full max-h-60 overflow-auto rounded-lg border border-gray-200 bg-white py-1 text-sm shadow-lg"
                    >
                      <li role="presentation">
                        <button
                          type="button"
                          role="option"
                          aria-selected={!userIdFilter}
                          className={`w-full text-left px-3 py-2 hover:bg-gray-50 ${
                            !userIdFilter ? "bg-gray-50 font-medium text-gray-900" : "text-gray-700"
                          }`}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setUserIdFilter("");
                            setUserMenuOpen(false);
                            setUserQuery("");
                          }}
                        >
                          All users (registry-wide)
                        </button>
                      </li>
                      {loadingUsers ? (
                        <li className="px-3 py-2 text-gray-500">Loading users…</li>
                      ) : filteredUserOptions.length === 0 ? (
                        <li className="px-3 py-2 text-amber-800">No users match.</li>
                      ) : (
                        filteredUserOptions.map((u) => {
                          const primary = displayUser(u) || String(u.id ?? "");
                          const idNum = String(u?.id_number || "").replace(/\s+/g, " ").trim();
                          const primaryNorm = primary.replace(/\s+/g, " ").trim();
                          const showIdSuffix =
                            idNum && idNum.toLowerCase() !== primaryNorm.toLowerCase();
                          const secondary = showIdSuffix ? `(${idNum})` : "";
                          const sel = String(userIdFilter) === String(u.id);
                          return (
                            <li key={u.id} role="presentation">
                              <button
                                type="button"
                                role="option"
                                aria-selected={sel}
                                className={`w-full text-left px-3 py-2 hover:bg-gray-50 ${
                                  sel ? "bg-emerald-50/80" : ""
                                }`}
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                  setUserIdFilter(String(u.id));
                                  setUserMenuOpen(false);
                                  setUserQuery("");
                                }}
                              >
                                <div className="font-medium text-gray-900 truncate">
                                  {primary}
                                  {secondary ? (
                                    <span className="font-normal text-gray-500"> {secondary}</span>
                                  ) : null}
                                </div>
                              </button>
                            </li>
                          );
                        })
                      )}
                    </ul>
                  ) : null}
                </div>
              </div>

              <RippleButton
                type="button"
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border bg-white text-sm"
                onClick={() => void load()}
                disabled={loading}
              >
                <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                Refresh
              </RippleButton>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/80 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
                SMS OTPs sent
              </div>
              <div className="text-3xl font-bold text-emerald-950 tabular-nums mt-1">
                {loading ? "—" : totals.sms_otp_sent_success}
              </div>
              <p className="text-xs text-emerald-900/80 mt-2">
                One row per successful provider send (paid path).
              </p>
            </div>
            <div className="rounded-2xl border border-amber-100 bg-amber-50/80 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-amber-900">
                SMS send failures
              </div>
              <div className="text-3xl font-bold text-amber-950 tabular-nums mt-1">
                {loading ? "—" : totals.sms_send_failed}
              </div>
              <p className="text-xs text-amber-900/80 mt-2">
                After debit; credits are refunded when the provider send fails.
              </p>
            </div>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-gray-800 mb-2">
              By day (UTC) — days with activity only
            </h2>
            {loading ? (
              <div className="text-sm text-gray-500 py-6">Loading…</div>
            ) : byDayWithActivity.length === 0 ? (
              <div className="text-sm text-gray-500 py-6">
                No SMS OTP activity in this range.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-gray-100">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                      <th className="px-3 py-2">Day</th>
                      <th className="px-3 py-2 text-right">SMS sent</th>
                      <th className="px-3 py-2 text-right">Failures</th>
                      <th className="px-3 py-2 min-w-[8rem]">Volume</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...byDayWithActivity].reverse().map((row) => {
                      const sent = Number(row?.sms_otp_sent_success ?? 0);
                      const failed = Number(row?.sms_send_failed ?? 0);
                      const barPct = Math.round((sent / maxSent) * 100);
                      return (
                        <tr key={row.day} className="border-t border-gray-100">
                          <td className="px-3 py-2 text-gray-800 whitespace-nowrap">
                            {fmtDay(row.day)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums font-medium">{sent}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-amber-800">{failed}</td>
                          <td className="px-3 py-2 align-middle">
                            <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                              <div
                                className="h-2 rounded-full bg-iregistrygreen/80"
                                style={{ width: `${barPct}%` }}
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <p className="text-xs text-gray-500">
            For raw events, use{" "}
            <button
              type="button"
              className="text-iregistrygreen font-medium hover:underline"
              onClick={() => navigate("/admin/audit-logs")}
            >
              Audit logs
            </button>{" "}
            and filter event <code className="text-gray-700">OTP_SENT</code> with channel{" "}
            <code className="text-gray-700">sms</code>.
          </p>
        </div>
      </PageSectionCard>
    </div>
  );
}
