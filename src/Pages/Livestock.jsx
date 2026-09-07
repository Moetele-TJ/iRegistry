import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import RippleButton from "../components/RippleButton.jsx";
import { invokeWithAuth } from "../lib/invokeWithAuth.js";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useToast } from "../contexts/ToastContext.jsx";
import { useListUsers } from "../hooks/useListUsers.js";
import { displayUser } from "../lib/userDisplay.js";
import { isPrivilegedRole } from "../lib/billingUx.js";
import { roleIs } from "../lib/roleUtils.js";
import { NAV, NAV_ACTIONS } from "../lib/navLabels.js";
import { livestockThumb } from "../lib/livestockPhotos.js";
import { readStaffUserScope } from "../lib/staffUserScopeStorage.js";
import {
  LIVESTOCK_VIEW_ALL,
  readLivestockListScope,
  writeLivestockListScope,
  patchLivestockListScope,
} from "../lib/livestockListScopeStorage.js";
import { useStaffUserScopeOptional } from "../contexts/StaffUserScopeContext.jsx";

const PAGE_SIZE = 12;

function viewTitle(view) {
  switch (view) {
    case "missing":
      return NAV.missingAnimals;
    case "recovered":
      return NAV.recoveredAnimals;
    case "deleted":
      return NAV.deletedAnimals;
    default:
      return NAV.activeAnimals;
  }
}

function statusBadgeClass(status) {
  switch (String(status || "").toLowerCase()) {
    case "missing":
      return "bg-red-50 text-red-700 border-red-200";
    case "recovered":
      return "bg-sky-50 text-sky-800 border-sky-200";
    case "deleted":
      return "bg-gray-100 text-gray-600 border-gray-200";
    default:
      return "bg-emerald-50 text-emerald-800 border-emerald-200";
  }
}

