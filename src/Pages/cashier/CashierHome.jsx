import { Link } from "react-router-dom";
import { useState } from "react";
import {
  Banknote,
  Users,
  Package,
  ClipboardList,
  ChevronRight,
  TrendingUp,
  ShieldAlert,
  PieChart,
} from "lucide-react";
import { useDashboard } from "../../hooks/useDashboard.js";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { useNotificationCenter } from "../../contexts/NotificationContext.jsx";
import RippleButton from "../../components/RippleButton.jsx";
import TimeAgo from "../../components/TimeAgo.jsx";
import { formatBwpCurrency } from "../../lib/formatBWP.js";

export default function CashierHome() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const { data, loading, error, refresh } = useDashboard({ page, limit: 8 });

  const adminOverview = data?.roleData?.adminOverview;
  const cashierOverview = data?.roleData?.cashierOverview;
  const roleActivity = data?.roleData?.roleActivity?.data ?? [];
  const activityPagination = data?.roleData?.roleActivity?.pagination;
  const totalPages = activityPagination?.totalPages ?? 1;
  const activityOthersTotal = activityPagination?.total;

  const { total: notifTotal, unread } = useNotificationCenter();

  const displayName = [user?.first_name, user?.last_name].filter(Boolean).join(" ").trim();

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-iregistrygreen">
            <Banknote className="w-6 h-6" />
          </span>
          Cashier overview
        </h1>
        <p className="text-gray-500 mt-2 max-w-2xl">
          Financial snapshot of the registry—estimated asset values from registrations, account volumes, and
          compliance signals. Operations mirror the admin view, tuned for front-desk and treasury workflows.
        </p>
      </div>

      {loading && (
        <div className="space-y-4 animate-pulse">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-28 bg-gray-200 rounded-xl" />
            ))}
          </div>
          <div className="h-56 bg-gray-200 rounded-2xl" />
        </div>
      )}

      {!loading && error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-sm text-red-800">{error}</div>
      )}

      {!loading && !error && (
        <>
          <div className="bg-gradient-to-r from-emerald-50/90 to-white border border-emerald-100/80 rounded-2xl p-5 sm:p-6 shadow-sm">
            <p className="text-sm text-gray-800">
              Welcome{displayName ? `, ${displayName}` : ""}. Use <strong>Items</strong> to assist with registrations
              and valuations; totals below aggregate <strong>estimated values</strong> stored on item records.
            </p>
            <div className="mt-4 flex flex-wrap gap-3 text-sm">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/90 text-emerald-900 px-3 py-1.5 border border-emerald-100 shadow-sm">
                <span className="font-semibold tabular-nums">{unread}</span>
                unread notifications
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/80 text-gray-700 px-3 py-1.5 border border-gray-100">
                <span className="font-medium tabular-nums">{notifTotal}</span>
                in inbox
              </span>
            </div>
          </div>

          {/* Primary financial + volume metrics (admin-style grid) */}
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
              Registry value &amp; volume
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                icon={<Banknote size={18} />}
                label="Total estimated value"
                value={formatBwpCurrency(cashierOverview?.totalEstimatedValue)}
                hint="Sum of estimated values on all active items"
                accent="bg-emerald-600"
              />
              <StatCard
                icon={<TrendingUp size={18} />}
                label="Average estimate"
                value={
                  cashierOverview?.itemsWithEstimate > 0
                    ? formatBwpCurrency(cashierOverview?.averageEstimatedValue)
                    : "—"
                }
                hint="Among items with a valuation"
                accent="bg-teal-600"
              />
              <StatCard
                icon={<PieChart size={18} />}
                label="Items with valuation"
                value={
                  cashierOverview?.itemsWithEstimate != null
                    ? cashierOverview.itemsWithEstimate
                    : "—"
                }
                hint="Records with a non-empty estimate"
                accent="bg-iregistrygreen"
              />
              <StatCard
                icon={<Package size={18} />}
                label="Registered items"
                value={adminOverview?.totalItems ?? "—"}
                hint="All non-deleted registrations"
                accent="bg-slate-600"
              />
            </div>
          </section>

          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
              Accounts &amp; risk
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                icon={<Users size={18} />}
                label="Active accounts"
                value={cashierOverview?.activeUsers ?? "—"}
                hint="Users with status active"
                accent="bg-emerald-700"
              />
              <StatCard
                icon={<Users size={18} />}
                label="Total user records"
                value={adminOverview?.totalUsers ?? "—"}
                hint="Including non-active"
                accent="bg-gray-600"
              />
              <StatCard
                icon={<ShieldAlert size={18} />}
                label="High-severity audits"
                value={cashierOverview?.highSeverityAudits ?? "—"}
                hint="Flags worth supervisor review"
                accent="bg-red-600"
                danger
              />
              <StatCard
                icon={<ClipboardList size={18} />}
                label="Logged events (others)"
                value={activityOthersTotal != null ? activityOthersTotal : "—"}
                hint="Rows in the shared activity stream"
                accent="bg-indigo-600"
              />
            </div>
          </section>

          <div className="flex flex-wrap gap-3">
            <Link
              to="/cashierdashboard/items"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-iregistrygreen text-white text-sm font-medium hover:opacity-90 shadow-sm"
            >
              <Package size={18} />
              Items &amp; valuations
              <ChevronRight size={16} />
            </Link>
            <Link
              to="/cashierdashboard/notifications"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-800 text-sm font-medium hover:bg-gray-50"
            >
              Notifications
              <ChevronRight size={16} />
            </Link>
            <Link
              to="/cashierdashboard/activity"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-800 text-sm font-medium hover:bg-gray-50"
            >
              Full activity
              <ChevronRight size={16} />
            </Link>
            <RippleButton
              className="px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-700 text-sm"
              onClick={() => refresh()}
            >
              Refresh data
            </RippleButton>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center gap-2 text-sm uppercase tracking-wide text-gray-500 font-medium mb-4">
              <ClipboardList size={18} />
              Recent activity (others)
            </div>

            {roleActivity.length === 0 && (
              <p className="text-sm text-gray-400">No recent activity from other users yet.</p>
            )}

            {roleActivity.length > 0 && (
              <ul className="space-y-3">
                {roleActivity.map((a) => (
                  <li key={a.id} className="flex justify-between gap-4 border-b border-gray-50 pb-3 last:border-0">
                    <div className="min-w-0">
                      <p className="text-sm text-gray-800">{a.message}</p>
                      {a.entity_name && (
                        <p className="text-xs text-gray-400 truncate mt-0.5">{a.entity_name}</p>
                      )}
                    </div>
                    <div className="text-xs text-gray-400 whitespace-nowrap">
                      <TimeAgo date={a.created_at} />
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                <RippleButton
                  className="px-3 py-1.5 rounded-lg border text-sm disabled:opacity-40"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </RippleButton>
                <span className="text-xs text-gray-500">
                  Page {page} of {totalPages}
                </span>
                <RippleButton
                  className="px-3 py-1.5 rounded-lg border text-sm disabled:opacity-40"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </RippleButton>
              </div>
            )}

            <div className="mt-4 text-right">
              <Link to="/cashierdashboard/activity" className="text-sm text-iregistrygreen hover:underline">
                Open full activity log
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, hint, accent, danger }) {
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 relative overflow-hidden">
      <div className={`absolute left-0 top-0 h-full w-1 ${accent}`} />
      <div className="flex items-start justify-between gap-2 pl-1">
        <div className="min-w-0">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
          <p
            className={`text-2xl font-bold mt-1 tabular-nums truncate ${
              danger ? "text-red-600" : "text-gray-900"
            }`}
          >
            {value}
          </p>
          {hint ? <p className="text-xs text-gray-400 mt-1 leading-snug">{hint}</p> : null}
        </div>
        <span className="text-gray-400 shrink-0 mt-0.5">{icon}</span>
      </div>
    </div>
  );
}
