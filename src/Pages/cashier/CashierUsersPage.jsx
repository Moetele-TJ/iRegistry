import { useEffect, useMemo, useState } from "react";
import { Users } from "lucide-react";
import RippleButton from "../../components/RippleButton.jsx";
import { invokeWithAuth } from "../../lib/invokeWithAuth.js";
import { useToast } from "../../contexts/ToastContext.jsx";
import { useModal } from "../../contexts/ModalContext.jsx";
import PageSectionCard from "../shared/PageSectionCard.jsx";

function displayName(u) {
  const first = String(u?.first_name || "").trim();
  const last = String(u?.last_name || "").trim();
  const full = `${first} ${last}`.trim();
  return full || u?.email || u?.id || "—";
}

function fmtDateTime(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return String(iso);
  }
}

export default function CashierUsersPage() {
  const { addToast } = useToast();
  const { confirm } = useModal();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [q, setQ] = useState("");
  const [stationFilter, setStationFilter] = useState("");

  const [editingUser, setEditingUser] = useState(null);
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    police_station: "",
    village: "",
    ward: "",
  });

  async function load() {
    setLoading(true);
    setError("");
    try {
      const { data, error } = await invokeWithAuth("list-users");
      if (error || !data?.success) {
        throw new Error(data?.message || error?.message || "Failed to load users");
      }
      setUsers(data.users || []);
    } catch (e) {
      const msg = e?.message || "Failed to load users";
      setUsers([]);
      setError(msg);
      addToast({ type: "error", message: msg });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredUsers = useMemo(() => {
    const query = String(q || "").trim().toLowerCase();
    const stationQ = String(stationFilter || "").trim().toLowerCase();
    return (users || []).filter((u) => {
      if (!u) return false;
      if (stationQ) {
        const st = String(u.police_station || "").toLowerCase();
        if (!st.includes(stationQ)) return false;
      }
      if (!query) return true;
      const hay = [
        displayName(u),
        u.email || "",
        u.phone || "",
        u.id || "",
        u.id_number || "",
        u.status || "",
        u.police_station || "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(query);
    });
  }, [users, q, stationFilter]);

  function startEdit(u) {
    setEditingUser(u);
    setForm({
      first_name: u.first_name || "",
      last_name: u.last_name || "",
      email: u.email || "",
      phone: u.phone || "",
      police_station: u.police_station || "",
      village: u.village || "",
      ward: u.ward || "",
    });
  }

  function closeEdit() {
    setEditingUser(null);
    setForm({
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
      police_station: "",
      village: "",
      ward: "",
    });
  }

  async function saveEdit(e) {
    e.preventDefault();
    if (!editingUser?.id) return;
    const ok = await confirm({
      title: "Confirm",
      message: `Save changes for ${displayName(editingUser)}?`,
      confirmLabel: "Save changes",
      cancelLabel: "Cancel",
    }).catch(() => false);
    if (!ok) return;

    setLoading(true);
    setError("");
    try {
      const updates = {
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email,
        phone: form.phone,
        police_station: form.police_station,
        village: form.village,
        ward: form.ward,
      };

      const { data, error } = await invokeWithAuth("update-user", {
        body: { id: String(editingUser.id), updates },
      });

      if (error || !data?.success) {
        throw new Error(data?.message || error?.message || "Failed to update user");
      }

      addToast({ type: "success", message: "User updated." });
      await load();
      closeEdit();
    } catch (e2) {
      const msg = e2?.message || "Failed to update user";
      setError(msg);
      addToast({ type: "error", message: msg });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="px-1 py-2 sm:p-6 w-full max-w-none mx-0 sm:max-w-7xl sm:mx-auto">
        <PageSectionCard
          maxWidthClass="max-w-7xl"
          title="Users"
          subtitle="Cashier view: search users and update basic profile details. Roles, status, and deletion are admin-only."
          icon={<Users className="w-6 h-6 text-iregistrygreen shrink-0" />}
          actions={
            <RippleButton
              type="button"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm text-gray-800 shadow-sm hover:bg-gray-50 disabled:opacity-60"
              onClick={() => void load()}
              disabled={loading}
            >
              {loading ? "Refreshing…" : "Refresh"}
            </RippleButton>
          }
        >
        <div className="p-4 sm:p-6 space-y-6">
        {error ? (
          <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg p-3">
            {error}
          </div>
        ) : null}

        {editingUser ? (
          <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <h2 className="text-lg font-semibold">Edit user</h2>
                <div className="text-xs text-gray-500">
                  {displayName(editingUser)} • ID / Passport: {editingUser.id_number || "—"} • Last login:{" "}
                  {fmtDateTime(editingUser.last_login_at)}
                </div>
              </div>
              <button
                type="button"
                className="text-sm text-gray-500 hover:text-gray-700"
                onClick={closeEdit}
                disabled={loading}
              >
                Close
              </button>
            </div>

            <form onSubmit={(e) => void saveEdit(e)} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
              <div>
                <label className="text-xs text-gray-600">First name</label>
                <input
                  value={form.first_name}
                  onChange={(e) => setForm((s) => ({ ...s, first_name: e.target.value }))}
                  className="mt-1 w-full border rounded-lg px-3 py-2"
                  disabled={loading}
                />
              </div>
              <div>
                <label className="text-xs text-gray-600">Last name *</label>
                <input
                  value={form.last_name}
                  onChange={(e) => setForm((s) => ({ ...s, last_name: e.target.value }))}
                  className="mt-1 w-full border rounded-lg px-3 py-2"
                  required
                  disabled={loading}
                />
              </div>
              <div>
                <label className="text-xs text-gray-600">Phone *</label>
                <input
                  value={form.phone}
                  onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))}
                  className="mt-1 w-full border rounded-lg px-3 py-2"
                  required
                  disabled={loading}
                />
              </div>
              <div>
                <label className="text-xs text-gray-600">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
                  className="mt-1 w-full border rounded-lg px-3 py-2"
                  disabled={loading}
                />
              </div>
              <div>
                <label className="text-xs text-gray-600">Police station</label>
                <input
                  value={form.police_station}
                  onChange={(e) => setForm((s) => ({ ...s, police_station: e.target.value }))}
                  className="mt-1 w-full border rounded-lg px-3 py-2"
                  disabled={loading}
                />
              </div>
              <div>
                <label className="text-xs text-gray-600">Town / village</label>
                <input
                  value={form.village}
                  onChange={(e) => setForm((s) => ({ ...s, village: e.target.value }))}
                  className="mt-1 w-full border rounded-lg px-3 py-2"
                  disabled={loading}
                />
              </div>
              <div>
                <label className="text-xs text-gray-600">Ward / street</label>
                <input
                  value={form.ward}
                  onChange={(e) => setForm((s) => ({ ...s, ward: e.target.value }))}
                  className="mt-1 w-full border rounded-lg px-3 py-2"
                  disabled={loading}
                />
              </div>

              <div className="sm:col-span-3 flex justify-end gap-2 pt-2">
                <RippleButton
                  type="button"
                  className="px-4 py-2 rounded-lg border bg-white disabled:opacity-60"
                  onClick={closeEdit}
                  disabled={loading}
                >
                  Cancel
                </RippleButton>
                <RippleButton
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-iregistrygreen text-white disabled:opacity-60"
                  disabled={loading}
                >
                  {loading ? "Saving…" : "Save changes"}
                </RippleButton>
              </div>
            </form>
          </div>
        ) : null}

        <div className="rounded-xl border border-gray-100 bg-gray-50/40 p-4">
          <div className="flex flex-col lg:flex-row gap-3 lg:items-end lg:justify-between mb-4">
            <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:items-end flex-1 min-w-0">
              <div className="flex-1 min-w-[220px]">
                <label className="text-xs text-gray-600">Search</label>
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="mt-1 w-full border rounded-lg px-3 py-2"
                  placeholder="Name, email, phone, ID/passport…"
                />
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
                  setStationFilter("");
                }}
              >
                Clear
              </RippleButton>
            </div>
          </div>

          {loading && users.length === 0 ? (
            <div className="text-gray-500 py-6 text-center">Loading…</div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-gray-500 py-6 text-center">No users match your filters.</div>
          ) : (
            <div className="space-y-2">
              {filteredUsers.map((u) => (
                <div
                  key={u.id}
                  className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 lg:gap-8 border rounded-xl p-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-gray-900">
                      {displayName(u)}{" "}
                      <span className="text-xs text-gray-500 ml-2">{u.email || "—"}</span>
                    </div>
                    <div className="text-xs text-gray-500">
                      Status: {u.status || "—"} • Role: {u.role || "—"} • ID / Passport: {u.id_number || "—"} • Last login:{" "}
                      {fmtDateTime(u.last_login_at)} • ID: {u.id}
                      {u.police_station ? ` • Station: ${u.police_station}` : ""}
                    </div>
                    {u.suspended_reason && String(u.status || "").toLowerCase() !== "active" ? (
                      <div className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-md px-2 py-1 mt-2 max-w-xl">
                        Reason: {u.suspended_reason}
                      </div>
                    ) : null}
                  </div>

                  <div className="shrink-0">
                    <RippleButton
                      type="button"
                      className="px-4 py-2 rounded-lg bg-gray-100 text-sm disabled:opacity-60"
                      onClick={() => startEdit(u)}
                      disabled={loading}
                    >
                      Edit
                    </RippleButton>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        </div>
        </PageSectionCard>
      </div>
    </div>
  );
}

