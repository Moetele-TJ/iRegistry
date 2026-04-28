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

  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);

  const [promoLoading, setPromoLoading] = useState(true);
  const [promoSaving, setPromoSaving] = useState(false);
  const [promoConfig, setPromoConfig] = useState({
    enabled: false,
    starts_at: null,
    ends_at: null,
    note: "",
  });
  const [promoUsers, setPromoUsers] = useState([]);

  const [enrollOpen, setEnrollOpen] = useState(false);
  const [enrollBusy, setEnrollBusy] = useState(false);
  const [enrollErr, setEnrollErr] = useState("");
  const [enrollUserQuery, setEnrollUserQuery] = useState("");
  const [enrollUserId, setEnrollUserId] = useState("");
  const [enrollStartsAt, setEnrollStartsAt] = useState("");
  const [enrollEndsAt, setEnrollEndsAt] = useState("");
  const [enrollNote, setEnrollNote] = useState("");
  const [userSearchBusy, setUserSearchBusy] = useState(false);
  const [userSearchResults, setUserSearchResults] = useState([]);

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
        setPromoConfig({ enabled: false, starts_at: null, ends_at: null, note: "" });
        setPromoUsers([]);
        return;
      }
      const cfg = data.config || {};
      setPromoConfig({
        enabled: !!cfg.enabled,
        starts_at: cfg.starts_at ?? null,
        ends_at: cfg.ends_at ?? null,
        note: cfg.note || "",
      });
      setPromoUsers(Array.isArray(data.enrollments) ? data.enrollments : []);
    } catch {
      setPromoConfig({ enabled: false, starts_at: null, ends_at: null, note: "" });
      setPromoUsers([]);
    } finally {
      setPromoLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPromo();
  }, [loadPromo]);

  async function savePromoConfig() {
    setPromoSaving(true);
    try {
      const { data, error } = await invokeWithAuth("admin-api", {
        body: {
          operation: "admin-set-promo-config",
          enabled: !!promoConfig.enabled,
          starts_at: promoConfig.starts_at || null,
          ends_at: promoConfig.ends_at || null,
          note: promoConfig.note || null,
        },
      });
      if (error || !data?.success) {
        addToast({
          type: "error",
          message: data?.message || error?.message || "Failed to save promo settings.",
        });
        return;
      }
      addToast({ type: "success", message: "Promo settings saved." });
      await loadPromo();
    } catch {
      addToast({ type: "error", message: "Failed to save promo settings." });
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
    setEnrollEndsAt("");
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
          operation: "admin-upsert-promo-user",
          user_id: uid,
          starts_at: enrollStartsAt ? new Date(enrollStartsAt).toISOString() : null,
          ends_at: enrollEndsAt ? new Date(enrollEndsAt).toISOString() : null,
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

  async function removeEnrollment(id) {
    const eid = String(id || "").trim();
    if (!eid) return;
    try {
      const { data, error } = await invokeWithAuth("admin-api", {
        body: { operation: "admin-delete-promo-user", id: eid },
      });
      if (error || !data?.success) {
        addToast({
          type: "error",
          message: data?.message || error?.message || "Failed to remove promo user.",
        });
        return;
      }
      addToast({ type: "success", message: "Promo user removed." });
      await loadPromo();
    } catch {
      addToast({ type: "error", message: "Failed to remove promo user." });
    }
  }

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
                  className="px-4 py-2 rounded-xl bg-iregistrygreen text-white text-sm disabled:opacity-60"
                  onClick={() => void savePromoConfig()}
                  disabled={promoLoading || promoSaving}
                >
                  {promoSaving ? "Saving…" : "Save"}
                </RippleButton>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-gray-50/50 p-4 space-y-3">
              <label className="flex items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={!!promoConfig.enabled}
                  onChange={(e) =>
                    setPromoConfig((c) => ({ ...c, enabled: e.target.checked }))
                  }
                />
                <span className="font-medium text-gray-800">
                  Enable system promo mode
                </span>
                <span className="text-xs text-gray-500">
                  (bypasses credit charges)
                </span>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-600">Promo starts (optional)</label>
                  <input
                    type="datetime-local"
                    className="mt-1 w-full border rounded-xl px-3 py-2 text-sm bg-white"
                    value={isoDateInputValue(promoConfig.starts_at)}
                    onChange={(e) =>
                      setPromoConfig((c) => ({
                        ...c,
                        starts_at: e.target.value
                          ? new Date(e.target.value).toISOString()
                          : null,
                      }))
                    }
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600">Promo ends (optional)</label>
                  <input
                    type="datetime-local"
                    className="mt-1 w-full border rounded-xl px-3 py-2 text-sm bg-white"
                    value={isoDateInputValue(promoConfig.ends_at)}
                    onChange={(e) =>
                      setPromoConfig((c) => ({
                        ...c,
                        ends_at: e.target.value
                          ? new Date(e.target.value).toISOString()
                          : null,
                      }))
                    }
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-600">Note (optional)</label>
                <input
                  className="mt-1 w-full border rounded-xl px-3 py-2 text-sm bg-white"
                  value={promoConfig.note || ""}
                  onChange={(e) =>
                    setPromoConfig((c) => ({ ...c, note: e.target.value }))
                  }
                  placeholder="e.g. Launch promo (2 months)"
                />
              </div>
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
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">Start</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">End</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">Note</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y bg-white">
                  {promoLoading ? (
                    <tr>
                      <td className="px-4 py-4 text-gray-500" colSpan={5}>
                        Loading…
                      </td>
                    </tr>
                  ) : promoUsers.length === 0 ? (
                    <tr>
                      <td className="px-4 py-4 text-gray-500" colSpan={5}>
                        No promo users enrolled.
                      </td>
                    </tr>
                  ) : (
                    promoUsers.map((e) => (
                      <tr key={e.id}>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-800 truncate">
                            {formatUserLabel(e.user)}
                          </div>
                          <div className="text-xs text-gray-500 font-mono truncate">
                            {String(e.user_id).slice(0, 8)}…
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          {e.starts_at ? new Date(e.starts_at).toLocaleString() : "—"}
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          {e.ends_at ? new Date(e.ends_at).toLocaleString() : "—"}
                        </td>
                        <td className="px-4 py-3 text-gray-700 max-w-[22rem] truncate">
                          {e.note || "—"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            className="text-sm text-red-700 hover:underline"
                            onClick={() => void removeEnrollment(e.id)}
                          >
                            Remove
                          </button>
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
                    <label className="text-xs text-gray-600">End (optional)</label>
                    <input
                      type="datetime-local"
                      className="mt-1 w-full border rounded-xl px-3 py-2 text-sm bg-white"
                      value={enrollEndsAt}
                      onChange={(e) => setEnrollEndsAt(e.target.value)}
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
