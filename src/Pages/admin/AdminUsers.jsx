// src/Pages/admin/AdminUsers.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import RippleButton from "../../components/RippleButton.jsx";
import { invokeWithAuth } from "../../lib/invokeWithAuth.js";
import { useAdminSidebar } from "../../hooks/useAdminSidebar";
import { useToast } from "../../contexts/ToastContext.jsx";
import { useModal } from "../../contexts/ModalContext.jsx";

function displayName(u) {
  const first = String(u?.first_name || "").trim();
  const last = String(u?.last_name || "").trim();
  const full = `${first} ${last}`.trim();
  return full || u?.email || u?.id || "—";
}

export default function AdminUsers() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { confirm } = useModal();
  useAdminSidebar();

  const [users, setUsers] = useState([]);
  const [editing, setEditing] = useState(null); // user being edited or null
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    id_number: "",
    email: "",
    phone: "",
    role: "user",
    status: "active",
    status_reason: "",
    police_station: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [mode, setMode] = useState("idle"); // idle | add | edit

  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [stationFilter, setStationFilter] = useState("");

  const isEditing = mode === "edit" && !!editing;
  const isAdding = mode === "add";

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
          const msg = data?.message || error?.message || "Failed to load users";
          setError(msg);
          addToast({ type: "error", message: msg });
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
  }, [addToast]);

  function startEdit(u) {
    setMode("edit");
    setEditing(u.id);
    setForm({
      first_name: u.first_name || "",
      last_name: u.last_name || "",
      id_number: "",
      email: u.email || "",
      phone: u.phone || "",
      role: u.role || "user",
      status: u.status || "active",
      status_reason: "",
      police_station: u.police_station || "",
    });
  }

  function startAdd() {
    setMode("add");
    setEditing(null);
    setForm({
      first_name: "",
      last_name: "",
      id_number: "",
      email: "",
      phone: "",
      role: "user",
      status: "active",
      status_reason: "",
      police_station: "",
    });
  }

  function closeForm() {
    setEditing(null);
    setMode("idle");
    setForm({
      first_name: "",
      last_name: "",
      id_number: "",
      email: "",
      phone: "",
      role: "user",
      status: "active",
      status_reason: "",
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

  const filteredUsers = useMemo(() => {
    const query = String(q || "").trim().toLowerCase();
    const stationQ = String(stationFilter || "").trim().toLowerCase();
    const roleQ = String(roleFilter || "all").trim().toLowerCase();
    const statusQ = String(statusFilter || "all").trim().toLowerCase();

    return (users || []).filter((u) => {
      if (!u) return false;
      if (roleQ !== "all" && String(u.role || "").toLowerCase() !== roleQ) return false;
      if (statusQ !== "all" && String(u.status || "").toLowerCase() !== statusQ) return false;

      if (stationQ) {
        const st = String(u.police_station || "").toLowerCase();
        if (!st.includes(stationQ)) return false;
      }

      if (!query) return true;
      const hay = [
        displayName(u),
        u.email || "",
        u.id || "",
        u.id_number || "",
        u.phone || "",
        u.status || "",
        u.police_station || "",
      ]
        .join(" ")
        .toLowerCase();

      return hay.includes(query);
    });
  }, [users, q, roleFilter, statusFilter, stationFilter]);

  async function refresh() {
    const { data, error } = await invokeWithAuth("list-users");
    if (error || !data?.success) {
      throw new Error(data?.message || error?.message || "Failed to refresh");
    }
    setUsers(data.users || []);
  }

  async function handleSave(e) {
    e.preventDefault();

    setLoading(true);
    setError("");
    try {
      const prevStatus =
        isEditing && editing
          ? users.find((u) => String(u.id) === String(editing))?.status
          : undefined;
      const statusIsChanging =
        isAdding || (isEditing && typeof prevStatus === "string" && form.status !== prevStatus);
      const statusNeedsReason = form.status !== "active";

      if ((isAdding || isEditing) && statusIsChanging && statusNeedsReason && !String(form.status_reason || "").trim()) {
        throw new Error("A reason is required when setting status to suspended/disabled.");
      }

      if (isAdding) {
        const ok = await confirm({
          title: "Confirm",
          message: "Create this user? This will add a new user record.",
          confirmLabel: "Create",
          cancelLabel: "Cancel",
        }).catch(() => false);
        if (!ok) return;

        const { data, error } = await invokeWithAuth("admin-create-user", {
          body: {
            first_name: form.first_name,
            last_name: form.last_name,
            id_number: form.id_number,
            email: form.email,
            phone: form.phone,
            role: form.role,
            status: form.status,
            suspended_reason: statusNeedsReason ? String(form.status_reason || "").trim() : undefined,
            police_station: form.police_station,
          },
        });

        if (error || !data?.success) {
          throw new Error(data?.message || error?.message || "Failed to create user");
        }
        addToast({ type: "success", message: "User was created successfully." });
      } else if (isEditing) {
        const ok = await confirm({
          title: "Confirm",
          message: "Save changes to this user? This will update the user record immediately.",
          confirmLabel: "Save changes",
          cancelLabel: "Cancel",
        }).catch(() => false);
        if (!ok) return;

        const updates = {
          first_name: form.first_name,
          last_name: form.last_name,
          email: form.email,
          phone: form.phone,
          police_station: form.police_station,
          role: form.role,
          status: form.status,
          suspended_reason: statusNeedsReason ? String(form.status_reason || "").trim() : undefined,
        };

        const { data, error } = await invokeWithAuth("update-user", {
          body: { id: editing, updates },
        });

        if (error || !data?.success) {
          throw new Error(data?.message || error?.message || "Failed to update user");
        }
        if (String(data?.message || "").toLowerCase().includes("no changes")) {
          addToast({ type: "info", message: "No changes to save." });
        } else {
          addToast({ type: "success", message: "User was updated successfully." });
        }
      } else {
        return;
      }

      await refresh();
      closeForm();
    } catch (e) {
      const msg = e.message || "Failed to save user";
      setError(msg);
      addToast({ type: "error", message: msg });
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id) {
    const ok = await confirm({
      title: "Confirm",
      message: "Delete this user? This action cannot be undone.",
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
      danger: true,
    }).catch(() => false);
    if (!ok) return;
    setLoading(true);
    setError("");
    try {
      const { data, error } = await invokeWithAuth("delete-user", {
        body: { id },
      });
      if (error || !data?.success) {
        throw new Error(data?.message || error?.message || "Failed to delete user");
      }
      addToast({ type: "success", message: "User was deleted successfully." });
      await refresh();
      if (editing === id) closeForm();
    } catch (e) {
      const msg = e.message || "Failed to delete user";
      setError(msg);
      addToast({ type: "error", message: msg });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="p-4 sm:p-6 w-full max-w-7xl mx-auto">
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

        {/* Toolbar: Add + filters */}
        <div className="bg-white rounded-lg p-4 shadow-sm mb-6">
          <div className="flex flex-col lg:flex-row gap-3 lg:items-end lg:justify-between">
            <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:items-end flex-1 min-w-0">
              <div className="flex-1 min-w-[220px]">
                <label className="text-xs text-gray-600">Search</label>
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="mt-1 w-full border rounded-lg px-3 py-2"
                  placeholder="Name, email, ID…"
                />
              </div>
              <div className="sm:w-44 min-w-[170px]">
                <label className="text-xs text-gray-600">Role</label>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="mt-1 w-full border rounded-lg px-3 py-2"
                >
                  <option value="all">All</option>
                  <option value="user">User</option>
                  <option value="police">Police</option>
                  <option value="cashier">Cashier</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="sm:w-44 min-w-[170px]">
                <label className="text-xs text-gray-600">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="mt-1 w-full border rounded-lg px-3 py-2"
                >
                  <option value="all">All</option>
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                  <option value="disabled">Disabled</option>
                </select>
              </div>
              <div className="sm:w-56 min-w-[220px]">
                <label className="text-xs text-gray-600">Station</label>
                <input
                  value={stationFilter}
                  onChange={(e) => setStationFilter(e.target.value)}
                  className="mt-1 w-full border rounded-lg px-3 py-2"
                  placeholder="Gantsi Police…"
                />
              </div>
              <RippleButton
                type="button"
                className="px-3 py-2 rounded border bg-white shrink-0"
                onClick={() => {
                  setQ("");
                  setRoleFilter("all");
                  setStatusFilter("all");
                  setStationFilter("");
                }}
              >
                Clear
              </RippleButton>
            </div>
            <RippleButton
              type="button"
              className="px-4 py-2 rounded bg-iregistrygreen text-white disabled:opacity-60 shrink-0"
              onClick={startAdd}
              disabled={loading}
            >
              Add user
            </RippleButton>
          </div>
        </div>

        {/* Add/Edit form (shown only when active) */}
        {mode !== "idle" ? (
          <div className="bg-white rounded-lg p-4 shadow-sm mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">
                {isAdding ? "Add user" : "Edit user"}
              </h2>
              <button
                type="button"
                className="text-sm text-gray-500 hover:text-gray-700"
                onClick={closeForm}
                disabled={loading}
              >
                Close
              </button>
            </div>

            <form onSubmit={handleSave} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
              <div>
                <label className="text-xs text-gray-600">First name</label>
                <input
                  value={form.first_name}
                  onChange={(e) => setForm((s) => ({ ...s, first_name: e.target.value }))}
                  className="mt-1 w-full border rounded-lg px-3 py-2"
                  placeholder="Jane"
                  disabled={loading}
                />
              </div>

              <div>
                <label className="text-xs text-gray-600">Last name *</label>
                <input
                  value={form.last_name}
                  onChange={(e) => setForm((s) => ({ ...s, last_name: e.target.value }))}
                  className="mt-1 w-full border rounded-lg px-3 py-2"
                  placeholder="Doe"
                  required
                  disabled={loading}
                />
              </div>

              {isAdding ? (
                <div>
                  <label className="text-xs text-gray-600">ID / Passport *</label>
                  <input
                    value={form.id_number}
                    onChange={(e) => setForm((s) => ({ ...s, id_number: e.target.value }))}
                    className="mt-1 w-full border rounded-lg px-3 py-2"
                    placeholder="123456789"
                    required
                    disabled={loading}
                  />
                </div>
              ) : null}

              <div>
                <label className="text-xs text-gray-600">Email</label>
                <input
                  value={form.email}
                  onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
                  className="mt-1 w-full border rounded-lg px-3 py-2"
                  placeholder="jane@example.com"
                  disabled={loading}
                />
              </div>

              <div>
                <label className="text-xs text-gray-600">Phone *</label>
                <input
                  value={form.phone}
                  onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))}
                  className="mt-1 w-full border rounded-lg px-3 py-2"
                  placeholder="+267…"
                  required
                  disabled={loading}
                />
              </div>

              <div>
                <label className="text-xs text-gray-600">Role</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm((s) => ({ ...s, role: e.target.value }))}
                  className="mt-1 w-full border rounded-lg px-3 py-2"
                  disabled={loading}
                >
                  <option value="user">User</option>
                  <option value="police">Police</option>
                  <option value="cashier">Cashier</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-gray-600">Status</label>
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, status: e.target.value }))
                  }
                  className="mt-1 w-full border rounded-lg px-3 py-2"
                  disabled={loading}
                >
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                  <option value="disabled">Disabled</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-gray-600">Police station</label>
                <input
                  value={form.police_station}
                  onChange={(e) => setForm((s) => ({ ...s, police_station: e.target.value }))}
                  className="mt-1 w-full border rounded-lg px-3 py-2"
                  placeholder="(optional)"
                  disabled={loading}
                />
              </div>

              {form.status !== "active" ? (
                <div className="sm:col-span-3">
                  <label className="text-xs text-gray-600">
                    Reason for {form.status}
                  </label>
                  <textarea
                    value={form.status_reason}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, status_reason: e.target.value }))
                    }
                    className="mt-1 w-full border rounded-lg px-3 py-2"
                    placeholder="Required"
                    required
                    disabled={loading}
                  />
                </div>
              ) : null}

              <div className="sm:col-span-3 flex gap-2 justify-end pt-2">
                <RippleButton
                  type="button"
                  className="px-4 py-2 rounded border bg-white disabled:opacity-60"
                  onClick={closeForm}
                  disabled={loading}
                >
                  Cancel
                </RippleButton>
                <RippleButton
                  type="submit"
                  className="px-4 py-2 rounded bg-iregistrygreen text-white disabled:opacity-60"
                  disabled={loading}
                >
                  {isAdding ? "Create user" : "Save changes"}
                </RippleButton>
              </div>
            </form>
          </div>
        ) : null}

        <div className="bg-white rounded-lg p-4 shadow-sm">
          <h2 className="text-lg font-semibold mb-3">Users</h2>

          {loading && users.length === 0 ? (
            <div className="text-gray-500 py-6 text-center">Loading…</div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-gray-500 py-6 text-center">No users yet.</div>
          ) : (
            <div className="space-y-2">
              {filteredUsers.map((u) => (
                <div key={u.id} className="flex items-center justify-between border rounded-lg p-3">
                  <div>
                    <div className="font-medium text-gray-900">
                      {displayName(u)}{" "}
                      <span className="text-xs text-gray-500 ml-2">{u.email || "—"}</span>
                    </div>
                    <div className="text-xs text-gray-500">
                      Role: {roleLabel[u.role] || u.role || "—"} • Status: {u.status || "—"} • ID: {u.id}
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