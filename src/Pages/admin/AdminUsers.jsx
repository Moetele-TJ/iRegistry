// src/Pages/admin/AdminUsers.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import RippleButton from "../../components/RippleButton.jsx";
import { invokeWithAuth } from "../../lib/invokeWithAuth.js";

function displayName(u) {
  const first = String(u?.first_name || "").trim();
  const last = String(u?.last_name || "").trim();
  const full = `${first} ${last}`.trim();
  return full || u?.email || u?.id || "—";
}

export default function AdminUsers() {
  const navigate = useNavigate();

  const [users, setUsers] = useState([]);
  const [editing, setEditing] = useState(null); // user being edited or null
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    role: "user",
    police_station: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isEditing = !!editing;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const { data, error } = await invokeWithAuth("list-users");
        if (cancelled) return;
        if (error || !data?.success) {
          setUsers([]);
          setError(data?.message || error?.message || "Failed to load users");
          return;
        }
        setUsers(data.users || []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  function startEdit(u) {
    setEditing(u.id);
    setForm({
      first_name: u.first_name || "",
      last_name: u.last_name || "",
      email: u.email || "",
      role: u.role || "user",
      police_station: u.police_station || "",
    });
  }

  function cancelEdit() {
    setEditing(null);
    setForm({
      first_name: "",
      last_name: "",
      email: "",
      role: "user",
      police_station: "",
    });
  }

  const roleLabel = useMemo(
    () => ({
      admin: "Admin",
      cashier: "Cashier",
      police: "Police",
      user: "User",
    }),
    []
  );

  async function refresh() {
    const { data, error } = await invokeWithAuth("list-users");
    if (error || !data?.success) {
      throw new Error(data?.message || error?.message || "Failed to refresh");
    }
    setUsers(data.users || []);
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!editing) return;

    setLoading(true);
    setError("");
    try {
      const updates = {
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email,
        police_station: form.police_station,
        role: form.role,
      };

      const { data, error } = await invokeWithAuth("update-user", {
        body: { id: editing, updates },
      });

      if (error || !data?.success) {
        throw new Error(data?.message || error?.message || "Failed to update user");
      }

      await refresh();
      cancelEdit();
    } catch (e) {
      setError(e.message || "Failed to update user");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm("Delete this user? This action cannot be undone.")) return;
    setLoading(true);
    setError("");
    try {
      const { data, error } = await invokeWithAuth("delete-user", {
        body: { id },
      });
      if (error || !data?.success) {
        throw new Error(data?.message || error?.message || "Failed to delete user");
      }
      await refresh();
      if (editing === id) cancelEdit();
    } catch (e) {
      setError(e.message || "Failed to delete user");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="p-4 sm:p-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-iregistrygreen">Manage Users</h1>
            <p className="text-sm text-gray-500">Create and manage application users and roles.</p>
          </div>

          <div className="flex gap-2">
            <RippleButton className="py-2 px-3 rounded-lg bg-gray-100 text-gray-800" onClick={() => navigate("/admindashboard")}>
              Back
            </RippleButton>
          </div>
        </div>

        {error ? (
          <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg p-3">
            {error}
          </div>
        ) : null}

        <div className="bg-white rounded-lg p-4 shadow-sm mb-6">
          <form onSubmit={handleSave} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <div>
              <label className="text-xs text-gray-600">First name</label>
              <input
                value={form.first_name}
                onChange={(e) => setForm((s) => ({ ...s, first_name: e.target.value }))}
                className="mt-1 w-full border rounded-lg px-3 py-2"
                placeholder="Jane"
                disabled={!isEditing || loading}
              />
            </div>

            <div>
              <label className="text-xs text-gray-600">Last name</label>
              <input
                value={form.last_name}
                onChange={(e) => setForm((s) => ({ ...s, last_name: e.target.value }))}
                className="mt-1 w-full border rounded-lg px-3 py-2"
                placeholder="Doe"
                disabled={!isEditing || loading}
              />
            </div>

            <div>
              <label className="text-xs text-gray-600">Email</label>
              <input
                value={form.email}
                onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
                className="mt-1 w-full border rounded-lg px-3 py-2"
                placeholder="jane@example.com"
                disabled={!isEditing || loading}
              />
            </div>

            <div>
              <label className="text-xs text-gray-600">Role</label>
              <select
                value={form.role}
                onChange={(e) => setForm((s) => ({ ...s, role: e.target.value }))}
                className="mt-1 w-full border rounded-lg px-3 py-2"
                disabled={!isEditing || loading}
              >
                <option value="user">User</option>
                <option value="police">Police</option>
                <option value="cashier">Cashier</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-gray-600">Police station</label>
              <input
                value={form.police_station}
                onChange={(e) => setForm((s) => ({ ...s, police_station: e.target.value }))}
                className="mt-1 w-full border rounded-lg px-3 py-2"
                placeholder="(optional)"
                disabled={!isEditing || loading}
              />
            </div>

            <div className="sm:col-span-3 flex gap-2 justify-end pt-2">
              <RippleButton
                type="button"
                className="px-4 py-2 rounded border bg-white disabled:opacity-60"
                onClick={cancelEdit}
                disabled={!isEditing || loading}
              >
                Cancel
              </RippleButton>
              <RippleButton
                type="submit"
                className="px-4 py-2 rounded bg-iregistrygreen text-white disabled:opacity-60"
                disabled={!isEditing || loading}
              >
                Save changes
              </RippleButton>
            </div>
          </form>
        </div>

        <div className="bg-white rounded-lg p-4 shadow-sm">
          <h2 className="text-lg font-semibold mb-3">Users</h2>

          {loading && users.length === 0 ? (
            <div className="text-gray-500 py-6 text-center">Loading…</div>
          ) : users.length === 0 ? (
            <div className="text-gray-500 py-6 text-center">No users yet.</div>
          ) : (
            <div className="space-y-2">
              {users.map((u) => (
                <div key={u.id} className="flex items-center justify-between border rounded-lg p-3">
                  <div>
                    <div className="font-medium text-gray-900">
                      {displayName(u)}{" "}
                      <span className="text-xs text-gray-500 ml-2">{u.email || "—"}</span>
                    </div>
                    <div className="text-xs text-gray-500">
                      Role: {roleLabel[u.role] || u.role || "—"} • ID: {u.id}
                      {u.police_station ? ` • Station: ${u.police_station}` : ""}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <RippleButton className="px-3 py-1 rounded bg-gray-100 text-sm" onClick={() => startEdit(u)}>
                      Edit
                    </RippleButton>

                    <RippleButton className="px-3 py-1 rounded bg-red-50 text-red-600 border text-sm" onClick={() => handleDelete(u.id)}>
                      Delete
                    </RippleButton>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}