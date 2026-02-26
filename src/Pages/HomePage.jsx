// src/Pages/HomePage.jsx
import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import RippleButton from "../components/RippleButton.jsx";
import VerificationPanel from "../components/VerificationPanel.jsx";
import { usePublicStats } from "../hooks/usePublicStats.js";
import { Users, Package, ShieldCheck, AlertTriangle } from "lucide-react";
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

export default function HomePage() {
  const navigate = useNavigate();
  const { stats, initialLoading, refreshing, lastUpdated } = usePublicStats();

  const timeline = stats?.dailyItemTrend || [];

  const itemTrend = (stats?.dailyItemTrend || []).slice(-7);
  const userTrend = (stats?.dailyUserTrend || []).slice(-7);
  const stolenTrend = (stats?.dailyStolenTrend || []).slice(-7);
  const activeTrend = (stats?.dailyActiveTrend || []).slice(-7);

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

  const active = totals.activeItems ?? 0;
  const stolen = totals.stolenItems ?? 0;
  const total = totals.totalItems ?? 0;
  const totalUsers = totals.totalUsers ?? 0;
  const chartKey = stats?.totals?.totalItems || 0;

  const [expandedCard, setExpandedCard] = useState(null);
  const { user, logout } = useAuth();
  const [openMenu, setOpenMenu] = useState(false);
  const menuRef = useRef(null);

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

          <div className="mt-6 flex items-center justify-between">
  
            {/* LEFT SIDE */}
            {!user && (
              <div className="flex gap-3">
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
              </div>
            )}

            {/* RIGHT SIDE */}
            {user && (
              <div className="flex items-center gap-3 ml-auto">
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
                  {(user.first_name || user.last_name || user.email)
                    ?.charAt(0)
                    .toUpperCase()}
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8 items-start">

          <StatCard
            id = "users"
            title="Total Users"
            value={totalUsers}
            initialLoading={initialLoading}
            refreshing={refreshing}
            icon={<Users size={22} />}
            miniTrend = {userTrend}
            expanded={expandedCard === "users"}
            onToggle={() =>
              setExpandedCard(expandedCard === "users" ? null : "users")
            }
          >
            <div>Registered citizens & institutions.</div>
          </StatCard>

          <StatCard
            id = "total"
            title="Total Items"
            value={total}
            initialLoading={initialLoading}
            refreshing={refreshing}
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
              {Object.entries(stats?.categoryBreakdown || {})
                .slice(0, 4)
                .map(([cat, count]) => (
                  <div key={cat} className="flex justify-between">
                    <span>{cat}</span>
                    <span className="font-medium">{count}</span>
                  </div>
                ))}
            </div>

            <div className="mt-3 text-xs text-gray-500">
              Active ratio: {total ? Math.round((active / total) * 100) : 0}%
            </div>
          </StatCard>

          <StatCard
            id = "active"
            title="Active Items"
            value={active}
            initialLoading={initialLoading}
            refreshing={refreshing}
            icon={<ShieldCheck size={22} />}
            miniTrend = {activeTrend}
            expanded={expandedCard === "active"}
            onToggle={() =>
              setExpandedCard(expandedCard === "active" ? null : "active")
            }
          >
            <div>Currently protected assets.</div>
            <div className="mt-2">
              Secure items not reported stolen.
            </div>
          </StatCard>

          <StatCard
            id = "stolen"
            title="Stolen Items"
            value={stolen}
            initialLoading={initialLoading}
            refreshing={refreshing}
            red
            icon={<AlertTriangle size={22} />}
            miniTrend = {stolenTrend}
            expanded={expandedCard === "stolen"}
            onToggle={() =>
              setExpandedCard(expandedCard === "stolen" ? null : "stolen")
            }
          >
            <div>Assets flagged as stolen.</div>
            <div className="mt-2">
              Risk level: {stolen > 0 ? "Monitoring Active" : "Stable"}
            </div>
          </StatCard>

        </div>

        {/* CHARTS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Timeline */}
          <div className="bg-white rounded-3xl p-6 shadow-sm">
            <div className="text-sm font-semibold text-gray-700 mb-4">
              Items Added (Last 14 Days)
            </div>

            <div style={{ height: 220 }}>
              {initialLoading ? (
                <div className="h-full bg-gray-100 rounded-2xl animate-pulse" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart key={chartKey} data={timeline}>
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

                    <YAxis allowDecimals={false} />
                    <CartesianGrid strokeDasharray="3 3" />
                    <RechartsTooltip
                      labelFormatter={(value) =>
                        new Date(value).toLocaleDateString("en-BW", {
                          day: "2-digit",
                          month: "long",
                          year: "numeric",
                        })
                      }
                    />

                    <Area
                      type="monotone"
                      dataKey="count"
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
  refreshing,
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