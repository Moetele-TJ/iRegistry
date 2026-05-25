import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { normalizeRole } from "../../lib/roleUtils.js";
import { LogIn, RefreshCw } from "lucide-react";
import RippleButton from "../../components/RippleButton.jsx";
import RecentLoginsByUser from "../../components/RecentLoginsByUser.jsx";
import { invokeWithAuth } from "../../lib/invokeWithAuth.js";
import { useToast } from "../../contexts/ToastContext.jsx";
import PageSectionCard from "../shared/PageSectionCard.jsx";

const RANGE_OPTIONS = [
  { value: 7, label: "Last 7 days" },
  { value: 30, label: "Last 30 days" },
  { value: 90, label: "Last 90 days" },
];

export default function AdminRecentLoginsPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { addToast } = useToast();
  const isAdmin = !!user && normalizeRole(user.role) === "admin";

  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [byUser, setByUser] = useState([]);
  const [expandedUserId, setExpandedUserId] = useState(null);

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const { data, error } = await invokeWithAuth("admin-recent-logins", {
        body: { days },
      });
      if (error || !data?.success) {
        throw new Error(data?.message || error?.message || "Failed to load logins");
      }
      setByUser(Array.isArray(data.by_user) ? data.by_user : []);
    } catch (e) {
      addToast({ type: "error", message: e.message || "Failed to load" });
      setByUser([]);
    } finally {
      setLoading(false);
    }
  }, [addToast, days, isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    void load();
  }, [load, isAdmin]);

  useEffect(() => {
    if (!expandedUserId) return;
    const still = byUser.some((g) => String(g.user_id) === String(expandedUserId));
    if (!still) setExpandedUserId(null);
  }, [byUser, expandedUserId]);

  const totalLogins = useMemo(
    () => byUser.reduce((n, g) => n + Number(g.login_count || 0), 0),
    [byUser]
  );

  function toggleUser(uid) {
    setExpandedUserId((prev) => (prev === uid ? null : uid));
  }

  if (authLoading) {
    return <p className="text-sm text-gray-500 p-6">Loading…</p>;
  }
  if (!isAdmin) {
    return <Navigate to="/unauthorized" replace />;
  }

  return (
    <div className="max-w-5xl mx-auto w-full">
      <PageSectionCard
        maxWidthClass="max-w-5xl"
        title="Recent logins"
        subtitle="Click a user’s name to expand their sign-ins in the selected range."
        icon={<LogIn className="w-6 h-6 text-iregistrygreen shrink-0" />}
        actions={
          <RippleButton
            className="py-2 px-3 rounded-xl border border-gray-200 bg-white text-sm text-gray-800 shadow-sm hover:bg-gray-50"
            onClick={() => navigate("/admin")}
          >
            Back
          </RippleButton>
        }
      >
        <div className="p-4 sm:p-6 space-y-6">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="text-xs text-gray-600 block" htmlFor="logins-range">
                Range
              </label>
              <select
                id="logins-range"
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
                className="mt-1 border rounded-lg px-3 py-2 text-sm bg-white min-w-[11rem]"
                disabled={loading}
              >
                {RANGE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <RippleButton
              className="inline-flex items-center gap-2 py-2 px-3 rounded-xl border border-gray-200 bg-white text-sm text-gray-800 shadow-sm hover:bg-gray-50 disabled:opacity-60"
              onClick={() => void load()}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </RippleButton>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/80 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
                Users with logins
              </p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {loading ? "—" : byUser.length}
              </p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                Sessions in range
              </p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {loading ? "—" : totalLogins}
              </p>
            </div>
          </div>

          {loading ? (
            <p className="text-sm text-gray-500">Loading…</p>
          ) : (
            <RecentLoginsByUser
              groups={byUser}
              expandedUserId={expandedUserId}
              onToggleUser={toggleUser}
              emptyMessage="No logins in this range."
            />
          )}
        </div>
      </PageSectionCard>
    </div>
  );
}
