import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import RippleButton from "../components/RippleButton.jsx";
import { invokeWithAuth } from "../lib/invokeWithAuth.js";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useToast } from "../contexts/ToastContext.jsx";
import { useListUsers } from "../hooks/useListUsers.js";
import { displayUser } from "../lib/userDisplay.js";
import { isPrivilegedRole } from "../lib/billingUx.js";
import { roleIs } from "../lib/roleUtils.js";
import {
  NAV,
  NAV_MOBILE,
  registerAnimalButtonLabel,
} from "../lib/navLabels.js";
import { livestockThumb } from "../lib/livestockPhotos.js";
import { readStaffUserScope } from "../lib/staffUserScopeStorage.js";
import {
  LIVESTOCK_VIEW_ALL,
  readLivestockListScope,
  writeLivestockListScope,
  patchLivestockListScope,
} from "../lib/livestockListScopeStorage.js";
import { useStaffUserScopeOptional } from "../contexts/StaffUserScopeContext.jsx";
import { useRegisterAnimalPreflight } from "../hooks/useRegisterAnimalPreflight.js";

const PAGE_SIZE = 12;

function viewSubtitle(view) {
  switch (view) {
    case "missing":
      return "Animals marked missing — treat like a stolen queue for livestock.";
    case "recovered":
      return "Animals marked recovered after being missing.";
    case "deleted":
      return "Recycle bin — restore animals or permanently remove them from the detail page.";
    default:
      return "Manage and monitor your registered livestock";
  }
}

function statusBadgeClass(status) {
  switch (String(status || "").toLowerCase()) {
    case "missing":
      return "bg-red-50 text-red-700 border border-red-200";
    case "recovered":
      return "bg-sky-50 text-sky-800 border border-sky-200";
    case "deleted":
      return "bg-gray-50 text-gray-600 border border-gray-200";
    default:
      return "bg-emerald-50 text-emerald-800 border border-emerald-200";
  }
}

function registerPath(base, ownerId) {
  if (base === "/user") return "/user/livestock/register";
  const q =
    ownerId && ownerId !== LIVESTOCK_VIEW_ALL
      ? `?owner=${encodeURIComponent(ownerId)}`
      : "";
  return `${base}/livestock/register${q}`;
}

function listBasePath(role) {
  if (roleIs(role, "admin")) return "/admin";
  if (roleIs(role, "cashier")) return "/cashier";
  if (roleIs(role, "police")) return "/police";
  return "/user";
}

