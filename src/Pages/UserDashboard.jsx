// src/Pages/UserDashboard.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useItems } from "../contexts/ItemsContext.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";
import RippleButton from "../components/RippleButton.jsx";

function useCountUp(target, duration = 800) {
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
  const { items = [] } = useItems();
  const { user } = useAuth();

  // ===== Derived Stats =====
  const activeCount = useMemo(
    () => items.filter((i) => i.status === "Active").length,
    [items]
  );

  const stolenCount = useMemo(
    () => items.filter((i) => i.status === "Stolen").length,
    [items]
  );

  // Placeholder until notifications context is wired
  const notificationCount = 3;

  const activeAnimated = useCountUp(activeCount);
  const stolenAnimated = useCountUp(stolenCount);
  const notifAnimated = useCountUp(notificationCount);

  // ===== Recent Activity (backend-driven basic version) =====
  const recentActivity = useMemo(() => {
    return [...items]
      .sort((a, b) => new Date(b.updatedOn) - new Date(a.updatedOn))
      .slice(0, 3);
  }, [items]);

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">

        {/* ===== Welcome Section ===== */}
        <div className="space-y-1 animate-fade-up">
          <h1 className="text-3xl font-semibold text-gray-900">
            Welcome back{user?.first_name ? `, ${user.first_name}` : ""} 👋
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
            <div className="absolute left-0 top-0 h-full w-1.5 bg-amber-500" />
            <div className="flex items-center justify-between px-6 py-5">
              <div>
                <div className="text-sm uppercase tracking-wide text-gray-500">
                  Notifications
                </div>
                <div className="text-xs text-gray-400">
                  2 unread alerts
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
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
            <div className="text-sm uppercase tracking-wide text-gray-500">
              Recent Activity
            </div>

            {recentActivity.length === 0 && (
              <div className="text-sm text-gray-400">
                No recent activity.
              </div>
            )}

            {recentActivity.map((item) => (
              <div
                key={item.id}
                className="text-sm text-gray-700 border-b border-gray-100 pb-2 last:border-none"
              >
                • {item.name} updated
              </div>
            ))}
          </div>

        </div>

      </div>
    </div>
  );
}