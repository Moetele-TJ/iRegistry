// src/Pages/UserDashboard.jsx
import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useNotificationCenter } from "../contexts/NotificationContext";
import RecentActivityPanel from "../components/RecentActivityPanel";
import PendingTransferRequests from "../components/PendingTransferRequests";
import QuickActionsPanel from "../components/QuickActionsPanel";
import DashboardAlertsPanel from "../components/DashboardAlertsPanel";
import CreditsSummaryStrip from "../components/CreditsSummaryStrip.jsx";
import { useDashboard } from "../hooks/useDashboard";
import { useAddItemPreflight } from "../hooks/useAddItemPreflight.js";
import PromoModeBanner from "../components/PromoModeBanner.jsx";

function useCountUp(target = 0, duration = 800) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    let start = 0;
    const increment = Math.max(target / (duration / 16), 1);

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
  
  const [page, setPage] = useState(1);
  const { data, loading } = useDashboard({limit: 5, page,});
  const { user } = useAuth();
  const { goToAddItem, tasksLoading: addPreflightLoading } = useAddItemPreflight();

  // ===== Derived Stats =====
  const summary = data?.personal?.summary || {};
  const alerts = data?.personal?.alerts || [];

  const activeCount = summary.activeItems || 0;
  const stolenCount = summary.stolenItems || 0;
  const { total: notifTotal, unread } = useNotificationCenter();
  const hasItems = activeCount + stolenCount > 0;

  const activeAnimated = useCountUp(activeCount);
  const stolenAnimated = useCountUp(stolenCount);
  const notifAnimated = useCountUp(notifTotal);

  const activity = data?.personal?.activity?.data || [];
  const activityLoading = loading;

  const pagination = data?.personal?.activity?.pagination;
  const totalPages = pagination?.totalPages || 1;

  const promoActive = Boolean(user?.promo_active);
  const showFirstItemCallout = !loading && !hasItems;

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto w-full py-6 sm:py-8 lg:py-10 pb-12">
        <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="border-b border-emerald-100/80 bg-gradient-to-r from-emerald-50/95 via-emerald-50/80 to-emerald-50/60 px-4 sm:px-6 lg:px-8 py-5 sm:py-6">
            <h1 className="text-2xl sm:text-3xl font-bold text-iregistrygreen tracking-tight animate-fade-up">
              Welcome back{user?.last_name ? `, ${user.last_name}` : ""} 👋
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {showFirstItemCallout
                ? "Register your first item to start protecting what matters to you"
                : "Here’s a snapshot of your asset portfolio"}
            </p>
          </div>
          <div className="px-4 sm:px-6 lg:px-8 py-5 sm:py-8 space-y-8 bg-gradient-to-b from-white to-gray-50/40">
        <PromoModeBanner />
        {showFirstItemCallout && (
          <div className="rounded-2xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50/90 to-white shadow-sm p-8 text-center">

            <div className="text-4xl mb-3">📦</div>

            <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
              {promoActive
                ? "Protect your first asset — registration is free right now"
                : "Protect your first asset on iRegistry"}
            </h2>

            <p className="text-sm text-gray-600 mt-2 max-w-lg mx-auto leading-relaxed">
              {promoActive ? (
                <>
                  Add a phone, laptop, bicycle, or any valuable item — takes about 3 minutes.
                  You&apos;ll get a verifiable record on Botswana&apos;s digital asset registry.
                </>
              ) : (
                <>
                  Your first two lifetime registrations are free. After that, registrations use
                  credits — but getting started costs you nothing today.
                </>
              )}
            </p>

            <button
              type="button"
              onClick={() => void goToAddItem()}
              disabled={addPreflightLoading}
              title={addPreflightLoading ? "Loading…" : undefined}
              className="mt-5 bg-iregistrygreen text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:shadow-md transition disabled:opacity-60"
            >
              {promoActive ? "Register my first item — free" : "+ Add your first item"}
            </button>

          </div>
        )}

        {!promoActive && <CreditsSummaryStrip />}

        {/* ===== Summary Cards ===== */}
        <div className="space-y-4">

          {/* Active */}
          <div className="bg-white rounded-2xl shadow-sm hover:shadow-lg transition transform hover:-translate-y-0.5 border border-gray-100 relative overflow-hidden">
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
                {loading ? (
                  <div className="h-8 w-10 bg-gray-200 rounded animate-pulse" />
                ) : (
                  activeAnimated
                )}
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
                {loading ? (
                  <div className="h-8 w-10 bg-gray-200 rounded animate-pulse" />
                ) : (
                  stolenAnimated
                )}
              </div>
            </div>
          </div>

          {/* Notifications */}
          <div className={`bg-white rounded-2xl shadow-sm hover:shadow-lg transition transform hover:-translate-y-0.5 border border-gray-100 relative overflow-hidden ${
              unread > 0 ? "bg-amber-50/40" : ""
            }`}
            >
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
                {loading ? (
                  <div className="h-8 w-10 bg-gray-200 rounded animate-pulse" />
                ) : (
                  notifAnimated
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ===== Bottom Grid ===== */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Quick Actions */}
          <QuickActionsPanel />

          {/* ===== Recent Alerts ===== */}
          <DashboardAlertsPanel alerts={alerts} />

          {/* Pending Transfers */}
          <PendingTransferRequests />

          {/* Recent Activity */}
          <RecentActivityPanel
            activity={activity}
            loading={activityLoading}
            page={page}
            setPage={setPage}
            totalPages={totalPages}
          />

        </div>

          </div>
        </div>
      </div>
    </div>
  );
}