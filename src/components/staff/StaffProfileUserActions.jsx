import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import RippleButton from "../RippleButton.jsx";
import ConfirmModal from "../ConfirmModal.jsx";
import { invokeWithAuth } from "../../lib/invokeWithAuth.js";
import { useToast } from "../../contexts/ToastContext.jsx";
import { useModal } from "../../contexts/ModalContext.jsx";
import { deriveUserStatus, isInactiveLockout } from "../../lib/userState.js";
import { displayUser } from "../../lib/userDisplay.js";
import { isAppAdminRole } from "../../lib/roleUtils.js";
import { writeItemsListScope } from "../../lib/itemsListScopeStorage.js";
import { useAddItemPreflight } from "../../hooks/useAddItemPreflight.js";
import { APP_ROLE_OPTIONS, NAV_ACTIONS } from "../../lib/navLabels.js";

const SUSPEND_REASONS = [
  "Policy violation",
  "Fraud / abuse",
  "Non-payment / chargeback",
  "Account requested closure",
  "Duplicate account",
  "Other",
];

const ROLE_LABEL = {
  admin: "Admin",
  cashier: "Cashier",
  police: "Police",
  user: "User",
};

function staffBasePath(role) {
  return isAppAdminRole(role) ? "/admin" : "/cashier";
}

function btnNavClass(extra = "") {
  return `px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-800 shadow-sm hover:bg-gray-50 whitespace-nowrap ${extra}`.trim();
}

function btnPrimaryClass(extra = "") {
  return `px-3 py-2 rounded-xl bg-iregistrygreen text-white text-sm font-medium shadow-sm hover:opacity-95 whitespace-nowrap disabled:opacity-50 ${extra}`.trim();
}

const mobileSelectClass =
  "mt-1 w-full min-w-0 border border-gray-200 rounded-lg px-2 py-2 text-sm bg-white disabled:opacity-50 box-border";

/**
 * Staff actions when viewing another user's profile (`/profile?user=…`).
 */
