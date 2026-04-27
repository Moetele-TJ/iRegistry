// src/Pages/admin/AdminSessionsPage.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MonitorSmartphone, RefreshCw, Search } from "lucide-react";
import RippleButton from "../../components/RippleButton.jsx";
import ConfirmModal from "../../components/ConfirmModal.jsx";
import { invokeWithAuth } from "../../lib/invokeWithAuth.js";
import { useToast } from "../../contexts/ToastContext.jsx";
import { useAuth } from "../../contexts/AuthContext.jsx";
import PageSectionCard from "../shared/PageSectionCard.jsx";

function parseJwtSid(token) {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const json = atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(json);
    return payload.sid || null;
  } catch {
    return null;
  }
}

function displayUserName(s) {
  const first = String(s?.user_first_name || "").trim();
  const last = String(s?.user_last_name || "").trim();
  const full = `${first} ${last}`.trim();
  return full || s?.user_email || s?.user_id || "—";
}

function formatRemainingMs(ms) {
  if (ms <= 0) return "Expired";
  const totalMin = Math.floor(ms / 60000);
  const d = Math.floor(totalMin / (60 * 24));
  const h = Math.floor((totalMin % (60 * 24)) / 60);
  const m = totalMin % 60;
  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0 || parts.length === 0) parts.push(`${m}m`);
  return parts.join(" ");
}

function shortenId(id) {
  if (!id || typeof id !== "string") return "—";
  return id.length <= 12 ? id : `${id.slice(0, 8)}…`;
}

const EXTEND_PRESETS = [
  { label: "1 hour", minutes: 60 },
  { label: "2 hours", minutes: 120 },
  { label: "5 hours", minutes: 300 },
  { label: "10 hours", minutes: 600 },
];

