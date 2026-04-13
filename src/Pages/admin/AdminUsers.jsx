// src/Pages/admin/AdminUsers.jsx
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Users } from "lucide-react";
import RippleButton from "../../components/RippleButton.jsx";
import ConfirmModal from "../../components/ConfirmModal.jsx";
import { invokeWithAuth } from "../../lib/invokeWithAuth.js";
import { useToast } from "../../contexts/ToastContext.jsx";
import { useModal } from "../../contexts/ModalContext.jsx";
import { useAuth } from "../../contexts/AuthContext.jsx";
import PageSectionCard from "../shared/PageSectionCard.jsx";
import { deriveUserStatus, isInactiveLockout } from "../../lib/userState.js";

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

const ROLE_OPTIONS = [
  { value: "user", label: "User" },
  { value: "police", label: "Police" },
  { value: "cashier", label: "Cashier" },
  { value: "admin", label: "Admin" },
];

const SUSPEND_REASONS = [
  "Policy violation",
  "Fraud / abuse",
  "Non-payment / chargeback",
  "Account requested closure",
  "Duplicate account",
  "Other",
];

/**
 * Role dropdown width matches the combined width of the action buttons (measured).
 */
function UserRowActionControls({
  userId,
  role,
  statusLower,
  self,
  rowBusy,
  loading,
  onRoleChange,
  onMobileAction,
  onSuspend,
  onDisable,
  onReactivate,
  onEdit,
  onDelete,
}) {
  const btnRowRef = useRef(null);
  const [actionsWidthPx, setActionsWidthPx] = useState(null);
  const [mobileAction, setMobileAction] = useState("");
  /** Suspended or disabled: no edit / role change — only reactivate or delete. */
  const lockoutRestricted =
    statusLower === "suspended" || statusLower === "disabled";

  useLayoutEffect(() => {
    const el = btnRowRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.getBoundingClientRect().width;
      if (w > 0) setActionsWidthPx(Math.ceil(w));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [statusLower, self, rowBusy, loading]);

  const measured = actionsWidthPx != null;

  return (
    <div
      className={`flex flex-col shrink-0 self-start max-w-full min-w-0 ${
        measured ? "gap-2" : "gap-0"
      }`}
      style={
        measured
          ? { width: actionsWidthPx, boxSizing: "border-box" }
          : undefined
      }
    >
      {/* Mobile: single action dropdown (no buttons/role dropdown) */}
      <div className="sm:hidden">
        <label className="text-xs text-gray-600" htmlFor={`user-actions-${userId}`}>
          Actions
        </label>
        <select
          id={`user-actions-${userId}`}
          value={mobileAction}
          onChange={(e) => {
            const v = e.target.value;
            setMobileAction(v);
            if (!v) return;
            onMobileAction?.(v);
            // reset so the same action can be selected again
            setTimeout(() => setMobileAction(""), 0);
          }}
          className="mt-1 w-full min-w-0 max-w-full border rounded-lg px-2 py-2 text-sm disabled:opacity-50 box-border bg-white"
          disabled={loading || rowBusy}
        >
          <option value="">Select…</option>
          {lockoutRestricted ? (
            <>
              <option value="reactivate">Reactivate</option>
              <option value="delete">Delete…</option>
            </>
          ) : (
            <>
              <option value="change_role">Change role…</option>
              {statusLower === "active" ? (
                <>
                  <option value="suspend">Suspend…</option>
                  <option value="disable">Disable…</option>
                </>
              ) : (
                <option value="reactivate">Reactivate</option>
              )}
              <option value="edit">Edit</option>
              <option value="delete">Delete…</option>
            </>
          )}
        </select>
      </div>

      {!lockoutRestricted ? (
        <div
          className={
            measured ? "min-w-0 hidden sm:block" : "h-0 overflow-hidden opacity-0 pointer-events-none m-0 p-0 border-0"
          }
          aria-hidden={!measured}
        >
          <label className="text-xs text-gray-600" htmlFor={`user-role-${userId}`}>
            Change role
          </label>
          <select
            id={`user-role-${userId}`}
            value={role || "user"}
            onChange={(e) => onRoleChange(e.target.value)}
            className="mt-1 w-full min-w-0 max-w-full border rounded-lg px-2 py-1.5 text-sm disabled:opacity-50 box-border"
            disabled={loading || rowBusy || self}
            title={self ? "Cannot change your own role" : "Change role"}
          >
            {ROLE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <div ref={btnRowRef} className="hidden sm:flex flex-row flex-nowrap items-center gap-2 self-start">
        {statusLower !== "active" ? (
          <RippleButton
            type="button"
            className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-sm disabled:opacity-50 whitespace-nowrap"
            onClick={onReactivate}
            disabled={loading || rowBusy || self}
          >
            Reactivate
          </RippleButton>
        ) : null}
        {statusLower === "active" ? (
          <>
            <RippleButton
              type="button"
              className="px-3 py-1.5 rounded-lg bg-amber-500 text-white text-sm disabled:opacity-50 whitespace-nowrap"
              onClick={onSuspend}
              disabled={loading || rowBusy || self}
            >
              Suspend
            </RippleButton>
            <RippleButton
              type="button"
              className="px-3 py-1.5 rounded-lg bg-gray-800 text-white text-sm disabled:opacity-50 whitespace-nowrap"
              onClick={onDisable}
              disabled={loading || rowBusy || self}
            >
              Disable
            </RippleButton>
          </>
        ) : null}
        {!lockoutRestricted ? (
          <RippleButton
            className="px-3 py-1.5 rounded-lg bg-gray-100 text-sm whitespace-nowrap"
            onClick={onEdit}
            disabled={loading || rowBusy}
          >
            Edit
          </RippleButton>
        ) : null}
        <RippleButton
          className="px-3 py-1.5 rounded-lg bg-red-50 text-red-600 border text-sm disabled:opacity-50 whitespace-nowrap"
          onClick={onDelete}
          disabled={loading || rowBusy || self}
        >
          Delete
        </RippleButton>
      </div>
    </div>
  );
}

export default function AdminUsers({ variant = "admin" } = {}) {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const { addToast } = useToast();
  const { confirm } = useModal();

  const canAdminister = String(variant || "admin").toLowerCase() === "admin";
  const profileListBase = canAdminister ? "/admindashboard/profile" : "/cashierdashboard/profile";

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
    village: "",
    ward: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [mode, setMode] = useState("idle"); // idle | add | edit

  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [stationFilter, setStationFilter] = useState("");

  const [quickRowId, setQuickRowId] = useState("");
  const [suspendModal, setSuspendModal] = useState({ isOpen: false, user: null });
  const [suspendReason, setSuspendReason] = useState("");
  const [suspendPreset, setSuspendPreset] = useState("");
  const [suspendStatus, setSuspendStatus] = useState("suspended");

  const [roleModal, setRoleModal] = useState({ isOpen: false, user: null });
  const [roleNext, setRoleNext] = useState("");

  const isEditing = mode === "edit" && !!editing;
  const isAdding = mode === "add";
  const currentUserId = currentUser?.id != null ? String(currentUser.id) : "";

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
    if (isInactiveLockout(u)) {
      addToast({
        type: "error",
        message: "Suspended or disabled accounts cannot be edited. Reactivate the account first.",
      });
      return;
    }
    setMode("edit");
    setEditing(u.id);
    setForm({
      first_name: u.first_name || "",
      last_name: u.last_name || "",
      id_number: u.id_number || "",
      email: u.email || "",
      phone: u.phone || "",
      role: u.role || "user",
      status: deriveUserStatus(u) || "active",
      status_reason: u.suspended_reason || "",
      police_station: u.police_station || "",
      village: u.village || "",
      ward: u.ward || "",
    });
  }

  function startAdd() {
    if (!canAdminister) return;
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
      village: "",
      ward: "",
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
      village: "",
      ward: "",
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
      if (statusQ !== "all" && deriveUserStatus(u) !== statusQ) return false;

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
        deriveUserStatus(u) || "",
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
      if (isEditing && editing) {
        const row = users.find((u) => String(u.id) === String(editing));
        if (row && isInactiveLockout(row)) {
          throw new Error("Suspended or disabled accounts cannot be edited. Reactivate the account first.");
        }
      }

      const prevStatus =
        isEditing && editing
          ? users.find((u) => String(u.id) === String(editing))?.status
          : undefined;
      const statusIsChanging =
        isAdding || (isEditing && typeof prevStatus === "string" && form.status !== prevStatus);
      const statusNeedsReason = form.status !== "active";

      if (canAdminister) {
        if ((isAdding || isEditing) && statusIsChanging && statusNeedsReason && !String(form.status_reason || "").trim()) {
          throw new Error("A reason is required when setting status to suspended/disabled.");
        }
      }

      if (isAdding) {
        if (!canAdminister) return;
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
          village: form.village,
          ward: form.ward,
          ...(canAdminister
            ? {
              role: form.role,
              status: form.status,
              suspended_reason: statusNeedsReason ? String(form.status_reason || "").trim() : undefined,
            }
            : {}),
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

  function isSelf(id) {
    return currentUserId && String(id) === currentUserId;
  }

  async function quickUpdateUser(id, updates, successMsg) {
    setQuickRowId(String(id));
    setError("");
    try {
      const { data, error } = await invokeWithAuth("update-user", {
        body: { id: String(id), updates },
      });
      if (error || !data?.success) {
        throw new Error(data?.message || error?.message || "Update failed");
      }
      addToast({
        type: "success",
        message: successMsg || "User updated.",
      });
      await refresh();
      return true;
    } catch (e) {
      const msg = e.message || "Update failed";
      setError(msg);
      addToast({ type: "error", message: msg });
      return false;
    } finally {
      setQuickRowId("");
    }
  }

  function openRoleModal(u) {
    if (!u?.id) return;
    if (isInactiveLockout(u)) {
      addToast({
        type: "error",
        message: "Cannot change role while the account is suspended or disabled. Reactivate first.",
      });
      return;
    }
    if (isSelf(u.id)) {
      addToast({ type: "error", message: "You cannot change your own role." });
      return;
    }
    setRoleNext(String(u.role || "user"));
    setRoleModal({ isOpen: true, user: u });
  }

  function closeRoleModal() {
    if (quickRowId) return;
    setRoleModal({ isOpen: false, user: null });
    setRoleNext("");
  }

  async function submitRoleChange() {
    const u = roleModal.user;
    if (!u?.id) return;
    if (isInactiveLockout(u)) {
      addToast({
        type: "error",
        message: "Cannot change role while the account is suspended or disabled. Reactivate first.",
      });
      return;
    }
    const next = String(roleNext || "").toLowerCase();
    if (!next || next === String(u.role || "").toLowerCase()) return;
    const label = roleLabel[next] || next;
    await quickUpdateUser(u.id, { role: next }, `Role updated to ${label}.`);
  }

  async function quickChangeRole(u, nextRole) {
    if (isInactiveLockout(u)) {
      addToast({
        type: "error",
        message: "Cannot change role while the account is suspended or disabled. Reactivate first.",
      });
      return;
    }
    if (isSelf(u.id)) {
      addToast({ type: "error", message: "You cannot change your own role." });
      return;
    }
    const r = String(nextRole || "").toLowerCase();
    if (!r || r === String(u.role || "").toLowerCase()) return;
    const label = roleLabel[r] || r;
    const ok = await confirm({
      title: "Confirm",
      message: `Change role for ${displayName(u)} to ${label}?`,
      confirmLabel: "Change role",
      cancelLabel: "Cancel",
      variant: "warning",
    }).catch(() => false);
    if (!ok) return;
    await quickUpdateUser(u.id, { role: r }, `Role updated to ${label}.`);
  }

  function openSuspendModal(u, kind) {
    if (isSelf(u.id)) {
      addToast({ type: "error", message: "You cannot suspend or disable your own account." });
      return;
    }
    setSuspendStatus(kind);
    setSuspendPreset("");
    setSuspendReason(u.suspended_reason || "");
    setSuspendModal({ isOpen: true, user: u });
  }

  function closeSuspendModal() {
    if (quickRowId) return;
    setSuspendModal({ isOpen: false, user: null });
    setSuspendReason("");
    setSuspendPreset("");
  }

  async function submitSuspend() {
    const u = suspendModal.user;
    if (!u?.id) return;
    const reason = String(suspendReason || "").trim();
    if (!reason) return;
    const status = suspendStatus === "disabled" ? "disabled" : "suspended";
    const ok = await quickUpdateUser(
      u.id,
      status === "disabled"
        ? { status, disabled_reason: reason }
        : { status, suspended_reason: reason },
      status === "disabled" ? "User disabled." : "User suspended.",
    );
    if (ok) closeSuspendModal();
  }

  async function quickReactivate(u) {
    if (isSelf(u.id)) return;
    const st = deriveUserStatus(u);
    if (st === "active") {
      addToast({ type: "info", message: "User is already active." });
      return;
    }
    const ok = await confirm({
      title: "Confirm",
      message: `Reactivate ${displayName(u)}? They will be able to sign in again.`,
      confirmLabel: "Reactivate",
      cancelLabel: "Cancel",
      variant: "success",
    }).catch(() => false);
    if (!ok) return;
    await quickUpdateUser(u.id, { status: "active" }, "User reactivated.");
  }

  async function handleDelete(id) {
    if (isSelf(id)) {
      addToast({ type: "error", message: "You cannot delete your own account here." });
      return;
    }
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

  const suspendVerb = suspendStatus === "disabled" ? "Disable" : "Suspend";

  return (
    <div className="min-h-screen bg-gray-100">
      <ConfirmModal
        isOpen={roleModal.isOpen}
        onClose={closeRoleModal}
        onConfirm={() => void submitRoleChange()}
        title="Change role"
        message={`Select a new role for ${roleModal.user ? displayName(roleModal.user) : "this user"}.`}
        confirmLabel={quickRowId ? "Saving…" : "Change role"}
        cancelLabel="Cancel"
        variant="warning"
        confirmDisabled={
          !!quickRowId ||
          !roleModal.user ||
          !String(roleNext || "").trim() ||
          String(roleNext || "").toLowerCase() === String(roleModal.user?.role || "").toLowerCase()
        }
      >
        <div>
          <label className="text-xs text-gray-600">Role</label>
          <select
            value={roleNext}
            onChange={(e) => setRoleNext(e.target.value)}
            className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-white"
            disabled={!!quickRowId}
          >
            {ROLE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </ConfirmModal>

      <ConfirmModal
        isOpen={suspendModal.isOpen}
        onClose={closeSuspendModal}
        onConfirm={() => void submitSuspend()}
        title={`${suspendVerb} user`}
        message={`${suspendVerb} ${suspendModal.user ? displayName(suspendModal.user) : "this user"}? A reason is required.`}
        confirmLabel={quickRowId ? "Saving…" : suspendVerb}
        cancelLabel="Cancel"
        danger
        confirmDisabled={!!quickRowId || !String(suspendReason || "").trim()}
      >
        <div className="space-y-2">
          <div>
            <label className="text-xs text-gray-600">Quick reason</label>
            <select
              value={suspendPreset}
              onChange={(e) => {
                const v = e.target.value;
                setSuspendPreset(v);
                if (v && v !== "Other") setSuspendReason(v);
                if (v === "Other") setSuspendReason("");
              }}
              className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-white"
              disabled={!!quickRowId}
            >
              <option value="">Select…</option>
              {SUSPEND_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-600">Reason (required)</label>
            <textarea
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
              className="mt-1 w-full border rounded-lg px-3 py-2 text-sm min-h-[88px]"
              placeholder="Explain why this account is being suspended or disabled…"
              disabled={!!quickRowId}
            />
          </div>
        </div>
      </ConfirmModal>

      <div className="px-1 py-2 sm:p-6 w-full max-w-none mx-0 sm:max-w-7xl sm:mx-auto">
        <PageSectionCard
          maxWidthClass="max-w-7xl"
          title={canAdminister ? "Manage Users" : "Users"}
          subtitle={
            canAdminister
              ? "Change roles, suspend, disable, or reactivate from each user row, or use Edit for the full form."
              : "Search users and update basic profile details. Roles, status, and deletion are admin-only."
          }
          icon={<Users className="w-6 h-6 text-iregistrygreen shrink-0" />}
          actions={
            <RippleButton
              className="py-2 px-3 rounded-xl border border-gray-200 bg-white text-sm text-gray-800 shadow-sm hover:bg-gray-50"
              onClick={() => navigate(canAdminister ? "/admindashboard" : "/cashierdashboard")}
            >
              Back
            </RippleButton>
          }
        >
        <div className="p-4 sm:p-6 space-y-6">
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
              {canAdminister ? (
                <>
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
                </>
              ) : null}
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
                  if (canAdminister) {
                    setRoleFilter("all");
                    setStatusFilter("all");
                  }
                  setStationFilter("");
                }}
              >
                Clear
              </RippleButton>
            </div>
            {canAdminister ? (
              <RippleButton
                type="button"
                className="px-4 py-2 rounded bg-iregistrygreen text-white disabled:opacity-60 shrink-0"
                onClick={startAdd}
                disabled={loading}
              >
                Add user
              </RippleButton>
            ) : null}
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

              {canAdminister ? (
                <>
                  <div>
                    <label className="text-xs text-gray-600">Role</label>
                    <select
                      value={form.role}
                      onChange={(e) => setForm((s) => ({ ...s, role: e.target.value }))}
                      className="mt-1 w-full border rounded-lg px-3 py-2"
                      disabled={loading || (isEditing && isSelf(editing))}
                    >
                      <option value="user">User</option>
                      <option value="police">Police</option>
                      <option value="cashier">Cashier</option>
                      <option value="admin">Admin</option>
                    </select>
                    {isEditing && isSelf(editing) ? (
                      <p className="text-xs text-gray-400 mt-1">You cannot change your own role.</p>
                    ) : null}
                  </div>

                  <div>
                    <label className="text-xs text-gray-600">Status</label>
                    <select
                      value={form.status}
                      onChange={(e) =>
                        setForm((s) => ({ ...s, status: e.target.value }))
                      }
                      className="mt-1 w-full border rounded-lg px-3 py-2"
                      disabled={loading || (isEditing && isSelf(editing))}
                    >
                      <option value="active">Active</option>
                      <option value="suspended">Suspended</option>
                      <option value="disabled">Disabled</option>
                    </select>
                    {isEditing && isSelf(editing) ? (
                      <p className="text-xs text-gray-400 mt-1">Use another admin account to change your status.</p>
                    ) : null}
                  </div>
                </>
              ) : null}

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

              <div>
                <label className="text-xs text-gray-600">Village</label>
                <input
                  value={form.village}
                  onChange={(e) => setForm((s) => ({ ...s, village: e.target.value }))}
                  className="mt-1 w-full border rounded-lg px-3 py-2"
                  placeholder="(optional)"
                  disabled={loading}
                />
              </div>

              <div>
                <label className="text-xs text-gray-600">Ward</label>
                <input
                  value={form.ward}
                  onChange={(e) => setForm((s) => ({ ...s, ward: e.target.value }))}
                  className="mt-1 w-full border rounded-lg px-3 py-2"
                  placeholder="(optional)"
                  disabled={loading}
                />
              </div>

              {canAdminister && form.status !== "active" ? (
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
              {filteredUsers.map((u) => {
                const st = deriveUserStatus(u);
                const rowBusy = quickRowId === String(u.id);
                const self = isSelf(u.id);
                return (
                  <div key={u.id} className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 lg:gap-8 border rounded-lg p-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-gray-900 min-w-0">
                        <Link
                          to={`${profileListBase}?user=${encodeURIComponent(u.id)}`}
                          className="text-iregistrygreen font-semibold hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-iregistrygreen/35 rounded-sm"
                        >
                          {displayName(u)}
                        </Link>
                        <span className="text-xs text-gray-500 ml-2">{u.email || "—"}</span>
                      </div>
                      <div className="text-xs text-gray-500">
                        Role: {roleLabel[u.role] || u.role || "—"} • Status: {st || "—"} • ID / Passport: {u.id_number || "—"} • Last login: {fmtDateTime(u.last_login_at)} • ID: {u.id}
                        {u.police_station ? ` • Station: ${u.police_station}` : ""}
                      </div>
                      {(u.suspended_reason || u.disabled_reason) && st !== "active" ? (
                        <div className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-md px-2 py-1 mt-2 max-w-xl">
                          Reason: {u.suspended_reason || u.disabled_reason}
                        </div>
                      ) : null}
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-start gap-3 shrink-0">
                      <UserRowActionControls
                        key={u.id}
                        userId={u.id}
                        role={u.role}
                        statusLower={st}
                        self={self}
                        rowBusy={rowBusy}
                        loading={loading}
                        onRoleChange={(next) => void quickChangeRole(u, next)}
                        onMobileAction={(action) => {
                          if (action === "change_role") return openRoleModal(u);
                          if (action === "suspend") return openSuspendModal(u, "suspended");
                          if (action === "disable") return openSuspendModal(u, "disabled");
                          if (action === "reactivate") return void quickReactivate(u);
                          if (action === "edit") return startEdit(u);
                          if (action === "delete") return void handleDelete(u.id);
                        }}
                        onSuspend={() => openSuspendModal(u, "suspended")}
                        onDisable={() => openSuspendModal(u, "disabled")}
                        onReactivate={() => void quickReactivate(u)}
                        onEdit={() => startEdit(u)}
                        onDelete={() => handleDelete(u.id)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        </div>
        </PageSectionCard>
      </div>
    </div>
  );
}