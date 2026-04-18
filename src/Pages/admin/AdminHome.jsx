// src/Pages/admin/AdminHome.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { RefreshCw, Users, Package, Bell, Activity, ReceiptText, Coins, MonitorSmartphone, Tag, AlertTriangle } from "lucide-react";
import { invokeWithAuth } from "../../lib/invokeWithAuth.js";
import DashboardAlertsPanel from "../../components/DashboardAlertsPanel.jsx";

export default function AdminHome() {
  const navigate = useNavigate();

  const [stats, setStats] = useState(null); // from stats(mode=admin)
  const [dashboard, setDashboard] = useState(null); // from get-dashboard-data (alerts, activity)
  const [paymentAttention, setPaymentAttention] = useState({ pending: [], failed: [] });
  const [suspendedUsers, setSuspendedUsers] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    setError("");

    try {
      // Primary source for alerts + activity
      const dashReq = invokeWithAuth("get-dashboard-data", { body: { limit: 6, page: 1 } });

      // Stats function expects a query param. Supabase functions.invoke supports passing it via name.
      // If this ever fails, we still render the dashboard using get-dashboard-data.
      const statsReq = invokeWithAuth("stats?mode=admin");

      const paymentsReq = invokeWithAuth("list-payments", { body: { user_id: null, limit: 200, offset: 0 } });
      const usersReq = invokeWithAuth("list-users");

      const [dashRes, statsRes, paymentsRes, usersRes] = await Promise.allSettled([
        dashReq,
        statsReq,
        paymentsReq,
        usersReq,
      ]);

      if (dashRes.status === "fulfilled") {
        const { data, error } = dashRes.value;
        if (error || !data?.success) throw new Error(data?.message || error?.message || "Failed to load dashboard");
        setDashboard(data);
      }

      if (statsRes.status === "fulfilled") {
        const { data } = statsRes.value;
        if (data?.success && data?.data) {
          setStats(data.data);
        } else {
          setStats(null);
        }
      } else {
        setStats(null);
      }

      if (paymentsRes.status === "fulfilled") {
        const { data, error } = paymentsRes.value;
        if (error || !data?.success) throw new Error(data?.message || error?.message || "Failed to load payments");
        const all = Array.isArray(data?.payments) ? data.payments : [];
        const pending = all.filter((p) => String(p?.status || "").toUpperCase() === "PENDING");
        const failed = all.filter((p) => String(p?.status || "").toUpperCase() === "FAILED");
        setPaymentAttention({ pending: pending.slice(0, 8), failed: failed.slice(0, 8) });
      } else {
        setPaymentAttention({ pending: [], failed: [] });
      }

      if (usersRes.status === "fulfilled") {
        const { data, error } = usersRes.value;
        if (error || !data?.success) throw new Error(data?.message || error?.message || "Failed to load users");
        const all = Array.isArray(data?.users) ? data.users : [];
        const susp = all.filter((u) => {
          const st = String(u?.status || "").toLowerCase();
          return st === "suspended" || st === "disabled";
        });
        setSuspendedUsers(susp.slice(0, 8));
      } else {
        setSuspendedUsers([]);
      }

    } catch (err) {
      console.error("Failed to load admin dashboard", err);
      setError(err?.message || "Failed to load dashboard");
      setDashboard(null);
    } finally {
      setLoading(false);
    }
  }

  const roleActivity = dashboard?.roleData?.roleActivity?.data || [];
  const alerts = dashboard?.personal?.alerts || [];

  const statCards = useMemo(() => {
    const fallbackUsers = dashboard?.roleData?.adminOverview?.totalUsers;
    const fallbackItems = dashboard?.roleData?.adminOverview?.totalItems;

    const usersTotal = stats?.users_total ?? (typeof fallbackUsers === "number" ? fallbackUsers : null);
    const usersActive = stats?.users_active ?? null;
    const itemsTotal = stats?.items_total ?? (typeof fallbackItems === "number" ? fallbackItems : null);
    const itemsStolen = stats?.items_stolen ?? null;

    return [
      { label: "Total users", value: usersTotal, icon: Users },
      { label: "Active users", value: usersActive, icon: Users },
      { label: "Registered items", value: itemsTotal, icon: Package },
      { label: "Stolen items", value: itemsStolen, icon: Package, danger: true },
    ];
  }, [dashboard, stats]);

  return (
    <div className="max-w-7xl mx-auto w-full">
      <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="border-b border-emerald-100/80 bg-gradient-to-r from-emerald-50/95 via-emerald-50/80 to-emerald-50/60 px-4 sm:px-6 lg:px-8 py-5 sm:py-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-iregistrygreen tracking-tight">Admin overview</h1>
              <p className="text-sm text-gray-500 mt-1">Live system stats and required actions.</p>
            </div>
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-emerald-200/80 bg-white/90 text-sm font-medium text-gray-700 shadow-sm hover:bg-white disabled:opacity-50"
              disabled={loading}
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
              {loading ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </div>

        <div className="px-4 sm:px-6 lg:px-8 py-5 sm:py-8 space-y-6 bg-gradient-to-b from-white to-gray-50/40">
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 text-red-800 px-4 py-3 text-sm">
          {error}
        </div>
      ) : null}

      <section className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {statCards.map((c) => (
          <StatCard
            key={c.label}
            label={c.label}
            value={loading ? "—" : (c.value ?? "—")}
            icon={c.icon}
            danger={c.danger}
          />
        ))}
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7 space-y-4">
          <AdminTransfersShortcut />
          <AttentionPaymentsCard
            loading={loading}
            pending={paymentAttention.pending}
            failed={paymentAttention.failed}
            onGoPayments={() => navigate("/admin/transactions")}
          />
          <SuspendedUsersCard
            loading={loading}
            users={suspendedUsers}
            onGoUsers={() => navigate("/admin/users")}
          />
          <QuickActions onGo={(to) => navigate(to)} />
        </div>

        <div className="lg:col-span-5 space-y-4">
          <DashboardAlertsPanel alerts={alerts} />
          <RecentActivityCard
            events={roleActivity}
            loading={loading}
            onGoActivity={() => navigate("/admin/activity")}
          />
        </div>
      </section>
        </div>
      </div>
    </div>
  );
}

