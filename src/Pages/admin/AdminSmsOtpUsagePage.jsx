import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MessageSquare, RefreshCw } from "lucide-react";
import RippleButton from "../../components/RippleButton.jsx";
import { invokeWithAuth } from "../../lib/invokeWithAuth.js";
import { displayUser } from "../../lib/userDisplay.js";
import { useListUsers } from "../../hooks/useListUsers.js";
import { useToast } from "../../contexts/ToastContext.jsx";
import PageSectionCard from "../shared/PageSectionCard.jsx";

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
  const [userSearch, setUserSearch] = useState("");
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

  const userOptions = useMemo(() => {
    const list = [...(users || [])];
    const q = userSearch.trim().toLowerCase();
    if (!q) return list.slice(0, 500);
    return list
      .filter((u) => {
        const hay = [displayUser(u), u?.email, u?.phone, u?.id_number, u?.id]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 500);
  }, [users, userSearch]);

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
    : "Counts each time an SMS code is actually sent after credits are debited (audit: OTP_SENT, channel sms). Provider failures after debit are listed separately. Choose a user below to see only their SMS OTP sends.";

  return (
    <div className="max-w-5xl mx-auto w-full">
      <PageSectionCard
        maxWidthClass="max-w-5xl"
        title="SMS login OTP usage"
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

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 lg:items-end">
              <div className="lg:col-span-5">
                <label className="text-xs text-gray-600 block" htmlFor="sms-otp-user-search">
                  Find user
                </label>
                <input
                  id="sms-otp-user-search"
                  type="search"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Name, email, phone, ID…"
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                  disabled={loadingUsers}
                  autoComplete="off"
                />
              </div>
              <div className="lg:col-span-7">
                <label className="text-xs text-gray-600 block" htmlFor="sms-otp-user">
                  User (SMS OTP sends only)
                </label>
                <select
                  id="sms-otp-user"
                  value={userIdFilter}
                  onChange={(e) => setUserIdFilter(e.target.value)}
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-white min-w-0"
                  disabled={loadingUsers || loading}
                >
                  <option value="">All users (registry-wide)</option>
                  {userOptions.map((u) => (
                    <option key={u.id} value={u.id}>
                      {displayUser(u) || u.id}
                      {u.email ? ` · ${u.email}` : ""}
                    </option>
                  ))}
                </select>
                {loadingUsers ? (
                  <p className="text-[11px] text-gray-400 mt-1">Loading users…</p>
                ) : userSearch.trim() && userOptions.length === 0 ? (
                  <p className="text-[11px] text-amber-700 mt-1">No users match this search.</p>
                ) : null}
              </div>
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
