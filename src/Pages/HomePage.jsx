// src/Pages/HomePage.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import RippleButton from "../components/RippleButton.jsx";
import { usePublicStats } from "../hooks/usePublicStats";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

const IREG_GREEN = "#1FA463";
const IREG_RED = "#E53E3E";

export default function HomePage() {
  const navigate = useNavigate();
  const { stats, loading } = usePublicStats();

  const totals = stats?.totals || {};
  const timeline = stats?.timeline || [];
  const active = totals.activeItems ?? 0;
  const stolen = totals.stolenItems ?? 0;
  const total = totals.totalItems ?? 0;

  const pieData = [
    { name: "Active", value: active },
    { name: "Stolen", value: stolen },
  ];

  return (
    <div className="min-h-screen bg-gray-100">

      <div className="p-6 max-w-6xl mx-auto">

        {/* HERO */}
        <div className="bg-gradient-to-br from-iregistrygreen to-emerald-600 rounded-3xl p-8 text-white shadow-xl mb-8">
          <h1 className="text-4xl font-extrabold tracking-tight">
            iRegistry
          </h1>

          <p className="mt-3 max-w-2xl text-white/90">
            Botswana’s centralized asset registry platform —
            connecting citizens, institutions, and law enforcement.
          </p>

          <div className="mt-6 flex gap-3">
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
        </div>

        {/* STAT CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
          <StatCard
            title="Total Registered"
            value={total}
            loading={loading}
          />
          <StatCard
            title="Active Items"
            value={active}
            loading={loading}
          />
          <StatCard
            title="Reported Stolen"
            value={stolen}
            loading={loading}
            red
          />
        </div>

        {/* CHARTS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Timeline */}
          <div className="bg-white rounded-3xl p-6 shadow-sm">
            <div className="text-sm font-semibold text-gray-700 mb-4">
              Items Added (Last 14 Days)
            </div>

            <div style={{ height: 220 }}>
              {loading ? (
                <div className="h-full bg-gray-100 rounded-2xl animate-pulse" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={timeline}>
                    <defs>
                      <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={IREG_GREEN} stopOpacity={0.4} />
                        <stop offset="100%" stopColor={IREG_GREEN} stopOpacity={0} />
                      </linearGradient>
                    </defs>

                    <XAxis
                      dataKey="date"
                      tickFormatter={(value) =>
                        new Date(value).toLocaleDateString("en-BW", {
                          day: "2-digit",
                          month: "short",
                        })
                      }
                    />

                    <YAxis allowDecimals={false} />
                    <CartesianGrid strokeDasharray="3 3" />
                    <Tooltip />

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

          {/* Status Pie */}
          <div className="bg-white rounded-3xl p-6 shadow-sm">
            <div className="text-sm font-semibold text-gray-700 mb-4">
              Status Distribution
            </div>

            <div style={{ height: 220 }}>
              {loading ? (
                <div className="h-full bg-gray-100 rounded-2xl animate-pulse" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={4}
                    >
                      <Cell fill={IREG_GREEN} />
                      <Cell fill={IREG_RED} />
                    </Pie>
                    <Legend />
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, red, loading }) {
  return (
    <div className="bg-white rounded-3xl p-6 shadow-sm">
      <div className="text-xs text-gray-500">{title}</div>

      {loading ? (
        <div className="h-8 bg-gray-200 rounded mt-2 animate-pulse" />
      ) : (
        <div
          className={
            "text-4xl font-extrabold mt-2 " +
            (red ? "text-red-600" : "text-gray-900")
          }
        >
          {value ?? 0}
        </div>
      )}
    </div>
  );
}