/* =========================
   Stat Card
   ========================= */
function AdminTransfersShortcut() {
  const navigate = useNavigate();
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-gray-800">Transfer requests</div>
          <p className="text-xs text-gray-500 mt-0.5">
            Review individual (P2P) and organization-assisted transfers in one place.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/admin/transfers")}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold shadow-sm hover:bg-emerald-700"
        >
          Open transfers
        </button>
      </div>
    </div>
  );
}

function StatCard({ label, value, danger, icon: Icon }) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-gray-500 font-medium">{label}</p>
          <p className={`text-2xl font-bold mt-1 tabular-nums ${danger ? "text-red-600" : "text-gray-900"}`}>
            {value}
          </p>
        </div>
        {Icon ? (
          <div className={`shrink-0 rounded-xl p-2 ${danger ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-700"}`}>
            <Icon size={18} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function QuickActions({ onGo }) {
  const actions = [
    { label: "Manage users", to: "/admin/users", icon: Users },
    { label: "Items", to: "/admin/items", icon: Package },
    { label: "Transactions", to: "/admin/transactions", icon: ReceiptText },
    { label: "Revenue", to: "/admin/revenue", icon: Coins },
    { label: "Sessions", to: "/admin/sessions", icon: MonitorSmartphone },
    { label: "Pricing", to: "/admin/pricing", icon: Tag },
    { label: "Notifications", to: "/admin/notifications", icon: Bell },
    { label: "Activity", to: "/admin/activity", icon: Activity },
  ];

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
      <div className="text-sm uppercase tracking-wide text-gray-500 mb-4">Quick actions</div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {actions.map((a) => (
          <button
            key={a.to}
            type="button"
            onClick={() => onGo(a.to)}
            className="flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm text-gray-800 hover:bg-gray-50"
          >
            <a.icon size={16} className="text-gray-500" />
            <span className="truncate">{a.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function RecentActivityCard({ events, loading, onGoActivity }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="text-sm uppercase tracking-wide text-gray-500">Recent activity</div>
        <button type="button" onClick={onGoActivity} className="text-sm text-iregistrygreen hover:underline">
          View all
        </button>
      </div>
      {loading ? (
        <div className="text-sm text-gray-400">Loading…</div>
      ) : !events || events.length === 0 ? (
        <div className="text-sm text-gray-400">No recent activity.</div>
      ) : (
        <div className="space-y-2">
          {events.slice(0, 6).map((e) => (
            <div key={e.id} className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
              <div className="text-sm text-gray-800 font-medium truncate">{e.entity_name || e.entity_type || "Activity"}</div>
              <div className="text-xs text-gray-500 mt-0.5 truncate">{e.message || e.action}</div>
              <div className="text-[11px] text-gray-400 mt-1">
                {e.created_at ? new Date(e.created_at).toLocaleString() : ""}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AttentionPaymentsCard({ loading, pending, failed, onGoPayments }) {
  const total = (pending?.length || 0) + (failed?.length || 0);
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <AlertTriangle size={16} className="text-amber-500" />
          <div className="text-sm uppercase tracking-wide text-gray-500">Payments needing attention</div>
        </div>
        <button type="button" onClick={onGoPayments} className="text-sm text-iregistrygreen hover:underline">
          Open
        </button>
      </div>
      {loading ? (
        <div className="text-sm text-gray-400">Loading…</div>
      ) : total === 0 ? (
        <div className="text-sm text-gray-400">No pending or failed payments.</div>
      ) : (
        <div className="space-y-3">
          {pending?.length ? (
            <div>
              <div className="text-xs font-semibold text-amber-700 mb-1">Pending ({pending.length})</div>
              <div className="space-y-1">
                {pending.slice(0, 3).map((p) => (
                  <div key={p.id} className="text-sm text-gray-700 truncate">
                    {p.channel} • {p.currency} {p.amount} • {p.users ? `${p.users.first_name || ""} ${p.users.last_name || ""}`.trim() : p.user_id}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {failed?.length ? (
            <div>
              <div className="text-xs font-semibold text-red-700 mb-1">Failed ({failed.length})</div>
              <div className="space-y-1">
                {failed.slice(0, 3).map((p) => (
                  <div key={p.id} className="text-sm text-gray-700 truncate">
                    {p.channel} • {p.currency} {p.amount} • {p.users ? `${p.users.first_name || ""} ${p.users.last_name || ""}`.trim() : p.user_id}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          <div className="pt-1">
            <button
              type="button"
              onClick={onGoPayments}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border bg-white text-sm hover:bg-gray-50"
            >
              Review payments
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SuspendedUsersCard({ loading, users, onGoUsers }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="text-sm uppercase tracking-wide text-gray-500">Suspended / disabled users</div>
        <button type="button" onClick={onGoUsers} className="text-sm text-iregistrygreen hover:underline">
          Open
        </button>
      </div>
      {loading ? (
        <div className="text-sm text-gray-400">Loading…</div>
      ) : !users || users.length === 0 ? (
        <div className="text-sm text-gray-400">No suspended users.</div>
      ) : (
        <div className="space-y-2">
          {users.slice(0, 5).map((u) => {
            const name = `${String(u?.first_name || "").trim()} ${String(u?.last_name || "").trim()}`.trim();
            const label = name || u?.email || u?.id_number || u?.id;
            const st = String(u?.status || "").toLowerCase();
            return (
              <div key={u.id} className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
                <div className="min-w-0">
                  <div className="text-sm text-gray-800 font-medium truncate">{label}</div>
                  <div className="text-xs text-gray-500 truncate">{u.email || u.phone || u.id_number || u.id}</div>
                </div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${st === "disabled" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800"}`}>
                  {st || "—"}
                </span>
              </div>
            );
          })}
          <div className="pt-1">
            <button
              type="button"
              onClick={onGoUsers}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border bg-white text-sm hover:bg-gray-50"
            >
              Manage users
            </button>
          </div>
        </div>
      )}
    </div>
  );
}