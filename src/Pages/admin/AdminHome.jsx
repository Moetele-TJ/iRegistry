// src/Pages/admin/AdminHome.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { RefreshCw, Users, Package, Bell, Activity, ReceiptText, Coins, MonitorSmartphone, Tag } from "lucide-react";
import { useAdminSidebar } from "../../hooks/useAdminSidebar";
import { invokeWithAuth } from "../../lib/invokeWithAuth.js";
import DashboardAlertsPanel from "../../components/DashboardAlertsPanel.jsx";
import PendingTransferRequests from "../../components/PendingTransferRequests.jsx";

export default function AdminHome() {
  useAdminSidebar();
  const navigate = useNavigate();

  const [stats, setStats] = useState(null); // from stats(mode=admin)
  const [dashboard, setDashboard] = useState(null); // from get-dashboard-data (alerts, activity)

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

      const [dashRes, statsRes] = await Promise.allSettled([dashReq, statsReq]);

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
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin overview</h1>
          <p className="text-sm text-gray-500 mt-1">Live system stats and required actions.</p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border bg-white text-sm hover:bg-gray-50 disabled:opacity-50"
          disabled={loading}
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

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
          <PendingTransferRequests />
          <QuickActions onGo={(to) => navigate(to)} />
        </div>

        <div className="lg:col-span-5 space-y-4">
          <DashboardAlertsPanel alerts={alerts} />
          <RecentActivityCard
            events={roleActivity}
            loading={loading}
            onGoActivity={() => navigate("/admindashboard/activity")}
          />
        </div>
      </section>
    </div>
  );
}

/* =========================
   Stat Card
   ========================= */
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
    { label: "Manage users", to: "/admindashboard/users", icon: Users },
    { label: "Items", to: "/admindashboard/items", icon: Package },
    { label: "Transactions", to: "/admindashboard/transactions", icon: ReceiptText },
    { label: "Revenue", to: "/admindashboard/revenue", icon: Coins },
    { label: "Sessions", to: "/admindashboard/sessions", icon: MonitorSmartphone },
    { label: "Pricing", to: "/admindashboard/pricing", icon: Tag },
    { label: "Notifications", to: "/admindashboard/notifications", icon: Bell },
    { label: "Activity", to: "/admindashboard/activity", icon: Activity },
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