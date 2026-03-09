//  src/Pages/ActivityPage.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDashboard } from "../hooks/useDashboard";
import TimeAgo from "../components/TimeAgo";
import { getIcon } from "../utils/iconResolver";
import { groupActivityByDate } from "../utils/groupActivityByDate";

export default function ActivityPage() {

    const navigate = useNavigate();

    const [page, setPage] = useState(1);
    const [filter, setFilter] = useState("all");

    const { data, loading } = useDashboard({
        page,
        limit: 20
    });

    const activity = data?.personal?.activity?.data || [];
    const pagination = data?.personal?.activity?.pagination;

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
            <div className="max-w-4xl mx-auto px-4 py-8">

                <h1 className="text-xl font-semibold text-gray-800 mb-6">
                    Activity History
                </h1>

                <div className="flex gap-2 mb-4">

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

                <div className="bg-white rounded-xl shadow-sm border border-gray-100">

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

                <div className="flex justify-between items-center mt-6 text-sm">

                    <button
                        disabled={page === 1}
                        onClick={() => setPage(p => p - 1)}
                        className="px-3 py-1 rounded bg-gray-200 disabled:opacity-50"
                    >
                        Previous
                    </button>

                    <span className="text-gray-500">
                        Page {page} of {totalPages}
                    </span>

                    <button
                        disabled={page === totalPages}
                        onClick={() => setPage(p => p + 1)}
                        className="px-3 py-1 rounded bg-gray-200 disabled:opacity-50"
                    >
                        Next
                    </button>
                </div>
            </div>
        </div>
    );
}