export default function StaffProfileUserActions({ targetUser, sessionUser, onUserUpdated }) {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { confirm } = useModal();
  const { goToAddItem, tasksLoading: addItemLoading } = useAddItemPreflight();

  const canAdminister = isAppAdminRole(sessionUser?.role);
  const base = staffBasePath(sessionUser?.role);
  const usersPath = `${base}/users`;

  const [busy, setBusy] = useState(false);
  const [accountSelect, setAccountSelect] = useState("");
  const [registrySelect, setRegistrySelect] = useState("");

  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [roleNext, setRoleNext] = useState("");

  const [suspendModalOpen, setSuspendModalOpen] = useState(false);
  const [suspendReason, setSuspendReason] = useState("");
  const [suspendPreset, setSuspendPreset] = useState("");
  const [suspendStatus, setSuspendStatus] = useState("suspended");

  const targetId = targetUser?.id != null ? String(targetUser.id) : "";
  const selfId = sessionUser?.id != null ? String(sessionUser.id) : "";
  const isSelf = targetId && selfId && targetId === selfId;
  const displayName = displayUser(targetUser) || "this user";
  const statusLower = deriveUserStatus(targetUser) || "active";
  const accountActive = statusLower === "active";
  const isDeleted = statusLower === "deleted";
  const lockoutRestricted = statusLower === "suspended" || statusLower === "disabled";

  const roleLabel = useMemo(() => ROLE_LABEL, []);

  async function refreshTarget() {
    await onUserUpdated?.();
  }

  async function quickUpdateUser(updates, successMsg) {
    if (!targetId) return false;
    setBusy(true);
    try {
      const { data, error } = await invokeWithAuth("update-user", {
        body: { id: targetId, updates },
      });
      if (error || !data?.success) {
        throw new Error(data?.message || error?.message || "Update failed");
      }
      addToast({ type: "success", message: successMsg || "User updated." });
      await refreshTarget();
      return true;
    } catch (e) {
      addToast({ type: "error", message: e?.message || "Update failed" });
      return false;
    } finally {
      setBusy(false);
    }
  }

  function goToItems() {
    if (!targetId || !selfId) return;
    writeItemsListScope(selfId, "active", {
      ownerScope: targetId,
      query: "",
      statusFilter: "All",
      categoryFilter: "All",
      page: 1,
      scrollY: 0,
    });
    navigate(`${base}/items`);
  }

  function goToTopup() {
    if (!targetId) return;
    if (!accountActive) {
      addToast({
        type: "error",
        message: "Top-ups are only available for active accounts. Reactivate the account first.",
      });
      return;
    }
    navigate(`${base}/topup?user=${encodeURIComponent(targetId)}`);
  }

  function goToTransactions() {
    if (!targetId) return;
    navigate(`${base}/transactions?user=${encodeURIComponent(targetId)}`);
  }

  function goToEdit() {
    if (!targetId) return;
    if (isInactiveLockout(targetUser)) {
      addToast({
        type: "error",
        message: "Suspended or disabled accounts cannot be edited. Reactivate the account first.",
      });
      return;
    }
    navigate(`${usersPath}?user=${encodeURIComponent(targetId)}&mode=edit`);
  }

  function openRoleModal() {
    if (isInactiveLockout(targetUser)) {
      addToast({
        type: "error",
        message: "Cannot change role while the account is suspended or disabled. Reactivate first.",
      });
      return;
    }
    if (isSelf) {
      addToast({ type: "error", message: "You cannot change your own role." });
      return;
    }
    setRoleNext(String(targetUser.role || "user"));
    setRoleModalOpen(true);
  }

  async function submitRoleChange() {
    const next = String(roleNext || "").toLowerCase();
    if (!next || next === String(targetUser.role || "").toLowerCase()) return;
    const label = roleLabel[next] || next;
    const ok = await quickUpdateUser({ role: next }, `Role updated to ${label}.`);
    if (ok) setRoleModalOpen(false);
  }

  async function quickChangeRole(nextRole) {
    if (isInactiveLockout(targetUser)) {
      addToast({
        type: "error",
        message: "Cannot change role while the account is suspended or disabled. Reactivate first.",
      });
      return;
    }
    if (isSelf) {
      addToast({ type: "error", message: "You cannot change your own role." });
      return;
    }
    const r = String(nextRole || "").toLowerCase();
    if (!r || r === String(targetUser.role || "").toLowerCase()) return;
    const label = roleLabel[r] || r;
    const ok = await confirm({
      title: "Confirm",
      message: `Change role for ${displayName} to ${label}?`,
      confirmLabel: "Change role",
      cancelLabel: "Cancel",
      variant: "warning",
    }).catch(() => false);
    if (!ok) return;
    await quickUpdateUser({ role: r }, `Role updated to ${label}.`);
  }

  function openSuspendModal(kind) {
    if (isSelf) {
      addToast({ type: "error", message: "You cannot suspend or disable your own account." });
      return;
    }
    setSuspendStatus(kind);
    setSuspendPreset("");
    setSuspendReason(targetUser.suspended_reason || targetUser.disabled_reason || "");
    setSuspendModalOpen(true);
  }

  async function submitSuspend() {
    const reason = String(suspendReason || "").trim();
    if (!reason) return;
    const status = suspendStatus === "disabled" ? "disabled" : "suspended";
    const ok = await quickUpdateUser(
      status === "disabled"
        ? { status, disabled_reason: reason }
        : { status, suspended_reason: reason },
      status === "disabled" ? "User disabled." : "User suspended.",
    );
    if (ok) {
      setSuspendModalOpen(false);
      setSuspendReason("");
      setSuspendPreset("");
    }
  }

  async function quickReactivate() {
    if (isSelf) return;
    if (accountActive) {
      addToast({ type: "info", message: "User is already active." });
      return;
    }
    const ok = await confirm({
      title: "Confirm",
      message: isDeleted
        ? `Restore ${displayName}? They will be able to sign in again.`
        : `Reactivate ${displayName}? They will be able to sign in again.`,
      confirmLabel: isDeleted ? "Restore" : "Reactivate",
      cancelLabel: "Cancel",
      variant: "success",
    }).catch(() => false);
    if (!ok) return;
    await quickUpdateUser(
      { status: "active" },
      isDeleted ? "User restored." : "User reactivated.",
    );
  }

  async function handleDelete() {
    if (isSelf) {
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
    setBusy(true);
    try {
      const { data, error } = await invokeWithAuth("delete-user", { body: { id: targetId } });
      if (error || !data?.success) {
        throw new Error(data?.message || error?.message || "Failed to delete user");
      }
      addToast({ type: "success", message: "User was deleted successfully." });
      navigate(usersPath);
    } catch (e) {
      addToast({ type: "error", message: e?.message || "Failed to delete user" });
    } finally {
      setBusy(false);
    }
  }

  function runAccountAction(action) {
    switch (action) {
      case "edit":
        return goToEdit();
      case "change_role":
        return openRoleModal();
      case "suspend":
        return openSuspendModal("suspended");
      case "disable":
        return openSuspendModal("disabled");
      case "reactivate":
        return void quickReactivate();
      case "delete":
        return void handleDelete();
      default:
        break;
    }
  }

  function runRegistryAction(action) {
    if ((action === "add_item" || action === "topup") && !accountActive) {
      addToast({
        type: "error",
        message:
          action === "topup"
            ? "Top-ups are only available for active accounts. Reactivate the account first."
            : "Items can only be registered for active accounts. Reactivate the account first.",
      });
      return;
    }
    switch (action) {
      case "items":
        return goToItems();
      case "add_item":
        return void goToAddItem({ ownerId: targetId, ownerLabel: displayName });
      case "topup":
        return goToTopup();
      case "transactions":
        return goToTransactions();
      default:
        break;
    }
  }

  const suspendVerb = suspendStatus === "disabled" ? "Disable" : "Suspend";
  const disabled = busy || addItemLoading;
  const showAccountDropdown =
    isDeleted || !lockoutRestricted || canAdminister;

  const navButtons = (
    <>
      <RippleButton type="button" className={btnNavClass()} onClick={goToItems} disabled={disabled}>
        {NAV_ACTIONS.viewItems}
      </RippleButton>
      {accountActive ? (
        <>
          <RippleButton
            type="button"
            className={btnPrimaryClass()}
            onClick={() => void goToAddItem({ ownerId: targetId, ownerLabel: displayName })}
            disabled={disabled}
          >
            {NAV_ACTIONS.addItem}
          </RippleButton>
          <RippleButton type="button" className={btnNavClass()} onClick={goToTopup} disabled={disabled}>
            {NAV_ACTIONS.topUp}
          </RippleButton>
        </>
      ) : null}
      <RippleButton type="button" className={btnNavClass()} onClick={goToTransactions} disabled={disabled}>
        Transactions
      </RippleButton>
    </>
  );

  const accountButtons = isDeleted ? (
    canAdminister ? (
      <RippleButton
        type="button"
        className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-sm font-medium whitespace-nowrap disabled:opacity-50"
        onClick={() => void quickReactivate()}
        disabled={disabled || isSelf}
      >
        Restore
      </RippleButton>
    ) : null
  ) : lockoutRestricted ? (
    canAdminister ? (
      <>
        <RippleButton
          type="button"
          className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-sm font-medium whitespace-nowrap disabled:opacity-50"
          onClick={() => void quickReactivate()}
          disabled={disabled || isSelf}
        >
          Reactivate
        </RippleButton>
        <RippleButton
          type="button"
          className="px-3 py-2 rounded-xl bg-red-50 text-red-600 border border-red-100 text-sm whitespace-nowrap disabled:opacity-50"
          onClick={() => void handleDelete()}
          disabled={disabled || isSelf}
        >
          Delete
        </RippleButton>
      </>
    ) : null
  ) : (
    <>
      {canAdminister && accountActive ? (
        <>
          <RippleButton
            type="button"
            className="px-3 py-2 rounded-xl bg-amber-500 text-white text-sm whitespace-nowrap disabled:opacity-50"
            onClick={() => openSuspendModal("suspended")}
            disabled={disabled || isSelf}
          >
            Suspend
          </RippleButton>
          <RippleButton
            type="button"
            className="px-3 py-2 rounded-xl bg-gray-800 text-white text-sm whitespace-nowrap disabled:opacity-50"
            onClick={() => openSuspendModal("disabled")}
            disabled={disabled || isSelf}
          >
            Disable
          </RippleButton>
        </>
      ) : null}
      {accountActive ? (
        <RippleButton type="button" className={btnNavClass()} onClick={goToEdit} disabled={disabled}>
          Edit
        </RippleButton>
      ) : null}
      {canAdminister ? (
        <RippleButton
          type="button"
          className="px-3 py-2 rounded-xl bg-red-50 text-red-600 border border-red-100 text-sm whitespace-nowrap disabled:opacity-50"
          onClick={() => void handleDelete()}
          disabled={disabled || isSelf}
        >
          Delete
        </RippleButton>
      ) : null}
    </>
  );

  return (
    <>
      <ConfirmModal
        isOpen={roleModalOpen}
        onClose={() => !busy && setRoleModalOpen(false)}
        onConfirm={() => void submitRoleChange()}
        title="Change role"
        message={`Select a new role for ${displayName}.`}
        confirmLabel={busy ? "Saving…" : "Change role"}
        cancelLabel="Cancel"
        variant="warning"
        confirmDisabled={
          busy ||
          !String(roleNext || "").trim() ||
          String(roleNext || "").toLowerCase() === String(targetUser?.role || "").toLowerCase()
        }
      >
        <div>
          <label className="text-xs text-gray-600">Role</label>
          <select
            value={roleNext}
            onChange={(e) => setRoleNext(e.target.value)}
            className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-white"
            disabled={busy}
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
        isOpen={suspendModalOpen}
        onClose={() => !busy && setSuspendModalOpen(false)}
        onConfirm={() => void submitSuspend()}
        title={`${suspendVerb} user`}
        message={`${suspendVerb} ${displayName}? A reason is required.`}
        confirmLabel={busy ? "Saving…" : suspendVerb}
        cancelLabel="Cancel"
        danger
        confirmDisabled={busy || !String(suspendReason || "").trim()}
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
              disabled={busy}
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
              disabled={busy}
            />
          </div>
        </div>
      </ConfirmModal>

      <div className="md:hidden w-full min-w-0 flex flex-col gap-2 sm:flex-row sm:gap-3">
        {showAccountDropdown ? (
          <div className="min-w-0 flex-1">
            <label className="text-xs text-gray-600" htmlFor="staff-profile-account-actions">
              Account
            </label>
            <select
              id="staff-profile-account-actions"
              value={accountSelect}
              onChange={(e) => {
                const v = e.target.value;
                setAccountSelect(v);
                if (!v) return;
                runAccountAction(v);
                setTimeout(() => setAccountSelect(""), 0);
              }}
              className={mobileSelectClass}
              disabled={disabled}
            >
              <option value="">Choose action…</option>
              {isDeleted ? (
                canAdminister ? <option value="reactivate">Restore account</option> : null
              ) : lockoutRestricted ? (
                <>
                  {canAdminister ? <option value="reactivate">Reactivate</option> : null}
                  {canAdminister ? <option value="delete">Delete user…</option> : null}
                </>
              ) : (
                <>
                  {canAdminister && accountActive ? (
                    <>
                      <option value="suspend">Suspend…</option>
                      <option value="disable">Disable…</option>
                      <option value="change_role">Change role…</option>
                    </>
                  ) : null}
                  {canAdminister && !accountActive ? (
                    <option value="reactivate">Reactivate</option>
                  ) : null}
                  {accountActive ? <option value="edit">Edit user</option> : null}
                  {canAdminister ? <option value="delete">Delete user…</option> : null}
                </>
              )}
            </select>
          </div>
        ) : (
          <p className="text-xs text-gray-500 leading-snug sm:flex-1">
            {isDeleted
              ? "Deleted accounts can only be restored by an administrator."
              : "Suspended or disabled accounts can only be reactivated or removed by an administrator."}
          </p>
        )}
        <div className="min-w-0 flex-1">
          <label className="text-xs text-gray-600" htmlFor="staff-profile-registry-actions">
            Registry
          </label>
          <select
            id="staff-profile-registry-actions"
            value={registrySelect}
            onChange={(e) => {
              const v = e.target.value;
              setRegistrySelect(v);
              if (!v) return;
              runRegistryAction(v);
              setTimeout(() => setRegistrySelect(""), 0);
            }}
            className={mobileSelectClass}
            disabled={disabled}
          >
            <option value="">Choose action…</option>
            <option value="items">{NAV_ACTIONS.viewItems}</option>
            {accountActive ? <option value="add_item">{NAV_ACTIONS.addItem}</option> : null}
            {accountActive ? <option value="topup">{NAV_ACTIONS.topUpCredits}</option> : null}
            <option value="transactions">Transactions</option>
          </select>
        </div>
      </div>

      <div className="hidden md:flex w-full min-w-0 flex-wrap items-center gap-2">
        {navButtons}
        {canAdminister && accountActive ? (
          <div className="flex items-center gap-2 border-l border-gray-200 pl-2 ml-0.5">
            <label className="sr-only" htmlFor="staff-profile-role">
              Change role
            </label>
            <select
              id="staff-profile-role"
              value={targetUser?.role || "user"}
              onChange={(e) => void quickChangeRole(e.target.value)}
              className="border rounded-lg px-2 py-2 text-sm bg-white disabled:opacity-50 max-w-[7.5rem]"
              disabled={disabled || isSelf}
              title={isSelf ? "Cannot change your own role" : "Change role"}
            >
              {APP_ROLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        {accountButtons}
      </div>
    </>
  );
}
