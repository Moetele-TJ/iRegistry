// src/Pages/HomePage.jsx
import React, { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import RippleButton from "../components/RippleButton.jsx";
import VerificationPanel from "../components/VerificationPanel.jsx";
import HomeContactCard from "../components/HomeContactCard.jsx";
import { usePublicStats } from "../hooks/usePublicStats.js";
import { DISPLAY } from "../lib/navLabels.js";
import { Users, Package, AlertTriangle, ChevronRight } from "lucide-react";
import CountUp from "react-countup";
import { useAuth } from "../contexts/AuthContext.jsx";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Legend,
} from "recharts";

const IREG_GREEN = "#1FA463";
const IREG_RED = "#E53E3E";

/** Coerce RPC / JSON row to a non-negative integer count (handles strings and alternate keys). */
function coerceDailyCount(row) {
  if (!row || typeof row !== "object") return 0;
  const raw = row.count ?? row.Count ?? row.value;
  if (typeof raw === "number" && Number.isFinite(raw)) return Math.max(0, Math.floor(raw));
  if (typeof raw === "string" && raw.trim() !== "") {
    const n = Number(raw.trim());
    return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
  }
  return 0;
}

function normalizeDailyTrend(rows, takeLast) {
  const r = Array.isArray(rows) ? rows.slice(-takeLast) : [];
  return r.map((row) => ({
    date: row?.date ?? row?.Date ?? "",
    count: coerceDailyCount(row),
  }));
}

function toCumulativeTrend(rows) {
  let running = 0;
  return rows.map((row) => {
    running += row.count;
    return { ...row, count: running };
  });
}

/** Y ticks that always include 0 and the true max so the axis does not look capped at a low tick. */
function yAxisTicksForMax(maxValue) {
  const m = Math.max(0, Math.floor(Number(maxValue)) || 0);
  if (m <= 0) return [0, 1];
  const maxTicks = 9;
  if (m < maxTicks) {
    return Array.from({ length: m + 1 }, (_, i) => i);
  }
  const step = Math.ceil(m / (maxTicks - 1));
  const out = new Set([0, m]);
  for (let v = step; v < m; v += step) out.add(Math.min(v, m));
  return [...out].sort((a, b) => a - b);
}

