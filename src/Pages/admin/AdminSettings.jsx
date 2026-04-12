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
      { label: "Dashboard", to: "/admindashboard", icon: LayoutDashboard },
      { label: "Profile", to: "/admindashboard/profile", icon: UserCircle },
      { label: "Users", to: "/admindashboard/users", icon: Users },
      { label: "Audit logs", to: "/admindashboard/audit-logs", icon: FileText },
      { label: "Items", to: "/admindashboard/items", icon: Package },
      { label: "Transactions", to: "/admindashboard/transactions", icon: ReceiptText },
      { label: "Revenue", to: "/admindashboard/revenue", icon: Coins },
      { label: "Top up", to: "/admindashboard/topup", icon: Wallet },
      { label: "Pricing", to: "/admindashboard/pricing", icon: Tag },
      { label: "Notifications", to: "/admindashboard/notifications", icon: Bell },
      { label: "Activity", to: "/admindashboard/activity", icon: Activity },
      { label: "Sessions", to: "/admindashboard/sessions", icon: MonitorSmartphone },
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
