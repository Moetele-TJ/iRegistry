// src/Pages/admin/AdminUsers.jsx
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Plus, Users } from "lucide-react";
import RippleButton from "../../components/RippleButton.jsx";
import ConfirmModal from "../../components/ConfirmModal.jsx";
import PoliceStationSelect from "../../components/PoliceStationSelect.jsx";
import { invokeWithAuth } from "../../lib/invokeWithAuth.js";
import { useToast } from "../../contexts/ToastContext.jsx";
import { useModal } from "../../contexts/ModalContext.jsx";
import { useAuth } from "../../contexts/AuthContext.jsx";
import PageSectionCard from "../shared/PageSectionCard.jsx";
import { deriveUserStatus, isInactiveLockout } from "../../lib/userState.js";
import { displayUser, formatUserLocation } from "../../lib/userDisplay.js";
import { useListUsers } from "../../hooks/useListUsers.js";
import { useAddItemPreflight } from "../../hooks/useAddItemPreflight.js";

function displayName(u) {
  return displayUser(u) || "—";
}

function displayNameWithItemCount(u) {
  const name = displayName(u);
  const n = Math.max(0, Math.floor(Number(u?.active_items_count) || 0));
  return `${name} (${n})`;
}

function UserMetaItem({ label, value }) {
  const v = value != null && String(value).trim() !== "" ? value : "—";
  return (
    <span className="inline">
      <span className="font-semibold text-gray-600">{label}:</span>{" "}
      <span className="font-normal text-gray-800">{v}</span>
    </span>
  );
}