export default function HomePage() {
  const navigate = useNavigate();
  const { stats, initialLoading, refreshing, lastUpdated } = usePublicStats();

  const itemTimelineData = useMemo(
    () => normalizeDailyTrend(stats?.dailyItemTrend, 14),
    [stats?.dailyItemTrend],
  );

  const userTimelineData14 = useMemo(
    () => normalizeDailyTrend(stats?.dailyUserTrend, 14),
    [stats?.dailyUserTrend],
  );

  const [trendMetric, setTrendMetric] = useState("items"); // "items" | "users"

  const activityChart = useMemo(() => {
    const daily =
      trendMetric === "users" ? userTimelineData14 : itemTimelineData;
    const data = toCumulativeTrend(daily);
    const peak = data.reduce((m, d) => Math.max(m, d.count), 0);
    const yMax = Math.max(peak, 1);
    return {
      data,
      yMax,
      yTicks: yAxisTicksForMax(yMax),
    };
  }, [trendMetric, itemTimelineData, userTimelineData14]);

  const itemTrend = useMemo(
    () => normalizeDailyTrend(stats?.dailyItemTrend, 7),
    [stats?.dailyItemTrend],
  );
  const userTrend = useMemo(
    () => normalizeDailyTrend(stats?.dailyUserTrend, 7),
    [stats?.dailyUserTrend],
  );
  const stolenTrend = useMemo(
    () => normalizeDailyTrend(stats?.dailyStolenTrend, 7),
    [stats?.dailyStolenTrend],
  );
  const topCategories = useMemo(
    () =>
      Object.entries(stats?.categoryBreakdown || {})
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
    [stats?.categoryBreakdown],
  );

  const stolenCategoryData = Object.entries(
    stats?.stolenCategoryBreakdown || {}
  )
    .map(([category, count]) => ({
      category,
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  const totals = stats?.totals || {};
  const topStolenItems = Array.isArray(stats?.topStolenItems) ? stats.topStolenItems : [];
  const topStolenVillages = Array.isArray(stats?.topStolenVillages) ? stats.topStolenVillages : [];
  const topUserVillages = useMemo(
    () =>
      (Array.isArray(stats?.topUserVillages) ? stats.topUserVillages : [])
        .map((r) => ({
          village: r?.village || "Unknown",
          count: Number(r?.count) || 0,
        }))
        .sort((a, b) => b.count - a.count || String(a.village).localeCompare(String(b.village)))
        .slice(0, 5),
    [stats?.topUserVillages],
  );

  const stolen = totals.stolenItems ?? 0;
  const total = totals.totalItems ?? 0;
  const totalUsers = totals.totalUsers ?? 0;
  const chartKey = stats?.totals?.totalItems || 0;

  const [expandedCard, setExpandedCard] = useState(null);
  const [stolenPanel, setStolenPanel] = useState("category"); // category | village
  const { user } = useAuth();
  const [, setOpenMenu] = useState(false);
  const menuRef = useRef(null);
  const statCardsRef = useRef(null);

  useEffect(() => {
    if (!expandedCard) return undefined;
    function collapseIfOutside(e) {
      if (!statCardsRef.current?.contains(e.target)) {
        setExpandedCard(null);
      }
    }
    function collapseOnEscape(e) {
      if (e.key === "Escape") setExpandedCard(null);
    }
    document.addEventListener("mousedown", collapseIfOutside);
    document.addEventListener("keydown", collapseOnEscape);
    return () => {
      document.removeEventListener("mousedown", collapseIfOutside);
      document.removeEventListener("keydown", collapseOnEscape);
    };
  }, [expandedCard]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpenMenu(false);
      }
    }

    function handleEsc(e) {
      if (e.key === "Escape") {
        setOpenMenu(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEsc);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-100">

      <div className="p-6 max-w-6xl mx-auto">

        {/* HERO */}
        <div className="bg-gradient-to-br from-iregistrygreen to-emerald-600 rounded-3xl p-8 text-white shadow-xl mb-8">
          <h1 className="text-4xl font-extrabold tracking-tight">
            The Smart Way to Protect Your Assets.
          </h1>

          <p className="mt-4 max-w-2xl text-white/90 text-lg">
            iRegistry is Botswana’s trusted digital asset registry — built to protect your devices,secure ownership, and fight theft through smart verification. Real-time verification. Theft reporting. Ownership protection — all in one secure ecosystem.
          </p>

          <div className="mt-6 flex items-center">
  
            {/* LEFT SIDE */}
            {!user && (
              <div className="flex flex-wrap gap-3 items-center">
                <RippleButton
                  className="px-6 py-2 rounded-xl bg-white text-iregistrygreen font-semibold"
                  onClick={() => navigate("/login")}
                >
                  Login
                </RippleButton>

                <RippleButton
                  className="px-6 py-2 rounded-xl bg-white/20 backdrop-blur text-white border border-white/30"
                  onClick={() => navigate("/signup")}
                >
                  Create Account
                </RippleButton>

                <RippleButton
                  className="px-6 py-2 rounded-xl bg-white/15 backdrop-blur text-white border border-white/40 font-semibold"
                  onClick={() => navigate("/guide")}
                >
                  User guide
                </RippleButton>

                <RippleButton
                  className="px-6 py-2 rounded-xl bg-white/15 backdrop-blur text-white border border-white/40 font-semibold"
                  onClick={() => navigate("/faq")}
                >
                  FAQ
                </RippleButton>
              </div>
            )}

            {/* RIGHT SIDE */}
            {user && (
              <div className="flex flex-wrap items-center justify-between gap-4 w-full">
                <div className="flex flex-wrap gap-3 items-center">
                  <RippleButton
                    className="px-5 py-2 rounded-xl bg-white/15 backdrop-blur text-white border border-white/40 font-semibold"
                    onClick={() => navigate("/guide")}
                  >
                    User guide
                  </RippleButton>
                  <RippleButton
                    className="px-5 py-2 rounded-xl bg-white/15 backdrop-blur text-white border border-white/40 font-semibold"
                    onClick={() => navigate("/faq")}
                  >
                    FAQ
                  </RippleButton>
                </div>
                <div className="flex items-center gap-3 ml-auto sm:ml-0">
                  <div className="text-white text-lg font-medium text-right">
                    Welcome back,{" "}
                    <span className="font-semibold">
                      {user.last_name}
                    </span>{" "}
                    👋
                  </div>

                  <div
                    className="w-10 h-10 rounded-full bg-white/20 backdrop-blur 
                    flex items-center justify-center text-white font-semibold"
                  >
                    {(user.last_name || user.email)
                      ?.charAt(0)
                      .toUpperCase()}
                  </div>
                </div>
              </div>
            )}

          </div>

          {lastUpdated && (
              <div className="mt-4 text-xs text-white/80">
                Last updated:{" "}
                {lastUpdated.toLocaleTimeString("en-BW", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
                {refreshing && (
                  <span className="ml-2 animate-pulse">• Updating...</span>
                )}
              </div>
            )}

        </div>

        <VerificationPanel/>

        {/* STAT CARDS */}
        <div
          ref={statCardsRef}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8 items-start"
        >

          <StatCard
            id = "users"
            title={DISPLAY.stats.activeUsers}
            value={totalUsers}
            initialLoading={initialLoading}
            icon={<Users size={22} />}
            miniTrend = {userTrend}
            expanded={expandedCard === "users"}
            onToggle={() =>
              setExpandedCard(expandedCard === "users" ? null : "users")
            }
          >
            <div>Registered citizens & institutions.</div>

            <div className="mt-3 text-xs text-gray-400 uppercase tracking-wide">
              Top villages / towns
            </div>
            <div className="mt-2 space-y-1">
              {topUserVillages.length === 0 ? (
                <div className="text-sm text-gray-500">No location data yet.</div>
              ) : (
                topUserVillages.map((r) => (
                  <div
                    key={r.village}
                    className="flex justify-between gap-3"
                  >
                    <span className="truncate">{r.village}</span>
                    <span className="font-medium tabular-nums">{r.count}</span>
                  </div>
                ))
              )}
            </div>
          </StatCard>

          <StatCard
            id = "total"
            title="Total Items"
            value={total}
            initialLoading={initialLoading}
            icon={<Package size={22} />}
            miniTrend = {itemTrend}
            expanded={expandedCard === "total"}
            onToggle={() =>
              setExpandedCard(expandedCard === "total" ? null : "total")
            }
          >
            <div>Total items recorded in registry.</div>

            <div className="mt-3 text-xs text-gray-400 uppercase tracking-wide">
              Top Categories
            </div>

            <div className="mt-2 space-y-1">
              {topCategories.length === 0 ? (
                <div className="text-sm text-gray-500">No category data yet.</div>
              ) : (
                topCategories.map(({ category, count }) => (
                  <div key={category} className="flex justify-between gap-3">
                    <span className="truncate">{category}</span>
                    <span className="font-medium tabular-nums">{count}</span>
                  </div>
                ))
              )}
            </div>
          </StatCard>

          <StatCard
            id = "stolen"
            title="Stolen Items"
            value={stolen}
            initialLoading={initialLoading}
            red
            icon={<AlertTriangle size={22} />}
            miniTrend = {stolenTrend}
            expanded={expandedCard === "stolen"}
            onToggle={() =>
              setExpandedCard(expandedCard === "stolen" ? null : "stolen")
            }
          >
            <div>Assets flagged as stolen.</div>

            <div className="mt-3 flex items-center justify-between">
              <div className="text-xs text-gray-400 uppercase tracking-wide">
                {stolenPanel === "category" ? "Top 5 most stolen" : "Stolen by village / town"}
              </div>
              <button
                type="button"
                className="p-1 rounded-md hover:bg-gray-50 text-gray-500"
                onClick={(e) => {
                  e.stopPropagation();
                  setStolenPanel((p) => (p === "category" ? "village" : "category"));
                }}
                aria-label="Toggle stolen stats view"
                title="Switch view"
              >
                <ChevronRight
                  className={`w-4 h-4 transition-transform duration-300 ${
                    stolenPanel === "village" ? "rotate-180" : ""
                  }`}
                />
              </button>
            </div>

            <div className="relative mt-2 overflow-hidden">
              <div
                className={`transition-transform duration-300 ease-in-out ${
                  stolenPanel === "category" ? "translate-x-0" : "-translate-x-full"
                }`}
              >
                <div className="space-y-1">
                  {topStolenItems.length === 0 ? (
                    <div className="text-sm text-gray-500">No stolen items yet.</div>
                  ) : (
                    topStolenItems.slice(0, 5).map((r, idx) => {
                      const cat = String(r?.category || "").trim();
                      return (
                        <div
                          key={`${r?.category || "cat"}-${idx}`}
                          className="flex justify-between gap-3"
                        >
                          <span className="truncate">{cat || "Uncategorized"}</span>
                          <span className="font-medium tabular-nums">{r?.count ?? 0}</span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div
                className={`absolute inset-0 transition-transform duration-300 ease-in-out ${
                  stolenPanel === "village" ? "translate-x-0" : "translate-x-full"
                }`}
              >
                <div className="space-y-1">
                  {topStolenVillages.length === 0 ? (
                    <div className="text-sm text-gray-500">No village data yet.</div>
                  ) : (
                    topStolenVillages.slice(0, 5).map((r, idx) => {
                      const v = String(r?.village || "").trim();
                      return (
                        <div
                          key={`${r?.village || "v"}-${idx}`}
                          className="flex justify-between gap-3"
                        >
                          <span className="truncate">{v || "Unknown"}</span>
                          <span className="font-medium tabular-nums">{r?.count ?? 0}</span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </StatCard>

        </div>

        {/* CHARTS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Timeline */}
          <div className="bg-white rounded-3xl p-6 shadow-sm">
            <div className="mb-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-gray-800">14-day activity</div>
                  <p className="text-xs text-gray-500 mt-1 max-w-md leading-snug">
                    {trendMetric === "users"
                      ? "Cumulative new user accounts over the last 14 days."
                      : "Cumulative assets registered over the last 14 days."}
                  </p>
                </div>
                <div
                  className="inline-flex rounded-xl border border-gray-200 p-1 bg-gray-50 shrink-0"
                  role="tablist"
                  aria-label="Chart metric"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={trendMetric === "items"}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                      trendMetric === "items"
                        ? "bg-white text-iregistrygreen shadow-sm"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                    onClick={() => setTrendMetric("items")}
                  >
                    Items
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={trendMetric === "users"}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                      trendMetric === "users"
                        ? "bg-white text-iregistrygreen shadow-sm"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                    onClick={() => setTrendMetric("users")}
                  >
                    Users
                  </button>
                </div>
              </div>
            </div>

            <div style={{ height: 220 }}>
              {initialLoading ? (
                <div className="h-full bg-gray-100 rounded-2xl animate-pulse" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart key={`${chartKey}-${trendMetric}`} data={activityChart.data}>
                    <defs>
                      <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={IREG_GREEN} stopOpacity={0.4} />
                        <stop offset="100%" stopColor={IREG_GREEN} stopOpacity={0} />
                      </linearGradient>
                    </defs>

                    <XAxis
                      dataKey="date"
                      tickFormatter={(value) => {
                        if (!value) return "";
                        const date = new Date(value);
                        if (isNaN(date)) return "";
                        return date.toLocaleDateString("en-BW", {
                          day: "2-digit",
                          month: "short",
                        });
                      }}
                    />

                    <YAxis
                      type="number"
                      allowDecimals={false}
                      allowDataOverflow
                      domain={[0, activityChart.yMax]}
                      ticks={activityChart.yTicks}
                      interval={0}
                      width={52}
                    />
                    <CartesianGrid strokeDasharray="3 3" />
                    <RechartsTooltip
                      labelFormatter={(value) =>
                        new Date(value).toLocaleDateString("en-BW", {
                          day: "2-digit",
                          month: "long",
                          year: "numeric",
                        })
                      }
                      formatter={(value) => [
                        String(value),
                        trendMetric === "users"
                          ? "Cumulative new users"
                          : "Cumulative items registered",
                      ]}
                    />

                    <Area
                      type="monotone"
                      dataKey="count"
                      name={
                        trendMetric === "users"
                          ? "Cumulative new users"
                          : "Cumulative items registered"
                      }
                      stroke={IREG_GREEN}
                      fill="url(#g)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Stolen Category Breakdown */}
          <div className="bg-white rounded-3xl p-6 shadow-sm">
            <div className="text-sm font-semibold text-gray-700 mb-4">
              Stolen Items by Category
            </div>

            <div style={{ height: 240 }}>
              {initialLoading ? (
                <div className="h-full bg-gray-100 rounded-2xl animate-pulse" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart key={chartKey}
                    data={stolenCategoryData}
                    layout="vertical"
                  >
                    <CartesianGrid strokeDasharray="3 3" />

                    <XAxis type="number" allowDecimals={false} />
                    <YAxis
                      type="category"
                      dataKey="category"
                      width={100}
                    />

                    <RechartsTooltip />

                    <Legend />

                    <Bar
                      dataKey="count"
                      fill={IREG_RED}
                      radius={[0, 6, 6, 0]}
                      animationDuration={800}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

        </div>

        <div className="mt-8">
          <HomeContactCard />
        </div>
      </div>
    </div>
  );
}

function StatCard({
  id,
  title,
  value,
  red,
  initialLoading,
  icon,
  miniTrend = [],
  expanded,
  onToggle,
  children,
}) {
  return (
    <div
       onClick={onToggle}
      className={`bg-white rounded-3xl p-6 shadow-md hover:shadow-xl 
      transition-all duration-300 cursor-pointer border border-gray-100
      ${expanded ? "ring-2 ring-emerald-500" : ""}
      `}
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-iregistrygreen tracking-wide">{title}</div>

          {initialLoading ? (
            <div className="h-8 bg-gray-200 rounded mt-2 animate-pulse w-20" />
          ) : (
            <div
              className={
                "text-4xl font-extrabold mt-2 transition-all duration-500 " +
                (red ? "text-red-600" : "text-gray-900")
              }
            >
              <CountUp
                key={value}   // 🔥 forces animation when value changes
                end={value ?? 0}
                duration={1.2}
                separator=","
              />
            </div>
          )}

          {/* MINI SPARKLINE */}
          {!initialLoading && miniTrend.length > 0 && (
            <div className="mt-3 h-10">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={miniTrend}>
                  <defs>
                    <linearGradient id={`spark-${id}`} x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="0%"
                        stopColor={red ? IREG_RED : IREG_GREEN}
                        stopOpacity={0.4}
                      />
                      <stop
                        offset="100%"
                        stopColor={red ? IREG_RED : IREG_GREEN}
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>

                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke={red ? IREG_RED : IREG_GREEN}
                    strokeWidth={2}
                    fill={`url(#spark-${id})`}
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

        </div>

        <div
          className={
            "p-3 rounded-2xl " +
            (red ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600")
          }
        >
          {icon}
        </div>
      </div>

      {/* Smooth Expand Section */}
      <div
        className={`transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] overflow-hidden ${
          expanded ? "max-h-[500px] mt-4 opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="text-sm text-gray-600 space-y-2 border-t pt-4">
          {children}
        </div>
      </div>
    </div>
  );
}