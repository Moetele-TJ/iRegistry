import { Link } from "react-router-dom";
import { useState } from "react";
import { Banknote, Users, Package, ClipboardList, ChevronRight } from "lucide-react";
import { useDashboard } from "../../hooks/useDashboard.js";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { useNotificationCenter } from "../../contexts/NotificationContext.jsx";
import RippleButton from "../../components/RippleButton.jsx";
import TimeAgo from "../../components/TimeAgo.jsx";

export default function CashierHome() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const { data, loading, error, refresh } = useDashboard({ page, limit: 8 });

  const adminOverview = data?.roleData?.adminOverview;
  const roleActivity = data?.roleData?.roleActivity?.data ?? [];
  const activityPagination = data?.roleData?.roleActivity?.pagination;
  const totalPages = activityPagination?.totalPages ?? 1;

  const { total: notifTotal, unread } = useNotificationCenter();

  const displayName = [user?.first_name, user?.last_name].filter(Boolean).join(" ").trim();

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-iregistrygreen flex items-center gap-2">
          <Banknote className="w-7 h-7" />
          Cashier dashboard
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          Registry overview and recent activity from other users. Use Items to look up or assist with registrations.
        </p>
      </div>

      {loading && (
        <div className="space-y-4 animate-pulse">
          <div className="h-24 bg-gray-200 rounded-2xl" />
          <div className="h-48 bg-gray-200 rounded-2xl" />
        </div>
      )}

      {!loading && error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-sm text-red-800">{error}</div>
      )}

      {!loading && !error && (
        <>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <p className="text-sm text-gray-700">
              Welcome{displayName ? `, ${displayName}` : ""}. You have staff access to help users with items and
              registrations.
            </p>
            <div className="mt-4 flex flex-wrap gap-3 text-sm">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 text-emerald-900 px-3 py-1.5 border border-emerald-100">
                <span className="font-medium tabular-nums">{unread}</span>
                unread notifications
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-gray-50 text-gray-700 px-3 py-1.5 border border-gray-100">
                <span className="font-medium tabular-nums">{notifTotal}</span>
                total in inbox
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 relative overflow-hidden">
              <div className="absolute left-0 top-0 h-full w-1.5 bg-emerald-600" />
              <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500 font-medium">
                <Users size={16} className="text-gray-400" />
                Users in registry
              </div>
              <div className="text-3xl font-bold text-gray-900 mt-2 tabular-nums">
                {adminOverview?.totalUsers ?? "—"}
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 relative overflow-hidden">
              <div className="absolute left-0 top-0 h-full w-1.5 bg-iregistrygreen" />
              <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500 font-medium">
                <Package size={16} className="text-gray-400" />
                Registered items
              </div>
              <div className="text-3xl font-bold text-gray-900 mt-2 tabular-nums">
                {adminOverview?.totalItems ?? "—"}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              to="/cashierdashboard/items"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-iregistrygreen text-white text-sm font-medium hover:opacity-90 shadow-sm"
            >
              <Package size={18} />
              Browse items
              <ChevronRight size={16} />
            </Link>
            <Link
              to="/cashierdashboard/notifications"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-800 text-sm font-medium hover:bg-gray-50"
            >
              Notifications
              <ChevronRight size={16} />
            </Link>
            <RippleButton
              className="px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-700 text-sm"
              onClick={() => refresh()}
            >
              Refresh
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
                Full activity log
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