export default function AdminSessionsPage() {
  const { addToast } = useToast();
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [currentSid, setCurrentSid] = useState(() =>
    parseJwtSid(
      typeof window !== "undefined" ? localStorage.getItem("session") : null,
    ),
  );

  const [revokeModal, setRevokeModal] = useState({ open: false, row: null });
  const [revokeUserModal, setRevokeUserModal] = useState({
    open: false,
    row: null,
  });
  const [extendModal, setExtendModal] = useState({
    open: false,
    row: null,
    minutes: 60,
  });
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setError("");
    try {
      const { data, error: invErr } = await invokeWithAuth("admin-sessions", {
        body: { action: "list" },
      });
      if (invErr || !data?.success) {
        const msg =
          data?.message || invErr?.message || "Failed to load sessions";
        setSessions([]);
        setError(msg);
        return;
      }
      setSessions(data.sessions || []);
      setCurrentSid(parseJwtSid(localStorage.getItem("session")));
    } catch (e) {
      console.error(e);
      setError("Unexpected error loading sessions");
      setSessions([]);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await load();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  useEffect(() => {
    const id = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(id);
  }, [load]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return sessions;
    return sessions.filter((s) => {
      const blob = [
        displayUserName(s),
        s.user_email,
        s.user_id,
        s.role,
        s.ip_address,
        s.user_agent,
        s.id,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return blob.includes(needle);
    });
  }, [sessions, q]);

  async function handleRevokeConfirm() {
    const row = revokeModal.row;
    if (!row?.id) return;
    setBusyId(row.id);
    try {
      const { data, error: invErr } = await invokeWithAuth("admin-sessions", {
        body: { action: "revoke", session_id: row.id },
      });
      if (invErr || !data?.success) {
        addToast({
          type: "error",
          message: data?.message || invErr?.message || "Revoke failed",
        });
        return;
      }
      addToast({ type: "success", message: data.message || "Session revoked" });
      if (row.id === currentSid) {
        await logout({ silent: true });
        navigate("/login", { replace: true });
        return;
      }
      await load();
    } finally {
      setBusyId(null);
      setRevokeModal({ open: false, row: null });
    }
  }

  async function handleRevokeUserConfirm() {
    const row = revokeUserModal.row;
    if (!row?.user_id) return;
    setBusyId(`user:${row.user_id}`);
    try {
      const { data, error: invErr } = await invokeWithAuth("admin-sessions", {
        body: { action: "revoke_user", user_id: row.user_id },
      });
      if (invErr || !data?.success) {
        addToast({
          type: "error",
          message: data?.message || invErr?.message || "Action failed",
        });
        return;
      }
      addToast({
        type: "success",
        message: data.message || "Sessions revoked",
      });
      const includedSelf =
        row.user_id &&
        sessions.some(
          (s) =>
            s.user_id === row.user_id && s.id === currentSid,
        );
      if (includedSelf) {
        await logout({ silent: true });
        navigate("/login", { replace: true });
        return;
      }
      await load();
    } finally {
      setBusyId(null);
      setRevokeUserModal({ open: false, row: null });
    }
  }

  async function handleExtend(sessionId, minutes) {
    setBusyId(sessionId);
    try {
      const { data, error: invErr } = await invokeWithAuth("admin-sessions", {
        body: { action: "extend", session_id: sessionId, extend_minutes: minutes },
      });
      if (invErr || !data?.success) {
        addToast({
          type: "error",
          message: data?.message || invErr?.message || "Extend failed",
        });
        return;
      }
      addToast({
        type: "success",
        message: data.message || "Session extended",
      });
      setExtendModal({ open: false, row: null, minutes: 60 });
      await load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
    <PageSectionCard
      maxWidthClass="max-w-7xl"
      title="Active sessions"
      subtitle="Non-revoked sessions with a future expiry. The list syncs from the server every minute; time remaining updates every second."
      icon={<MonitorSmartphone className="w-6 h-6 text-iregistrygreen shrink-0" />}
      actions={
        <RippleButton
          type="button"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm text-gray-800 shadow-sm hover:bg-gray-50 disabled:opacity-50"
          onClick={async () => {
            setLoading(true);
            try {
              await load();
            } finally {
              setLoading(false);
            }
          }}
          disabled={loading}
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          Refresh now
        </RippleButton>
      }
    >
      <div className="p-4 sm:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="relative flex-1 max-w-md">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            size={18}
          />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, email, role, IP, device…"
            className="w-full border rounded-lg pl-10 pr-3 py-2 text-sm"
          />
        </div>
        <p className="text-sm text-gray-600">
          {loading ? "Loading…" : `${filtered.length} session(s)`}
        </p>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 text-red-800 px-4 py-3 text-sm">
          {error}
        </div>
      ) : null}

      <div className="rounded-xl border border-gray-100 overflow-hidden bg-gray-50/40">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Time left</th>
                <th className="px-4 py-3 font-medium">Session</th>
                <th className="px-4 py-3 font-medium">IP</th>
                <th className="px-4 py-3 font-medium min-w-[140px]">Device</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && sessions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    Loading sessions…
                  </td>
                </tr>
              ) : null}
              {!loading && filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    No active sessions match your filters.
                  </td>
                </tr>
              ) : null}
              {filtered.map((row) => {
                const expMs = new Date(row.expires_at).getTime() - now;
                const isSelf = row.id === currentSid;
                const rowBusy = busyId === row.id || busyId === `user:${row.user_id}`;
                return (
                  <tr key={row.id} className={isSelf ? "bg-emerald-50/60" : ""}>
                    <td className="px-4 py-3 align-top">
                      <div className="font-medium text-gray-900">
                        {displayUserName(row)}
                      </div>
                      <div className="text-xs text-gray-500 break-all">
                        {row.user_email || "—"}
                      </div>
                      {isSelf ? (
                        <span className="inline-block mt-1 text-xs font-medium text-emerald-800 bg-emerald-100 rounded px-2 py-0.5">
                          This browser
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 align-top capitalize text-gray-800">
                      {row.role || "—"}
                    </td>
                    <td className="px-4 py-3 align-top whitespace-nowrap font-mono text-gray-800">
                      {formatRemainingMs(expMs)}
                    </td>
                    <td
                      className="px-4 py-3 align-top font-mono text-xs text-gray-600"
                      title={row.id}
                    >
                      {shortenId(row.id)}
                    </td>
                    <td className="px-4 py-3 align-top text-gray-700 text-xs max-w-[120px] break-all">
                      {row.ip_address || "—"}
                    </td>
                    <td
                      className="px-4 py-3 align-top text-gray-600 text-xs max-w-[200px] truncate"
                      title={row.user_agent || ""}
                    >
                      {row.user_agent || "—"}
                    </td>
                    <td className="px-4 py-3 align-top text-right">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <RippleButton
                          type="button"
                          className="px-2.5 py-1 rounded-md bg-indigo-600 text-white text-xs disabled:opacity-50"
                          onClick={() => {
                            setExtendModal({
                              open: true,
                              row,
                              minutes: 60,
                            });
                          }}
                          disabled={rowBusy}
                        >
                          Extend
                        </RippleButton>
                        <RippleButton
                          type="button"
                          className="px-2.5 py-1 rounded-md bg-amber-600 text-white text-xs disabled:opacity-50"
                          onClick={() =>
                            setRevokeModal({ open: true, row })
                          }
                          disabled={rowBusy}
                        >
                          Revoke
                        </RippleButton>
                        <RippleButton
                          type="button"
                          className="px-2.5 py-1 rounded-md bg-slate-600 text-white text-xs disabled:opacity-50"
                          onClick={() =>
                            setRevokeUserModal({ open: true, row })
                          }
                          disabled={rowBusy}
                          title="Sign out this user everywhere (all active sessions)"
                        >
                          Revoke all
                        </RippleButton>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <section className="rounded-xl border border-gray-200 bg-slate-50 px-4 py-3 text-sm text-gray-700 space-y-2">
        <p className="font-medium text-gray-800">What you can do</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <strong>Revoke</strong> ends a single session. The user must sign in
            again on that device.
          </li>
          <li>
            <strong>Revoke all</strong> ends every active session for that user
            (all browsers and devices).
          </li>
          <li>
            <strong>Extend</strong> pushes the server expiry forward (capped at
            30 days from now per request). Users still get sliding renewals from
            normal activity.
          </li>
        </ul>
      </section>
      </div>
    </PageSectionCard>

      <ConfirmModal
        isOpen={revokeModal.open}
        onClose={() => setRevokeModal({ open: false, row: null })}
        onConfirm={handleRevokeConfirm}
        title="Revoke session?"
        message={
          revokeModal.row?.id === currentSid
            ? "This is your current session. You will be signed out immediately."
            : "This signs the user out on that device only."
        }
        confirmLabel="Revoke"
        danger
      />

      <ConfirmModal
        isOpen={revokeUserModal.open}
        onClose={() => setRevokeUserModal({ open: false, row: null })}
        onConfirm={handleRevokeUserConfirm}
        title="Revoke all sessions for this user?"
        message={
          revokeUserModal.row &&
          sessions.some(
            (s) =>
              s.user_id === revokeUserModal.row.user_id &&
              s.id === currentSid,
          )
            ? "This includes your current admin session. You will be signed out."
            : "This signs the user out on every device."
        }
        confirmLabel="Revoke all"
        danger
      />

      <ConfirmModal
        isOpen={extendModal.open}
        onClose={() => setExtendModal({ open: false, row: null, minutes: 60 })}
        title="Extend session"
        message="Choose how long to extend this session by."
        confirmLabel="Extend"
        confirmDisabled={!extendModal.row?.id || busyId === extendModal.row?.id}
        onConfirm={async () => {
          const sid = extendModal.row?.id;
          if (!sid) return;
          await handleExtend(sid, extendModal.minutes);
        }}
        variant="default"
      >
        <div className="space-y-2">
          {EXTEND_PRESETS.map((p) => {
            const checked = extendModal.minutes === p.minutes;
            return (
              <label
                key={p.minutes}
                className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2 cursor-pointer"
              >
                <div className="text-sm text-gray-800">{p.label}</div>
                <input
                  type="radio"
                  name="extendMinutes"
                  value={p.minutes}
                  checked={checked}
                  onChange={() =>
                    setExtendModal((m) => ({ ...m, minutes: p.minutes }))
                  }
                />
              </label>
            );
          })}
        </div>
      </ConfirmModal>
    </>
  );
}
