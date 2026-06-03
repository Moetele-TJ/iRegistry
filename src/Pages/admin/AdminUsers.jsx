// src/Pages/admin/AdminUsers.jsx
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Plus, Users } from "lucide-react";
import RippleButton from "../../components/RippleButton.jsx";
import ConfirmModal from "../../components/ConfirmModal.jsx";
import { invokeWithAuth } from "../../lib/invokeWithAuth.js";
import { useToast } from "../../contexts/ToastContext.jsx";
import { useModal } from "../../contexts/ModalContext.jsx";
import { useAuth } from "../../contexts/AuthContext.jsx";
import PageSectionCard from "../shared/PageSectionCard.jsx";
import { deriveUserStatus, isActiveUserAccount, isInactiveLockout } from "../../lib/userState.js";
import { displayUser, formatUserLocation } from "../../lib/userDisplay.js";
import { useListUsers } from "../../hooks/useListUsers.js";
import { useAddItemPreflight } from "../../hooks/useAddItemPreflight.js";
import {
  APP_ROLE_OPTIONS,
  DISPLAY,
  NAV_ACTIONS,
  USER_ACCOUNT_NON_ACTIVE_FILTER_OPTIONS,
  addItemAriaLabel,
} from "../../lib/navLabels.js";
import {
  readStaffUsersListScope,
  writeStaffUsersListScope,
} from "../../lib/staffUsersListStorage.js";
import {
  STAFF_USERS_LIST_VIEWS,
  staffUsersListViewFromPath,
} from "../../lib/staffUsersListView.js";
import { useStaffUserScope } from "../../contexts/StaffUserScopeContext.jsx";
import {
  MSG_NOTHING_TO_SUBMIT,
  staffUserAddPath,
  staffUserEditPath,
} from "../../lib/staffUserForm.js";

function displayName(u) {
  return displayUser(u) || "—";
}

function displayNameWithItemCount(u) {
  const name = displayName(u);
  const n = Math.max(0, Math.floor(Number(u?.active_items_count) || 0));
  return `${name} (${n})`;
}

