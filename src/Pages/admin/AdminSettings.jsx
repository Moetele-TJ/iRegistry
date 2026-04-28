import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  Bell,
  Coins,
  Copy,
  FileText,
  LayoutDashboard,
  MonitorSmartphone,
  Package,
  ReceiptText,
  RefreshCw,
  Settings,
  Tag,
  UserCircle,
  Users,
  Wallet,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { useToast } from "../../contexts/ToastContext.jsx";
import { useModal } from "../../contexts/ModalContext.jsx";
import RippleButton from "../../components/RippleButton.jsx";
import { invokeWithAuth } from "../../lib/invokeWithAuth.js";
import PageSectionCard from "../shared/PageSectionCard.jsx";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

function isoDateInputValue(iso) {
  if (!iso) return "";
  try {
    return String(iso).slice(0, 16); // yyyy-mm-ddThh:mm for datetime-local
  } catch {
    return "";
  }
}

function formatUserLabel(u) {
  if (!u) return "—";
  const name = `${String(u.first_name || "").trim()} ${String(u.last_name || "").trim()}`.trim();
  return name || u.email || u.id_number || u.id || "—";
}

function promoStatusForRow(row, nowMs = Date.now()) {
  if (!row) return { key: "unknown", label: "Unknown" };
  const s = row.starts_at ? new Date(row.starts_at).getTime() : NaN;
  const p = row.proposed_ends_at ? new Date(row.proposed_ends_at).getTime() : NaN;
  const e = row.ended_at ? new Date(row.ended_at).getTime() : NaN;
  if (!Number.isFinite(s) || !Number.isFinite(p)) return { key: "unknown", label: "Unknown" };

  const effectiveEnd = Number.isFinite(e) ? Math.min(e, p) : p;

  if (nowMs < s) return { key: "scheduled", label: "Scheduled" };
  if (nowMs >= s && nowMs < effectiveEnd) return { key: "active", label: "Active" };

  if (Number.isFinite(e) && e < p) return { key: "ended_early", label: "Ended early" };
  return { key: "ended", label: "Ended" };
}

function promoStatusBadgeClass(key) {
  const k = String(key || "");
  if (k === "active") return "bg-emerald-50 text-emerald-800 border-emerald-100";
  if (k === "scheduled") return "bg-blue-50 text-blue-800 border-blue-100";
  if (k === "ended_early") return "bg-amber-50 text-amber-900 border-amber-100";
  if (k === "ended") return "bg-gray-50 text-gray-700 border-gray-200";
  return "bg-slate-50 text-slate-700 border-slate-200";
}

function projectLabel(url) {
  if (!url || typeof url !== "string") return "—";
  try {
    const u = new URL(url);
    return u.host || "—";
  } catch {
    return "—";
  }
}

function roleLabel(role) {
  const r = String(role || "").toLowerCase();
  const map = {
    admin: "Administrator",
    user: "Registered user",
    police: "Police",
    cashier: "Cashier",
  };
  return map[r] || role || "—";
}

