import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Building2, CheckSquare, Square, User, Users, RefreshCw, Undo2, X, Check, Wallet, Send, Plus, ExternalLink, Pencil, Archive, RotateCcw } from "lucide-react";
import PageSectionCard from "./PageSectionCard.jsx";
import RippleButton from "../../components/RippleButton.jsx";
import { invokeWithAuth } from "../../lib/invokeWithAuth.js";
import { useToast } from "../../contexts/ToastContext.jsx";
import { useModal } from "../../contexts/ModalContext.jsx";
import { supabase } from "../../lib/supabase.js";
import { useOrgRouteResolution } from "../../hooks/useOrgRouteResolution.js";

function displayName(u) {
  const first = String(u?.first_name || "").trim();
  const last = String(u?.last_name || "").trim();
  const full = `${first} ${last}`.trim();
  return full || u?.email || u?.id_number || u?.id || "—";
}

export default function OrganizationItemsPage() {
  const { orgSlug, orgId, loading: routeLoading, error: routeError } = useOrgRouteResolution();
  const { addToast } = useToast();
  const { confirm } = useModal();

  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState(null);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(null);
  const [error, setError] = useState(null);

  const [members, setMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [assigneeId, setAssigneeId] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [includeLegacy, setIncludeLegacy] = useState(false);
  const [transferItemId, setTransferItemId] = useState("");
  const [transferTargetUserId, setTransferTargetUserId] = useState("");
  const [transferReason, setTransferReason] = useState("");
  const [transferFile, setTransferFile] = useState(null);
  const [transferBusy, setTransferBusy] = useState(false);
  const [openTransferRequests, setOpenTransferRequests] = useState([]);
  const [transferReqLoading, setTransferReqLoading] = useState(false);
  const [transferCancelBusyId, setTransferCancelBusyId] = useState("");

  const [createCategory, setCreateCategory] = useState("");
  const [createMake, setCreateMake] = useState("");
  const [createModel, setCreateModel] = useState("");
  const [createSerial1, setCreateSerial1] = useState("");
  const [createSerial2, setCreateSerial2] = useState("");
  const [createStation, setCreateStation] = useState("");
  const [createVillage, setCreateVillage] = useState("");
  const [createWard, setCreateWard] = useState("");
  const [createNotes, setCreateNotes] = useState("");
  const [createAssignTo, setCreateAssignTo] = useState("");
  const [createBusy, setCreateBusy] = useState(false);

  const [myOpenReturnReqByItemId, setMyOpenReturnReqByItemId] = useState({});
  const [orgOpenRequests, setOrgOpenRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [reviewBusyId, setReviewBusyId] = useState("");

  const [walletBalance, setWalletBalance] = useState(null);
  const [walletLoading, setWalletLoading] = useState(false);

  const isPrivileged = role === "ORG_ADMIN" || role === "ORG_MANAGER";

  async function loadWallet() {
    if (!orgId) {
      setWalletLoading(false);
      return;
    }
    setWalletLoading(true);
    try {
      const { data, error } = await invokeWithAuth("get-org-wallet", {
        body: { org_id: orgId },
      });
      if (error || !data?.success) throw new Error(data?.message || error?.message || "Failed to load wallet");
      setWalletBalance(typeof data.balance === "number" ? data.balance : 0);
    } catch {
      setWalletBalance(null);
    } finally {
      setWalletLoading(false);
    }
  }

  async function loadItems() {
    if (!orgId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await invokeWithAuth("list-org-items", {
        body: { org_id: orgId, limit: 200, includeDeleted, includeLegacy },
      });
      if (error || !data?.success) throw new Error(data?.message || error?.message || "Failed to load items");
      setItems(Array.isArray(data.items) ? data.items : []);
      setRole(data.role || null);
      setTotal(data.total ?? null);
    } catch (e) {
      setError(e.message || "Failed to load items");
      setItems([]);
      setRole(null);
      setTotal(null);
    } finally {
      setLoading(false);
    }
  }

  async function loadReturnRequests() {
    if (!orgId) return;
    setLoadingRequests(true);
    try {
      // Load my open requests always (members can request returns).
      const mine = await invokeWithAuth("list-org-item-return-requests", {
        body: { org_id: orgId, status: "OPEN", scope: "mine", limit: 200 },
      });
      if (mine?.error || !mine?.data?.success) {
        throw new Error(mine?.data?.message || mine?.error?.message || "Failed to load return requests");
      }
      const mineRows = Array.isArray(mine.data.requests) ? mine.data.requests : [];
      const by = {};
      for (const r of mineRows) {
        const iid = r?.item_id;
        if (iid) by[iid] = r;
      }
      setMyOpenReturnReqByItemId(by);

      if (isPrivileged) {
        const orgRes = await invokeWithAuth("list-org-item-return-requests", {
          body: { org_id: orgId, status: "OPEN", scope: "org", limit: 200 },
        });
        if (orgRes?.error || !orgRes?.data?.success) {
          throw new Error(orgRes?.data?.message || orgRes?.error?.message || "Failed to load org return requests");
        }
        setOrgOpenRequests(Array.isArray(orgRes.data.requests) ? orgRes.data.requests : []);
      } else {
        setOrgOpenRequests([]);
      }
    } catch (e) {
      addToast({ type: "error", message: e.message || "Failed to load return requests" });
      setMyOpenReturnReqByItemId({});
      setOrgOpenRequests([]);
    } finally {
      setLoadingRequests(false);
    }
  }

  async function loadMembers() {
    if (!isPrivileged) return;
    setLoadingMembers(true);
    try {
      const { data, error } = await invokeWithAuth("list-org-members", {
        body: { org_id: orgId },
      });
      if (error || !data?.success) throw new Error(data?.message || error?.message || "Failed to load members");
      const rows = Array.isArray(data.members) ? data.members : [];
      setMembers(rows);
      const first = rows.find((m) => m?.status === "ACTIVE")?.user_id;
      if (!assigneeId && first) setAssigneeId(String(first));
    } catch (e) {
      addToast({ type: "error", message: e.message || "Failed to load members" });
      setMembers([]);
    } finally {
      setLoadingMembers(false);
    }
  }

  useEffect(() => {
    void loadItems();
    void loadWallet();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, includeDeleted, includeLegacy]);

  useEffect(() => {
    void loadMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, isPrivileged]);

  useEffect(() => {
    void loadReturnRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, isPrivileged]);

  const selectedCount = selected.size;

  const activeMembers = useMemo(
    () => (members || []).filter((m) => m?.status === "ACTIVE" && m?.user_id),
    [members],
  );

  function toggle(id) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function toggleAll() {
    setSelected((prev) => {
      if (prev.size === (items || []).length) return new Set();
      return new Set((items || []).map((i) => i.id));
    });
  }

  async function bulkAssign({ unassign = false } = {}) {
    if (!isPrivileged) return;
    if (selectedCount === 0) {
      addToast({ type: "error", message: "Select at least one item." });
      return;
    }
    if (!unassign && !assigneeId) {
      addToast({ type: "error", message: "Select a member first." });
      return;
    }
    setBulkBusy(true);
    try {
      const { data, error } = await invokeWithAuth("bulk-assign-org-items", {
        body: {
          org_id: orgId,
          item_ids: Array.from(selected),
          assign_to_user_id: unassign ? null : assigneeId,
        },
      });
      if (error || !data?.success) throw new Error(data?.message || error?.message || "Failed");
      addToast({ type: "success", message: unassign ? "Items unassigned." : "Items assigned." });
      setSelected(new Set());
      await loadItems();
      await loadReturnRequests();
    } catch (e) {
      addToast({ type: "error", message: e.message || "Failed" });
    } finally {
      setBulkBusy(false);
    }
  }

  async function requestReturn(itemId) {
    setBulkBusy(true);
    try {
      const { data, error } = await invokeWithAuth("create-org-item-return-request", {
        body: { org_id: orgId, item_id: itemId, note: null },
      });
      if (error || !data?.success) throw new Error(data?.message || error?.message || "Failed");
      addToast({ type: "success", message: "Return request submitted." });
      await loadReturnRequests();
    } catch (e) {
      addToast({ type: "error", message: e.message || "Failed" });
    } finally {
      setBulkBusy(false);
    }
  }

  async function reviewReturn({ requestId, action }) {
    setReviewBusyId(requestId);
    try {
      const { data, error } = await invokeWithAuth("review-org-item-return-request", {
        body: { org_id: orgId, request_id: requestId, action, note: null },
      });
      if (error || !data?.success) throw new Error(data?.message || error?.message || "Failed");
      addToast({ type: "success", message: action === "approve" ? "Return approved." : "Return rejected." });
      await loadItems();
      await loadReturnRequests();
    } catch (e) {
      addToast({ type: "error", message: e.message || "Failed" });
    } finally {
      setReviewBusyId("");
    }
  }

  const isOrgAdmin = role === "ORG_ADMIN";
  const canCreate = role === "ORG_ADMIN" || role === "ORG_MANAGER";

  async function loadTransferRequests() {
    if (!isOrgAdmin) {
      setOpenTransferRequests([]);
      return;
    }
    setTransferReqLoading(true);
    try {
      const { data, error } = await invokeWithAuth("list-org-item-transfer-requests", {
        body: { status: "OPEN", limit: 200, offset: 0 },
      });
      if (error || !data?.success) throw new Error(data?.message || error?.message || "Failed");
      const all = Array.isArray(data.requests) ? data.requests : [];
      const mineOrg = all.filter((r) => String(r?.org_id) === String(orgId));
      setOpenTransferRequests(mineOrg);
    } catch {
      setOpenTransferRequests([]);
    } finally {
      setTransferReqLoading(false);
    }
  }

  useEffect(() => {
    void loadTransferRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, isOrgAdmin]);

  async function cancelTransferRequest(requestId) {
    if (!isOrgAdmin) return;
    const ok = await confirm({
      title: "Cancel transfer request?",
      message: "This will cancel the open request. Staff will no longer be able to complete it.",
      confirmLabel: "Cancel request",
      cancelLabel: "Keep",
      danger: true,
    }).catch(() => false);
    if (!ok) return;

    setTransferCancelBusyId(requestId);
    try {
      const { data, error } = await invokeWithAuth("cancel-org-item-transfer-request", {
        body: { org_id: orgId, request_id: requestId },
      });
      if (error || !data?.success) throw new Error(data?.message || error?.message || "Failed");
      addToast({ type: "success", message: "Transfer request cancelled." });
      await loadTransferRequests();
    } catch (e) {
      addToast({ type: "error", message: e?.message || "Failed" });
    } finally {
      setTransferCancelBusyId("");
    }
  }

  async function deleteItem(itemId, itemName) {
    const ok = await confirm({
      title: "Delete item?",
      message: `This will delete “${itemName || "this item"}” from the organization list. You can restore it later.`,
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
      danger: true,
    }).catch(() => false);
    if (!ok) return;

    setBulkBusy(true);
    try {
      const { data, error } = await invokeWithAuth("org-delete-item", {
        body: { org_id: orgId, item_id: itemId, reason: null },
      });
      if (error || !data?.success) throw new Error(data?.message || error?.message || "Failed");
      addToast({ type: "success", message: "Item deleted." });
      await loadItems();
      await loadWallet();
    } catch (e) {
      addToast({ type: "error", message: e.message || "Failed" });
    } finally {
      setBulkBusy(false);
    }
  }

  async function restoreItem(itemId, itemName) {
    const ok = await confirm({
      title: "Restore item?",
      message: `Restoring “${itemName || "this item"}” will charge the organization wallet (RESTORE_ITEM).`,
      confirmLabel: "Restore",
      cancelLabel: "Cancel",
    }).catch(() => false);
    if (!ok) return;

    setBulkBusy(true);
    try {
      const { data, error } = await invokeWithAuth("org-restore-item", {
        body: { org_id: orgId, item_id: itemId },
      });
      if (error || !data?.success) throw new Error(data?.message || error?.message || "Failed");
      addToast({ type: "success", message: "Item restored." });
      await loadItems();
      await loadWallet();
    } catch (e) {
      addToast({ type: "error", message: e?.message || "Failed" });
    } finally {
      setBulkBusy(false);
    }
  }

  async function markLegacy(itemId, itemName) {
    const ok = await confirm({
      title: "Mark as legacy?",
      message: `This will move “${itemName || "this item"}” to legacy. Only organization administrators can restore it.`,
      confirmLabel: "Mark legacy",
      cancelLabel: "Cancel",
      danger: true,
    }).catch(() => false);
    if (!ok) return;

    setBulkBusy(true);
    try {
      const { data, error } = await invokeWithAuth("org-mark-item-legacy", {
        body: { org_id: orgId, item_id: itemId, reason: null },
      });
      if (error || !data?.success) throw new Error(data?.message || error?.message || "Failed");
      addToast({ type: "success", message: "Item moved to legacy." });
      await loadItems();
    } catch (e) {
      addToast({ type: "error", message: e.message || "Failed" });
    } finally {
      setBulkBusy(false);
    }
  }

  async function restoreLegacy(itemId, itemName) {
    const ok = await confirm({
      title: "Restore legacy item?",
      message: `This will restore “${itemName || "this item"}” from legacy.`,
      confirmLabel: "Restore",
      cancelLabel: "Cancel",
    }).catch(() => false);
    if (!ok) return;

    setBulkBusy(true);
    try {
      const { data, error } = await invokeWithAuth("org-restore-legacy-item", {
        body: { org_id: orgId, item_id: itemId },
      });
      if (error || !data?.success) throw new Error(data?.message || error?.message || "Failed");
      addToast({ type: "success", message: "Legacy item restored." });
      await loadItems();
    } catch (e) {
      addToast({ type: "error", message: e.message || "Failed" });
    } finally {
      setBulkBusy(false);
    }
  }

  async function submitTransferRequest() {
    if (!isOrgAdmin) return;
    if (!transferItemId) {
      addToast({ type: "error", message: "Select an item to transfer." });
      return;
    }
    if (!transferTargetUserId.trim()) {
      addToast({ type: "error", message: "Enter a target user id." });
      return;
    }
    if (!transferReason.trim()) {
      addToast({ type: "error", message: "Enter a reason." });
      return;
    }
    if (!transferFile) {
      addToast({ type: "error", message: "Upload evidence (PDF/image) to proceed." });
      return;
    }

    const ok = await confirm({
      title: "Submit transfer request?",
      message:
        "This will submit a request for staff (admin/cashier) to complete the transfer, with your reason and evidence attached.",
      confirmLabel: "Submit request",
      cancelLabel: "Cancel",
    }).catch(() => false);
    if (!ok) return;

    setTransferBusy(true);
    try {
      const form = new FormData();
      form.append("file", transferFile);
      form.append("itemId", transferItemId);
      form.append("type", "ORG_TRANSFER_EVIDENCE");
      form.append("referenceId", String(orgId));
      form.append("orgId", String(orgId));

      const auth = await supabase.auth.getSession();
      const token = auth?.data?.session?.access_token;
      if (!token) throw new Error("Not signed in");

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/upload-ownership-evidence`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const evJson = await res.json().catch(() => ({}));
      if (!res.ok || !evJson?.success) {
        throw new Error(evJson?.message || "Failed to upload evidence");
      }

      const { data, error } = await invokeWithAuth("create-org-item-transfer-request", {
        body: {
          org_id: orgId,
          item_id: transferItemId,
          target_user_id: transferTargetUserId.trim(),
          reason: transferReason.trim(),
          evidence: evJson.evidence,
        },
      });
      if (error || !data?.success) throw new Error(data?.message || error?.message || "Failed");
      addToast({ type: "success", message: "Transfer request submitted." });
      setTransferItemId("");
      setTransferTargetUserId("");
      setTransferReason("");
      setTransferFile(null);
    } catch (e) {
      addToast({ type: "error", message: e?.message || "Failed" });
    } finally {
      setTransferBusy(false);
    }
  }

  async function createItem() {
    if (!canCreate) return;
    if (!createCategory.trim() || !createMake.trim() || !createModel.trim() || !createSerial1.trim() || !createStation.trim()) {
      addToast({ type: "error", message: "Category, make, model, serial number, and station are required." });
      return;
    }
    setCreateBusy(true);
    try {
      const { data, error } = await invokeWithAuth("org-create-item", {
        body: {
          org_id: orgId,
          category: createCategory,
          make: createMake,
          model: createModel,
          serial1: createSerial1,
          serial2: createSerial2 || null,
          station: createStation,
          village: createVillage || null,
          ward: createWard || null,
          notes: createNotes || null,
          assign_to_user_id: createAssignTo || null,
        },
      });
      if (error || !data?.success) throw new Error(data?.message || error?.message || "Failed");
      addToast({ type: "success", message: "Item created." });
      setCreateCategory("");
      setCreateMake("");
      setCreateModel("");
      setCreateSerial1("");
      setCreateSerial2("");
      setCreateStation("");
      setCreateVillage("");
      setCreateWard("");
      setCreateNotes("");
      setCreateAssignTo("");
      await loadItems();
      await loadWallet();
    } catch (e) {
      addToast({ type: "error", message: e?.message || "Failed" });
    } finally {
      setCreateBusy(false);
    }
  }

  return (
    <PageSectionCard
      maxWidthClass="max-w-7xl"
      title="Organization items"
      subtitle={isPrivileged ? "Manage organization-owned items and assignments." : "Your assigned organization items."}
      icon={<Building2 className="w-6 h-6 text-iregistrygreen shrink-0" />}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to={`/organizations/${orgSlug}/wallet`}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-emerald-200 bg-white text-emerald-900 text-sm font-semibold hover:bg-emerald-50"
          >
            <Wallet size={16} />
            Organization wallet
          </Link>
          <Link
            to={`/organizations/${orgSlug}/transactions`}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm text-gray-800 shadow-sm hover:bg-gray-50"
          >
            Transactions
          </Link>
          {isPrivileged ? (
            <Link
              to={`/organizations/${orgSlug}/members`}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm text-gray-800 shadow-sm hover:bg-gray-50"
            >
              <Users size={16} />
              Members
            </Link>
          ) : null}
          <RippleButton
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm text-gray-800 shadow-sm hover:bg-gray-50"
            onClick={() => {
              void loadItems();
              void loadWallet();
            }}
            disabled={loading}
          >
            <RefreshCw size={16} />
            Refresh
          </RippleButton>
        </div>
      }
    >
      <div className="p-4 sm:p-6 space-y-5">
        {routeLoading ? (
          <div className="text-sm text-gray-500">Loading organization…</div>
        ) : null}
        {routeError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 text-red-800 px-4 py-3 text-sm">{routeError}</div>
        ) : null}
        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 text-red-800 px-4 py-3 text-sm">{error}</div>
        ) : null}

        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="rounded-xl bg-white border border-emerald-100 p-2 text-emerald-800 shrink-0">
              <Wallet size={20} />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-emerald-900/80 uppercase tracking-wide">Organization wallet</div>
              <div className="text-lg font-bold text-emerald-950 tabular-nums">
                {walletLoading ? "…" : walletBalance === null ? "—" : walletBalance.toLocaleString()}{" "}
                <span className="text-sm font-semibold text-emerald-900/70">credits</span>
              </div>
            </div>
          </div>
          <Link
            to={`/organizations/${orgSlug}/wallet`}
            className="inline-flex items-center justify-center px-3 py-2 rounded-xl border border-emerald-200 bg-white text-emerald-900 text-sm font-semibold hover:bg-emerald-50 shrink-0"
          >
            View details
          </Link>
        </div>

        {isPrivileged ? (
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-700">
            <div className="flex items-center gap-2">
              <input
                id="includeDeleted"
                type="checkbox"
                checked={includeDeleted}
                onChange={(e) => setIncludeDeleted(e.target.checked)}
              />
              <label htmlFor="includeDeleted">Show deleted items</label>
            </div>
            <div className="flex items-center gap-2">
              <input
                id="includeLegacy"
                type="checkbox"
                checked={includeLegacy}
                onChange={(e) => setIncludeLegacy(e.target.checked)}
              />
              <label htmlFor="includeLegacy">Show legacy items</label>
            </div>
          </div>
        ) : null}

        {isOrgAdmin ? (
          <div className="rounded-2xl border border-gray-100 bg-white p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="text-sm font-semibold text-gray-800">Transfer item (staff-assisted)</div>
              <div className="text-xs text-gray-500">Requires reason + evidence</div>
            </div>

            <div className="mb-4 rounded-2xl border border-gray-100 bg-gray-50/60 p-4">
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="text-sm font-semibold text-gray-800">Open transfer requests</div>
                {transferReqLoading ? <div className="text-xs text-gray-400">Loading…</div> : null}
              </div>
              {openTransferRequests.length === 0 ? (
                <div className="text-sm text-gray-600">No open requests for this organization.</div>
              ) : (
                <div className="space-y-2">
                  {openTransferRequests.map((r) => (
                    <div
                      key={r.id}
                      className="rounded-xl border border-gray-100 bg-white px-3 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-gray-900 truncate">
                          {r.item?.name || r.item_id}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          Target: {displayName(r.target_user)} • Requested{" "}
                          {r.requested_at ? new Date(r.requested_at).toLocaleString() : "—"}
                        </div>
                      </div>
                      <RippleButton
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-red-200 text-red-700 bg-white text-xs font-semibold disabled:opacity-60"
                        disabled={transferCancelBusyId === r.id}
                        onClick={() => void cancelTransferRequest(r.id)}
                      >
                        Cancel
                      </RippleButton>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-end">
              <div className="lg:col-span-3">
                <label className="text-xs text-gray-600">Item</label>
                <select
                  value={transferItemId}
                  onChange={(e) => setTransferItemId(e.target.value)}
                  className="mt-1 w-full border rounded-xl px-3 py-2 text-sm bg-white"
                >
                  <option value="">Select item…</option>
                  {(items || [])
                    .filter((it) => !it.deletedat && !it.legacyat)
                    .map((it) => (
                      <option key={it.id} value={it.id}>
                        {it.name || it.id}
                      </option>
                    ))}
                </select>
              </div>
              <div className="lg:col-span-3">
                <label className="text-xs text-gray-600">Target user id</label>
                <input
                  value={transferTargetUserId}
                  onChange={(e) => setTransferTargetUserId(e.target.value)}
                  className="mt-1 w-full border rounded-xl px-3 py-2 text-sm bg-white"
                  placeholder="uuid…"
                />
              </div>
              <div className="lg:col-span-4">
                <label className="text-xs text-gray-600">Reason</label>
                <input
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                  className="mt-1 w-full border rounded-xl px-3 py-2 text-sm bg-white"
                  placeholder="Why is this transfer needed?"
                />
              </div>
              <div className="lg:col-span-2">
                <label className="text-xs text-gray-600">Evidence (PDF/image)</label>
                <input
                  type="file"
                  accept="application/pdf,image/*"
                  onChange={(e) => setTransferFile(e.target.files?.[0] || null)}
                  className="mt-1 w-full text-sm"
                />
              </div>
              <div className="lg:col-span-12 flex justify-end">
                <RippleButton
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-iregistrygreen text-white font-semibold disabled:opacity-60"
                  disabled={transferBusy}
                  onClick={() => void submitTransferRequest()}
                >
                  <Send size={18} />
                  Submit request
                </RippleButton>
              </div>
            </div>
          </div>
        ) : null}

        {canCreate ? (
          <div className="rounded-2xl border border-gray-100 bg-white p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="text-sm font-semibold text-gray-800">Add organization item</div>
              <div className="text-xs text-gray-500">Charges organization wallet (ADD_ITEM)</div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-end">
              <div className="lg:col-span-3">
                <label className="text-xs text-gray-600">Category</label>
                <input
                  value={createCategory}
                  onChange={(e) => setCreateCategory(e.target.value)}
                  className="mt-1 w-full border rounded-xl px-3 py-2 text-sm bg-white"
                  placeholder="e.g. Electronics"
                />
              </div>
              <div className="lg:col-span-2">
                <label className="text-xs text-gray-600">Make</label>
                <input
                  value={createMake}
                  onChange={(e) => setCreateMake(e.target.value)}
                  className="mt-1 w-full border rounded-xl px-3 py-2 text-sm bg-white"
                  placeholder="e.g. Dell"
                />
              </div>
              <div className="lg:col-span-2">
                <label className="text-xs text-gray-600">Model</label>
                <input
                  value={createModel}
                  onChange={(e) => setCreateModel(e.target.value)}
                  className="mt-1 w-full border rounded-xl px-3 py-2 text-sm bg-white"
                  placeholder="e.g. XPS 13"
                />
              </div>
              <div className="lg:col-span-2">
                <label className="text-xs text-gray-600">Serial number</label>
                <input
                  value={createSerial1}
                  onChange={(e) => setCreateSerial1(e.target.value)}
                  className="mt-1 w-full border rounded-xl px-3 py-2 text-sm bg-white"
                  placeholder="Required"
                />
              </div>
              <div className="lg:col-span-3">
                <label className="text-xs text-gray-600">Nearest police station</label>
                <input
                  value={createStation}
                  onChange={(e) => setCreateStation(e.target.value)}
                  className="mt-1 w-full border rounded-xl px-3 py-2 text-sm bg-white"
                  placeholder="Required"
                />
              </div>

              <div className="lg:col-span-3">
                <label className="text-xs text-gray-600">Assign to (optional)</label>
                <select
                  value={createAssignTo}
                  onChange={(e) => setCreateAssignTo(e.target.value)}
                  disabled={loadingMembers || activeMembers.length === 0}
                  className="mt-1 w-full border rounded-xl px-3 py-2 text-sm bg-white disabled:opacity-60"
                >
                  <option value="">Unassigned</option>
                  {activeMembers.map((m) => (
                    <option key={m.user_id} value={m.user_id}>
                      {displayName(m.user)} ({m.role})
                    </option>
                  ))}
                </select>
              </div>
              <div className="lg:col-span-2">
                <label className="text-xs text-gray-600">Serial #2 (optional)</label>
                <input
                  value={createSerial2}
                  onChange={(e) => setCreateSerial2(e.target.value)}
                  className="mt-1 w-full border rounded-xl px-3 py-2 text-sm bg-white"
                />
              </div>
              <div className="lg:col-span-2">
                <label className="text-xs text-gray-600">Village (optional)</label>
                <input
                  value={createVillage}
                  onChange={(e) => setCreateVillage(e.target.value)}
                  className="mt-1 w-full border rounded-xl px-3 py-2 text-sm bg-white"
                />
              </div>
              <div className="lg:col-span-2">
                <label className="text-xs text-gray-600">Ward (optional)</label>
                <input
                  value={createWard}
                  onChange={(e) => setCreateWard(e.target.value)}
                  className="mt-1 w-full border rounded-xl px-3 py-2 text-sm bg-white"
                />
              </div>
              <div className="lg:col-span-12">
                <label className="text-xs text-gray-600">Notes (optional)</label>
                <input
                  value={createNotes}
                  onChange={(e) => setCreateNotes(e.target.value)}
                  className="mt-1 w-full border rounded-xl px-3 py-2 text-sm bg-white"
                />
              </div>
              <div className="lg:col-span-12 flex justify-end">
                <RippleButton
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-iregistrygreen text-white font-semibold disabled:opacity-60"
                  disabled={createBusy}
                  onClick={() => void createItem()}
                >
                  <Plus size={18} />
                  Add item
                </RippleButton>
              </div>
            </div>
          </div>
        ) : null}

        {isPrivileged ? (
          <div className="rounded-2xl border border-gray-100 bg-gray-50/70 p-4 flex flex-col lg:flex-row lg:items-end gap-3">
            <div className="flex-1">
              <div className="text-xs uppercase tracking-wide text-gray-500 font-semibold mb-1">Bulk assignment</div>
              <div className="text-sm text-gray-700">
                Selected: <span className="font-semibold tabular-nums">{selectedCount}</span>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-end">
              <div className="min-w-[240px]">
                <label className="text-xs text-gray-600">Assign to</label>
                <select
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                  disabled={loadingMembers || activeMembers.length === 0}
                  className="mt-1 w-full border rounded-xl px-3 py-2 text-sm bg-white"
                >
                  {activeMembers.map((m) => (
                    <option key={m.user_id} value={m.user_id}>
                      {displayName(m.user)} ({m.role})
                    </option>
                  ))}
                </select>
              </div>
              <RippleButton
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-iregistrygreen text-white font-semibold disabled:opacity-60"
                disabled={bulkBusy || selectedCount === 0 || (!assigneeId && activeMembers.length > 0)}
                onClick={() => void bulkAssign({ unassign: false })}
              >
                <Users size={18} />
                Assign
              </RippleButton>
              <RippleButton
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-800 font-semibold disabled:opacity-60"
                disabled={bulkBusy || selectedCount === 0}
                onClick={() => void bulkAssign({ unassign: true })}
              >
                <User size={18} />
                Unassign
              </RippleButton>
            </div>
          </div>
        ) : null}

        {isPrivileged ? (
          <div className="rounded-2xl border border-gray-100 bg-white p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="text-sm font-semibold text-gray-800">Return requests</div>
              {loadingRequests ? <div className="text-xs text-gray-400">Loading…</div> : null}
            </div>
            {orgOpenRequests.length === 0 ? (
              <div className="text-sm text-gray-500">No open return requests.</div>
            ) : (
              <div className="space-y-2">
                {orgOpenRequests.map((r) => (
                  <div
                    key={r.id}
                    className="rounded-xl border border-gray-100 bg-gray-50/70 px-3 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-gray-900 truncate">
                        {r?.item?.name || r.item_id}
                      </div>
                      <div className="text-xs text-gray-500">
                        Requested: {r.created_at ? new Date(r.created_at).toLocaleString() : "—"}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <RippleButton
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-iregistrygreen text-white text-sm font-semibold disabled:opacity-60"
                        disabled={reviewBusyId === r.id}
                        onClick={() => void reviewReturn({ requestId: r.id, action: "approve" })}
                      >
                        <Check size={16} />
                        Approve
                      </RippleButton>
                      <RippleButton
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-red-200 text-red-700 bg-white text-sm font-semibold disabled:opacity-60"
                        disabled={reviewBusyId === r.id}
                        onClick={() => void reviewReturn({ requestId: r.id, action: "reject" })}
                      >
                        <X size={16} />
                        Reject
                      </RippleButton>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}

        <div className="rounded-2xl border border-gray-100 bg-white overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                {isPrivileged ? (
                  <th className="text-left font-semibold px-4 py-3 w-12">
                    <button type="button" onClick={toggleAll} className="p-1 rounded hover:bg-gray-100">
                      {selectedCount === (items || []).length && (items || []).length > 0 ? (
                        <CheckSquare size={18} />
                      ) : (
                        <Square size={18} />
                      )}
                    </button>
                  </th>
                ) : null}
                <th className="text-left font-semibold px-4 py-3">Item</th>
                <th className="text-left font-semibold px-4 py-3">Status</th>
                {isPrivileged ? <th className="text-left font-semibold px-4 py-3">Assigned</th> : null}
                {!isPrivileged ? <th className="text-right font-semibold px-4 py-3">Action</th> : null}
                {isPrivileged ? <th className="text-right font-semibold px-4 py-3">Manage</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td className="px-4 py-6 text-gray-500" colSpan={isPrivileged ? 4 : 4}>
                    Loading…
                  </td>
                </tr>
              ) : (items || []).length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-gray-500" colSpan={isPrivileged ? 4 : 4}>
                    No items found.
                  </td>
                </tr>
              ) : (
                items.map((i) => {
                  const stolen = !!i.reportedstolenat;
                  const legacy = !!i.legacyat;
                  const status = legacy ? "Legacy" : stolen ? "Stolen" : "Active";
                  const checked = selected.has(i.id);
                  const myReq = myOpenReturnReqByItemId?.[i.id] || null;
                  return (
                    <tr key={i.id} className="hover:bg-gray-50">
                      {isPrivileged ? (
                        <td className="px-4 py-3">
                          <button type="button" onClick={() => toggle(i.id)} className="p-1 rounded hover:bg-gray-100">
                            {checked ? <CheckSquare size={18} /> : <Square size={18} />}
                          </button>
                        </td>
                      ) : null}
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{i.name || "—"}</div>
                        <div className="text-xs text-gray-500">{i.category || "—"}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold border ${
                            status === "Stolen"
                              ? "bg-red-50 text-red-700 border-red-100"
                              : status === "Legacy"
                                ? "bg-gray-50 text-gray-700 border-gray-200"
                                : "bg-emerald-50 text-emerald-800 border-emerald-100"
                          }`}
                        >
                          {status}
                        </span>
                      </td>
                      {isPrivileged ? (
                        <td className="px-4 py-3 text-gray-700">
                          {i.assigned_user_id ? (
                            <span className="text-xs font-mono">{String(i.assigned_user_id).slice(0, 8)}…</span>
                          ) : (
                            <span className="text-xs text-gray-500">Unassigned</span>
                          )}
                        </td>
                      ) : null}
                      {isPrivileged ? (
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-2">
                            <Link
                              to={`/items/${i.slug || i.id}`}
                              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-white text-gray-800 text-xs font-semibold hover:bg-gray-50"
                              title="View item"
                            >
                              <ExternalLink size={14} />
                              View
                            </Link>
                            {!i.deletedat ? (
                              <Link
                                to={`/items/${i.slug || i.id}/edit`}
                                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-emerald-200 bg-white text-emerald-900 text-xs font-semibold hover:bg-emerald-50"
                                title="Edit item"
                              >
                                <Pencil size={14} />
                                Edit
                              </Link>
                            ) : null}

                            {isOrgAdmin ? (
                              i.deletedat ? (
                                <RippleButton
                                  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-white text-gray-800 text-xs font-semibold hover:bg-gray-50 disabled:opacity-60"
                                  disabled={bulkBusy}
                                  onClick={() => void restoreItem(i.id, i.name)}
                                >
                                  Restore
                                </RippleButton>
                              ) : (
                                <RippleButton
                                  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-red-200 text-red-700 bg-white text-xs font-semibold hover:bg-red-50 disabled:opacity-60"
                                  disabled={bulkBusy}
                                  onClick={() => void deleteItem(i.id, i.name)}
                                >
                                  Delete
                                </RippleButton>
                              )
                            ) : null}

                            {!i.deletedat ? (
                              i.legacyat ? (
                                isOrgAdmin ? (
                                  <RippleButton
                                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-white text-gray-800 text-xs font-semibold hover:bg-gray-50 disabled:opacity-60"
                                    disabled={bulkBusy}
                                    onClick={() => void restoreLegacy(i.id, i.name)}
                                    title="Restore from legacy"
                                  >
                                    <RotateCcw size={14} />
                                    Restore legacy
                                  </RippleButton>
                                ) : null
                              ) : (
                                <RippleButton
                                  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-white text-gray-800 text-xs font-semibold hover:bg-gray-50 disabled:opacity-60"
                                  disabled={bulkBusy}
                                  onClick={() => void markLegacy(i.id, i.name)}
                                  title="Move to legacy"
                                >
                                  <Archive size={14} />
                                  Legacy
                                </RippleButton>
                              )
                            ) : null}
                          </div>
                        </td>
                      ) : null}
                      {!isPrivileged ? (
                        <td className="px-4 py-3 text-right">
                          {myReq ? (
                            <span className="text-xs text-gray-500 inline-flex items-center gap-2 justify-end">
                              <Undo2 size={14} className="text-gray-400" />
                              Return requested
                            </span>
                          ) : (
                            <RippleButton
                              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-white text-gray-800 text-xs font-semibold hover:bg-gray-50 disabled:opacity-60"
                              disabled={bulkBusy}
                              onClick={() => void requestReturn(i.id)}
                            >
                              <Undo2 size={14} />
                              Request return
                            </RippleButton>
                          )}
                        </td>
                      ) : null}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {total != null ? (
          <div className="text-xs text-gray-400">
            Total: <span className="tabular-nums">{total}</span>
          </div>
        ) : null}
      </div>
    </PageSectionCard>
  );
}

