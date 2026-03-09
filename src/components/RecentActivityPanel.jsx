//  src/components/RecentActivityPanel.jsx
import { useNavigate } from "react-router-dom";
import { getIcon } from "../utils/iconResolver";
import RippleButton from "./RippleButton";
import TimeAgo from "./TimeAgo";

export default function RecentActivityPanel({
  activity,
  loading,
  page,
  setPage,
  totalPages,
}) {

  const navigate = useNavigate();

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
            {activity.map((a) => {

              const Icon = getIcon(a);

              return (
                <div
                  key={a.id}
                  onClick={() => {
                    if (a.entity_type === "item") {
                      const slug = a.metadata?.slug;

                      if (slug) {
                        navigate(`/items/${slug}`);
                      }
                    }
                  }}
                  className={`flex justify-between items-start border-b border-gray-50 pb-2 last:border-none transition ${
                    a.entity_type === "item" ? "cursor-pointer hover:bg-gray-50" : ""
                  }`}
                  >

                  <div className="flex items-start gap-3">

                    <Icon size={16} className="text-gray-400 mt-0.5" />

                    <div>
                      <div className="text-gray-700 text-sm">
                        {a.message}
                      </div>

                      {a.entity_name && (
                        <div className="text-xs text-gray-400">
                          {a.entity_name}
                        </div>
                      )}

                    </div>

                  </div>

                  <div className="flex items-center gap-3 text-xs text-gray-400 whitespace-nowrap ml-4">
                    <TimeAgo date={a.created_at} />
                    <span className="text-gray-300">›</span>
                  </div>
                </div>
              );
            })}
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

          <div className="mt-3 text-right">
            <button
              onClick={() => navigate("/activity")}
              className="text-sm text-iregistrygreen hover:underline"
            >
              View full activity
            </button>
          </div>

        </>
      )}
    </div>
  );
}