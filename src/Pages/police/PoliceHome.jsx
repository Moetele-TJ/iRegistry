import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { Shield, Package, ClipboardList, ChevronRight } from "lucide-react";
import { useDashboard } from "../../hooks/useDashboard.js";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { roleIs } from "../../lib/roleUtils.js";
import RippleButton from "../../components/RippleButton.jsx";
import TimeAgo from "../../components/TimeAgo.jsx";

export default function PoliceHome() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const { data, loading, error, refresh } = useDashboard({ page, limit: 8 });

  const overview = data?.roleData?.policeOverview;
  const station = overview?.station;
  const openCases = overview?.openStolenCases ?? 0;
  const caseActivity = overview?.caseActivity ?? [];
  const pagination = overview?.pagination;
  const totalPages = pagination?.totalPages ?? 1;

  const errStr = String(error || "").toLowerCase();
  const stationError =
    errStr.includes("police station") || errStr.includes("no police station");

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-iregistrygreen flex items-center gap-2">
          <Shield className="w-7 h-7" />
          Police dashboard
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          Station queue and case activity use your profile&apos;s police station name.
        </p>
        {roleIs(user?.role, "admin") && (
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-3">
            You are signed in as <strong>admin</strong>. Station metrics below are for{" "}
            <strong>police</strong> accounts with a station on their profile.
          </p>
        )}
      </div>

      {loading && (
        <div className="space-y-4 animate-pulse">
          <div className="h-24 bg-gray-200 rounded-2xl" />
          <div className="h-48 bg-gray-200 rounded-2xl" />
        </div>
      )}

      {!loading && stationError && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-sm text-amber-900">
          Add a <strong>police station</strong> to your account profile so we can match cases to
          your station. Until then, the stolen queue cannot load.
        </div>
      )}

      {!loading && error && !stationError && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-sm text-red-800">
          {error}
        </div>
      )}

      {!loading && !error && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="text-xs uppercase tracking-wide text-gray-500 font-medium">
                Your station
              </div>
              <div className="text-lg font-semibold text-gray-900 mt-1">
                {station || "—"}
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 relative overflow-hidden">
              <div className="absolute left-0 top-0 h-full w-1.5 bg-slate-600" />
              <div className="text-xs uppercase tracking-wide text-gray-500 font-medium">
                Open cases at station
              </div>
              <div className="text-3xl font-bold text-slate-800 mt-1 tabular-nums">
                {openCases}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Non-returned cases where the case record&apos;s station matches your profile.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              to="/policedashboard/items"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-iregistrygreen text-white text-sm font-medium hover:opacity-90 shadow-sm"
            >
              <Package size={18} />
              Station stolen queue
              <ChevronRight size={16} />
            </Link>
            <RippleButton
              className="px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-700 text-sm"
              onClick={() => refresh()}
            >
              Refresh stats
            </RippleButton>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center gap-2 text-sm uppercase tracking-wide text-gray-500 font-medium mb-4">
              <ClipboardList size={18} />
              Case-related activity
            </div>

            {caseActivity.length === 0 && (
              <p className="text-sm text-gray-400">No recent case activity for this station.</p>
            )}

            {caseActivity.length > 0 && (
              <ul className="space-y-3">
                {caseActivity.map((a) => (
                  <li
                    key={a.id}
                    className={`flex justify-between gap-4 border-b border-gray-50 pb-3 last:border-0 ${
                      a.metadata?.slug ? "cursor-pointer hover:bg-gray-50 -mx-2 px-2 rounded-lg" : ""
                    }`}
                    onClick={() => {
                      if (a.metadata?.slug) {
                        navigate(`/items/${a.metadata.slug}`);
                      }
                    }}
                  >
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
              <Link
                to="/policedashboard/activity"
                className="text-sm text-iregistrygreen hover:underline"
              >
                Full activity log
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
