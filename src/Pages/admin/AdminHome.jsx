// src/Pages/admin/AdminHome.jsx
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function AdminHome() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    items: 0,
    alerts: 0,
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  async function fetchStats() {
    setLoading(true);

    try {
      const [
        usersRes,
        activeUsersRes,
        itemsRes,
        alertsRes,
      ] = await Promise.all([
        supabase.from("users").select("id", { count: "exact", head: true }),
        supabase
          .from("users")
          .select("id", { count: "exact", head: true })
          .eq("status", "active"),
        supabase.from("items").select("id", { count: "exact", head: true }),
        supabase
          .from("audit_logs")
          .select("id", { count: "exact", head: true })
          .eq("severity", "high"),
      ]);

      setStats({
        totalUsers: usersRes.count ?? 0,
        activeUsers: activeUsersRes.count ?? 0,
        items: itemsRes.count ?? 0,
        alerts: alertsRes.count ?? 0,
      });
    } catch (err) {
      console.error("Failed to load admin stats", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">
          Admin Overview
        </h1>
        <p className="text-gray-500">
          System health, activity, and quick actions
        </p>
      </div>

      {/* Stats */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Users"
          value={loading ? "—" : stats.totalUsers}
        />
        <StatCard
          label="Active Users"
          value={loading ? "—" : stats.activeUsers}
        />
        <StatCard
          label="Registered Items"
          value={loading ? "—" : stats.items}
        />
        <StatCard
          label="Security Alerts"
          value={loading ? "—" : stats.alerts}
          danger
        />
      </section>

    </div>
  );
}

/* =========================
   Stat Card
   ========================= */
function StatCard({ label, value, danger }) {
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border">
      <p className="text-sm text-gray-500">{label}</p>
      <p
        className={`text-2xl font-bold ${
          danger ? "text-red-600" : "text-gray-800"
        }`}
      >
        {value}
      </p>
    </div>
  );
}