function escapeCsv(v) {
  const s = String(v ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export default function Livestock({ view = "active" } = {}) {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { user } = useAuth();
  const staffScope = useStaffUserScopeOptional();
  const { goToRegisterAnimal, tasksLoading: registerPreflightLoading } =
    useRegisterAnimalPreflight();
  const privileged = isPrivilegedRole(user?.role);
  const base = listBasePath(user?.role);
  const sessionUserId = user?.id != null ? String(user.id) : "";
  const isOrdinaryUser = roleIs(user?.role, "user");

  const { users: usersList, loading: usersLoading } = useListUsers({
    enabled: privileged,
  });

  const [animals, setAnimals] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [page, setPage] = useState(1);
  const [ownerScope, setOwnerScope] = useState(() => {
    if (staffScope?.scopedUserId) return String(staffScope.scopedUserId);
    if (privileged && sessionUserId) {
      const stored = readLivestockListScope(sessionUserId, view);
      if (stored?.ownerScope) return String(stored.ownerScope);
      const staff = readStaffUserScope(sessionUserId);
      if (staff?.targetUserId) return String(staff.targetUserId);
      return LIVESTOCK_VIEW_ALL;
    }
    return sessionUserId;
  });
  const [pack, setPack] = useState(null);
  const [scopeReady, setScopeReady] = useState(!privileged);
  const [statusBusyId, setStatusBusyId] = useState(null);

  useEffect(() => {
    if (!sessionUserId) return;
    if (!privileged) {
      setOwnerScope(sessionUserId);
      setScopeReady(true);
      return;
    }
    // Match Items: seed from staff profile target when active, else saved View as, else All.
    const stored = readLivestockListScope(sessionUserId, view);
    const staff = readStaffUserScope(sessionUserId);
    if (staffScope?.scopedUserId) setOwnerScope(String(staffScope.scopedUserId));
    else if (stored?.ownerScope) setOwnerScope(String(stored.ownerScope));
    else if (staff?.targetUserId) setOwnerScope(String(staff.targetUserId));
    else setOwnerScope(LIVESTOCK_VIEW_ALL);
    if (stored?.query != null) setQuery(String(stored.query));
    if (stored?.typeFilter) setTypeFilter(String(stored.typeFilter));
    if (stored?.page) setPage(Math.max(1, Number(stored.page) || 1));
    setScopeReady(true);
  }, [sessionUserId, view, privileged, staffScope?.scopedUserId]);

  useEffect(() => {
    if (!sessionUserId || !scopeReady) return;
    patchLivestockListScope(sessionUserId, view, {
      ownerScope,
      query,
      typeFilter,
      page,
    });
  }, [sessionUserId, view, ownerScope, query, typeFilter, page, scopeReady]);

  const load = useCallback(async () => {
    if (!sessionUserId || !scopeReady) return;
    setLoading(true);
    try {
      const body = {
        operation: "livestock-list-mine",
        view,
        query: query.trim() || undefined,
        page,
        pageSize: PAGE_SIZE,
      };
      if (privileged) {
        body.owner_id = ownerScope || LIVESTOCK_VIEW_ALL;
      }

      const listRes = await invokeWithAuth("livestock-api", { body });
      if (listRes.error || !listRes.data?.success) {
        throw new Error(listRes.data?.message || listRes.error?.message || "Failed to load");
      }
      let rows = Array.isArray(listRes.data.animals) ? listRes.data.animals : [];
      if (typeFilter && typeFilter !== "All") {
        rows = rows.filter(
          (a) => String(a.type_code || "").toLowerCase() === typeFilter.toLowerCase(),
        );
      }
      setAnimals(rows);
      setTotal(
        typeFilter && typeFilter !== "All"
          ? rows.length
          : Number(listRes.data.total) || 0,
      );

      const packOwner =
        privileged && ownerScope && ownerScope !== LIVESTOCK_VIEW_ALL
          ? ownerScope
          : !privileged
            ? sessionUserId
            : null;
      if (packOwner && view === "active") {
        const packRes = await invokeWithAuth("livestock-api", {
          body: { operation: "livestock-get-pack-status", owner_id: packOwner },
        });
        if (packRes.data?.success) {
          setPack({
            ...packRes.data.pack,
            can_register: packRes.data.can_register,
            needs_pack: packRes.data.needs_pack,
          });
        }
      } else {
        setPack(null);
      }
    } catch (e) {
      setAnimals([]);
      setTotal(0);
      addToast({ type: "error", message: e?.message || "Failed to load livestock" });
    } finally {
      setLoading(false);
    }
  }, [
    addToast,
    ownerScope,
    page,
    privileged,
    query,
    scopeReady,
    sessionUserId,
    typeFilter,
    view,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const startIndex = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const endIndex = Math.min(page * PAGE_SIZE, total);

  const privilegedViewAll =
    privileged && (!ownerScope || ownerScope === LIVESTOCK_VIEW_ALL);

  const registrationOwnerId = useMemo(() => {
    if (!privileged || privilegedViewAll || !sessionUserId) return null;
    const oid = String(ownerScope || "").trim();
    if (!oid || oid === String(sessionUserId)) return null;
    return oid;
  }, [privileged, privilegedViewAll, ownerScope, sessionUserId]);

  const registrationOwnerLabel = useMemo(() => {
    if (!registrationOwnerId) return null;
    const u = (usersList || []).find((x) => String(x.id) === String(registrationOwnerId));
    return u ? displayUser(u) : null;
  }, [registrationOwnerId, usersList]);

  const allUsersLivestockCount = useMemo(
    () =>
      (usersList || []).reduce(
        (sum, u) => sum + Math.max(0, Math.floor(Number(u?.active_livestock_count) || 0)),
        0,
      ),
    [usersList],
  );

  /** Match Items: Add on active when not “All”; also when a specific user is selected on other lists. */
  const showScopeAddAnimal =
    (!privileged || !privilegedViewAll) &&
    (view === "active" || Boolean(registrationOwnerId));

  const isOwnerSelf =
    !privileged || String(ownerScope) === String(sessionUserId);

  const typeOptions = useMemo(() => {
    const set = new Set();
    for (const a of animals) {
      if (a?.type_code) set.add(String(a.type_code));
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [animals]);

  const stats = useMemo(() => {
    if (view === "missing") {
      return { total, active: 0, missing: total };
    }
    if (view === "active") {
      const missingOnPage = animals.filter((a) => a.status === "missing").length;
      return { total, active: total, missing: missingOnPage };
    }
    return {
      total,
      active: animals.filter((a) => a.status === "active").length,
      missing: animals.filter((a) => a.status === "missing").length,
    };
  }, [animals, total, view]);

  const headerTitle =
    view === "deleted"
      ? NAV.deletedAnimals
      : view === "missing"
        ? NAV.missingAnimals
        : view === "recovered"
          ? NAV.recoveredAnimals
          : NAV_MOBILE.myLivestock;

  async function buyPack() {
    const { data, error } = await invokeWithAuth("livestock-api", {
      body: { operation: "livestock-buy-pack" },
    });
    if (error || !data?.success) {
      addToast({
        type: "error",
        message: data?.message || error?.message || "Could not buy pack",
      });
      return;
    }
    addToast({ type: "success", message: "Registration pack unlocked (10 animals)." });
    await load();
  }

  async function setAnimalStatus(animalId, status) {
    setStatusBusyId(animalId);
    try {
      const { data, error } = await invokeWithAuth("livestock-api", {
        body: { operation: "livestock-set-status", id: animalId, status },
      });
      if (error || !data?.success) {
        throw new Error(data?.message || error?.message || "Could not update status");
      }
      const messages = {
        active: "Marked as active.",
        missing: "Marked as missing.",
        recovered: "Marked as recovered.",
        deleted: "Moved to recycle bin.",
      };
      addToast({ type: "success", message: messages[status] || "Status updated." });
      await load();
    } catch (e) {
      addToast({ type: "error", message: e?.message || "Update failed" });
    } finally {
      setStatusBusyId(null);
    }
  }

  function handleExportCSV() {
    const header = ["id", "name", "type", "status", "breed", "colour", "gender", "village"];
    const lines = [header.join(",")];
    for (const a of animals) {
      lines.push(
        [
          a.id,
          a.name,
          a.type_code,
          a.status,
          a.breed,
          a.colour,
          a.gender,
          a.dwelling_village,
        ]
          .map(escapeCsv)
          .join(","),
      );
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `livestock-${view}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function goRegister() {
    void goToRegisterAnimal({
      path: registerPath(base, registrationOwnerId || undefined),
      ownerId: registrationOwnerId || undefined,
      ownerLabel: registrationOwnerLabel || undefined,
    });
  }

  /** Pack chrome only after the 3rd animal (pack in use) — silent during free tier. */
  const showPackBanner =
    Boolean(pack) &&
    view === "active" &&
    (isOwnerSelf || privileged) &&
    !privilegedViewAll &&
    Number(pack.lifetime_registered ?? 0) >= 3;

  const showListLoading = loading || !scopeReady;
  const showFirstEmpty =
    isOrdinaryUser && view === "active" && !loading && total === 0 && !query;

  return (
    <div className="max-w-7xl mx-auto w-full py-6 sm:py-8 lg:py-10 pb-12">
      <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="border-b border-emerald-100/80 bg-gradient-to-r from-emerald-50/95 via-emerald-50/80 to-emerald-50/60 px-4 sm:px-6 lg:px-8 py-5 sm:py-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-iregistrygreen tracking-tight">
                {headerTitle}
              </h1>
              <p className="mt-1 text-sm text-gray-500">{viewSubtitle(view)}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 lg:shrink-0">
              {showScopeAddAnimal ? (
                <RippleButton
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-iregistrygreen text-white text-sm font-medium shadow-sm hover:opacity-95 transition-opacity disabled:opacity-60"
                  onClick={goRegister}
                  disabled={registerPreflightLoading}
                  title={registerPreflightLoading ? "Loading…" : undefined}
                >
                  {registerAnimalButtonLabel(Boolean(registrationOwnerId))}
                </RippleButton>
              ) : null}
              <RippleButton
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-emerald-200/80 bg-white/90 text-sm font-medium text-gray-700 shadow-sm hover:bg-white transition-colors"
                onClick={handleExportCSV}
              >
                Export CSV
              </RippleButton>
            </div>
          </div>
        </div>

        <div className="px-4 sm:px-6 lg:px-8 py-5 sm:py-6 space-y-6 bg-gradient-to-b from-white to-gray-50/40">
          {showListLoading ? (
            <div
              className="flex items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-3 text-sm text-emerald-900"
              role="status"
              aria-live="polite"
            >
              <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent shrink-0" />
              <span>{!scopeReady ? "Restoring your list view…" : "Loading livestock…"}</span>
            </div>
          ) : null}

          {showPackBanner ? (
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 px-4 py-3 text-sm text-gray-700 flex flex-wrap items-center justify-between gap-2">
              <div>
                Registered:{" "}
                <span className="font-semibold tabular-nums">{pack.lifetime_registered ?? 0}</span>
                {" · "}
                Pack slots left:{" "}
                <span className="font-semibold tabular-nums">{pack.pack_slots_remaining ?? 0}</span>
              </div>
              {pack.needs_pack && isOwnerSelf ? (
                <RippleButton
                  type="button"
                  className="px-3 py-1.5 rounded-xl bg-iregistrygreen text-white text-sm font-medium"
                  onClick={() => void buyPack()}
                >
                  Buy pack — unlock 10 more animals
                </RippleButton>
              ) : null}
            </div>
          ) : null}

          {showFirstEmpty ? (
            <div className="rounded-2xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50/90 to-white shadow-sm p-6 sm:p-8 text-center">
              <div className="text-4xl mb-3">🐄</div>
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
                Protect your first animal on iRegistry
              </h2>
              <p className="text-sm text-gray-600 mt-2 max-w-lg mx-auto leading-relaxed">
                Register livestock with photos and dwelling location — public sightings can notify you with
                distance from home.
              </p>
              <RippleButton
                className="mt-5 px-6 py-2.5 rounded-xl bg-iregistrygreen text-white text-sm font-semibold"
                onClick={goRegister}
              >
                + Add your first animal
              </RippleButton>
            </div>
          ) : null}

          <div className="rounded-2xl border border-gray-100 bg-gray-50/80 p-5 shadow-sm">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="flex flex-col gap-3 w-full lg:w-auto">
                <div>
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setPage(1);
                    }}
                    placeholder="Search by name, breed, colour, type…"
                    className="w-full lg:w-96 border rounded-xl px-4 py-2.5"
                  />
                </div>

                <div className="lg:hidden bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 shadow-sm">
                  <div className="flex justify-between text-sm font-medium">
                    <div className="text-center flex-1">
                      <div className="text-xs text-gray-400 uppercase tracking-wide">Total</div>
                      <div className="text-xl font-bold text-gray-900">{stats.total}</div>
                    </div>
                    <div className="text-center flex-1">
                      <div className="text-xs text-gray-400 uppercase tracking-wide">Active</div>
                      <div className="text-xl font-bold text-emerald-600">{stats.active}</div>
                    </div>
                    <div className="text-center flex-1">
                      <div className="text-xs text-gray-400 uppercase tracking-wide">Missing</div>
                      <div className="text-xl font-bold text-red-600">{stats.missing}</div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 flex-wrap">
                  <select
                    value={typeFilter}
                    onChange={(e) => {
                      setTypeFilter(e.target.value);
                      setPage(1);
                    }}
                    className="border rounded-xl px-3 py-2"
                  >
                    <option value="All">All types</option>
                    {typeOptions.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>

                  {privileged ? (
                    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2 px-2 py-2 rounded-xl border bg-white w-full min-w-0 sm:w-auto">
                      <div className="text-xs font-medium text-gray-600 sm:text-gray-500 sm:whitespace-nowrap">
                        View as
                      </div>
                      <select
                        value={ownerScope || LIVESTOCK_VIEW_ALL}
                        onChange={(e) => {
                          const v = e.target.value;
                          setOwnerScope(v);
                          setPage(1);
                          if (sessionUserId) {
                            writeLivestockListScope(sessionUserId, view, {
                              ownerScope: v,
                              query,
                              typeFilter,
                              page: 1,
                            });
                          }
                        }}
                        disabled={usersLoading || !scopeReady}
                        className="w-full min-w-0 sm:w-auto border rounded-lg px-2 py-1 text-sm"
                      >
                        <option value={LIVESTOCK_VIEW_ALL}>
                          All ({allUsersLivestockCount})
                        </option>
                        {(usersList || []).map((u) => {
                          const name = displayUser(u) || String(u.id ?? "");
                          const n = Math.max(
                            0,
                            Math.floor(Number(u?.active_livestock_count) || 0),
                          );
                          return (
                            <option key={u.id} value={u.id}>
                              {`${name} (${n})`}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="hidden lg:flex items-center gap-6 text-sm font-medium">
                <div className="text-gray-700">
                  <span className="text-2xl font-bold text-gray-900">{stats.total}</span> total
                </div>
                <div className="text-emerald-600">
                  <span className="text-2xl font-bold">{stats.active}</span> active
                </div>
                <div className="text-red-600">
                  <span className="text-2xl font-bold">{stats.missing}</span> missing
                </div>
              </div>
            </div>
          </div>

          <div className="hidden sm:block overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left py-3 px-4">Animal</th>
                  <th className="text-left py-3 px-4">Type</th>
                  <th className="text-left py-3 px-4">Status</th>
                  <th className="text-left py-3 px-4">Location</th>
                  <th className="text-right py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {showListLoading
                  ? [...Array(PAGE_SIZE)].map((_, i) => (
                      <tr key={i} className="border-t animate-pulse">
                        <td className="py-3 px-4">
                          <div className="h-4 bg-gray-200 rounded w-32" />
                        </td>
                        <td className="py-3 px-4">
                          <div className="h-4 bg-gray-200 rounded w-20" />
                        </td>
                        <td className="py-3 px-4">
                          <div className="h-6 bg-gray-200 rounded-full w-20" />
                        </td>
                        <td className="py-3 px-4">
                          <div className="h-4 bg-gray-200 rounded w-28" />
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="h-6 bg-gray-200 rounded w-16 ml-auto" />
                        </td>
                      </tr>
                    ))
                  : null}

                {!showListLoading &&
                  animals.map((a) => {
                    const src = livestockThumb(a);
                    const isMissing = String(a.status || "").toLowerCase() === "missing";
                    const busy = statusBusyId === a.id;
                    return (
                      <tr
                        key={a.id}
                        className="border-t border-gray-100 hover:bg-gray-50 hover:shadow-sm transition-all duration-150"
                      >
                        <td className="py-4 px-5">
                          <div className="flex items-center gap-3">
                            <div className="w-11 h-11 bg-gray-100 rounded-xl border border-gray-200 flex items-center justify-center text-xs text-gray-400 overflow-hidden">
                              {src ? (
                                <img src={src} alt="" className="w-full h-full object-cover" />
                              ) : (
                                "—"
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="font-medium text-gray-900 truncate">
                                {a.name || a.breed || a.type_code || "Animal"}
                              </div>
                              <div className="text-xs text-gray-500 truncate">
                                {[a.colour, a.breed, a.gender].filter(Boolean).join(" · ") || "—"}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-5 text-gray-700">{a.type_code || "—"}</td>
                        <td className="py-4 px-5">
                          <span
                            className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium capitalize ${statusBadgeClass(a.status)}`}
                          >
                            {a.status || "active"}
                          </span>
                        </td>
                        <td className="py-4 px-5 text-gray-600">
                          {a.dwelling_village || "—"}
                        </td>
                        <td className="py-4 px-5 text-right">
                          <div className="inline-flex gap-2">
                            <RippleButton
                              className="px-3 py-1.5 rounded-xl bg-gray-100 text-sm text-gray-800"
                              onClick={() => navigate(`/livestock/${a.id}`)}
                            >
                              View
                            </RippleButton>
                            {view === "deleted" ? (
                              <RippleButton
                                className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-sm font-medium disabled:opacity-60"
                                disabled={busy}
                                onClick={() => void setAnimalStatus(a.id, "active")}
                              >
                                Restore
                              </RippleButton>
                            ) : view === "active" || view === "missing" ? (
                              <RippleButton
                                className={`px-3 py-1.5 rounded-xl text-white text-sm font-medium disabled:opacity-60 ${
                                  isMissing
                                    ? "bg-emerald-600 hover:bg-emerald-700"
                                    : "bg-red-600 hover:bg-red-700"
                                }`}
                                disabled={busy}
                                onClick={() =>
                                  void setAnimalStatus(a.id, isMissing ? "active" : "missing")
                                }
                              >
                                {isMissing ? "Mark Active" : "Mark Missing"}
                              </RippleButton>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

          <div className="sm:hidden space-y-3">
            {!showListLoading &&
              animals.map((a) => {
                const src = livestockThumb(a);
                const isMissing = String(a.status || "").toLowerCase() === "missing";
                const busy = statusBusyId === a.id;
                return (
                  <div
                    key={a.id}
                    className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden"
                  >
                    <div className="aspect-[16/10] bg-gray-100">
                      {src ? (
                        <img src={src} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">
                          No photo
                        </div>
                      )}
                    </div>
                    <div className="p-4 space-y-3">
                      <div>
                        <div className="font-semibold text-gray-900">
                          {a.name || a.breed || a.type_code || "Animal"}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {[a.type_code, a.colour, a.status].filter(Boolean).join(" · ")}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <RippleButton
                          className="flex-1 py-2 rounded-xl bg-gray-100 text-sm text-gray-800"
                          onClick={() => navigate(`/livestock/${a.id}`)}
                        >
                          View
                        </RippleButton>
                        {view === "deleted" ? (
                          <RippleButton
                            className="flex-1 py-2 rounded-xl bg-emerald-600 text-white text-sm font-medium disabled:opacity-60"
                            disabled={busy}
                            onClick={() => void setAnimalStatus(a.id, "active")}
                          >
                            Restore
                          </RippleButton>
                        ) : view === "active" || view === "missing" ? (
                          <RippleButton
                            className={`flex-1 py-2 rounded-xl text-sm font-medium disabled:opacity-60 ${
                              isMissing
                                ? "bg-emerald-600 text-white hover:bg-emerald-700"
                                : "bg-red-600 text-white hover:bg-red-700"
                            }`}
                            disabled={busy}
                            onClick={() =>
                              void setAnimalStatus(a.id, isMissing ? "active" : "missing")
                            }
                          >
                            {isMissing ? "Mark Active" : "Mark Missing"}
                          </RippleButton>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}

            {!showListLoading && animals.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
                <div className="text-4xl mb-3">🐄</div>
                {showFirstEmpty ? (
                  <>
                    <div className="text-lg font-semibold text-gray-800">Your livestock registry is empty</div>
                    <p className="text-sm text-gray-500 mt-2">
                      Use the button above to register your first animal.
                    </p>
                  </>
                ) : total === 0 && showScopeAddAnimal ? (
                  <>
                    <div className="text-lg font-semibold text-gray-800">
                      {registrationOwnerId
                        ? "No animals for this user yet"
                        : "No animals registered yet"}
                    </div>
                    <p className="text-sm text-gray-500 mt-2">
                      {registrationOwnerId
                        ? `Add an animal to ${registrationOwnerLabel || "this user"}'s registry.`
                        : "Register an animal to start tracking ownership and sightings."}
                    </p>
                    <RippleButton
                      className="mt-4 px-5 py-2 rounded-xl bg-iregistrygreen text-white text-sm font-medium"
                      onClick={goRegister}
                    >
                      {registerAnimalButtonLabel(Boolean(registrationOwnerId))}
                    </RippleButton>
                  </>
                ) : (
                  <>
                    <div className="text-lg font-semibold text-gray-800">No animals found</div>
                    <p className="text-sm text-gray-500 mt-2">
                      Try adjusting your search or filters.
                    </p>
                  </>
                )}
              </div>
            ) : null}
          </div>

          {!showListLoading && animals.length === 0 && !showFirstEmpty ? (
            <div className="hidden sm:block bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
              <div className="text-4xl mb-3">🐄</div>
              <div className="text-lg font-semibold text-gray-800">
                {total === 0 && showScopeAddAnimal
                  ? registrationOwnerId
                    ? "No animals for this user yet"
                    : "No animals registered yet"
                  : "No animals found"}
              </div>
              <p className="text-sm text-gray-500 mt-2">
                {total === 0 && showScopeAddAnimal
                  ? registrationOwnerId
                    ? `Add an animal to ${registrationOwnerLabel || "this user"}'s registry.`
                    : "Register an animal to start tracking ownership and sightings."
                  : "Try adjusting your search or filters."}
              </p>
              {total === 0 && showScopeAddAnimal ? (
                <RippleButton
                  className="mt-4 px-5 py-2 rounded-xl bg-iregistrygreen text-white text-sm font-medium"
                  onClick={goRegister}
                >
                  {registerAnimalButtonLabel(Boolean(registrationOwnerId))}
                </RippleButton>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-col gap-3 pt-3 border-t border-gray-100/80 sm:flex-row sm:items-center sm:justify-between sm:gap-0 sm:pt-1">
            <div className="text-sm text-gray-600 text-center sm:text-left">
              Showing <strong>{startIndex}</strong> - <strong>{endIndex}</strong> of{" "}
              <strong>{total}</strong>
            </div>
            <div className="flex items-center justify-center gap-2 sm:justify-end">
              <RippleButton
                className="px-3 py-1 rounded-md bg-white border border-gray-200 disabled:opacity-50"
                disabled={page <= 1 || showListLoading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Prev
              </RippleButton>
              <div className="px-3 py-1 rounded-md bg-white border border-gray-200 text-sm">
                {page} / {pageCount}
              </div>
              <RippleButton
                className="px-3 py-1 rounded-md bg-white border border-gray-200 disabled:opacity-50"
                disabled={page >= pageCount || showListLoading}
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              >
                Next
              </RippleButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
