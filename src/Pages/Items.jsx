// src/Pages/Items.jsx
import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, useMatch } from "react-router-dom";
import RippleButton from "../components/RippleButton.jsx";
import ConfirmModal from "../components/ConfirmModal.jsx";
import Toast from "../components/Toast.jsx";
import { useItems } from "../contexts/ItemsContext.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";
import { invokeWithAuth } from "../lib/invokeWithAuth.js";
import { useModal } from "../contexts/ModalContext.jsx";
import { formatBwpCurrency } from "../lib/formatBWP.js";
import { useTaskPricing } from "../hooks/useTaskPricing.js";
import { useBillingErrorMessage } from "../hooks/useBillingErrorMessage.js";
import { useAddItemPreflight } from "../hooks/useAddItemPreflight.js";
import {
  resolveOwnerBalanceForItem,
  willUpdateItemChargeOwnerWallet,
  isPrivilegedRole,
} from "../lib/billingUx.js";
import { roleIs } from "../lib/roleUtils.js";
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

function formatPoliceCaseStatus(status) {
  if (!status) return "—";
  const map = {
    Open: "Open",
    InCustody: "In custody",
    ClearedForReturn: "Cleared for return",
    ReturnedToOwner: "Returned to owner",
  };
  return map[status] || status;
}

function policeCaseStatusBadgeClass(status) {
  switch (status) {
    case "Open":
      return "bg-amber-50 text-amber-800 border border-amber-200";
    case "InCustody":
      return "bg-sky-50 text-sky-800 border border-sky-200";
    case "ClearedForReturn":
      return "bg-violet-50 text-violet-800 border border-violet-200";
    default:
      return "bg-gray-50 text-gray-600 border border-gray-200";
  }
}

/** Next step in Open → In custody → Cleared for return → Returned to owner */
function getNextPoliceCaseStep(status) {
  switch (status) {
    case "Open":
      return { label: "In custody", nextStatus: "InCustody" };
    case "InCustody":
      return { label: "Cleared for return", nextStatus: "ClearedForReturn" };
    case "ClearedForReturn":
      return { label: "Returned to owner", nextStatus: "ReturnedToOwner" };
    default:
      return null;
  }
}

