//  src/Pages/ActivityPage.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Activity } from "lucide-react";
import { useDashboard } from "../hooks/useDashboard";
import TimeAgo from "../components/TimeAgo";
import { getIcon } from "../utils/iconResolver";
import { groupActivityByDate } from "../utils/groupActivityByDate";
import PageSectionCard from "./shared/PageSectionCard.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";
import { isPrivilegedRole } from "../lib/billingUx.js";

export default function ActivityPage() {

    const navigate = useNavigate();
    const { user } = useAuth();

    const [page, setPage] = useState(1);
    const [filter, setFilter] = useState("all");
    const [scope, setScope] = useState("mine"); // mine | system

    const { data, loading } = useDashboard({
        page,
        limit: 20
    });

    const privileged = isPrivilegedRole(user?.role);
    const mineActivity = data?.personal?.activity?.data || [];
    const systemActivity = data?.roleData?.systemActivity?.data || [];
    const activity = privileged && scope === "system" ? systemActivity : mineActivity;
    const pagination = privileged && scope === "system"
      ? data?.roleData?.systemActivity?.pagination
      : data?.personal?.activity?.pagination;

    const filteredActivity = activity.filter(item => {

        if (filter === "all") return true;

        if (filter === "items")
            return item.entity_type === "item";

        if (filter === "transfers")
            return item.action?.includes("transfer");

        if (filter === "security")
            return item.action?.includes("verify") || item.action?.includes("stolen");

        return true;

    });

    const groupedActivity = groupActivityByDate(filteredActivity);
    const totalPages = pagination?.totalPages || 1;

    return (
        <div className="min-h-screen bg-gray-100">
            <div className="w-full py-6 sm:py-8 lg:py-10 pb-12">
            <PageSectionCard
                maxWidthClass="max-w-7xl"
                title="Activity"
                subtitle={privileged ? "Registry activity history" : "Your registry activity history"}
                icon={<Activity className="w-7 h-7 text-iregistrygreen shrink-0" />}
            >
                <div className="p-4 sm:p-6 space-y-6">
                {privileged ? (
                  <div className="flex gap-2 flex-wrap">
                    {[
                      { label: "My activity", value: "mine" },
                      { label: "System activity", value: "system" },
                    ].map((s) => (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() => {
                          setScope(s.value);
                          setPage(1);
                        }}
                        className={`px-3 py-1 rounded-full text-sm transition ${
                          scope === s.value
                            ? "bg-iregistrygreen text-white"
                            : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                ) : null}

                <div className="flex gap-2 flex-wrap">

                    {[
                        { label: "All", value: "all" },
                        { label: "Items", value: "items" },
                        { label: "Transfers", value: "transfers" },
                        { label: "Security", value: "security" }
                     ].map(f => (

                        <button
                            key={f.value}
                            onClick={() => {
                                setFilter(f.value);
                                setPage(1);
                            }}
                            className={`px-3 py-1 rounded-full text-sm transition ${
                                filter === f.value
                                ? "bg-iregistrygreen text-white"
                                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                            }`}
                            >
                            {f.label}
                        </button>
                    ))}
                </div>

                <div className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">

                    {loading && (
                        <div className="p-6 text-sm text-gray-400">
                        Loading activity...
                        </div>
                    )}

                    {!loading && filteredActivity.length === 0 && (
                        <div className="p-6 text-sm text-gray-400">
                            No activity yet
                        </div>
                    )}

                    {Object.entries(groupedActivity).map(([date, items]) => (
                        <div key={date}>

                            <div className="px-6 py-3 text-xs font-semibold text-gray-400 uppercase bg-gray-50/95 border-b sticky top-0 z-10 backdrop-blur">
                                {date}
                            </div>

                            {items.map((item) => {

                            const Icon = getIcon(item);

                            return (
                                <div
                                    key={item.id}
                                    onClick={() => {
                                        if (item.entity_type === "item") {
                                            const slug = item.metadata?.slug;

                                        if (slug) {
                                            navigate(`/items/${slug}`);
                                          }
                                        }
                                    }}
                                    className={`px-6 py-4 border-b last:border-b-0 flex justify-between items-start transition ${
                                        item.entity_type === "item" ? "cursor-pointer hover:bg-gray-50" : ""
                                    }`}
                                >

                                    <div className="flex items-start gap-3">

                                        <Icon size={18} className="text-gray-500 mt-0.5" />

                                        <div>
                                            <div className="text-sm text-gray-800">
                                                {item.message}
                                            </div>

                                            <div className="text-xs text-gray-400 mt-1">
                                                {item.entity_name}
                                            </div>

                                            {privileged && item?.actor?.display_name ? (
                                              <div className="text-xs text-gray-400 mt-1">
                                                Performed by{" "}
                                                <span className="font-medium text-gray-500">
                                                  {item.actor.display_name}
                                                </span>
                                                {item?.actor?.role ? (
                                                  <span className="text-gray-300"> · {String(item.actor.role)}</span>
                                                ) : null}
                                              </div>
                                            ) : null}
                                        </div>

                                    </div>

                                    <div className="flex items-center gap-2 text-xs text-gray-400 whitespace-nowrap">
                                        <TimeAgo date={item.created_at} />
                                        {item.entity_type === "item" && (
                                            <span className="text-gray-300">›</span>
                                        )}
                                    </div>

                                </div>
                            );
                            })}
                        </div>
                        ))}

                </div>

                {/* Pagination */}

                <div className="flex justify-between items-center pt-2 border-t border-gray-100/80 text-sm">

                    <button
                        disabled={page === 1}
                        onClick={() => setPage(p => p - 1)}
                        className="px-3 py-1.5 rounded-lg bg-white border border-gray-200 disabled:opacity-50"
                    >
                        Previous
                    </button>

                    <span className="text-gray-500">
                        Page {page} of {totalPages}
                    </span>

                    <button
                        disabled={page === totalPages}
                        onClick={() => setPage(p => p + 1)}
                        className="px-3 py-1.5 rounded-lg bg-white border border-gray-200 disabled:opacity-50"
                    >
                        Next
                    </button>
                </div>
                </div>
            </PageSectionCard>
            </div>
        </div>
    );
}