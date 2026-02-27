// src/Pages/UserDashboard.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import RippleButton from "../components/RippleButton.jsx";
import { useDashboard } from "../hooks/useDashboard";

function useCountUp(target = 0, duration = 800) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    let start = 0;
    const increment = target / (duration / 16);

    const timer = setInterval(() => {
      start += increment;

      if (start >= target) {
        setValue(target);
        clearInterval(timer);
      } else {
        setValue(Math.floor(start));
      }
    }, 16);

    return () => clearInterval(timer);
  }, [target, duration]);

  return value;
}

export default function UserDashboard() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const { data, loading } = useDashboard({limit: 5, page,});
  const { user } = useAuth();

  // ===== Derived Stats =====
  const summary = data?.personal?.summary || {};

  const activeCount = summary.activeItems || 0;
  const stolenCount = summary.stolenItems || 0;
  const notifTotal = summary.notifications || 0;
  const unread = summary.unreadNotifications || 0;

  const activeAnimated = useCountUp(activeCount);
  const stolenAnimated = useCountUp(stolenCount);
  const notifAnimated = useCountUp(notifTotal);

  const activity = data?.personal?.activity?.data || [];
  const activityLoading = loading;

  const pagination = data?.personal?.activity?.pagination;
  const totalPages = pagination?.totalPages || 1;

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">

        {/* ===== Welcome Section ===== */}
        <div className="space-y-1 animate-fade-up">
          <h1 className="text-3xl font-semibold text-gray-900">
            Welcome back{user?.last_name ? `, ${user.last_name}` : ""} 👋
          </h1>
          <p className="text-gray-500 text-sm">
            Here’s a snapshot of your asset portfolio
          </p>
        </div>

        {/* ===== Summary Cards ===== */}
        <div className="space-y-4">

          {/* Active */}
          <div className="bg-white rounded-2xl shadow-sm hover:shadow-md transition border border-gray-100 relative overflow-hidden">
            <div className="absolute left-0 top-0 h-full w-1.5 bg-emerald-500" />
            <div className="flex items-center justify-between px-6 py-5">
              <div>
                <div className="text-sm uppercase tracking-wide text-gray-500">
                  Active Items
                </div>
                <div className="text-xs text-gray-400">
                  Secure and verified
                </div>
              </div>
              <div className="text-3xl font-bold text-emerald-600">
                {activeAnimated}
              </div>
            </div>
          </div>

          {/* Stolen */}
          <div
            className={`bg-white rounded-2xl shadow-sm hover:shadow-md transition border border-gray-100 relative overflow-hidden ${
              stolenCount > 0 ? "bg-red-50/40" : ""
            }`}
          >
            <div className="absolute left-0 top-0 h-full w-1.5 bg-red-500" />
            <div className="flex items-center justify-between px-6 py-5">
              <div>
                <div className="text-sm uppercase tracking-wide text-gray-500">
                  Stolen Items
                </div>
                <div className="text-xs text-gray-400">
                  Requires attention
                </div>
              </div>
              <div className="text-3xl font-bold text-red-600">
                {stolenAnimated}
              </div>
            </div>
          </div>

          {/* Notifications */}
          <div className="bg-white rounded-2xl shadow-sm hover:shadow-md transition border border-gray-100 relative overflow-hidden">
            <div className="absolute left-0 top-0 h-full w-1.5 bg-amber-700" />
            <div className="flex items-center justify-between px-6 py-5">
              <div>
                <div className="text-sm uppercase tracking-wide text-gray-700">
                  Notifications
                </div>
                <div className="text-sm text-gray-400 mt-1">
                  {unread > 0
                    ? `${unread} unread alert${unread > 1 ? "s" : ""}`
                    : "All caught up"}
                </div>
              </div>
              <div className="text-3xl font-bold text-amber-600">
                {notifAnimated}
              </div>
            </div>
          </div>
        </div>

        {/* ===== Bottom Grid ===== */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Quick Actions */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
            <div className="text-sm uppercase tracking-wide text-gray-500">
              Quick Actions
            </div>

            <div className="space-y-3">
              <RippleButton
                className="w-full py-2 rounded-xl bg-iregistrygreen text-white font-medium"
                onClick={() => navigate("/items/add")}
              >
                + Register New Item
              </RippleButton>

              <RippleButton
                className="w-full py-2 rounded-xl bg-gray-100 text-gray-800"
                onClick={() => navigate("/items")}
              >
                View My Items
              </RippleButton>

              <RippleButton
                className="w-full py-2 rounded-xl bg-red-600 text-white"
                onClick={() => navigate("/items")}
              >
                Report Theft
              </RippleButton>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">

            <div className="text-sm uppercase tracking-wide text-gray-500 font-medium mb-4">
              Recent Activity
            </div>

            {activityLoading && (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-4 bg-gray-200 rounded animate-pulse" />
                ))}
              </div>
            )}

            {!activityLoading && activity.length === 0 && (
              <div className="text-sm text-gray-400">
                No recent activity.
              </div>
            )}

            {!activityLoading && activity.length > 0 && (
              <>
                <div className="space-y-3 text-sm">
                  {activity.map((a, index) => (
                    <div
                      key={index}
                      className="flex justify-between items-start border-b border-gray-50 pb-2 last:border-none"
                    >
                      <div className="text-gray-700">
                        {a.message}
                      </div>

                      <div className="text-xs text-gray-400 whitespace-nowrap ml-4">
                        {new Date(a.created_at).toLocaleDateString("en-BW", {
                          day: "2-digit",
                          month: "short",
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                {!activityLoading && totalPages > 1 && (
                  <div className="pt-4">
                    <RippleButton
                      className="w-full py-2 rounded-xl bg-gray-100 text-gray-800 text-sm hover:bg-gray-200 transition"
                      onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                    >
                      {page < totalPages ? "Load More Activity" : "All Activity Loaded"}
                    </RippleButton>
                  </div>
                )}
              </>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}