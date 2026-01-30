// src/Pages/HomePage.jsx
import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";

import RippleButton from "../components/RippleButton.jsx";
import { useItems } from "../contexts/ItemsContext.jsx";

// charts
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
  const { items = [] } = useItems();

  // high-level stats (safe for public view)
  const stats = useMemo(() => {
    const total = items.length;
    const stolen = items.filter((i) => i.status === "Stolen").length;
    const active = total - stolen;
    return { total, active, stolen };
  }, [items]);

  // timeline (last 14 days)
  const timelineData = useMemo(() => {
    const days = 14;
    const buckets = {};

    function key(d) {
      return d.toISOString().slice(5, 10);
    }

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      buckets[key(d)] = 0;
    }

    items.forEach((it) => {
      const d = new Date(it.createdOn || it.updatedOn);
      const k = key(d);
      if (k in buckets) buckets[k] += 1;
    });

    return Object.entries(buckets).map(([date, count]) => ({ date, count }));
  }, [items]);

  const pieData = [
    { name: "Active", value: stats.active },
    { name: "Stolen", value: stats.stolen },
  ];

  return (
    <div className="min-h-screen bg-gray-100">

      <div className="p-6 max-w-6xl mx-auto">
        {/* Hero */}
        <div className="bg-white rounded-2xl p-6 shadow-sm mb-6">
          <h1 className="text-3xl font-extrabold text-iregistrygreen">
            iRegistry
          </h1>
          <p className="text-gray-600 mt-2 max-w-2xl">
            A centralized registry for personal and institutional assets —
            designed to support citizens, administrators, and law enforcement.
          </p>

          <div className="mt-4 flex gap-3">
            <RippleButton
              className="px-5 py-2 rounded-lg bg-iregistrygreen text-white"
              onClick={() => navigate("/login")}
            >
              Login
            </RippleButton>

            <RippleButton
              className="px-5 py-2 rounded-lg bg-gray-100 text-gray-800"
              onClick={() => navigate("/signup")}
            >
              Create Account
            </RippleButton>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <StatCard title="Total registered items" value={stats.total} />
          <StatCard title="Active items" value={stats.active} />
          <StatCard title="Reported stolen" value={stats.stolen} red />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Timeline */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="text-sm font-medium mb-2">
              Items added (last 14 days)
            </div>
            <div style={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timelineData}>
                  <defs>
                    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={IREG_GREEN} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={IREG_GREEN} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" />
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
            </div>
          </div>

          {/* Status pie */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="text-sm font-medium mb-2">
              Status distribution
            </div>
            <div style={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={3}
                  >
                    <Cell fill={IREG_GREEN} />
                    <Cell fill={IREG_RED} />
                  </Pie>
                  <Legend />
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// small stat card
function StatCard({ title, value, red }) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm">
      <div className="text-xs text-gray-500">{title}</div>
      <div
        className={
          "text-3xl font-extrabold mt-1 " +
          (red ? "text-red-600" : "text-gray-900")
        }
      >
        {value}
      </div>
    </div>
  );
}