function registerPath(base, ownerId) {
  if (base === "/user") return "/user/livestock/register";
  const q = ownerId && ownerId !== LIVESTOCK_VIEW_ALL
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

export default function Livestock({ view = "active" } = {}) {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { user } = useAuth();
  const staffScope = useStaffUserScopeOptional();
  const privileged = isPrivilegedRole(user?.role);
  const base = listBasePath(user?.role);
  const sessionUserId = user?.id != null ? String(user.id) : "";

  const { users: usersList, loading: usersLoading } = useListUsers({
    enabled: privileged,
  });

  const [animals, setAnimals] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
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

  useEffect(() => {
    if (!sessionUserId) return;
    if (staffScope?.scopedUserId) {
      setOwnerScope(String(staffScope.scopedUserId));
      setScopeReady(true);
      return;
    }
    if (!privileged) {
      setOwnerScope(sessionUserId);
      setScopeReady(true);
      return;
    }
    const stored = readLivestockListScope(sessionUserId, view);
    if (stored?.ownerScope) setOwnerScope(String(stored.ownerScope));
    if (stored?.query != null) setQuery(String(stored.query));
    if (stored?.page) setPage(Math.max(1, Number(stored.page) || 1));
    setScopeReady(true);
  }, [sessionUserId, view, privileged, staffScope?.scopedUserId]);

  useEffect(() => {
    if (!sessionUserId || !scopeReady) return;
    patchLivestockListScope(sessionUserId, view, {
      ownerScope,
      query,
      page,
    });
  }, [sessionUserId, view, ownerScope, query, page, scopeReady]);

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
      setAnimals(Array.isArray(listRes.data.animals) ? listRes.data.animals : []);
      setTotal(Number(listRes.data.total) || 0);

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
    view,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const isOwnerSelf =
    !privileged || String(ownerScope) === String(sessionUserId);
  const canRegister =
    view === "active" &&
    (isOwnerSelf ||
      (privileged && ownerScope && ownerScope !== LIVESTOCK_VIEW_ALL));

  const sightingsPath =
    base === "/user" ? "/user/livestock/sightings" : null;

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

  const stats = useMemo(() => {
    const n = animals.length;
    return { showing: n, total };
  }, [animals.length, total]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">{viewTitle(view)}</h1>
          <p className="text-sm text-gray-600 mt-1">
            {view === "active"
              ? "Animals currently registered as active."
              : view === "missing"
                ? "Animals marked missing by their owners."
                : view === "recovered"
                  ? "Animals marked recovered."
                  : "Soft-deleted animals. Restore from the detail page."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {sightingsPath ? (
            <Link
              to={sightingsPath}
              className="px-4 py-2 rounded-xl border bg-white text-sm font-medium text-gray-800"
            >
              {NAV.livestockSightings}
            </Link>
          ) : null}
          {canRegister ? (
            <RippleButton
              type="button"
              className="px-4 py-2 rounded-xl bg-iregistrygreen text-white text-sm font-semibold"
              onClick={() =>
                navigate(
                  registerPath(
                    base,
                    privileged && ownerScope !== LIVESTOCK_VIEW_ALL
                      ? ownerScope
                      : undefined,
                  ),
                )
              }
            >
              {privileged && !isOwnerSelf
                ? NAV_ACTIONS.registerAnimalForUser || "Register animal for user"
                : "Register animal"}
            </RippleButton>
          ) : null}
        </div>
      </div>

      {pack && view === "active" && (isOwnerSelf || privileged) ? (
        <div className="rounded-2xl border border-gray-100 bg-white px-4 py-3 text-sm text-gray-700 flex flex-wrap items-center justify-between gap-2">
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
              className="px-3 py-1.5 rounded-xl bg-amber-500 text-white text-sm"
              onClick={() => void buyPack()}
            >
              Buy pack — 5 credits / 10 animals
            </RippleButton>
          ) : null}
        </div>
      ) : null}

      <div className="rounded-2xl border border-gray-100 bg-gray-50/80 p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex flex-col gap-3 w-full lg:w-auto">
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search by name, breed, colour, type…"
              className="w-full lg:w-96 border rounded-xl px-4 py-2.5 bg-white"
            />
            {privileged ? (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-gray-500">Owner</span>
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
                        page: 1,
                      });
                    }
                  }}
                  disabled={usersLoading || Boolean(staffScope?.scopedUserId)}
                  className="border rounded-lg px-2 py-1.5 bg-white min-w-[12rem]"
                >
                  {!staffScope?.scopedUserId ? (
                    <option value={LIVESTOCK_VIEW_ALL}>All owners</option>
                  ) : null}
                  {(usersList || []).map((u) => (
                    <option key={u.id} value={u.id}>
                      {displayUser(u) || u.id}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>
          <div className="hidden lg:flex items-center gap-6 text-sm font-medium text-gray-700">
            <div>
              <span className="text-2xl font-bold text-gray-900 tabular-nums">{stats.total}</span>{" "}
              total
            </div>
            <div>
              <span className="text-2xl font-bold text-iregistrygreen tabular-nums">
                {stats.showing}
              </span>{" "}
              on page
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-gray-500">Loading…</div>
      ) : animals.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-600">
          No animals in this list.
          {canRegister ? (
            <>
              {" "}
              <button
                type="button"
                className="text-iregistrygreen font-semibold underline"
                onClick={() =>
                  navigate(
                    registerPath(
                      base,
                      privileged && ownerScope !== LIVESTOCK_VIEW_ALL
                        ? ownerScope
                        : undefined,
                    ),
                  )
                }
              >
                Register an animal
              </button>
            </>
          ) : null}
        </div>
      ) : (
        <>
          <div className="hidden sm:block overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left py-3 px-4">Animal</th>
                  {privileged ? <th className="text-left py-3 px-4">Type</th> : null}
                  <th className="text-left py-3 px-4">Status</th>
                  <th className="text-left py-3 px-4">Location</th>
                  <th className="text-right py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {animals.map((a) => {
                  const src = livestockThumb(a);
                  return (
                    <tr
                      key={a.id}
                      className="border-t border-gray-100 hover:bg-gray-50/80 cursor-pointer"
                      onClick={() => navigate(`/livestock/${a.id}`)}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-12 h-12 rounded-lg bg-gray-100 overflow-hidden shrink-0">
                            {src ? (
                              <img src={src} alt="" className="w-full h-full object-cover" />
                            ) : null}
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium text-gray-900 truncate">
                              {a.name || a.breed || a.type_code || "Animal"}
                            </div>
                            <div className="text-xs text-gray-500 truncate">
                              {[a.colour, a.breed, a.gender].filter(Boolean).join(" · ")}
                            </div>
                          </div>
                        </div>
                      </td>
                      {privileged ? (
                        <td className="py-3 px-4 text-gray-700">{a.type_code || "—"}</td>
                      ) : null}
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${statusBadgeClass(a.status)}`}
                        >
                          {a.status || "active"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-600">
                        {a.dwelling_village || "—"}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          className="text-iregistrygreen font-medium hover:underline"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/livestock/${a.id}`);
                          }}
                        >
                          Open
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="sm:hidden grid grid-cols-1 gap-3">
            {animals.map((a) => {
              const src = livestockThumb(a);
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => navigate(`/livestock/${a.id}`)}
                  className="rounded-2xl border border-gray-100 bg-white overflow-hidden text-left shadow-sm"
                >
                  <div className="aspect-[4/3] bg-gray-100">
                    {src ? (
                      <img src={src} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">
                        No photo
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <div className="font-semibold text-gray-900">
                      {a.name || a.breed || a.type_code || "Animal"}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {[a.type_code, a.colour, a.status].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {pageCount > 1 ? (
            <div className="flex items-center justify-between gap-3 pt-2">
              <RippleButton
                type="button"
                className="px-3 py-1.5 rounded-xl border bg-white text-sm disabled:opacity-50"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </RippleButton>
              <div className="text-sm text-gray-600 tabular-nums">
                Page {page} / {pageCount}
              </div>
              <RippleButton
                type="button"
                className="px-3 py-1.5 rounded-xl border bg-white text-sm disabled:opacity-50"
                disabled={page >= pageCount}
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              >
                Next
              </RippleButton>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