function MetaSep() {
  return <span className="text-emerald-600 font-semibold select-none px-0.5" aria-hidden>•</span>;
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

const MSG_NOTHING_TO_SUBMIT =
  "Nothing to submit — you have not changed any information.";

const ROW_HIGHLIGHT_MS = 4500;

function normStr(v) {
  return String(v ?? "").trim();
}

function parseSortableTime(iso) {
  if (iso == null || iso === "") return NaN;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? NaN : t;
}

/** Client-side sort for the manage users list. @param {"asc"|"desc"} dir */
function compareAdminUsersRow(a, b, sortKey, dir) {
  const asc = dir === "asc";
  const sign = asc ? 1 : -1;
  const tieId = () => String(a?.id ?? "").localeCompare(String(b?.id ?? ""), undefined, { numeric: true });
  const cmpStr = (xa, xb) => {
    const c = String(xa ?? "").localeCompare(String(xb ?? ""), undefined, { sensitivity: "base", numeric: true });
    if (c !== 0) return c * sign;
    return tieId();
  };
  const cmpDateNullLast = (isoA, isoB) => {
    const ta = parseSortableTime(isoA);
    const tb = parseSortableTime(isoB);
    const na = Number.isNaN(ta);
    const nb = Number.isNaN(tb);
    if (na && nb) return tieId();
    if (na) return 1;
    if (nb) return -1;
    const d = ta - tb;
    if (d !== 0) return asc ? d : -d;
    return tieId();
  };

  switch (sortKey) {
    case "first_name":
      return cmpStr(normStr(a?.first_name), normStr(b?.first_name));
    case "last_name":
      return cmpStr(normStr(a?.last_name), normStr(b?.last_name));
    case "role":
      return cmpStr(String(a?.role || "").toLowerCase(), String(b?.role || "").toLowerCase());
    case "status":
      return cmpStr(deriveUserStatus(a) || "", deriveUserStatus(b) || "");
    case "police_station":
      return cmpStr(normStr(a?.police_station), normStr(b?.police_station));
    case "created_at":
      return cmpDateNullLast(a?.created_at, b?.created_at);
    case "last_login_at":
      return cmpDateNullLast(a?.last_login_at, b?.last_login_at);
    default:
      return tieId();
  }
}

const USER_SORT_OPTIONS = [
  { value: "first_name", label: "First name" },
  { value: "last_name", label: "Last name" },
  { value: "role", label: "Role" },
  { value: "status", label: "Status" },
  { value: "police_station", label: "Police station" },
  { value: "created_at", label: "Date created" },
  { value: "last_login_at", label: "Last login" },
];

const USER_SORT_DIR_OPTIONS = [
  { value: "asc", label: "Ascending" },
  { value: "desc", label: "Descending" },
];

function normEmail(v) {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
}

function normIdNumber(v) {
  return String(v ?? "").replace(/\s+/g, "").trim();
}

function dobInputStr(v) {
  const s = String(v ?? "").trim();
  if (!s) return "";
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : s;
}

function dobFromRow(row) {
  const v = row?.date_of_birth;
  if (typeof v === "string" && v.length >= 10) return v.slice(0, 10);
  return "";
}

function toDateInputValue(v) {
  if (v == null || v === "") return "";
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

/** True when the edit form differs from the server row (user management). */
function adminEditHasChanges(row, form, canAdminister) {
  if (!row) return true;
  if (normStr(form.first_name) !== normStr(row.first_name)) return true;
  if (normStr(form.last_name) !== normStr(row.last_name)) return true;
  if (normEmail(form.email) !== normEmail(row.email ?? "")) return true;
  if (normStr(form.phone) !== normStr(row.phone)) return true;
  if (normStr(form.police_station) !== normStr(row.police_station)) return true;
  if (normStr(form.village) !== normStr(row.village)) return true;
  if (normStr(form.ward) !== normStr(row.ward)) return true;
  if (normIdNumber(form.id_number) !== normIdNumber(row.id_number)) return true;
  if (dobInputStr(form.date_of_birth) !== dobFromRow(row)) return true;
  if (!canAdminister) return false;

  const prev = deriveUserStatus(row);
  if (String(form.role || "user").toLowerCase() !== String(row.role || "user").toLowerCase()) {
    return true;
  }
  if (String(form.status || "active") !== prev) return true;

  const reason = normStr(form.status_reason);
  if (prev === "suspended" && reason !== normStr(row.suspended_reason)) return true;
  if (prev === "disabled" && reason !== normStr(row.disabled_reason)) return true;

  return false;
}

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
  canAdminister,
  showAddItem,
  onRoleChange,
  onMobileAction,
  onAddItem,
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
  const isDeleted = statusLower === "deleted";

  /** Cashiers may only open Edit; suspend/reactivate/delete/role are admin-only on the server. */
  const showAdminActions = !!canAdminister;

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
  }, [statusLower, self, rowBusy, loading, canAdminister, showAddItem]);

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
        {((lockoutRestricted || isDeleted) && !showAdminActions) ? (
          <p className="text-xs text-gray-500 mt-1 max-w-[18rem] leading-snug">
            {isDeleted
              ? "Deleted accounts can only be restored by an administrator."
              : "Suspended or disabled accounts can only be reactivated or removed by an administrator."}
          </p>
        ) : (
          <>
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
                setTimeout(() => setMobileAction(""), 0);
              }}
              className="mt-1 w-full min-w-0 max-w-full border rounded-lg px-2 py-2 text-sm disabled:opacity-50 box-border bg-white"
              disabled={loading || rowBusy}
            >
              <option value="">Select…</option>
              {isDeleted ? (
                <option value="reactivate">Restore account</option>
              ) : lockoutRestricted ? (
                <>
                  <option value="reactivate">Reactivate</option>
                  <option value="delete">Delete…</option>
                </>
              ) : (
                <>
                  {showAdminActions ? (
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
                      <option value="delete">Delete…</option>
                    </>
                  ) : null}
                  {showAddItem ? <option value="add_item">Add item</option> : null}
                  <option value="edit">Edit</option>
                </>
              )}
            </select>
          </>
        )}
      </div>

      {!lockoutRestricted && showAdminActions ? (
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
        {showAdminActions && isDeleted ? (
          <RippleButton
            type="button"
            className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-sm disabled:opacity-50 whitespace-nowrap"
            onClick={onReactivate}
            disabled={loading || rowBusy || self}
          >
            Restore
          </RippleButton>
        ) : null}
        {showAdminActions && !isDeleted && statusLower !== "active" ? (
          <RippleButton
            type="button"
            className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-sm disabled:opacity-50 whitespace-nowrap"
            onClick={onReactivate}
            disabled={loading || rowBusy || self}
          >
            Reactivate
          </RippleButton>
        ) : null}
        {showAdminActions && statusLower === "active" ? (
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
        {showAddItem ? (
          <RippleButton
            type="button"
            className="px-3 py-1.5 rounded-lg bg-iregistrygreen text-white text-sm whitespace-nowrap disabled:opacity-50"
            onClick={onAddItem}
            disabled={loading || rowBusy}
          >
            Add item
          </RippleButton>
        ) : null}
        {!lockoutRestricted && !isDeleted ? (
          <RippleButton
            className="px-3 py-1.5 rounded-lg bg-gray-100 text-sm whitespace-nowrap"
            onClick={onEdit}
            disabled={loading || rowBusy}
          >
            Edit
          </RippleButton>
        ) : null}
        {showAdminActions && !isDeleted ? (
          <RippleButton
            className="px-3 py-1.5 rounded-lg bg-red-50 text-red-600 border text-sm disabled:opacity-50 whitespace-nowrap"
            onClick={onDelete}
            disabled={loading || rowBusy || self}
          >
            Delete
          </RippleButton>
        ) : null}
        {lockoutRestricted && !showAdminActions ? (
          <span className="text-xs text-gray-500 max-w-[14rem] leading-snug">
            Reactivation requires an administrator.
          </span>
        ) : null}
      </div>
    </div>
  );
}

export default function AdminUsers({ variant = "admin" } = {}) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user: currentUser } = useAuth();
  const { addToast } = useToast();
  const { confirm } = useModal();
  const { goToAddItem, tasksLoading: addItemPreflightLoading } = useAddItemPreflight();

  const canAdminister = String(variant || "admin").toLowerCase() === "admin";
  const canCreateUser = canAdminister || String(variant || "").toLowerCase() === "cashier";
  const profileListBase = canAdminister ? "/admin/profile" : "/cashier/profile";

  const {
    users,
    loading: usersDirectoryLoading,
    error: usersDirectoryError,
    refresh: refreshUsers,
  } = useListUsers();
  const [editing, setEditing] = useState(null); // user being edited or null
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    id_number: "",
    date_of_birth: "",
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
  const [sortBy, setSortBy] = useState("last_name");
  const [sortDir, setSortDir] = useState("asc");

  const [quickRowId, setQuickRowId] = useState("");
  const [suspendModal, setSuspendModal] = useState({ isOpen: false, user: null });
  const [suspendReason, setSuspendReason] = useState("");
  const [suspendPreset, setSuspendPreset] = useState("");
  const [suspendStatus, setSuspendStatus] = useState("suspended");

  const [roleModal, setRoleModal] = useState({ isOpen: false, user: null });
  const [roleNext, setRoleNext] = useState("");

  const editFormSectionRef = useRef(null);
  const editDeepLinkHandledRef = useRef(false);
  const [highlightUserId, setHighlightUserId] = useState(null);

  const isEditing = mode === "edit" && !!editing;
  const isAdding = mode === "add";
  const currentUserId = currentUser?.id != null ? String(currentUser.id) : "";

  useEffect(() => {
    if (!usersDirectoryError) return;
    setError(usersDirectoryError);
    addToast({ type: "error", message: usersDirectoryError });
  }, [usersDirectoryError, addToast]);

  useLayoutEffect(() => {
    if (mode === "idle") return;
    const el = editFormSectionRef.current;
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    if (typeof el.focus === "function") {
      try {
        el.focus({ preventScroll: true });
      } catch {
        /* ignore */
      }
    }
  }, [mode, editing]);

  useEffect(() => {
    if (!highlightUserId) return;
    const id = String(highlightUserId);
    const t = window.setTimeout(() => setHighlightUserId(null), ROW_HIGHLIGHT_MS);
    const row = document.getElementById(`admin-user-row-${id}`);
    row?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    return () => clearTimeout(t);
  }, [highlightUserId]);

  useEffect(() => {
    const uid = searchParams.get("user");
    const modeParam = searchParams.get("mode");
    if (!uid || modeParam !== "edit" || editDeepLinkHandledRef.current) return;
    if (usersDirectoryLoading) return;

    const u = (users || []).find((row) => String(row.id) === String(uid));
    if (!u) {
      if ((users || []).length > 0) {
        editDeepLinkHandledRef.current = true;
        addToast({ type: "error", message: "User not found in the directory." });
        setSearchParams({}, { replace: true });
      }
      return;
    }

    editDeepLinkHandledRef.current = true;
    setSearchParams({}, { replace: true });
    if (isInactiveLockout(u)) {
      addToast({
        type: "error",
        message: "Suspended or disabled accounts cannot be edited. Reactivate the account first.",
      });
      return;
    }
    startEdit(u);
    setHighlightUserId(String(uid));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once when list loads for ?user=&mode=edit
  }, [users, usersDirectoryLoading, searchParams]);

  function startEdit(u) {
    if (isInactiveLockout(u)) {
      addToast({
        type: "error",
        message: "Suspended or disabled accounts cannot be edited. Reactivate the account first.",
      });
      return;
    }
    setHighlightUserId(null);
    setMode("edit");
    setEditing(u.id);
    setForm({
      first_name: u.first_name || "",
      last_name: u.last_name || "",
      id_number: u.id_number || "",
      date_of_birth: toDateInputValue(u.date_of_birth),
      email: u.email || "",
      phone: u.phone || "",
      role: u.role || "user",
      status: deriveUserStatus(u) || "active",
      status_reason: u.suspended_reason || u.disabled_reason || "",
      police_station: u.police_station || "",
      village: u.village || "",
      ward: u.ward || "",
    });
  }

  function startAdd() {
    if (!canCreateUser) return;
    setHighlightUserId(null);
    setMode("add");
    setEditing(null);
    setForm({
      first_name: "",
      last_name: "",
      id_number: "",
      date_of_birth: "",
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

  function handleAddItemForUser(u) {
    const st = deriveUserStatus(u);
    if (st !== "active") {
      addToast({
        type: "error",
        message: "Items can only be registered for active accounts. Reactivate the account first.",
      });
      return;
    }
    void goToAddItem({
      ownerId: String(u.id),
      ownerLabel: displayName(u),
    });
  }

  function closeForm() {
    setEditing(null);
    setMode("idle");
    setForm({
      first_name: "",
      last_name: "",
      id_number: "",
      date_of_birth: "",
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

    const list = (users || []).filter((u) => {
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
    const sorted = [...list];
    sorted.sort((a, b) => compareAdminUsersRow(a, b, sortBy, sortDir));
    return sorted;
  }, [users, q, roleFilter, statusFilter, stationFilter, sortBy, sortDir]);

  async function refresh() {
    const r = await refreshUsers();
    if (!r.ok) throw new Error(r.message || "Failed to refresh");
  }

  async function handleSave(e) {
    e.preventDefault();
    setError("");

    const row = isEditing && editing ? users.find((u) => String(u.id) === String(editing)) : null;
    if (isEditing && editing && !row) {
      const msg = "This user is not in the current list. Refresh the page and try again.";
      setError(msg);
      addToast({ type: "error", message: msg });
      return;
    }
    if (row && isInactiveLockout(row)) {
      const msg = "Suspended or disabled accounts cannot be edited. Reactivate the account first.";
      setError(msg);
      addToast({ type: "error", message: msg });
      return;
    }

    if (isAdding || isEditing) {
      if (!normStr(form.last_name)) {
        const msg = "Last name is required.";
        setError(msg);
        addToast({ type: "error", message: msg });
        return;
      }
      if (!normStr(form.phone)) {
        const msg = "Phone number is required.";
        setError(msg);
        addToast({ type: "error", message: msg });
        return;
      }
      if (isAdding || isEditing) {
        const idn = String(form.id_number ?? "").replace(/\s+/g, "").trim();
        if (!idn) {
          const msg = "National ID / Passport is required.";
          setError(msg);
          addToast({ type: "error", message: msg });
          return;
        }
        if (!normStr(form.village)) {
          const msg = "Town / village is required.";
          setError(msg);
          addToast({ type: "error", message: msg });
          return;
        }
        if (!normStr(form.ward)) {
          const msg = "Ward / street is required.";
          setError(msg);
          addToast({ type: "error", message: msg });
          return;
        }
        if (!normStr(form.police_station)) {
          const msg = "Nearest police station is required.";
          setError(msg);
          addToast({ type: "error", message: msg });
          return;
        }
      }
    }

    if (isEditing && row && !adminEditHasChanges(row, form, canAdminister)) {
      addToast({ type: "info", message: MSG_NOTHING_TO_SUBMIT });
      return;
    }

    const prevDerived = row ? deriveUserStatus(row) : undefined;
    const statusIsChanging =
      isAdding ||
      (isEditing && typeof prevDerived === "string" && form.status !== prevDerived);
    const statusNeedsReason = form.status !== "active";

    if (canAdminister) {
      if (
        (isAdding || isEditing) &&
        statusIsChanging &&
        statusNeedsReason &&
        !String(form.status_reason || "").trim()
      ) {
        const msg = "A reason is required when setting status to suspended/disabled.";
        setError(msg);
        addToast({ type: "error", message: msg });
        return;
      }
    }

    setLoading(true);
    try {
      let rowIdToHighlight = null;

      if (isAdding) {
        if (!canCreateUser) return;
        const ok = await confirm({
          title: "Confirm",
          message: "Create this user? This will add a new user record.",
          confirmLabel: "Create",
          cancelLabel: "Cancel",
        }).catch(() => false);
        if (!ok) return;

        const reasonTrim = String(form.status_reason || "").trim();
        const { data, error } = await invokeWithAuth("admin-create-user", {
          body: {
            first_name: form.first_name,
            last_name: form.last_name,
            id_number: form.id_number,
            email: form.email,
            phone: form.phone,
            village: form.village,
            ward: form.ward,
            police_station: form.police_station,
            role: canAdminister ? form.role : "user",
            status: canAdminister ? form.status : "active",
            ...(dobInputStr(form.date_of_birth)
              ? { date_of_birth: dobInputStr(form.date_of_birth) }
              : {}),
            ...(form.status === "suspended" && reasonTrim
              ? { suspended_reason: reasonTrim }
              : {}),
            ...(form.status === "disabled" && reasonTrim
              ? { disabled_reason: reasonTrim }
              : {}),
          },
        });

        if (error || !data?.success) {
          throw new Error(data?.message || error?.message || "Failed to create user");
        }
        if (data?.user?.id != null) {
          rowIdToHighlight = String(data.user.id);
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

        const reasonTrim = String(form.status_reason || "").trim();
        const idn = normIdNumber(form.id_number);
        const rowIdNorm = normIdNumber(row.id_number);
        const rowDob = dobFromRow(row);
        const formDob = dobInputStr(form.date_of_birth);
        const updates = {
          first_name: form.first_name,
          last_name: form.last_name,
          email: form.email,
          phone: form.phone,
          police_station: form.police_station,
          village: form.village,
          ward: form.ward,
          ...(idn !== rowIdNorm ? { id_number: idn } : {}),
          ...(formDob !== rowDob ? { date_of_birth: formDob || null } : {}),
          ...(canAdminister
            ? {
                role: form.role,
                status: form.status,
                ...(form.status === "suspended" && reasonTrim
                  ? { suspended_reason: reasonTrim }
                  : {}),
                ...(form.status === "disabled" && reasonTrim
                  ? { disabled_reason: reasonTrim }
                  : {}),
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
          addToast({ type: "info", message: MSG_NOTHING_TO_SUBMIT });
          await refresh();
          return;
        }
        rowIdToHighlight = String(editing);
        addToast({ type: "success", message: "User was updated successfully." });
      } else {
        return;
      }

      await refresh();
      closeForm();

      if (rowIdToHighlight) {
        setHighlightUserId(rowIdToHighlight);
      }
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
      if (String(data?.message || "").toLowerCase().includes("no changes")) {
        addToast({ type: "info", message: MSG_NOTHING_TO_SUBMIT });
        await refresh();
        return true;
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
    const deleted = st === "deleted";
    const ok = await confirm({
      title: "Confirm",
      message: deleted
        ? `Restore ${displayName(u)}? They will be able to sign in again.`
        : `Reactivate ${displayName(u)}? They will be able to sign in again.`,
      confirmLabel: deleted ? "Restore" : "Reactivate",
      cancelLabel: "Cancel",
      variant: "success",
    }).catch(() => false);
    if (!ok) return;
    await quickUpdateUser(
      u.id,
      { status: "active" },
      deleted ? "User restored." : "User reactivated.",
    );
  }

  async function handleDelete(id) {
    if (isSelf(id)) {
      addToast({ type: "error", message: "You cannot delete your own account here." });
      return;
    }
    const ok = await confirm({
      title: "Confirm",
      message:
        "Close this registry account? The user will be removed from active lists. An administrator can restore the account later.",
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
      if (editing != null && String(editing) === String(id)) closeForm();
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

      <div className="w-full px-0 py-2 sm:py-3">
        <PageSectionCard
          maxWidthClass="max-w-full"
          headerPaddingClass="px-3 sm:px-4 py-4 sm:py-5"
          title={canAdminister ? "Manage Users" : "Users"}
          subtitle={
            canAdminister
              ? "Change roles, suspend, disable, or reactivate from each user row, or use Edit for the full form."
              : "Search users, add new accounts, and update basic profile details. Roles, status, and deletion are admin-only."
          }
          icon={<Users className="w-6 h-6 text-iregistrygreen shrink-0" />}
          actions={
            <RippleButton
              className="py-2 px-3 rounded-xl border border-gray-200 bg-white text-sm text-gray-800 shadow-sm hover:bg-gray-50"
              onClick={() => navigate(canAdminister ? "/admin" : "/cashier")}
            >
              Back
            </RippleButton>
          }
        >
        <div className="px-2 py-4 sm:px-3 sm:py-5 space-y-5">
        {error ? (
          <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg p-3">
            {error}
          </div>
        ) : null}

        {/* Toolbar: Add + filters */}
        <div className="bg-white rounded-lg px-2 py-3 sm:px-3 sm:py-4 shadow-sm mb-5">
          <div className="flex flex-col lg:flex-row gap-3 lg:items-end lg:justify-between">
            <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:items-end flex-1 min-w-0">
              <div className="flex-1 min-w-[220px]">
                <label className="text-xs text-gray-600">Search</label>
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="mt-1 w-full border rounded-lg px-3 py-2"
                  placeholder="Name, email, phone, ID number…"
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
                  placeholder="Gantsi Police Station…"
                />
              </div>
              <div className="sm:w-48 min-w-[11rem]">
                <label className="text-xs text-gray-600" htmlFor="admin-users-sort-by">
                  Sort by
                </label>
                <select
                  id="admin-users-sort-by"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-white"
                >
                  {USER_SORT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:w-44 min-w-[10rem]">
                <label className="text-xs text-gray-600" htmlFor="admin-users-sort-dir">
                  Order
                </label>
                <select
                  id="admin-users-sort-dir"
                  value={sortDir}
                  onChange={(e) => setSortDir(e.target.value)}
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-white"
                >
                  {USER_SORT_DIR_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
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
                  setSortBy("last_name");
                  setSortDir("asc");
                }}
              >
                Clear
              </RippleButton>
            </div>
            {canCreateUser ? (
              <RippleButton
                type="button"
                className="px-4 py-2 rounded bg-iregistrygreen text-white disabled:opacity-60 shrink-0"
                onClick={startAdd}
                disabled={loading || usersDirectoryLoading}
              >
                Add user
              </RippleButton>
            ) : null}
          </div>
        </div>

        {/* Add/Edit form (shown only when active) */}
        {mode !== "idle" ? (
          <div
            ref={editFormSectionRef}
            tabIndex={-1}
            className="bg-white rounded-lg px-2 py-3 sm:px-3 sm:py-4 shadow-sm mb-5 scroll-mt-6 outline-none focus-visible:ring-2 focus-visible:ring-iregistrygreen/35 focus-visible:ring-offset-2"
          >
            <div className="flex items-center justify-between mb-3 gap-3">
              <div>
                <h2 className="text-lg font-semibold">
                  {isAdding ? "Add user" : "Edit user"}
                </h2>
              </div>
              <button
                type="button"
                className="text-sm text-gray-500 hover:text-gray-700"
                onClick={closeForm}
                disabled={loading || usersDirectoryLoading}
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
                  placeholder="Thato"
                  disabled={loading || usersDirectoryLoading}
                />
              </div>

              <div>
                <label className="text-xs text-gray-600">Last name *</label>
                <input
                  value={form.last_name}
                  onChange={(e) => setForm((s) => ({ ...s, last_name: e.target.value }))}
                  className="mt-1 w-full border rounded-lg px-3 py-2"
                  placeholder="Kgosi"
                  required
                  disabled={loading || usersDirectoryLoading}
                />
              </div>

              {isAdding || isEditing ? (
                <div>
                  <label className="text-xs text-gray-600">ID / Passport *</label>
                  <input
                    value={form.id_number}
                    onChange={(e) => setForm((s) => ({ ...s, id_number: e.target.value }))}
                    className="mt-1 w-full border rounded-lg px-3 py-2"
                    placeholder="12345678901"
                    required
                    disabled={loading || usersDirectoryLoading}
                  />
                </div>
              ) : null}

              {isAdding || isEditing ? (
                <div>
                  <label className="text-xs text-gray-600">Date of birth</label>
                  <input
                    type="date"
                    value={form.date_of_birth}
                    onChange={(e) => setForm((s) => ({ ...s, date_of_birth: e.target.value }))}
                    className="mt-1 w-full border rounded-lg px-3 py-2"
                    disabled={loading || usersDirectoryLoading}
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    {isAdding
                      ? "Optional."
                      : "Optional. Clear the field to remove stored date of birth."}
                  </p>
                </div>
              ) : null}

              <div>
                <label className="text-xs text-gray-600">Email</label>
                <input
                  value={form.email}
                  onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
                  className="mt-1 w-full border rounded-lg px-3 py-2"
                  placeholder="thato@iregsys.com"
                  disabled={loading || usersDirectoryLoading}
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
                  disabled={loading || usersDirectoryLoading}
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
                      disabled={loading || usersDirectoryLoading || (isEditing && isSelf(editing))}
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
                      disabled={loading || usersDirectoryLoading || (isEditing && isSelf(editing))}
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

              {isAdding || isEditing ? (
                <>
                  <div>
                    <label className="text-xs text-gray-600">Police station *</label>
                    <div className="mt-1">
                      <PoliceStationSelect
                        label={null}
                        value={form.police_station}
                        onChange={(v) => setForm((s) => ({ ...s, police_station: v }))}
                        required
                        withAuth={true}
                        inputClassName="w-full border rounded-lg px-3 py-2"
                        placeholder={
                          canAdminister
                            ? "Search, pick from list, or type a station name…"
                            : "Select police station…"
                        }
                        allowOther={true}
                        variant={canAdminister ? "searchable" : "select"}
                        disabled={loading || usersDirectoryLoading}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-gray-600">Town / village *</label>
                    <input
                      value={form.village}
                      onChange={(e) => setForm((s) => ({ ...s, village: e.target.value }))}
                      className="mt-1 w-full border rounded-lg px-3 py-2"
                      required
                      disabled={loading || usersDirectoryLoading}
                    />
                  </div>

                  <div>
                    <label className="text-xs text-gray-600">Ward / street *</label>
                    <input
                      value={form.ward}
                      onChange={(e) => setForm((s) => ({ ...s, ward: e.target.value }))}
                      className="mt-1 w-full border rounded-lg px-3 py-2"
                      required
                      disabled={loading || usersDirectoryLoading}
                    />
                  </div>
                </>
              ) : null}

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
                    disabled={loading || usersDirectoryLoading}
                  />
                </div>
              ) : null}

              <div className="sm:col-span-3 flex gap-2 justify-end pt-2">
                <RippleButton
                  type="button"
                  className="px-4 py-2 rounded border bg-white disabled:opacity-60"
                  onClick={closeForm}
                  disabled={loading || usersDirectoryLoading}
                >
                  Cancel
                </RippleButton>
                <RippleButton
                  type="submit"
                  className="px-4 py-2 rounded bg-iregistrygreen text-white disabled:opacity-60"
                  disabled={loading || usersDirectoryLoading}
                >
                  {isAdding ? "Create user" : "Save changes"}
                </RippleButton>
              </div>
            </form>
          </div>
        ) : null}

        <div className="bg-white rounded-lg px-2 py-3 sm:px-3 sm:py-4 shadow-sm">
          <h2 className="text-lg font-semibold mb-3">Users</h2>

          {(usersDirectoryLoading || loading) && users.length === 0 ? (
            <div className="text-gray-500 py-6 text-center">Loading…</div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-gray-500 py-6 text-center">No users yet.</div>
          ) : (
            <div className="space-y-2">
              {filteredUsers.map((u) => {
                const st = deriveUserStatus(u);
                const rowBusy = quickRowId === String(u.id);
                const self = isSelf(u.id);
                const rowHighlighted = highlightUserId != null && String(u.id) === String(highlightUserId);
                return (
                  <div
                    key={u.id}
                    id={`admin-user-row-${u.id}`}
                    className={`flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 lg:gap-8 border rounded-lg p-3 transition-[box-shadow,background-color] duration-500 ${
                      rowHighlighted
                        ? "ring-2 ring-iregistrygreen shadow-md bg-emerald-50/70"
                        : ""
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Link
                            to={`${profileListBase}?user=${encodeURIComponent(u.id)}`}
                            className="font-medium text-iregistrygreen font-semibold hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-iregistrygreen/35 rounded-sm min-w-0 truncate"
                          >
                            {displayNameWithItemCount(u)}
                          </Link>
                          {st === "active" ? (
                            <button
                              type="button"
                              onClick={() => handleAddItemForUser(u)}
                              disabled={
                                loading || usersDirectoryLoading || addItemPreflightLoading
                              }
                              className="inline-flex items-center justify-center w-7 h-7 shrink-0 rounded-md border border-gray-200 bg-white text-iregistrygreen hover:bg-emerald-50 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-iregistrygreen/35"
                              title={`Add item for ${displayName(u)}`}
                              aria-label={`Add item for ${displayName(u)}`}
                            >
                              <Plus className="w-4 h-4" strokeWidth={2.5} aria-hidden />
                            </button>
                          ) : null}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5 break-all">{u.email || "—"}</p>
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        <UserMetaItem label="Role" value={roleLabel[u.role] || u.role} />
                        <MetaSep />
                        <UserMetaItem label="Status" value={st} />
                        <MetaSep />
                        <UserMetaItem label="Phone" value={u.phone} />
                        <MetaSep />
                        <UserMetaItem label="ID / Passport" value={u.id_number} />
                        <MetaSep />
                        <UserMetaItem label="Location" value={formatUserLocation(u)} />
                        <MetaSep />
                        <UserMetaItem label="Last login" value={fmtDateTime(u.last_login_at)} />
                        <MetaSep />
                        <UserMetaItem label="ID" value={u.id} />
                      </div>
                      {(u.suspended_reason || u.disabled_reason) && st !== "active" ? (
                        <div className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-md px-2 py-1 mt-2 max-w-xl">
                          <span className="font-semibold">Reason:</span>{" "}
                          <span className="font-normal">{u.suspended_reason || u.disabled_reason}</span>
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
                        loading={loading || usersDirectoryLoading || addItemPreflightLoading}
                        canAdminister={canAdminister}
                        showAddItem={st === "active"}
                        onRoleChange={(next) => void quickChangeRole(u, next)}
                        onMobileAction={(action) => {
                          if (action === "change_role") return openRoleModal(u);
                          if (action === "suspend") return openSuspendModal(u, "suspended");
                          if (action === "disable") return openSuspendModal(u, "disabled");
                          if (action === "reactivate") return void quickReactivate(u);
                          if (action === "add_item") return handleAddItemForUser(u);
                          if (action === "edit") return startEdit(u);
                          if (action === "delete") return void handleDelete(u.id);
                        }}
                        onAddItem={() => handleAddItemForUser(u)}
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