function staffUsersFiltersKey(snapshot) {
  return JSON.stringify({
    q: snapshot.q,
    roleFilter: snapshot.roleFilter,
    statusFilter: snapshot.statusFilter,
    stationFilter: snapshot.stationFilter,
    itemsFilter: snapshot.itemsFilter,
    usersListView: snapshot.usersListView,
    sortBy: snapshot.sortBy,
    sortDir: snapshot.sortDir,
  });
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

const SUSPEND_REASONS = [
  "Policy violation",
  "Fraud / abuse",
  "Non-payment / chargeback",
  "Account requested closure",
  "Duplicate account",
  "Other",
];

const ROW_HIGHLIGHT_MS = 4500;
const USERS_PER_PAGE = 10;

function normalizeUsersStatusFilter(filter, listView) {
  const f = String(filter || "all").trim().toLowerCase();
  if (listView === STAFF_USERS_LIST_VIEWS.active) return "active";
  if (f === "active") return "all";
  if (f === "suspended" || f === "disabled" || f === "deleted") return f;
  return "all";
}

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
                  {showAddItem ? <option value="add_item">{NAV_ACTIONS.addItem}</option> : null}
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
            {APP_ROLE_OPTIONS.map((opt) => (
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
            {NAV_ACTIONS.addItem}
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
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user: currentUser } = useAuth();
  const { addToast } = useToast();
  const { confirm } = useModal();
  const { goToAddItem, tasksLoading: addItemPreflightLoading } = useAddItemPreflight();

  const { enterScope } = useStaffUserScope();

  const canAdminister = String(variant || "admin").toLowerCase() === "admin";
  const canCreateUser = canAdminister || String(variant || "").toLowerCase() === "cashier";
  const staffRole = canAdminister ? "admin" : "cashier";
  const profileListBase = canAdminister ? "/admin/profile" : "/cashier/profile";
  const usersReturnPath = `${location.pathname}${location.search}`;
  const usersListView = useMemo(
    () => staffUsersListViewFromPath(location.pathname),
    [location.pathname],
  );
  const isActiveUsersView = usersListView === STAFF_USERS_LIST_VIEWS.active;
  const statusFilterOptions = isActiveUsersView
    ? [{ value: "active", label: DISPLAY.userAccountStatus.active }]
    : USER_ACCOUNT_NON_ACTIVE_FILTER_OPTIONS;

  const {
    users,
    loading: usersDirectoryLoading,
    error: usersDirectoryError,
    refresh: refreshUsers,
  } = useListUsers();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("active");
  const [stationFilter, setStationFilter] = useState("");
  const [itemsFilter, setItemsFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState("last_name");
  const [sortDir, setSortDir] = useState("asc");

  const [quickRowId, setQuickRowId] = useState("");
  const [suspendModal, setSuspendModal] = useState({ isOpen: false, user: null });
  const [suspendReason, setSuspendReason] = useState("");
  const [suspendPreset, setSuspendPreset] = useState("");
  const [suspendStatus, setSuspendStatus] = useState("suspended");

  const [roleModal, setRoleModal] = useState({ isOpen: false, user: null });
  const [roleNext, setRoleNext] = useState("");

  const listScopeReadyRef = useRef(false);
  const filtersReadyForPageResetRef = useRef(false);
  const prevUsersFiltersKeyRef = useRef(null);
  const [highlightUserId, setHighlightUserId] = useState(null);

  const currentUserId = currentUser?.id != null ? String(currentUser.id) : "";

  function goToAddUser() {
    if (!canCreateUser) return;
    navigate(staffUserAddPath(staffRole), { state: { returnTo: usersReturnPath } });
  }

  function goToEditUser(u) {
    if (!u?.id || isInactiveLockout(u)) {
      addToast({
        type: "error",
        message: "Suspended or disabled accounts cannot be edited. Reactivate the account first.",
      });
      return;
    }
    navigate(staffUserEditPath(staffRole, u.id), { state: { returnTo: usersReturnPath } });
  }

  useEffect(() => {
    if (!usersDirectoryError) return;
    setError(usersDirectoryError);
    addToast({ type: "error", message: usersDirectoryError });
  }, [usersDirectoryError, addToast]);

  useEffect(() => {
    if (!currentUserId) return;

    const urlWithoutItems = searchParams.get("items") === "without";
    setItemsFilter(urlWithoutItems ? "without" : "all");

    if (urlWithoutItems) {
      const snapshot = {
        q: "",
        roleFilter: "all",
        statusFilter: "active",
        stationFilter: "",
        itemsFilter: "without",
        usersListView,
        sortBy: "last_name",
        sortDir: "asc",
      };
      prevUsersFiltersKeyRef.current = staffUsersFiltersKey(snapshot);
      setQ(snapshot.q);
      setRoleFilter(snapshot.roleFilter);
      setStatusFilter(snapshot.statusFilter);
      setStationFilter(snapshot.stationFilter);
      setPage(1);
      listScopeReadyRef.current = true;
      filtersReadyForPageResetRef.current = true;
      return;
    }

    const scope = readStaffUsersListScope(currentUserId);
    const viewMatchesStored = scope?.listView === usersListView;

    let snapshot;
    if (scope && viewMatchesStored) {
      const nextStatus =
        scope.statusFilter != null
          ? normalizeUsersStatusFilter(scope.statusFilter, usersListView)
          : isActiveUsersView
            ? "active"
            : "all";
      snapshot = {
        q: scope.q != null ? String(scope.q) : "",
        roleFilter: scope.roleFilter != null ? String(scope.roleFilter) : "all",
        statusFilter: nextStatus,
        stationFilter: scope.stationFilter != null ? String(scope.stationFilter) : "",
        itemsFilter: "all",
        usersListView,
        sortBy: scope.sortBy != null ? String(scope.sortBy) : "last_name",
        sortDir: scope.sortDir != null ? String(scope.sortDir) : "asc",
      };
      prevUsersFiltersKeyRef.current = staffUsersFiltersKey(snapshot);
      setQ(snapshot.q);
      setRoleFilter(snapshot.roleFilter);
      setStatusFilter(snapshot.statusFilter);
      setStationFilter(snapshot.stationFilter);
      if (scope.sortBy != null) setSortBy(snapshot.sortBy);
      if (scope.sortDir != null) setSortDir(snapshot.sortDir);
      const storedPage = Number(scope.page);
      if (Number.isFinite(storedPage) && storedPage >= 1) setPage(Math.floor(storedPage));
      else setPage(1);
      if (typeof scope.scrollY === "number" && scope.scrollY > 0) {
        requestAnimationFrame(() => window.scrollTo({ top: scope.scrollY, behavior: "auto" }));
      }
    } else {
      snapshot = {
        q: "",
        roleFilter: "all",
        statusFilter: isActiveUsersView ? "active" : "all",
        stationFilter: "",
        itemsFilter: "all",
        usersListView,
        sortBy: "last_name",
        sortDir: "asc",
      };
      prevUsersFiltersKeyRef.current = staffUsersFiltersKey(snapshot);
      setQ(snapshot.q);
      setRoleFilter(snapshot.roleFilter);
      setStatusFilter(snapshot.statusFilter);
      setStationFilter(snapshot.stationFilter);
      setPage(1);
    }

    listScopeReadyRef.current = true;
    filtersReadyForPageResetRef.current = true;
  }, [currentUserId, usersListView, isActiveUsersView, searchParams]);

  useEffect(() => {
    if (!filtersReadyForPageResetRef.current) return;
    const key = staffUsersFiltersKey({
      q,
      roleFilter,
      statusFilter,
      stationFilter,
      itemsFilter,
      usersListView,
      sortBy,
      sortDir,
    });
    if (prevUsersFiltersKeyRef.current === null) {
      prevUsersFiltersKeyRef.current = key;
      return;
    }
    if (prevUsersFiltersKeyRef.current === key) return;
    prevUsersFiltersKeyRef.current = key;
    setPage(1);
  }, [
    q,
    roleFilter,
    statusFilter,
    stationFilter,
    itemsFilter,
    usersListView,
    sortBy,
    sortDir,
  ]);

  useEffect(() => {
    if (!currentUserId || !listScopeReadyRef.current) return;
    writeStaffUsersListScope(currentUserId, {
      listView: usersListView,
      q,
      roleFilter,
      statusFilter,
      stationFilter,
      itemsFilter,
      page,
      sortBy,
      sortDir,
      scrollY: typeof window !== "undefined" ? window.scrollY : 0,
    });
  }, [currentUserId, usersListView, q, roleFilter, statusFilter, stationFilter, itemsFilter, page, sortBy, sortDir]);

  const persistUsersListScope = () => {
    if (!currentUserId) return;
    writeStaffUsersListScope(currentUserId, {
      listView: usersListView,
      q,
      roleFilter,
      statusFilter,
      stationFilter,
      itemsFilter,
      page,
      sortBy,
      sortDir,
      scrollY: typeof window !== "undefined" ? window.scrollY : 0,
    });
  };

  function clearWithoutItemsFilter() {
    setItemsFilter("all");
    if (searchParams.get("items")) {
      const next = new URLSearchParams(searchParams);
      next.delete("items");
      setSearchParams(next, { replace: true });
    }
  }

  useEffect(() => {
    const h = searchParams.get("highlight");
    if (!h) return;
    setHighlightUserId(h);
    const next = new URLSearchParams(searchParams);
    next.delete("highlight");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (!highlightUserId) return;
    const id = String(highlightUserId);
    const t = window.setTimeout(() => setHighlightUserId(null), ROW_HIGHLIGHT_MS);
    const row = document.getElementById(`admin-user-row-${id}`);
    row?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    return () => clearTimeout(t);
  }, [highlightUserId]);

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

  const roleLabel = useMemo(() => ({ ...DISPLAY.appRole }), []);

  const filteredUsers = useMemo(() => {
    const query = String(q || "").trim().toLowerCase();
    const stationQ = String(stationFilter || "").trim().toLowerCase();
    const roleQ = String(roleFilter || "all").trim().toLowerCase();
    const statusQ = String(statusFilter || "all").trim().toLowerCase();

    const list = (users || []).filter((u) => {
      if (!u) return false;
      const status = deriveUserStatus(u);
      if (isActiveUsersView) {
        if (!isActiveUserAccount(u)) return false;
      } else if (isActiveUserAccount(u)) {
        return false;
      }
      if (roleQ !== "all" && String(u.role || "").toLowerCase() !== roleQ) return false;
      if (statusQ !== "all" && status !== statusQ) return false;
      if (itemsFilter === "without") {
        const itemCount = Math.max(0, Math.floor(Number(u.active_items_count) || 0));
        if (itemCount > 0) return false;
      }

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
  }, [users, q, roleFilter, statusFilter, stationFilter, itemsFilter, sortBy, sortDir, isActiveUsersView]);

  const usersTotal = filteredUsers.length;
  const usersTotalPages = Math.max(1, Math.ceil(usersTotal / USERS_PER_PAGE));

  useEffect(() => {
    setPage((p) => (p > usersTotalPages ? usersTotalPages : p < 1 ? 1 : p));
  }, [usersTotalPages]);

  const paginatedUsers = useMemo(() => {
    const start = (page - 1) * USERS_PER_PAGE;
    return filteredUsers.slice(start, start + USERS_PER_PAGE);
  }, [filteredUsers, page]);

  const usersRangeStart = usersTotal === 0 ? 0 : (page - 1) * USERS_PER_PAGE + 1;
  const usersRangeEnd = usersTotal === 0 ? 0 : Math.min(page * USERS_PER_PAGE, usersTotal);

  async function refresh() {
    const r = await refreshUsers();
    if (!r.ok) throw new Error(r.message || "Failed to refresh");
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
    <div className="min-h-[60vh]">
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
            {APP_ROLE_OPTIONS.map((opt) => (
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

      <PageSectionCard
          maxWidthClass="max-w-7xl"
          title={
            canAdminister
              ? isActiveUsersView
                ? "Manage Users — Active"
                : "Manage Users — Non-Active"
              : isActiveUsersView
                ? "Users — Active"
                : "Users — Non-Active"
          }
          subtitle={
            itemsFilter === "without" && isActiveUsersView
              ? "Active users with no registered items."
              : canAdminister
                ? isActiveUsersView
                  ? "Active accounts only. Change roles, suspend, disable, or reactivate from each user row, or use Edit for the full form."
                  : "Suspended, disabled, and deleted accounts. Restore or remove users from this list."
                : isActiveUsersView
                  ? "Search active users, add new accounts, and update basic profile details. Roles, status, and deletion are admin-only."
                  : "Search non-active users. Roles, status, and deletion are admin-only."
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
        <div className="p-4 sm:p-6 space-y-5">
        {error ? (
          <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg p-3">
            {error}
          </div>
        ) : null}

        {itemsFilter === "without" && isActiveUsersView ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-100 bg-amber-50/80 px-3 py-2 text-sm text-amber-950">
            <span>Showing {DISPLAY.stats.usersWithoutItems.toLowerCase()}.</span>
            <button
              type="button"
              onClick={clearWithoutItemsFilter}
              className="text-xs font-semibold text-iregistrygreen hover:underline"
            >
              Clear filter
            </button>
          </div>
        ) : null}

        {/* Toolbar: Add + filters */}
        <div className="bg-white rounded-2xl border border-gray-100 px-4 py-4 sm:px-5 sm:py-5 shadow-sm mb-5">
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
                  {isActiveUsersView ? null : (
                  <div className="sm:w-44 min-w-[170px]">
                    <label className="text-xs text-gray-600">Status</label>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="mt-1 w-full border rounded-lg px-3 py-2"
                    >
                      {statusFilterOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  )}
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
                onClick={goToAddUser}
                disabled={loading || usersDirectoryLoading}
              >
                {NAV_ACTIONS.addUser}
              </RippleButton>
            ) : null}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 px-4 py-4 sm:px-5 sm:py-5 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Users</h2>

          {(usersDirectoryLoading || loading) && users.length === 0 ? (
            <div className="text-gray-500 py-6 text-center">Loading…</div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-gray-500 py-6 text-center">No users yet.</div>
          ) : (
            <>
            <div className="space-y-2">
              {paginatedUsers.map((u) => {
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
                            onClick={() => {
                              persistUsersListScope();
                              enterScope(u);
                            }}
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
                              title={addItemAriaLabel(displayName(u))}
                              aria-label={addItemAriaLabel(displayName(u))}
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
                          if (action === "edit") return goToEditUser(u);
                          if (action === "delete") return void handleDelete(u.id);
                        }}
                        onAddItem={() => handleAddItemForUser(u)}
                        onSuspend={() => openSuspendModal(u, "suspended")}
                        onDisable={() => openSuspendModal(u, "disabled")}
                        onReactivate={() => void quickReactivate(u)}
                        onEdit={() => goToEditUser(u)}
                        onDelete={() => handleDelete(u.id)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col gap-3 pt-4 mt-4 border-t border-gray-100 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-gray-600 text-center sm:text-left">
                Showing <strong>{usersRangeStart}</strong> to <strong>{usersRangeEnd}</strong> of{" "}
                <strong>{usersTotal}</strong>
              </div>
              <div className="flex items-center justify-center gap-2 sm:justify-end">
                <RippleButton
                  type="button"
                  className="px-3 py-1.5 rounded-md bg-white border border-gray-200 text-sm disabled:opacity-40"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </RippleButton>
                <div className="px-3 py-1.5 rounded-md bg-white border border-gray-200 text-sm tabular-nums">
                  {page} / {usersTotalPages}
                </div>
                <RippleButton
                  type="button"
                  className="px-3 py-1.5 rounded-md bg-white border border-gray-200 text-sm disabled:opacity-40"
                  disabled={page >= usersTotalPages}
                  onClick={() => setPage((p) => Math.min(usersTotalPages, p + 1))}
                >
                  Next
                </RippleButton>
              </div>
            </div>
            </>
          )}
        </div>
        </div>
        </PageSectionCard>
    </div>
  );
}