export default function AdminSettings() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToast } = useToast();
  const { confirm } = useModal();

  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);

  const [promoLoading, setPromoLoading] = useState(true);
  const [promoSaving, setPromoSaving] = useState(false);
  const [systemPromo, setSystemPromo] = useState(null); // active system campaign (or null)
  const [systemHistory, setSystemHistory] = useState([]);
  const [userPromos, setUserPromos] = useState([]);

  const [systemStartsAt, setSystemStartsAt] = useState("");
  const [systemProposedEndsAt, setSystemProposedEndsAt] = useState("");
  const [systemNote, setSystemNote] = useState("");
  const [systemPromoDraftId, setSystemPromoDraftId] = useState("");

  const [enrollOpen, setEnrollOpen] = useState(false);
  const [enrollBusy, setEnrollBusy] = useState(false);
  const [enrollErr, setEnrollErr] = useState("");
  const [enrollUserQuery, setEnrollUserQuery] = useState("");
  const [enrollUserId, setEnrollUserId] = useState("");
  const [enrollStartsAt, setEnrollStartsAt] = useState("");
  const [enrollProposedEndsAt, setEnrollProposedEndsAt] = useState("");
  const [enrollNote, setEnrollNote] = useState("");
  const [userSearchBusy, setUserSearchBusy] = useState(false);
  const [userSearchResults, setUserSearchResults] = useState([]);

  const [editPromoId, setEditPromoId] = useState("");
  const [editPromoBusy, setEditPromoBusy] = useState(false);
  const [editPromoErr, setEditPromoErr] = useState("");
  const [editPromoStartsAt, setEditPromoStartsAt] = useState("");
  const [editPromoProposedEndsAt, setEditPromoProposedEndsAt] = useState("");
  const [editPromoNote, setEditPromoNote] = useState("");

  const host = useMemo(() => projectLabel(SUPABASE_URL), []);

  const loadStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const { data, error } = await invokeWithAuth("stats?mode=admin");
      if (error || !data?.success || !data?.data) {
        setStats(null);
        return;
      }
      setStats(data.data);
    } catch {
      setStats(null);
    } finally {
      setLoadingStats(false);
    }
  }, []);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  const loadPromo = useCallback(async () => {
    setPromoLoading(true);
    try {
      const { data, error } = await invokeWithAuth("admin-api", {
        body: { operation: "admin-get-promo-config" },
      });
      if (error || !data?.success) {
        setSystemPromo(null);
        setSystemHistory([]);
        setUserPromos([]);
        return;
      }
      const active = data.system_active || null;
      const hist = Array.isArray(data.system_history) ? data.system_history : [];
      const ups = Array.isArray(data.user_promos) ? data.user_promos : [];

      setSystemPromo(active);
      setSystemHistory(hist);
      setUserPromos(ups);

      // Prefill system editor with active promo (or defaults)
      setSystemStartsAt(isoDateInputValue(active?.starts_at) || "");
      setSystemProposedEndsAt(isoDateInputValue(active?.proposed_ends_at) || "");
      setSystemNote(String(active?.note || ""));
      setSystemPromoDraftId(String(active?.id || ""));
    } catch {
      setSystemPromo(null);
      setSystemHistory([]);
      setUserPromos([]);
    } finally {
      setPromoLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPromo();
  }, [loadPromo]);

  async function saveSystemPromo() {
    setPromoSaving(true);
    try {
      const { data, error } = await invokeWithAuth("admin-api", {
        body: {
          operation: "admin-upsert-system-promo",
          id: systemPromoDraftId || null,
          starts_at: systemStartsAt ? new Date(systemStartsAt).toISOString() : null,
          proposed_ends_at: systemProposedEndsAt ? new Date(systemProposedEndsAt).toISOString() : null,
          note: systemNote || null,
        },
      });
      if (error || !data?.success) {
        addToast({
          type: "error",
          message: data?.message || error?.message || "Failed to save system promo.",
        });
        return;
      }
      addToast({ type: "success", message: "System promo saved." });
      await loadPromo();
    } catch {
      addToast({ type: "error", message: "Failed to save system promo." });
    } finally {
      setPromoSaving(false);
    }
  }

  async function endSystemPromo() {
    if (!systemPromo?.id) return;
    const ok = await confirm({
      title: "End system promo now?",
      message: "This will stop promo billing bypass immediately.",
      confirmLabel: "End promo",
      cancelLabel: "Cancel",
      danger: true,
    }).catch(() => false);
    if (!ok) return;

    setPromoSaving(true);
    try {
      const { data, error } = await invokeWithAuth("admin-api", {
        body: { operation: "admin-end-system-promo", id: systemPromo.id },
      });
      if (error || !data?.success) {
        addToast({ type: "error", message: data?.message || error?.message || "Failed to end promo." });
        return;
      }
      addToast({ type: "success", message: "System promo ended." });
      await loadPromo();
    } catch {
      addToast({ type: "error", message: "Failed to end promo." });
    } finally {
      setPromoSaving(false);
    }
  }
  async function searchUsers(q) {
    const term = String(q || "").trim();
    if (!term) {
      setUserSearchResults([]);
      return;
    }
    setUserSearchBusy(true);
    try {
      const { data, error } = await invokeWithAuth("list-users");
      if (error || !data?.success) {
        setUserSearchResults([]);
        return;
      }
      const all = Array.isArray(data.users) ? data.users : [];
      const needle = term.toLowerCase();
      const filtered = all
        .filter((u) => String(u?.role || "").toLowerCase() === "user")
        .filter((u) => {
          const hay = [
            u?.first_name || "",
            u?.last_name || "",
            u?.email || "",
            u?.id_number || "",
            u?.phone || "",
            u?.id || "",
          ]
            .join(" ")
            .toLowerCase();
          return hay.includes(needle);
        })
        .slice(0, 30);
      setUserSearchResults(filtered);
    } catch {
      setUserSearchResults([]);
    } finally {
      setUserSearchBusy(false);
    }
  }

  function openEnroll() {
    setEnrollErr("");
    setEnrollUserQuery("");
    setEnrollUserId("");
    setEnrollStartsAt("");
    setEnrollProposedEndsAt("");
    setEnrollNote("");
    setUserSearchResults([]);
    setEnrollOpen(true);
  }

  async function submitEnroll() {
    const uid = String(enrollUserId || "").trim();
    if (!uid) {
      setEnrollErr("User is required.");
      return;
    }
    setEnrollBusy(true);
    setEnrollErr("");
    try {
      const { data, error } = await invokeWithAuth("admin-api", {
        body: {
          operation: "admin-upsert-user-promo",
          user_id: uid,
          starts_at: enrollStartsAt ? new Date(enrollStartsAt).toISOString() : null,
          proposed_ends_at: enrollProposedEndsAt ? new Date(enrollProposedEndsAt).toISOString() : null,
          note: enrollNote || null,
        },
      });
      if (error || !data?.success) {
        setEnrollErr(data?.message || error?.message || "Failed to enroll user.");
        return;
      }
      addToast({ type: "success", message: "User enrolled in promo." });
      setEnrollOpen(false);
      await loadPromo();
    } catch {
      setEnrollErr("Failed to enroll user.");
    } finally {
      setEnrollBusy(false);
    }
  }

  async function endUserPromo(e) {
    const id = String(e?.id || "").trim();
    if (!id) return;
    const ok = await confirm({
      title: "End user promo now?",
      message: `End promo early for "${formatUserLabel(e?.user)}"?`,
      confirmLabel: "End promo",
      cancelLabel: "Cancel",
      danger: true,
    }).catch(() => false);
    if (!ok) return;

    try {
      const { data, error } = await invokeWithAuth("admin-api", {
        body: { operation: "admin-end-user-promo", id },
      });
      if (error || !data?.success) {
        addToast({ type: "error", message: data?.message || error?.message || "Failed to end user promo." });
        return;
      }
      addToast({ type: "success", message: "User promo ended." });
      await loadPromo();
    } catch {
      addToast({ type: "error", message: "Failed to end user promo." });
    }
  }

  async function deleteScheduledPromo(row) {
    const id = String(row?.id || "").trim();
    if (!id) return;
    const ok = await confirm({
      title: "Delete scheduled promo?",
      message: "This will permanently remove the scheduled promo.",
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
      danger: true,
    }).catch(() => false);
    if (!ok) return;

    try {
      const { data, error } = await invokeWithAuth("admin-api", {
        body: { operation: "admin-delete-scheduled-promo", id },
      });
      if (error || !data?.success) {
        addToast({ type: "error", message: data?.message || error?.message || "Failed to delete promo." });
        return;
      }
      addToast({ type: "success", message: "Scheduled promo deleted." });
      await loadPromo();
    } catch {
      addToast({ type: "error", message: "Failed to delete promo." });
    }
  }

  function loadSystemPromoIntoEditor(row) {
    setSystemStartsAt(isoDateInputValue(row?.starts_at) || "");
    setSystemProposedEndsAt(isoDateInputValue(row?.proposed_ends_at) || "");
    setSystemNote(String(row?.note || ""));
    setSystemPromoDraftId(String(row?.id || ""));
  }

  function clearSystemPromoEditor() {
    setSystemPromoDraftId("");
    setSystemStartsAt("");
    setSystemProposedEndsAt("");
    setSystemNote("");
  }

  function beginEditEnrollment(e) {
    setEditPromoErr("");
    setEditPromoId(String(e?.id || ""));
    setEditPromoStartsAt(isoDateInputValue(e?.starts_at));
    setEditPromoProposedEndsAt(isoDateInputValue(e?.proposed_ends_at));
    setEditPromoNote(String(e?.note || ""));
  }

  function cancelEditEnrollment() {
    if (editPromoBusy) return;
    setEditPromoErr("");
    setEditPromoId("");
    setEditPromoStartsAt("");
    setEditPromoProposedEndsAt("");
    setEditPromoNote("");
  }

  async function saveEditEnrollment(e) {
    if (!e?.id || !e?.user_id) return;
    setEditPromoBusy(true);
    setEditPromoErr("");
    try {
      const { data, error } = await invokeWithAuth("admin-api", {
        body: {
          operation: "admin-upsert-user-promo",
          id: String(e.id),
          user_id: String(e.user_id),
          starts_at: editPromoStartsAt ? new Date(editPromoStartsAt).toISOString() : null,
          proposed_ends_at: editPromoProposedEndsAt ? new Date(editPromoProposedEndsAt).toISOString() : null,
          note: editPromoNote || null,
        },
      });
      if (error || !data?.success) {
        setEditPromoErr(data?.message || error?.message || "Failed to update promo user.");
        return;
      }
      addToast({ type: "success", message: "Promo user updated." });
      cancelEditEnrollment();
      await loadPromo();
    } catch {
      setEditPromoErr("Failed to update promo user.");
    } finally {
      setEditPromoBusy(false);
    }
  }

  // Removal is now "end early" for campaign model.

  async function copyHost() {
    if (!host || host === "—") return;
    try {
      await navigator.clipboard.writeText(host);
      addToast({ type: "success", message: "Project host copied." });
    } catch {
      addToast({ type: "error", message: "Could not copy to clipboard." });
    }
  }

  const shortcuts = useMemo(
    () => [
      { label: "Dashboard", to: "/admin", icon: LayoutDashboard },
      { label: "Profile", to: "/admin/profile", icon: UserCircle },
      { label: "Users", to: "/admin/users", icon: Users },
      { label: "Audit logs", to: "/admin/audit-logs", icon: FileText },
      { label: "Items", to: "/admin/items", icon: Package },
      { label: "Transactions", to: "/admin/transactions", icon: ReceiptText },
      { label: "Revenue", to: "/admin/revenue", icon: Coins },
      { label: "Top up", to: "/admin/topup", icon: Wallet },
      { label: "Pricing", to: "/admin/pricing", icon: Tag },
      { label: "Notifications", to: "/admin/notifications", icon: Bell },
      { label: "Activity", to: "/admin/activity", icon: Activity },
      { label: "Sessions", to: "/admin/sessions", icon: MonitorSmartphone },
    ],
    [],
  );

  return (
    <div className="min-h-[60vh]">
      <PageSectionCard
        maxWidthClass="max-w-7xl"
        title="Settings"
        subtitle="Workspace connection, live registry snapshot, and shortcuts to admin tools."
        icon={<Settings className="w-6 h-6 text-iregistrygreen shrink-0" />}
        actions={
          <RippleButton
            type="button"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm text-gray-800 shadow-sm hover:bg-gray-50"
            onClick={() => void loadStats()}
            disabled={loadingStats}
          >
            <RefreshCw size={16} className={loadingStats ? "animate-spin" : ""} />
            Refresh snapshot
          </RippleButton>
        }
      >
        <div className="p-4 sm:p-6 space-y-8">
          <section className="rounded-2xl border border-gray-100 bg-white/90 shadow-sm p-5 sm:p-6">
            <h2 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">
              Session
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              You are signed in as{" "}
              <span className="font-medium text-gray-800">{roleLabel(user?.role)}</span>
              {user?.id ? (
                <span className="text-gray-400">
                  {" "}
                  · <span className="font-mono text-xs">{String(user.id).slice(0, 8)}…</span>
                </span>
              ) : null}
            </p>
          </section>

          <section className="rounded-2xl border border-gray-100 bg-white/90 shadow-sm p-5 sm:p-6 space-y-4">
            <h2 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">
              Connected project
            </h2>
            <p className="text-sm text-gray-600">
              This browser build talks to the Supabase project below (from{" "}
              <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">VITE_SUPABASE_URL</code>
              ). Edge function secrets and database policies are managed in Supabase, not here.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <code className="text-sm font-mono bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 text-gray-800 break-all">
                {host}
              </code>
              <button
                type="button"
                onClick={() => void copyHost()}
                disabled={!host || host === "—"}
                className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                <Copy size={14} />
                Copy host
              </button>
            </div>
          </section>

          <section className="rounded-2xl border border-gray-100 bg-white/90 shadow-sm p-5 sm:p-6 space-y-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h2 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">
                  Registry snapshot
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Counts from the database (same source as the admin dashboard).
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { key: "users_total", label: "Total users" },
                { key: "users_active", label: "Active users" },
                { key: "items_total", label: "Registered items" },
                { key: "items_stolen", label: "Stolen items", danger: true },
              ].map((row) => (
                <div
                  key={row.key}
                  className={`rounded-xl border px-4 py-3 ${
                    row.danger
                      ? "border-red-100 bg-red-50/50"
                      : "border-gray-100 bg-gray-50/60"
                  }`}
                >
                  <div className="text-xs font-medium text-gray-500">{row.label}</div>
                  <div
                    className={`text-2xl font-semibold tabular-nums mt-1 ${
                      row.danger ? "text-red-800" : "text-gray-900"
                    }`}
                  >
                    {loadingStats ? "—" : stats?.[row.key] ?? "—"}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-gray-100 bg-white/90 shadow-sm p-5 sm:p-6 space-y-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h2 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">
                  Promo mode (billing)
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  Toggle promo for the entire system, and enroll specific users with start/end dates.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <RippleButton
                  type="button"
                  className="px-4 py-2 rounded-xl border bg-white text-sm"
                  onClick={() => void loadPromo()}
                  disabled={promoLoading || promoSaving}
                >
                  Refresh
                </RippleButton>
                <RippleButton
                  type="button"
                  className="px-4 py-2 rounded-xl border bg-white text-sm"
                  onClick={clearSystemPromoEditor}
                  disabled={promoLoading || promoSaving}
                  title="Clear editor to create a new promo"
                >
                  New promo
                </RippleButton>
                <RippleButton
                  type="button"
                  className="px-4 py-2 rounded-xl bg-iregistrygreen text-white text-sm disabled:opacity-60"
                  onClick={() => void saveSystemPromo()}
                  disabled={promoLoading || promoSaving}
                >
                  {promoSaving ? "Saving…" : "Save"}
                </RippleButton>
                {systemPromo?.id ? (
                  <RippleButton
                    type="button"
                    className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm disabled:opacity-60"
                    onClick={() => void endSystemPromo()}
                    disabled={promoLoading || promoSaving}
                  >
                    End now
                  </RippleButton>
                ) : null}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-gray-50/50 p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-600">Start</label>
                  <input
                    type="datetime-local"
                    className="mt-1 w-full border rounded-xl px-3 py-2 text-sm bg-white"
                    value={systemStartsAt}
                    onChange={(e) => setSystemStartsAt(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600">Proposed end</label>
                  <input
                    type="datetime-local"
                    className="mt-1 w-full border rounded-xl px-3 py-2 text-sm bg-white"
                    value={systemProposedEndsAt}
                    onChange={(e) => setSystemProposedEndsAt(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-600">Note (optional)</label>
                <input
                  className="mt-1 w-full border rounded-xl px-3 py-2 text-sm bg-white"
                  value={systemNote}
                  onChange={(e) => setSystemNote(e.target.value)}
                  placeholder="e.g. Launch promo (2 months)"
                />
              </div>
              {systemPromo?.ended_at ? (
                <div className="text-xs text-gray-500">
                  Actual end: {new Date(systemPromo.ended_at).toLocaleString()}
                </div>
              ) : null}
            </div>

            <div className="rounded-2xl border border-gray-100 bg-white p-4 space-y-2">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h3 className="text-sm font-semibold text-gray-800">Recent promo history</h3>
                  <p className="text-xs text-gray-500">Last 5 saved promo configurations.</p>
                </div>
              </div>
              {promoLoading ? (
                <div className="text-sm text-gray-500">Loading…</div>
              ) : systemHistory.length === 0 ? (
                <div className="text-sm text-gray-500">No history yet.</div>
              ) : (
                <>
                  {/* Mobile: cards */}
                  <div className="divide-y rounded-xl border border-gray-100 overflow-hidden lg:hidden">
                    {systemHistory.map((h) => {
                      const st = promoStatusForRow(h);
                      const isScheduled = st.key === "scheduled";
                      return (
                        <div key={h.id} className="px-4 py-3 bg-gray-50/40">
                          <div className="flex items-center justify-between gap-3 flex-wrap">
                            <div className="text-sm font-medium text-gray-800">System promo</div>
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold border ${promoStatusBadgeClass(
                                st.key,
                              )}`}
                            >
                              {st.label}
                            </span>
                          </div>
                          <div className="mt-1 text-xs text-gray-500">
                            Saved: {h.created_at ? new Date(h.created_at).toLocaleString() : "—"}
                          </div>
                          <div className="mt-2 text-xs text-gray-600 space-y-1">
                            <div>
                              <span className="font-medium">Start:</span>{" "}
                              {h.starts_at ? new Date(h.starts_at).toLocaleString() : "—"}
                            </div>
                            <div>
                              <span className="font-medium">Proposed end:</span>{" "}
                              {h.proposed_ends_at ? new Date(h.proposed_ends_at).toLocaleString() : "—"}
                            </div>
                            <div>
                              <span className="font-medium">Actual end:</span>{" "}
                              {h.ended_at ? new Date(h.ended_at).toLocaleString() : "—"}
                            </div>
                            {h.note ? (
                              <div className="truncate">
                                <span className="font-medium">Note:</span> {h.note}
                              </div>
                            ) : null}
                          </div>
                          {isScheduled ? (
                            <div className="mt-3 flex items-center gap-4">
                              <button
                                type="button"
                                className="text-sm text-gray-700 hover:underline"
                                onClick={() => loadSystemPromoIntoEditor(h)}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="text-sm text-red-700 hover:underline"
                                onClick={() => void deleteScheduledPromo(h)}
                              >
                                Delete
                              </button>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>

                  {/* Large screens: table */}
                  <div className="hidden lg:block overflow-auto rounded-xl border border-gray-100">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">Status</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">Start</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">Proposed end</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">Actual end</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">Note</th>
                          <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y bg-white">
                        {systemHistory.map((h) => {
                          const st = promoStatusForRow(h);
                          const isScheduled = st.key === "scheduled";
                          return (
                            <tr key={h.id}>
                              <td className="px-4 py-3">
                                <span
                                  className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold border ${promoStatusBadgeClass(
                                    st.key,
                                  )}`}
                                >
                                  {st.label}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-gray-700">
                                {h.starts_at ? new Date(h.starts_at).toLocaleString() : "—"}
                              </td>
                              <td className="px-4 py-3 text-gray-700">
                                {h.proposed_ends_at ? new Date(h.proposed_ends_at).toLocaleString() : "—"}
                              </td>
                              <td className="px-4 py-3 text-gray-700">
                                {h.ended_at ? new Date(h.ended_at).toLocaleString() : "—"}
                              </td>
                              <td className="px-4 py-3 text-gray-700 max-w-[26rem] truncate">{h.note || "—"}</td>
                              <td className="px-4 py-3 text-right">
                                {isScheduled ? (
                                  <div className="inline-flex items-center gap-4 justify-end">
                                    <button
                                      type="button"
                                      className="text-sm text-gray-700 hover:underline"
                                      onClick={() => loadSystemPromoIntoEditor(h)}
                                    >
                                      Edit
                                    </button>
                                    <button
                                      type="button"
                                      className="text-sm text-red-700 hover:underline"
                                      onClick={() => void deleteScheduledPromo(h)}
                                    >
                                      Delete
                                    </button>
                                  </div>
                                ) : (
                                  <span className="text-xs text-gray-400">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h3 className="text-sm font-semibold text-gray-800">Promo users</h3>
                <p className="text-xs text-gray-500">
                  These enrollments bypass billing for the enrolled user’s actions.
                </p>
              </div>
              <RippleButton
                type="button"
                className="px-4 py-2 rounded-xl bg-amber-500 text-white text-sm"
                onClick={openEnroll}
                disabled={promoLoading}
              >
                Enroll user
              </RippleButton>
            </div>

            <div className="overflow-auto rounded-2xl border border-gray-100">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">User</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">Start</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">Proposed end</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">Note</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y bg-white">
                  {promoLoading ? (
                    <tr>
                      <td className="px-4 py-4 text-gray-500" colSpan={6}>
                        Loading…
                      </td>
                    </tr>
                  ) : userPromos.length === 0 ? (
                    <tr>
                      <td className="px-4 py-4 text-gray-500" colSpan={6}>
                        No user promos yet.
                      </td>
                    </tr>
                  ) : (
                    userPromos.map((e) => (
                      <tr key={e.id}>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-800 truncate">
                            {formatUserLabel(e.user)}
                          </div>
                          <div className="text-xs text-gray-500 font-mono truncate">
                            {String(e.user_id).slice(0, 8)}…
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {(() => {
                            const st = promoStatusForRow(e);
                            return (
                              <span
                                className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold border ${promoStatusBadgeClass(
                                  st.key,
                                )}`}
                              >
                                {st.label}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          {editPromoId && String(editPromoId) === String(e.id) ? (
                            <input
                              type="datetime-local"
                              className="w-full border rounded-lg px-2 py-1 text-sm bg-white"
                              value={editPromoStartsAt}
                              onChange={(ev) => setEditPromoStartsAt(ev.target.value)}
                              disabled={editPromoBusy}
                            />
                          ) : e.starts_at ? (
                            new Date(e.starts_at).toLocaleString()
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          {editPromoId && String(editPromoId) === String(e.id) ? (
                            <input
                              type="datetime-local"
                              className="w-full border rounded-lg px-2 py-1 text-sm bg-white"
                              value={editPromoProposedEndsAt}
                              onChange={(ev) => setEditPromoProposedEndsAt(ev.target.value)}
                              disabled={editPromoBusy}
                            />
                          ) : e.proposed_ends_at ? (
                            new Date(e.proposed_ends_at).toLocaleString()
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-700 max-w-[22rem]">
                          {editPromoId && String(editPromoId) === String(e.id) ? (
                            <div className="space-y-1">
                              <input
                                className="w-full border rounded-lg px-2 py-1 text-sm bg-white"
                                value={editPromoNote}
                                onChange={(ev) => setEditPromoNote(ev.target.value)}
                                disabled={editPromoBusy}
                                placeholder="Note"
                              />
                              {editPromoErr ? (
                                <div className="text-xs text-red-700">{editPromoErr}</div>
                              ) : null}
                            </div>
                          ) : (
                            <div className="truncate">{e.note || "—"}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {editPromoId && String(editPromoId) === String(e.id) ? (
                            <div className="inline-flex items-center gap-3 justify-end">
                              <button
                                type="button"
                                className="text-sm text-gray-700 hover:underline"
                                onClick={cancelEditEnrollment}
                                disabled={editPromoBusy}
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                className="text-sm text-iregistrygreen hover:underline"
                                onClick={() => void saveEditEnrollment(e)}
                                disabled={editPromoBusy}
                              >
                                {editPromoBusy ? "Saving…" : "Save"}
                              </button>
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-4 justify-end">
                              <button
                                type="button"
                                className="text-sm text-gray-700 hover:underline"
                                onClick={() => beginEditEnrollment(e)}
                                disabled={editPromoBusy || !!editPromoId}
                              >
                                Edit
                              </button>
                              {(() => {
                                const st = promoStatusForRow(e);
                                if (st.key === "scheduled") {
                                  return (
                                    <button
                                      type="button"
                                      className="text-sm text-red-700 hover:underline"
                                      onClick={() => void deleteScheduledPromo(e)}
                                      disabled={editPromoBusy || !!editPromoId}
                                    >
                                      Delete
                                    </button>
                                  );
                                }
                                return (
                                  <button
                                    type="button"
                                    className="text-sm text-red-700 hover:underline"
                                    onClick={() => void endUserPromo(e)}
                                    disabled={editPromoBusy || !!editPromoId}
                                  >
                                    End now
                                  </button>
                                );
                              })()}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {enrollOpen ? (
              <div className="rounded-2xl border border-amber-100 bg-amber-50/40 p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-gray-800">Enroll user into promo</div>
                    <div className="text-xs text-gray-600">Search and select a registered user, then set dates.</div>
                  </div>
                  <button
                    type="button"
                    className="text-sm text-gray-700 hover:underline"
                    onClick={() => setEnrollOpen(false)}
                    disabled={enrollBusy}
                  >
                    Close
                  </button>
                </div>

                {enrollErr ? (
                  <div className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl p-3">
                    {enrollErr}
                  </div>
                ) : null}

                <div>
                  <label className="text-xs text-gray-600">User</label>
                  <input
                    className="mt-1 w-full border rounded-xl px-3 py-2 text-sm bg-white"
                    value={enrollUserQuery}
                    onChange={(e) => {
                      setEnrollUserQuery(e.target.value);
                      setEnrollUserId("");
                      void searchUsers(e.target.value);
                    }}
                    placeholder="Search by name, email, ID number…"
                    disabled={enrollBusy}
                  />
                  <div className="mt-2 rounded-xl border bg-white max-h-48 overflow-auto">
                    {userSearchBusy ? (
                      <div className="px-3 py-2 text-sm text-gray-500">Searching…</div>
                    ) : userSearchResults.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-gray-500">No matches.</div>
                    ) : (
                      userSearchResults.map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          className={`w-full text-left px-3 py-2 hover:bg-gray-50 ${
                            String(enrollUserId) === String(u.id) ? "bg-emerald-50" : ""
                          }`}
                          onClick={() => {
                            setEnrollUserId(String(u.id));
                            setEnrollUserQuery(formatUserLabel(u));
                            setUserSearchResults([]);
                          }}
                        >
                          <div className="text-sm font-medium text-gray-800 truncate">
                            {formatUserLabel(u)}
                          </div>
                          <div className="text-xs text-gray-500 font-mono truncate">
                            {String(u.id).slice(0, 8)}…
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-600">Start</label>
                    <input
                      type="datetime-local"
                      className="mt-1 w-full border rounded-xl px-3 py-2 text-sm bg-white"
                      value={enrollStartsAt}
                      onChange={(e) => setEnrollStartsAt(e.target.value)}
                      disabled={enrollBusy}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">Proposed end</label>
                    <input
                      type="datetime-local"
                      className="mt-1 w-full border rounded-xl px-3 py-2 text-sm bg-white"
                      value={enrollProposedEndsAt}
                      onChange={(e) => setEnrollProposedEndsAt(e.target.value)}
                      disabled={enrollBusy}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-gray-600">Note (optional)</label>
                  <input
                    className="mt-1 w-full border rounded-xl px-3 py-2 text-sm bg-white"
                    value={enrollNote}
                    onChange={(e) => setEnrollNote(e.target.value)}
                    placeholder="e.g. 60-day launch promo"
                    disabled={enrollBusy}
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <RippleButton
                    type="button"
                    className="px-4 py-2 rounded-xl border bg-white text-sm"
                    onClick={() => setEnrollOpen(false)}
                    disabled={enrollBusy}
                  >
                    Cancel
                  </RippleButton>
                  <RippleButton
                    type="button"
                    className="px-4 py-2 rounded-xl bg-amber-600 text-white text-sm disabled:opacity-60"
                    onClick={() => void submitEnroll()}
                    disabled={enrollBusy}
                  >
                    {enrollBusy ? "Saving…" : "Enroll"}
                  </RippleButton>
                </div>
              </div>
            ) : null}
          </section>

          <section className="rounded-2xl border border-gray-100 bg-white/90 shadow-sm p-5 sm:p-6 space-y-4">
            <h2 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">
              Administration
            </h2>
            <p className="text-sm text-gray-600">
              Jump to tools for users, billing, security, and registry content. Use{" "}
              <span className="font-medium text-gray-800">Pricing</span> for credit packages and{" "}
              <span className="font-medium text-gray-800">Audit logs</span> for auth and session
              events.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {shortcuts.map((a) => (
                <button
                  key={a.to}
                  type="button"
                  onClick={() => navigate(a.to)}
                  className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white px-4 py-3 text-left text-sm text-gray-800 hover:bg-emerald-50/40 hover:border-emerald-100 transition-colors"
                >
                  <a.icon size={18} className="text-iregistrygreen shrink-0" />
                  <span className="font-medium truncate">{a.label}</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      </PageSectionCard>
    </div>
  );
}
