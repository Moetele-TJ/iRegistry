// src/Pages/AdminUsers.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import RippleButton from "../../components/RippleButton.jsx";

/**
 * Very small users manager scaffold.
 * - stores users in localStorage at key: ireg_users_v1
 * - fields: id, name, email, role
 * - roles: Police Officer | Admin | User
 */

const STORAGE_KEY = "ireg_users_v1";

function loadUsers() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}
function saveUsers(users) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
    window.dispatchEvent(new Event("ireg:users-updated"));
  } catch (e) {
    console.error("Failed to save users", e);
  }
}

function makeUserId() {
  const n = Math.floor(Math.random() * 9000) + 1000;
  return 'USR-${String(n).padStart(4, "0")}';
}

export default function AdminUsers() {
  const navigate = useNavigate();

  const [users, setUsers] = useState([]);
  const [editing, setEditing] = useState(null); // user being edited or null
  const [form, setForm] = useState({ name: "", email: "", role: "User" });

  useEffect(() => {
    setUsers(loadUsers());
  }, []);

  function startAdd() {
    setEditing(null);
    setForm({ name: "", email: "", role: "User" });
  }

  function startEdit(u) {
    setEditing(u.id);
    setForm({ name: u.name || "", email: u.email || "", role: u.role || "User" });
  }

  function cancelEdit() {
    setEditing(null);
    setForm({ name: "", email: "", role: "User" });
  }

  function handleSave(e) {
    e.preventDefault();
    const all = loadUsers();
    if (editing) {
      const next = all.map((x) => (x.id === editing ? { ...x, ...form } : x));
      saveUsers(next);
      setUsers(next);
      setEditing(null);
    } else {
      const id = makeUserId();
      const newUser = { id, ...form };
      const next = [newUser, ...all];
      saveUsers(next);
      setUsers(next);
    }
    setForm({ name: "", email: "", role: "User" });
  }

  function handleDelete(id) {
    if (!confirm("Delete this user? This action cannot be undone.")) return;
    const next = users.filter((u) => u.id !== id);
    saveUsers(next);
    setUsers(next);
    if (editing === id) cancelEdit();
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
            <RippleButton className="py-2 px-3 rounded-lg bg-gray-100 text-gray-800" onClick={() => navigate("/dashboard")}>
              Back
            </RippleButton>
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 shadow-sm mb-6">
          <form onSubmit={handleSave} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <div>
              <label className="text-xs text-gray-600">Full name</label>
              <input
                value={form.name}
                onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
                className="mt-1 w-full border rounded-lg px-3 py-2"
                placeholder="Jane Doe"
                required
              />
            </div>

            <div>
              <label className="text-xs text-gray-600">Email</label>
              <input
                value={form.email}
                onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
                className="mt-1 w-full border rounded-lg px-3 py-2"
                placeholder="jane@example.com"
              />
            </div>

            <div>
              <label className="text-xs text-gray-600">Role</label>
              <select
                value={form.role}
                onChange={(e) => setForm((s) => ({ ...s, role: e.target.value }))}
                className="mt-1 w-full border rounded-lg px-3 py-2"
              >
                <option>Police Officer</option>
                <option>Admin</option>
                <option>User</option>
              </select>
            </div>

            <div className="sm:col-span-3 flex gap-2 justify-end pt-2">
              {editing ? (
                <>
                  <RippleButton type="button" className="px-4 py-2 rounded border bg-white" onClick={cancelEdit}>
                    Cancel
                  </RippleButton>
                  <RippleButton type="submit" className="px-4 py-2 rounded bg-iregistrygreen text-white">
                    Save changes
                  </RippleButton>
                </>
              ) : (
                <>
                  <RippleButton type="button" className="px-4 py-2 rounded border bg-white" onClick={() => { setForm({ name: "", email: "", role: "User" }); }}>
                    Reset
                  </RippleButton>
                  <RippleButton type="submit" className="px-4 py-2 rounded bg-iregistrygreen text-white">
                    Add user
                  </RippleButton>
                </>
              )}
            </div>
          </form>
        </div>

        <div className="bg-white rounded-lg p-4 shadow-sm">
          <h2 className="text-lg font-semibold mb-3">Users</h2>

          {users.length === 0 ? (
            <div className="text-gray-500 py-6 text-center">No users yet.</div>
          ) : (
            <div className="space-y-2">
              {users.map((u) => (
                <div key={u.id} className="flex items-center justify-between border rounded-lg p-3">
                  <div>
                    <div className="font-medium text-gray-900">{u.name} <span className="text-xs text-gray-500 ml-2">{u.email}</span></div>
                    <div className="text-xs text-gray-500">Role: {u.role || "User"} • ID: {u.id}</div>
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