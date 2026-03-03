//  src/components/RecentActivityPanel.jsx
import RippleButton from "./RippleButton";

export default function RecentActivityPanel({
  activity,
  loading,
  page,
  setPage,
  totalPages,
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
      
      <div className="text-sm uppercase tracking-wide text-gray-500 font-medium mb-4">
        Recent Activity
      </div>

      {loading && (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-4 bg-gray-200 rounded animate-pulse" />
          ))}
        </div>
      )}

      {!loading && activity.length === 0 && (
        <div className="text-sm text-gray-400">
          No recent activity.
        </div>
      )}

      {!loading && activity.length > 0 && (
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

          {totalPages > 1 && (
            <div className="pt-4">
              <RippleButton
                className="w-full py-2 rounded-xl bg-gray-100 text-gray-800 text-sm hover:bg-gray-200 transition"
                onClick={() =>
                  setPage((p) => Math.min(p + 1, totalPages))
                }
              >
                {page < totalPages
                  ? "Load More Activity"
                  : "All Activity Loaded"}
              </RippleButton>
            </div>
          )}
        </>
      )}
    </div>
  );
}