function photoStoragePublicUrl(entry, preferThumb = true) {
  if (!entry || !SUPABASE_URL) return null;

  const raw = (() => {
    if (typeof entry === "string") return entry.trim();
    if (typeof entry === "object" && entry) {
      return preferThumb
        ? (entry.thumb || entry.original || "").trim()
        : (entry.original || entry.thumb || "").trim();
    }
    return "";
  })();

  if (!raw) return null;

  // If it's already a full URL, use it as-is.
  if (/^https?:\/\//i.test(raw)) return raw;

  // If it already includes our public prefix, don't double-prefix.
  const publicPrefix = `${SUPABASE_URL}/storage/v1/object/public/item-photos/`;
  if (raw.startsWith(publicPrefix)) return raw;

  const relPrefix = "/storage/v1/object/public/item-photos/";
  if (raw.startsWith(relPrefix)) return `${SUPABASE_URL}${raw}`;

  const relPrefixNoSlash = "storage/v1/object/public/item-photos/";
  if (raw.startsWith(relPrefixNoSlash)) return `${SUPABASE_URL}/${raw}`;

  const normalizedPath = raw.replace(/^item-photos\//i, "").replace(/^\/+/, "");
  if (!normalizedPath) return null;

  return `${SUPABASE_URL}/storage/v1/object/public/item-photos/${normalizedPath}`;
}

function formatItemPlace(item) {
  const v = String(item?.village || "").trim();
  const w = String(item?.ward || "").trim();
  if (v || w) return [v, w].filter(Boolean).join(", ");
  return "—";
}

function formatItemStation(item) {
  return String(item?.station || item?.location || "").trim() || "—";
}

function itemThumbnailSrc(item) {
  const first = item?.photos?.[0] ?? null;
  return (
    photoStoragePublicUrl(first, true) ||
    item?.imageUrl?.trim() ||
    null
  );
}

function photoEntryPath(entry, preferThumb = true) {
  if (!entry) return null;
  if (typeof entry === "string") return entry.trim() || null;
  if (typeof entry === "object") {
    const raw = preferThumb
      ? entry.thumb || entry.original || ""
      : entry.original || entry.thumb || "";
    return String(raw).trim() || null;
  }
  return null;
}

export default function Items({ view = "active" } = {}) {
  const { confirm } = useModal();
  const navigate = useNavigate();
  /** `/items` has no dashboard layout padding; nested `/userdashboard/items` already does. */
  const standaloneItemsRoute = useMatch({ path: "/items", end: true });
    const {
    items: ctxItems = [],
    loading,
    updateItem,
    deleteItem,
    restoreItem,
    markLegacyItem,
    restoreLegacyItem,
    refreshItems,
  } = useItems();

  const { user } = useAuth();
  const role = user?.role;
  const { getCost } = useTaskPricing();
  const formatBilling = useBillingErrorMessage();
  const { goToAddItem, tasksLoading: addPreflightLoading } = useAddItemPreflight();

  // UI state
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All"); // All / Active / Stolen
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [sortBy] = useState("name"); // name | lastSeen | status
  const [page, setPage] = useState(1);
  const perPage = 8;

  // If bucket is private, we need signed URLs for thumbnails.
  const [signedThumbByItemId, setSignedThumbByItemId] = useState({});

  // Role-specific scope controls:
  // - police: can toggle viewing items "reported stolen at my station"
  // - privileged (admin/cashier): can choose which user's items to view
  const [policeShowStolenAtStation, setPoliceShowStolenAtStation] = useState(false);
  const [usersList, setUsersList] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [selectedOwnerId, setSelectedOwnerId] = useState(user?.id || "");

  const isPrivileged = isPrivilegedRole(role);

  useEffect(() => {
    // Reset scope defaults when switching sessions/roles.
    setPoliceShowStolenAtStation(false);
    setSelectedOwnerId(user?.id || "");
  }, [user?.id, role]);

  useEffect(() => {
    // When used as a dedicated page (deleted/legacy), refresh the backing list accordingly.
    // The main ItemsProvider initial load fetches active items; this overrides it when needed.
    if (!user?.id) return;
    const oid = isPrivileged ? (selectedOwnerId || user.id) : user.id;
    if (view === "deleted") {
      void refreshItems({ ownerId: oid, includeDeleted: true, deletedOnly: true, includeLegacy: true });
    } else if (view === "legacy") {
      void refreshItems({ ownerId: oid, includeLegacy: true, legacyOnly: true, includeDeleted: true });
    } else {
      void refreshItems({ ownerId: oid, includeDeleted: false, includeLegacy: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, user?.id, selectedOwnerId, isPrivileged]);

  useEffect(() => {
    if (!isPrivileged) return;
    let cancelled = false;

    async function loadUsers() {
      setUsersLoading(true);
      try {
        const { data, error } = await invokeWithAuth("list-users");
        if (cancelled) return;

        if (error || !data?.success) {
          setUsersList([]);
          return;
        }

        setUsersList(data.users || []);
      } finally {
        if (!cancelled) setUsersLoading(false);
      }
    }

    void loadUsers();

    return () => {
      cancelled = true;
    };
  }, [isPrivileged]);

  // Confirm modal state (new pattern: action + arg passed into modal)
  const [confirmState, setConfirmState] = useState({
    isOpen: false,
    title: "",
    message: "",
    confirmLabel: "Confirm",
    cancelLabel: "Cancel",
    danger: false,
    action: null, // function to call on confirm (modal will call it)
    arg: undefined,
    afterConfirmMessage: null,
    children: null,
  });

  const stolenStationInputRef = useRef(null);

  // Toast state (keeps Toast component usage compatible)
  const [toast, setToast] = useState({ message: "", type: "info", visible: false });
  const [caseWorkingId, setCaseWorkingId] = useState(null);
  const [policeAdvanceModal, setPoliceAdvanceModal] = useState(null);
  const [policeAdvanceNote, setPoliceAdvanceNote] = useState("");
  const [policeAdvanceEvidenceLine, setPoliceAdvanceEvidenceLine] = useState("");

  function openConfirm(opts = {}) {
    setConfirmState({
      isOpen: true,
      title: opts.title || "Confirm",
      message: opts.message || "Are you sure?",
      confirmLabel: opts.confirmLabel || "Confirm",
      cancelLabel: opts.cancelLabel || "Cancel",
      danger: !!opts.danger,
      action: typeof opts.action === "function" ? opts.action : null,
      arg: opts.arg,
      afterConfirmMessage: opts.afterConfirmMessage || null,
      children: opts.children ?? null,
    });
  }

  function closeConfirm() {
    setConfirmState({
      isOpen: false,
      title: "",
      message: "",
      confirmLabel: "Confirm",
      cancelLabel: "Cancel",
      danger: false,
      action: null,
      arg: undefined,
      afterConfirmMessage: null,
      children: null,
    });
  }

  function handleAfterConfirm(success) {

    if (!success) return;

    if (confirmState.afterConfirmMessage) {
      setToast({
        message: confirmState.afterConfirmMessage,
        type: "success",
        visible: true,
      });

      setTimeout(() => {
        setToast((t) => ({ ...t, visible: false }));
      }, 2500);
    }
  }

  // derived items (from context)
  const items = useMemo(() => ctxItems || [], [ctxItems]);

  async function handlePoliceStolenToggle(nextValue) {
    setPoliceShowStolenAtStation(nextValue);
    await refreshItems({
      policeStationStolenView: nextValue,
    });
    setStatusFilter(nextValue ? "Stolen" : "All");
    setPage(1);
  }

  function openPoliceAdvanceModal(item) {
    const step = getNextPoliceCaseStep(item.policeCase?.status);
    if (!step || !item.policeCase?.id) return;
    setPoliceAdvanceModal({ item, step });
    setPoliceAdvanceNote("");
    setPoliceAdvanceEvidenceLine("");
  }

  function closePoliceAdvanceModal() {
    setPoliceAdvanceModal(null);
    setPoliceAdvanceNote("");
    setPoliceAdvanceEvidenceLine("");
  }

  async function submitPoliceAdvanceModal() {
    if (!policeAdvanceModal) return;
    const { item, step } = policeAdvanceModal;
    const note = policeAdvanceNote.trim();
    const evLine = policeAdvanceEvidenceLine.trim();
    const evidence = evLine ? { summary: evLine } : undefined;
    try {
      const ok = await confirm({
        title: "Confirm",
        message: `Update case to "${step?.label || "next step"}"? This will update the police case record.`,
        confirmLabel: "Update case",
        cancelLabel: "Cancel",
      }).catch(() => false);
      if (!ok) return;

      await executePoliceCaseAdvance(item, step, {
        note: note || undefined,
        evidence,
      });
      closePoliceAdvanceModal();
    } catch {
      /* keep modal open on failure */
    }
  }

  async function executePoliceCaseAdvance(item, step, { note, evidence } = {}) {
    if (!step || !item.policeCase?.id) return;

    setCaseWorkingId(item.policeCase.id);
    try {
      const body = {
        caseId: item.policeCase.id,
        nextStatus: step.nextStatus,
      };
      if (note) body.note = note;
      if (evidence && Object.keys(evidence).length) body.evidence = evidence;

      const { data, error } = await invokeWithAuth("update-police-case", {
        body,
      });

      if (error && !data?.message) {
        throw new Error(error.message || "Could not update case");
      }
      if (!data?.success) {
        throw new Error(data?.message || "Could not update case");
      }

      await refreshItems({ policeStationStolenView: true });
      setToast({
        message: `Case: ${step.label}`,
        type: "success",
        visible: true,
      });
      setTimeout(() => {
        setToast((t) => ({ ...t, visible: false }));
      }, 2500);
    } catch (err) {
      setToast({
        message: err.message || "Case update failed",
        type: "error",
        visible: true,
      });
      setTimeout(() => {
        setToast((t) => ({ ...t, visible: false }));
      }, 5000);
      throw err;
    } finally {
      setCaseWorkingId(null);
    }
  }

  async function handlePrivilegedOwnerChange(nextOwnerId) {
    setSelectedOwnerId(nextOwnerId);
    await refreshItems({ ownerId: nextOwnerId });
    setStatusFilter("All");
    setPage(1);
  }

  const categories = useMemo(() => {
    const s = new Set(items.map((i) => i.category).filter(Boolean));
    return Array.from(s).sort();
  }, [items]);

  const filtered = useMemo(() => {
    let list = items.slice();

    if (statusFilter !== "All") list = list.filter((i) => i.status === statusFilter);
    if (categoryFilter !== "All") list = list.filter((i) => i.category === categoryFilter);

    const qTrim = (query || "").trim();
    if (qTrim) {
      const q = qTrim.toLowerCase();
      list = list.filter(
        (i) =>
          (i.name && i.name.toLowerCase().includes(q)) ||
          (i.id && i.id.toLowerCase().includes(q)) ||
          (i.make && i.make.toLowerCase().includes(q)) ||
          (i.model && i.model.toLowerCase().includes(q)) ||
          (i.serial1 && i.serial1.toLowerCase().includes(q)) ||
          (i.village && String(i.village).toLowerCase().includes(q)) ||
          (i.ward && String(i.ward).toLowerCase().includes(q)) ||
          (i.station && String(i.station).toLowerCase().includes(q)) ||
          (i.location && String(i.location).toLowerCase().includes(q))
      );
    }

    // sort
    list.sort((a, b) => {
      if (sortBy === "name") return (a.name || "").localeCompare(b.name || "");
      if (sortBy === "lastSeen") {
        const da = a.lastSeen ? new Date(a.lastSeen) : null;
        const db = b.lastSeen ? new Date(b.lastSeen) : null;
        if (da && db) return db - da;
        if (da && !db) return -1;
        if (!da && db) return 1;
        return 0;
      }
      if (sortBy === "status") return (a.status || "").localeCompare(b.status || "");
      return 0;
    });

    return list;
  }, [items, statusFilter, categoryFilter, query, sortBy]);

  useEffect(() => {
  setPage(1);
}, [query, statusFilter, categoryFilter, sortBy]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));

  useEffect(() => {
    setPage((p) => (p > totalPages ? totalPages : p));
  }, [totalPages]);

  const pageItems = useMemo(() => {
    const start = (page - 1) * perPage;
    return filtered.slice(start, start + perPage);
  }, [filtered, page]);

  useEffect(() => {
    let cancelled = false;

    async function loadSignedThumbs() {
      // Only thumbnails for visible rows.
      const reqs = pageItems
        .map((it) => {
          const first = it?.photos?.[0] ?? null;
          const path = photoEntryPath(first, true);
          if (!path) return null;
          return { itemId: it.id, path };
        })
        .filter(Boolean);

      if (reqs.length === 0) {
        if (!cancelled) setSignedThumbByItemId({});
        return;
      }

      try {
        const results = await Promise.all(
          reqs.map((r) =>
            invokeWithAuth("get-item-photo-urls", {
              body: { itemId: r.itemId, paths: [r.path] },
            })
          )
        );

        if (cancelled) return;

        const next = {};
        for (let i = 0; i < reqs.length; i++) {
          const res = results[i];
          const url = res?.data?.success ? res.data.urls?.[0] : null;
          if (url) next[reqs[i].itemId] = url;
        }

        setSignedThumbByItemId(next);
      } catch {
        // If signing fails, keep showing the public URLs.
        if (!cancelled) setSignedThumbByItemId({});
      }
    }

    void loadSignedThumbs();
    return () => {
      cancelled = true;
    };
  }, [pageItems]);

  const stats = useMemo(() => {
    const totalItems = items.length;
    const activeItems = items.filter((i) => i.status === "Active").length;
    const stolenItems = items.filter((i) => i.status === "Stolen").length;
    return { totalItems, activeItems, stolenItems };
  }, [items]);

  async function doRestoreDeleted(id) {
    await restoreItem(id);
  }

  async function doMarkLegacy(id, reason = null) {
    await markLegacyItem(id, { reason });
  }

  async function doRestoreLegacy(id) {
    await restoreLegacyItem(id);
  }

  function confirmRestoreDeleted(id) {
    const it = items.find((x) => x.id === id);
    if (!it) return;
    openConfirm({
      title: "Restore item",
      message: `Restore "${it.name || it.id}" back to your active items?`,
      confirmLabel: "Restore",
      cancelLabel: "Cancel",
      danger: false,
      action: doRestoreDeleted,
      arg: id,
      afterConfirmMessage: `${it.name || it.id} restored`,
    });
  }

  function confirmLegacy(id) {
    const it = items.find((x) => x.id === id);
    if (!it) return;
    openConfirm({
      title: "Move to legacy",
      message: `Move "${it.name || it.id}" to legacy? It will no longer appear in active items, but you can restore it later.`,
      confirmLabel: "Move to legacy",
      cancelLabel: "Cancel",
      danger: false,
      action: () => doMarkLegacy(id, null),
      afterConfirmMessage: `${it.name || it.id} moved to legacy`,
    });
  }

  function confirmRestoreLegacy(id) {
    const it = items.find((x) => x.id === id);
    if (!it) return;
    openConfirm({
      title: "Restore from legacy",
      message: `Restore "${it.name || it.id}" back to your active items?`,
      confirmLabel: "Restore",
      cancelLabel: "Cancel",
      danger: false,
      action: () => doRestoreLegacy(id),
      afterConfirmMessage: `${it.name || it.id} restored`,
    });
  }

  // ----------Mark Stolen/Active............................
  async function doToggleStatus(id, getPoliceStation) {
    const it = items.find((x) => x.id === id);
    if (!it) return;

    const next = it.status === "Stolen" ? "Active" : "Stolen";

    try {
      if (next === "Stolen") {
        const raw =
          typeof getPoliceStation === "function" ? getPoliceStation() : "";
        const trimmed = String(raw ?? "").trim();
        await updateItem(
          id,
          {
            status: "Stolen",
            reportedStolenAt: new Date().toISOString(),
          },
          trimmed ? { policeStation: trimmed } : {}
        );
      } else {
        await updateItem(id, {
          status: "Active",
          reportedStolenAt: null,
        });
      }
    } catch (err) {
      setToast({
        message: formatBilling(err),
        type: "error",
        visible: true,
      });
      setTimeout(() => {
        setToast((t) => ({ ...t, visible: false }));
      }, 5000);
      throw err;
    }
  }

  async function doDelete(id) {
    try {
      await deleteItem(id);
    } catch (err) {
      setToast({
        message: err.message || "Failed to delete item",
        type: "error",
        visible: true,
      });

      setTimeout(() => {
        setToast((t) => ({ ...t, visible: false }));
      }, 3000);

      throw err; // prevent success toast
    }
  }

  // wrappers that open the confirm modal with action + message
  function confirmToggleStatus(id) {
    const it = items.find((x) => x.id === id);
    if (!it) return;
    const next = it.status === "Stolen" ? "Active" : "Stolen";

    if (next === "Stolen") {
      const ownerRole = it.ownerRole ?? null;
      const chargesOwner = willUpdateItemChargeOwnerWallet(role, ownerRole);
      const ownerBal = resolveOwnerBalanceForItem(it, user);
      let stolenMsg = `Report "${it.name || it.id}" as stolen? A police case is opened for the station below.`;
      if (chargesOwner) {
        const cost = getCost("MARK_STOLEN");
        if (cost != null) {
          stolenMsg += ` This costs ${cost} credits. Registered owner's balance: ${ownerBal}.`;
          if (ownerBal < cost) {
            stolenMsg += ` The owner needs ${cost - ownerBal} more credits (Credit pricing) before this can succeed.`;
          }
        }
      } else if (
        isPrivilegedRole(role) &&
        it.ownerId &&
        String(it.ownerId) !== String(user?.id)
      ) {
        stolenMsg += ` Owner reference balance: ${ownerBal} credits. Staff actions do not debit this owner's wallet.`;
      } else {
        stolenMsg += " No owner credit charge applies for this action (policy).";
      }
      openConfirm({
        title: "Report stolen",
        message: stolenMsg,
        confirmLabel: "Mark Stolen",
        cancelLabel: "Cancel",
        danger: true,
        action: () =>
          doToggleStatus(id, () => stolenStationInputRef.current?.value ?? ""),
        afterConfirmMessage: `${it.name || it.id} reported stolen`,
        children: (
          <div className="text-left space-y-1.5">
            <label
              htmlFor="stolen-police-station"
              className="block text-xs font-medium text-gray-700"
            >
              Police station (optional)
            </label>
            <input
              id="stolen-police-station"
              ref={stolenStationInputRef}
              key={id}
              type="text"
              defaultValue={it.station || it.location || ""}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900"
              placeholder="Leave blank to use nearest police station on file"
            />
            <p className="text-xs text-gray-500">
              If you leave this blank, your item&apos;s nearest police station is used when the case opens.
            </p>
          </div>
        ),
      });
      return;
    }

    openConfirm({
      title: "Change status",
      message: `Are you sure you want to mark "${it.name || it.id}" as Active?`,
      confirmLabel: "Mark Active",
      cancelLabel: "Cancel",
      danger: false,
      action: () => doToggleStatus(id),
      afterConfirmMessage: `${it.name || it.id} marked Active`,
    });
  }

  function confirmDelete(id) {
    const it = items.find((x) => x.id === id);
    if (!it) return;

    openConfirm({
      title: "Delete item",
      message: `Delete "${it.name || it.id}" permanently?\n\nThis action cannot be undone.`,
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
      danger: true,
      action: doDelete,
      arg: id,
      afterConfirmMessage: `${it.name || it.id} deleted`,
    });
  }

  function handleExportCSV() {
    const rows = [
      [
        "ID",
        "Name",
        "Category",
        "Make",
        "Model",
        "Status",
        "LastSeen",
        "TownVillage",
        "WardStreet",
        "NearestPoliceStation",
        "Serial1",
        "CreatedOn",
        "UpdatedOn",
      ],
      ...filtered.map((i) => [
        i.id,
        i.name,
        i.category || "",
        i.make || "",
        i.model || "",
        i.status || "",
        i.lastSeen || "",
        i.village || "",
        i.ward || "",
        i.station || i.location || "",
        i.serial1 || "",
        i.createdOn || "",
        i.updatedOn || "",
      ]),
    ];

    const escapeCell = (cell) => {
      const s = String(cell == null ? "" : cell);
      const escaped = s.replace(/"/g, '""');
      return '"' + escaped + '"';
    };

    const csv = rows.map((row) => row.map(escapeCell).join(",")).join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ireg_items_export_" + new Date().toISOString().slice(0, 10) + ".csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function statusBadge(status) {
    if (status === "Stolen")
      return "bg-red-100 text-red-700 border border-red-200";
    if (status === "Active")
      return "bg-emerald-100 text-emerald-700 border border-emerald-200";
    return "bg-gray-100 text-gray-600 border border-gray-200";
  }

  const startIndex = total === 0 ? 0 : (page - 1) * perPage + 1;
  const endIndex = Math.min(page * perPage, total);

  const showStationQueue = roleIs(role, "police") && policeShowStolenAtStation;
  const queueRowReadOnly = (item) =>
    showStationQueue && item.ownerId !== user?.id;

  const tableColCount = showStationQueue ? 9 : 8;

  return (
    <div className="min-h-screen bg-gray-100">

      {/* Confirm modal wired to call action(actionArg) and run afterConfirm */}
      <ConfirmModal
        isOpen={confirmState.isOpen}
        onClose={() => closeConfirm()}
        action={confirmState.action}
        actionArg={confirmState.arg}
        afterConfirm={(success) => handleAfterConfirm(success)}
        title={confirmState.title}
        message={confirmState.message}
        confirmLabel={confirmState.confirmLabel}
        cancelLabel={confirmState.cancelLabel}
        danger={confirmState.danger}
        children={confirmState.children}
      />

      {policeAdvanceModal ? (
        <div className="fixed inset-0 z-[110] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => !caseWorkingId && closePoliceAdvanceModal()}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            className="relative bg-white rounded-xl shadow-lg w-full max-w-md mx-4 p-5 z-10 border border-gray-100"
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              {policeAdvanceModal.step.label}
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Optional note is appended to the case file. Evidence summary is stored as structured
              data for tangible property.
            </p>
            <label className="block text-xs font-medium text-gray-700 mb-1">Note (optional)</label>
            <textarea
              value={policeAdvanceNote}
              onChange={(e) => setPoliceAdvanceNote(e.target.value)}
              rows={3}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-3"
              placeholder="e.g. Item tagged at central exhibit room"
            />
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Evidence summary (optional)
            </label>
            <input
              type="text"
              value={policeAdvanceEvidenceLine}
              onChange={(e) => setPoliceAdvanceEvidenceLine(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-4"
              placeholder="Reference ID, exhibit number, or short description"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={!!caseWorkingId}
                onClick={closePoliceAdvanceModal}
                className="px-4 py-2 rounded-lg border border-gray-200 text-sm disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!!caseWorkingId}
                onClick={() => void submitPoliceAdvanceModal()}
                className="px-4 py-2 rounded-lg bg-slate-800 text-white text-sm hover:bg-slate-900 disabled:opacity-50"
              >
                {caseWorkingId ? "Saving…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Toast */}
      <Toast
        message={toast.message}
        type={toast.type}
        visible={toast.visible}
        onClose={() => setToast({ message: "", type: "info", visible: false })}
      />

      <div
        className={`max-w-7xl mx-auto w-full py-6 sm:py-8 lg:py-10 pb-12 ${
          standaloneItemsRoute ? "px-4 sm:px-6 lg:px-8" : ""
        }`}
      >
        {/* Single page container — same shell as Profile */}
        <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="border-b border-emerald-100/80 bg-gradient-to-r from-emerald-50/95 via-emerald-50/80 to-emerald-50/60 px-4 sm:px-6 lg:px-8 py-5 sm:py-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-iregistrygreen tracking-tight">
                  {showStationQueue
                    ? "Station stolen queue"
                    : view === "deleted"
                      ? "Deleted items"
                      : view === "legacy"
                        ? "Legacy items"
                        : "My Items"}
                </h1>
                <p className="mt-1 text-sm text-gray-500">
                  {showStationQueue
                    ? "Open cases reported to your station (matched on the case record). Item status and case pipeline are shown below."
                    : view === "deleted"
                      ? "Soft-deleted items you can restore back to active."
                      : view === "legacy"
                        ? "Obsolete items kept for reference (read-only). Restore to bring them back to active."
                        : "Manage and monitor your registered assets"}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 lg:shrink-0">
                {view === "active" ? (
                  <RippleButton
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-iregistrygreen text-white text-sm font-medium shadow-sm hover:opacity-95 transition-opacity disabled:opacity-60"
                    onClick={() => void goToAddItem()}
                    disabled={addPreflightLoading}
                    title={addPreflightLoading ? "Loading credit prices…" : undefined}
                  >
                    + Add Item
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
        {/* filters row */}
        <div className="rounded-2xl border border-gray-100 bg-gray-50/80 p-5 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">

            {/* LEFT SIDE */}
            <div className="flex flex-col gap-3 w-full lg:w-auto">

              {/* Search */}
              <div>
                <input
                  type="search"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Search by name, id, make, model or serial..."
                  className="w-full lg:w-96 border rounded-xl px-4 py-2.5"
                />
              </div>

              {/* 📱 MOBILE TOTALS (authoritative card) */}
              <div className="lg:hidden bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 shadow-sm">
                <div className="flex justify-between text-sm font-medium">

                  <div className="text-center flex-1">
                    <div className="text-xs text-gray-400 uppercase tracking-wide">
                      Total
                    </div>
                    <div className="text-xl font-bold text-gray-900">
                      {stats.totalItems}
                    </div>
                  </div>

                  <div className="text-center flex-1">
                    <div className="text-xs text-gray-400 uppercase tracking-wide">
                      Active
                    </div>
                    <div className="text-xl font-bold text-emerald-600">
                      {stats.activeItems}
                    </div>
                  </div>

                  <div className="text-center flex-1">
                    <div className="text-xs text-gray-400 uppercase tracking-wide">
                      Stolen
                    </div>
                    <div className="text-xl font-bold text-red-600">
                      {stats.stolenItems}
                    </div>
                  </div>

                </div>
              </div>

              {/* Filters */}
              <div className="flex gap-3 flex-wrap">
                {view === "active" ? (
                  <select
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value);
                      setPage(1);
                    }}
                    className="border rounded-xl px-3 py-2"
                  >
                    <option value="All">All statuses</option>
                    <option value="Active">Active</option>
                    <option value="Stolen">Stolen</option>
                  </select>
                ) : null}

                <select
                  value={categoryFilter}
                  onChange={(e) => {
                    setCategoryFilter(e.target.value);
                    setPage(1);
                  }}
                  className="border rounded-xl px-3 py-2"
                >
                  <option value="All">All categories</option>
                  {categories.map((c) => (
                    <option value={c} key={c}>
                      {c}
                    </option>
                  ))}
                </select>

                {roleIs(role, "police") && (
                  <label
                    className="flex items-center gap-2 text-sm text-gray-700 px-2 py-2 rounded-xl border bg-white"
                    title="List open police cases whose reporting station matches your police station profile"
                  >
                    <input
                      type="checkbox"
                      checked={policeShowStolenAtStation}
                      onChange={(e) =>
                        void handlePoliceStolenToggle(e.target.checked)
                      }
                    />
                    Station stolen queue
                  </label>
                )}

                {isPrivileged && (
                  <div className="flex items-center gap-2 px-2 py-2 rounded-xl border bg-white">
                    <div className="text-xs text-gray-500 whitespace-nowrap">
                      View as user
                    </div>
                    <select
                      value={selectedOwnerId}
                      onChange={(e) => {
                        void handlePrivilegedOwnerChange(e.target.value);
                      }}
                      disabled={usersLoading || usersList.length === 0}
                      className="border rounded-lg px-2 py-1 text-sm"
                    >
                      {(usersList || []).map((u) => {
                        const label =
                          [u.first_name, u.last_name].filter(Boolean).join(" ") ||
                          u.email ||
                          u.id;
                        return (
                          <option key={u.id} value={u.id}>
                            {label}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* 💻 DESKTOP TOTALS */}
            <div className="hidden lg:flex items-center gap-6 text-sm font-medium">
              <div className="text-gray-700">
                <span className="text-2xl font-bold text-gray-900">
                  {stats.totalItems}
                </span>{" "}
                total
              </div>

              <div className="text-emerald-600">
                <span className="text-2xl font-bold">
                  {stats.activeItems}
                </span>{" "}
                active
              </div>

              <div className="text-red-600">
                <span className="text-2xl font-bold">
                  {stats.stolenItems}
                </span>{" "}
                stolen
              </div>
            </div>

          </div>
        </div>

        {/* table (desktop) */}
        <div className="hidden sm:block overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left py-3 px-4">Item</th>
                <th className="text-left py-3 px-4">Category</th>
                <th className="text-left py-3 px-4">Status</th>
                {showStationQueue ? (
                  <th className="text-left py-3 px-4">Case</th>
                ) : null}
                <th className="text-left py-3 px-4">Last Seen</th>
                <th className="text-left py-3 px-4">Place</th>
                <th className="text-left py-3 px-4">Station</th>
                <th className="text-right py-3 px-4">Est.Value</th>
                <th className="text-right py-3 px-4">Actions</th>
              </tr>
            </thead>

            <tbody>
              {/* ================= LOADING SKELETON ================= */}
              {loading &&
                [...Array(perPage)].map((_, i) => (
                  <tr key={i} className="border-t animate-pulse">
                    <td className="py-3 px-4">
                      <div className="h-4 bg-gray-200 rounded w-32" />
                    </td>
                    <td className="py-3 px-4">
                      <div className="h-4 bg-gray-200 rounded w-40" />
                    </td>
                    <td className="py-3 px-4">
                      <div className="h-4 bg-gray-200 rounded w-24" />
                    </td>
                    {showStationQueue ? (
                      <td className="py-3 px-4">
                        <div className="h-6 bg-gray-200 rounded-full w-24" />
                      </td>
                    ) : null}
                    <td className="py-3 px-4">
                      <div className="h-4 bg-gray-200 rounded w-28" />
                    </td>
                    <td className="py-3 px-4">
                      <div className="h-4 bg-gray-200 rounded w-28" />
                    </td>
                    <td className="py-3 px-4">
                      <div className="h-4 bg-gray-200 rounded w-24" />
                    </td>
                    <td className="py-3 px-4">
                      <div className="h-4 bg-gray-200 rounded w-24" />
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="h-6 bg-gray-200 rounded w-24 ml-auto" />
                    </td>
                  </tr>
                ))}

              {/* ================= DATA ROWS ================= */}
              {!loading &&
                pageItems.map((item) => {
                  
                  return (
                    <tr
                      key={item.id}
                      className="border-t border-gray-100 hover:bg-gray-50 hover:shadow-sm transition-all duration-150"
                    >
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          {/* Thumbnail */}
                          <div className="w-11 h-11 bg-gray-100 rounded-xl border border-gray-200 flex items-center justify-center text-xs text-gray-400 overflow-hidden">
                            {itemThumbnailSrc(item) ? (
                              <img
                              src={
                                signedThumbByItemId?.[item.id] ||
                                itemThumbnailSrc(item)
                              }
                              className="w-full h-full object-cover"
                            />
                            ) : (
                              "—"
                            )}
                          </div>

                          {/* Name + Serial */}
                          <div>
                            <div className="font-semibold text-gray-900 hover:text-iregistrygreen transition cursor-pointer"
                                onClick={() => navigate("/items/" + item.slug)}>
                              {item.name}
                            </div>
                            <div className="text-xs text-gray-500">
                              Serial: {item.serial1 || "—"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-5 text-gray-600">{item.category}</td>
                      <td className="py-4 px-5">
                        <div className="flex flex-col items-start gap-1">

                          <span
                            className={
                              "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium " +
                              statusBadge(item.status)
                            }
                          >
                            {item.status || "—"}
                          </span>

                          {item.status === "Stolen" && item.reportedStolenAt && (
                            <div className="text-xs text-red-500">
                              Reported {new Date(item.reportedStolenAt).toLocaleDateString("en-BW")}
                            </div>
                          )}

                        </div>
                      </td>
                      {showStationQueue ? (
                        <td className="py-4 px-5">
                          {item.policeCase ? (
                            <div className="flex flex-col gap-1 items-start">
                              <span
                                className={
                                  "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium " +
                                  policeCaseStatusBadgeClass(item.policeCase.status)
                                }
                              >
                                {formatPoliceCaseStatus(item.policeCase.status)}
                              </span>
                              {item.policeCase.openedAt && (
                                <span className="text-xs text-gray-500">
                                  Opened{" "}
                                  {new Date(item.policeCase.openedAt).toLocaleDateString("en-BW")}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400 text-xs">—</span>
                          )}
                        </td>
                      ) : null}
                      <td className="py-4 px-5 text-gray-600">
                        {item.lastSeen || "-"}
                      </td>
                      <td className="py-4 px-5 text-gray-600">
                        {formatItemPlace(item)}
                      </td>
                      <td className="py-4 px-5 text-gray-600">
                        {formatItemStation(item)}
                      </td>
                      <td className="py-4 px-5 text-right font-medium text-gray-700">
                        {formatBwpCurrency(item.estimatedValue, { empty: "-" })}
                      </td>
                      <td className="py-4 px-5 text-right">
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <RippleButton
                            className="px-3 py-1 rounded-md bg-gray-100 text-gray-700 text-xs"
                            onClick={() => navigate("/items/" + item.slug)}
                          >
                            View
                          </RippleButton>

                          {showStationQueue &&
                            item.policeCase &&
                            (() => {
                              const step = getNextPoliceCaseStep(
                                item.policeCase.status,
                              );
                              if (!step) return null;
                              const busy = caseWorkingId === item.policeCase.id;
                              return (
                                <RippleButton
                                  className="px-3 py-1 rounded-md text-xs border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 disabled:opacity-60"
                                  disabled={busy}
                                  onClick={() => openPoliceAdvanceModal(item)}
                                >
                                  {busy ? "…" : step.label}
                                </RippleButton>
                              );
                            })()}

                          {!queueRowReadOnly(item) ? (
                            <>
                              <RippleButton
                                className={`px-3 py-1 rounded-md text-xs ${
                                  item.status === "Stolen"
                                    ? "bg-emerald-600 text-white"
                                    : "bg-red-600 text-white"
                                }`}
                                onClick={() => confirmToggleStatus(item.id)}
                              >
                                {item.status === "Stolen" ? "Mark Active" : "Mark Stolen"}
                              </RippleButton>

                              {view === "active" ? (
                                <>
                                  <RippleButton
                                    className="px-2 py-1 rounded-md bg-white text-slate-700 border border-slate-200 text-xs"
                                    onClick={() => confirmLegacy(item.id)}
                                  >
                                    Legacy
                                  </RippleButton>
                                  <RippleButton
                                    className="px-2 py-1 rounded-md bg-white text-red-600 border border-red-100 text-xs"
                                    onClick={() => confirmDelete(item.id)}
                                  >
                                    Delete
                                  </RippleButton>
                                </>
                              ) : view === "deleted" ? (
                                <RippleButton
                                  className="px-2 py-1 rounded-md bg-white text-emerald-700 border border-emerald-100 text-xs"
                                  onClick={() => confirmRestoreDeleted(item.id)}
                                >
                                  Restore
                                </RippleButton>
                              ) : view === "legacy" ? (
                                <RippleButton
                                  className="px-2 py-1 rounded-md bg-white text-emerald-700 border border-emerald-100 text-xs"
                                  onClick={() => confirmRestoreLegacy(item.id)}
                                >
                                  Restore
                                </RippleButton>
                              ) : null}
                            </>
                          ) : (
                            <span className="text-xs text-gray-400">View only</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}

              {/* ================= EMPTY STATE ================= */}
              {!loading && pageItems.length === 0 && (
                <tr>
                  <td
                    colSpan={tableColCount}
                    className="py-6 px-4 text-center text-gray-500"
                  >
                    No items found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ===== Mobile Cards ===== */}
        <div className="sm:hidden space-y-4 active:scale-[0.99] active:shadow-inner">
          {pageItems.map((item) => {
            const isStolen = item.status === "Stolen";
            const isSelected = statusFilter !== "All";

            return (
              <div
                key={item.id}
                className={`
                  relative bg-white rounded-2xl border transition-all duration-200
                  ${isStolen
                    ? "border-red-100 shadow-md hover:shadow-lg bg-red-50/30"
                    : "border-emerald-100 shadow-sd hover:shadow-lg bg-emerald-50/30"}
                  ${isSelected ? "scale-[1.01]" : ""}
                `}
              >
                {/* Left Status Indicator */}
                <div
                  className={`
                    absolute left-0 top-0 h-full w-1.5 rounded-l-2xl
                    ${isStolen ? "bg-red-500" : "bg-emerald-500"}
                  `}
                />

                <div className="p-4">

                  {/* Top Section */}
                  <div className="flex gap-3">
                    
                    {/* Thumbnail */}
                    <div className={`
                      w-16 h-16 rounded-xl overflow-hidden flex-shrink-0
                      ${isStolen
                        ? "ring-1 ring-red-200 bg-red-50"
                        : "ring-1 ring-emerald-200 bg-emerald-50"}
                    `}>
                      {itemThumbnailSrc(item) ? (
                        <img
                          src={
                            signedThumbByItemId?.[item.id] ||
                            itemThumbnailSrc(item)
                          }
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">
                          No Image
                        </div>
                      )}
                    </div>

                    {/* Title + Meta */}
                    <div className="flex-1 min-w-0">
                      <div
                        onClick={() => navigate("/items/" + item.slug)}
                        className="font-semibold text-gray-900 truncate cursor-pointer hover:text-iregistrygreen transition"
                      >
                        {item.name}
                      </div>

                      <div className="text-xs text-gray-500 mt-1">
                        {item.category}
                      </div>

                      <div className="text-xs text-gray-400 mt-1 tracking-wide">
                        Serial: {item.serial1 || "—"}
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div>
                      <div className="flex flex-col items-end">

                        <span
                          className={`
                            inline-flex px-2.5 py-1 rounded-full text-xs font-semibold border
                            ${isStolen
                              ? "bg-red-100 text-red-700 border-red-200"
                              : "bg-emerald-100 text-emerald-700 border-emerald-200"}
                          `}
                        >
                          {item.status}
                        </span>

                        {item.status === "Stolen" && item.reportedStolenAt && (
                          <div className="text-[11px] text-red-500 mt-1">
                            Reported {new Date(item.reportedStolenAt).toLocaleDateString("en-BW")}
                          </div>
                        )}

                      </div>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="my-4 border-t border-gray-100" />

                  {/* Info Grid */}
                  <div className="grid grid-cols-2 gap-x-3 gap-y-3 text-sm">

                    {/* Estimated Value */}
                    <div>
                      <div className="text-[11px] text-gray-400 uppercase tracking-wide">
                        Value
                      </div>
                      <div className="text-gray-900 font-semibold">
                        {formatBwpCurrency(item.estimatedValue, { empty: "-" })}
                      </div>
                    </div>

                    {/* Place + station */}
                    <div>
                      <div className="text-[11px] text-gray-400 uppercase tracking-wide">
                        Place
                      </div>
                      <div className="text-gray-700 font-medium truncate">
                        {formatItemPlace(item)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-gray-400 uppercase tracking-wide">
                        Station
                      </div>
                      <div className="text-gray-700 font-medium truncate">
                        {formatItemStation(item)}
                      </div>
                    </div>

                    {/* Last Seen */}
                    <div>
                      <div className="text-[11px] text-gray-400 uppercase tracking-wide">
                        Last Seen
                      </div>
                      <div className="text-gray-700 truncate">
                        {item.lastSeen
                          ? new Date(item.lastSeen).toLocaleDateString("en-BW", {
                              day: "2-digit",
                              month: "short",
                            })
                          : item.status === "Stolen"
                            ? "Never"
                            : "—"}
                      </div>
                    </div>

                  </div>

                  {showStationQueue && item.policeCase ? (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <div className="text-[11px] text-gray-400 uppercase tracking-wide mb-1">
                        Case status
                      </div>
                      <span
                        className={
                          "inline-flex px-2.5 py-1 rounded-full text-xs font-medium " +
                          policeCaseStatusBadgeClass(item.policeCase.status)
                        }
                      >
                        {formatPoliceCaseStatus(item.policeCase.status)}
                      </span>
                      {item.policeCase.openedAt && (
                        <div className="text-xs text-gray-500 mt-1">
                          Opened{" "}
                          {new Date(item.policeCase.openedAt).toLocaleDateString("en-BW")}
                        </div>
                      )}
                    </div>
                  ) : null}

                  {/* Actions */}
                  <div className="mt-4 flex flex-col gap-2">
                    <div className="flex gap-2">
                      <RippleButton
                        className="flex-1 py-2 rounded-xl bg-gray-100 text-sm text-gray-800"
                        onClick={() => navigate("/items/" + item.slug)}
                      >
                        View
                      </RippleButton>

                      {!queueRowReadOnly(item) ? (
                        <RippleButton
                          className={`flex-1 py-2 rounded-xl text-sm font-medium ${
                            isStolen
                              ? "bg-emerald-600 text-white hover:bg-emerald-700"
                              : "bg-red-600 text-white hover:bg-red-700"
                          }`}
                          onClick={() => confirmToggleStatus(item.id)}
                        >
                          {isStolen ? "Mark Active" : "Mark Stolen"}
                        </RippleButton>
                      ) : (
                        <div className="flex-1 flex items-center justify-center text-xs text-gray-400 border border-dashed border-gray-200 rounded-xl py-2">
                          View only
                        </div>
                      )}
                    </div>
                    {showStationQueue &&
                      item.policeCase &&
                      (() => {
                        const step = getNextPoliceCaseStep(item.policeCase.status);
                        if (!step) return null;
                        const busy = caseWorkingId === item.policeCase.id;
                        return (
                          <RippleButton
                            className="w-full py-2 rounded-xl text-sm font-medium border border-slate-300 bg-white text-slate-800"
                            disabled={busy}
                            onClick={() => openPoliceAdvanceModal(item)}
                          >
                            {busy ? "Updating…" : `Case: ${step.label}`}
                          </RippleButton>
                        );
                      })()}
                  </div>
                </div>
              </div>
            );
          })}

          {!loading && pageItems.length === 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
              
              <div className="text-4xl mb-3">📦</div>

              <div className="text-lg font-semibold text-gray-800">
                No items found
              </div>

              <p className="text-sm text-gray-500 mt-2">
                Try adjusting your search or filters.
              </p>

              {items.length === 0 && (
                <RippleButton
                  className="mt-4 px-5 py-2 rounded-xl bg-iregistrygreen text-white text-sm font-medium disabled:opacity-60"
                  onClick={() => void goToAddItem()}
                  disabled={addPreflightLoading}
                  title={addPreflightLoading ? "Loading credit prices…" : undefined}
                >
                  + Add Your First Item
                </RippleButton>
              )}
            </div>
          )}
        </div>

        {/* pagination */}
        <div className="flex items-center justify-between pt-1 border-t border-gray-100/80">
          <div className="text-sm text-gray-600">
            Showing <strong>{startIndex}</strong> - <strong>{endIndex}</strong> of <strong>{total}</strong>
          </div>

          <div className="flex items-center gap-2">
            <RippleButton
              className="px-3 py-1 rounded-md bg-white border border-gray-200"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Prev
            </RippleButton>

            <div className="px-3 py-1 rounded-md bg-white border border-gray-200 text-sm">
              {page} / {totalPages}
            </div>

            <RippleButton
              className="px-3 py-1 rounded-md bg-white border border-gray-200"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </RippleButton>
          </div>
        </div>
          </div>
        </div>
      </div>
    </div>
  );
}