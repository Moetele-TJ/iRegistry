import { useCallback, useEffect, useMemo, useState } from "react";
import { FileText, RefreshCw, Search } from "lucide-react";
import RippleButton from "../../components/RippleButton.jsx";
import TimeAgo from "../../components/TimeAgo.jsx";
import { invokeWithAuth } from "../../lib/invokeWithAuth.js";
import { useToast } from "../../contexts/ToastContext.jsx";
import PageSectionCard from "../shared/PageSectionCard.jsx";

const PAGE_SIZE = 40;

function displayUser(u) {
  if (!u) return null;
  const first = String(u.first_name || "").trim();
  const last = String(u.last_name || "").trim();
  const full = `${first} ${last}`.trim();
  return full || u.email || null;
}

function shortenIp(ip) {
  if (!ip || typeof ip !== "string") return "—";
  return ip.length > 32 ? `${ip.slice(0, 29)}…` : ip;
}

function fmtTimeCell(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return String(iso);
  }
}

export default function AdminAuditLogs() {
  const { addToast } = useToast();

  const [page, setPage] = useState(1);
  const [eventQ, setEventQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [successFilter, setSuccessFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("");
  const [userIdFilter, setUserIdFilter] = useState("");

  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(eventQ.trim()), 300);
    return () => window.clearTimeout(t);
  }, [eventQ]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQ]);

  useEffect(() => {
    let cancelled = false;
    async function loadUsers() {
      setLoadingUsers(true);
      try {
        const { data, error } = await invokeWithAuth("list-users");
        if (cancelled) return;
        if (error || !data?.success) {
          throw new Error(data?.message || error?.message || "Failed to load users");
        }
        setUsers(data.users || []);
      } catch (e) {
        addToast({ type: "error", message: e.message || "Failed to load users" });
        setUsers([]);
      } finally {
        if (!cancelled) setLoadingUsers(false);
      }
    }
    void loadUsers();
    return () => {
      cancelled = true;
    };
  }, [addToast]);

  const offset = (page - 1) * PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const body = {
        limit: PAGE_SIZE,
        offset,
        event_q: debouncedQ || undefined,
        user_id: userIdFilter || undefined,
      };
      if (successFilter === "ok") body.success = true;
      else if (successFilter === "fail") body.success = false;
      if (severityFilter) body.severity = severityFilter;

      const { data, error } = await invokeWithAuth("list-audit-logs", { body });
      if (error || !data?.success) {
        throw new Error(data?.message || error?.message || "Failed to load audit logs");
      }
      setLogs(data.logs || []);
      setTotal(Number(data.total) || 0);
    } catch (e) {
      addToast({ type: "error", message: e.message || "Failed to load audit logs" });
      setLogs([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [
    addToast,
    debouncedQ,
    offset,
    successFilter,
    severityFilter,
    userIdFilter,
  ]);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  const userOptions = useMemo(() => {
    return (users || []).slice(0, 500);
  }, [users]);

  return (
    <div className="min-h-[60vh]">
      <PageSectionCard
        maxWidthClass="max-w-7xl"
        title="Audit logs"
        subtitle="Security-sensitive events (auth, sessions, OTP, and admin actions). IP and device details are recorded for investigation."
        icon={<FileText className="w-6 h-6 text-iregistrygreen shrink-0" />}
      >
        <div className="p-4 sm:p-6 space-y-6">
          <div className="flex flex-col xl:flex-row gap-4 flex-wrap xl:items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs font-medium text-gray-600">Search event or code</label>
              <div className="mt-1 flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-sm">
                <Search size={18} className="text-gray-400 shrink-0" />
                <input
                  value={eventQ}
                  onChange={(e) => setEventQ(e.target.value)}
                  className="w-full outline-none text-sm bg-transparent"
                  placeholder="e.g. OTP_, ADMIN_SESSION…"
                />
              </div>
            </div>

            <div className="w-full sm:w-44">
              <label className="text-xs font-medium text-gray-600">Outcome</label>
              <select
                value={successFilter}
                onChange={(e) => {
                  setSuccessFilter(e.target.value);
                  setPage(1);
                }}
                className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white shadow-sm"
              >
                <option value="all">All</option>
                <option value="ok">Success</option>
                <option value="fail">Failed</option>
              </select>
            </div>

            <div className="w-full sm:w-44">
              <label className="text-xs font-medium text-gray-600">Severity</label>
              <select
                value={severityFilter}
                onChange={(e) => {
                  setSeverityFilter(e.target.value);
                  setPage(1);
                }}
                className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white shadow-sm"
              >
                <option value="">All</option>
                <option value="high">High</option>
              </select>
            </div>

            <div className="flex-1 min-w-[220px]">
              <label className="text-xs font-medium text-gray-600">User</label>
              <select
                value={userIdFilter}
                onChange={(e) => {
                  setUserIdFilter(e.target.value);
                  setPage(1);
                }}
                className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white shadow-sm"
                disabled={loadingUsers}
              >
                <option value="">All users</option>
                {userOptions.map((u) => (
                  <option key={u.id} value={u.id}>
                    {displayUser(u) || u.id}
                  </option>
                ))}
              </select>
            </div>

            <RippleButton
              type="button"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-800 shadow-sm hover:bg-gray-50 shrink-0"
              onClick={() => void loadLogs()}
              disabled={loading}
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
              Refresh
            </RippleButton>
          </div>

          {loading ? (
            <div className="text-sm text-gray-500 py-8">Loading audit logs…</div>
          ) : logs.length === 0 ? (
            <div className="text-sm text-gray-500 py-8">No matching entries.</div>
          ) : (
            <>
              {/* Mobile cards (match Transactions style) */}
              <div className="md:hidden space-y-3 -mx-1">
                {logs.map((row) => {
                  const name = displayUser(row.user);
                  const uid = row.user_id;
                  const who =
                    name ||
                    (typeof uid === "string"
                      ? uid.length > 14
                        ? `${uid.slice(0, 8)}…`
                        : uid
                      : "—");
                  const sev = row.severity;
                  const ok = !!row.success;
                  const badgeClass = ok
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-100"
                    : "bg-red-50 text-red-700 border border-red-100";

                  return (
                    <div
                      key={row.id}
                      className="w-full rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"
                      title={row.user_agent ? String(row.user_agent) : undefined}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-gray-900 break-words">
                            {row.event || "—"}
                          </div>
                          {sev ? (
                            <div className="text-xs text-amber-700 mt-0.5">
                              Severity: {sev}
                            </div>
                          ) : null}
                          <div className="text-xs text-gray-500 mt-1 truncate">
                            {who}
                          </div>
                          {name && typeof uid === "string" ? (
                            <div className="text-[11px] text-gray-400 font-mono truncate max-w-full">
                              {uid}
                            </div>
                          ) : null}
                        </div>
                        <div className="shrink-0 text-right">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold border ${badgeClass}`}>
                            {ok ? "OK" : "Fail"}
                          </span>
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
                          <div className="text-gray-500">Time</div>
                          <div className="text-gray-800 mt-0.5">
                            {row.created_at ? (
                              <span title={fmtTimeCell(row.created_at)}>
                                <TimeAgo date={row.created_at} />
                              </span>
                            ) : (
                              "—"
                            )}
                          </div>
                        </div>
                        <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
                          <div className="text-gray-500">Channel</div>
                          <div className="text-gray-800 mt-0.5">{row.channel ?? "—"}</div>
                        </div>
                        <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 col-span-2">
                          <div className="text-gray-500">Code</div>
                          <div className="text-gray-800 mt-0.5 font-mono break-all">{row.diag ?? "—"}</div>
                        </div>
                        <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 col-span-2">
                          <div className="text-gray-500">IP</div>
                          <div className="text-gray-800 mt-0.5 font-mono break-all">{row.ip_address ?? "—"}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop table */}
              <div className="hidden md:block overflow-auto rounded-xl border border-gray-100 shadow-sm">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="text-left font-semibold px-4 py-3 whitespace-nowrap">Time</th>
                      <th className="text-left font-semibold px-4 py-3">Event</th>
                      <th className="text-left font-semibold px-4 py-3">User</th>
                      <th className="text-left font-semibold px-4 py-3 whitespace-nowrap">Result</th>
                      <th className="text-left font-semibold px-4 py-3 whitespace-nowrap">Channel</th>
                      <th className="text-left font-semibold px-4 py-3">Code</th>
                      <th className="text-left font-semibold px-4 py-3 whitespace-nowrap">IP</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {logs.map((row) => {
                      const name = displayUser(row.user);
                      const uid = row.user_id;
                      const who =
                        name ||
                        (typeof uid === "string"
                          ? uid.length > 14
                            ? `${uid.slice(0, 8)}…`
                            : uid
                          : "—");
                      const sev = row.severity;
                      return (
                        <tr
                          key={row.id}
                          className="hover:bg-gray-50/80 align-top"
                          title={row.user_agent ? String(row.user_agent) : undefined}
                        >
                          <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                            {row.created_at ? (
                              <span title={new Date(row.created_at).toLocaleString()}>
                                <TimeAgo date={row.created_at} />
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-900">
                            <div className="font-medium">{row.event || "—"}</div>
                            {sev ? (
                              <div className="text-xs text-amber-700 mt-0.5">Severity: {sev}</div>
                            ) : null}
                          </td>
                          <td className="px-4 py-3 text-gray-800">
                            <div className="break-all">{who}</div>
                            {name && typeof uid === "string" ? (
                              <div className="text-xs text-gray-400 font-mono truncate max-w-[200px]">
                                {uid}
                              </div>
                            ) : null}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                                row.success
                                  ? "bg-emerald-50 text-emerald-800 border border-emerald-100"
                                  : "bg-red-50 text-red-700 border border-red-100"
                              }`}
                            >
                              {row.success ? "OK" : "Fail"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                            {row.channel ?? "—"}
                          </td>
                          <td className="px-4 py-3 text-gray-600 font-mono text-xs break-all">
                            {row.diag ?? "—"}
                          </td>
                          <td className="px-4 py-3 text-gray-500 font-mono text-xs" title={row.ip_address}>
                            {shortenIp(row.ip_address)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {!loading && logs.length > 0 ? (
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 pt-2 border-t border-gray-100 text-sm">
              <div className="text-gray-500">
                Showing {offset + 1}–{Math.min(offset + logs.length, total)} of {total}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1.5 rounded-lg bg-white border border-gray-200 disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="text-gray-600">
                  Page {page} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-3 py-1.5 rounded-lg bg-white border border-gray-200 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </PageSectionCard>
    </div>
  );
}
