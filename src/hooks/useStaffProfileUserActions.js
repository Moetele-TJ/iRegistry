import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { invokeWithAuth } from "../lib/invokeWithAuth.js";
import { useToast } from "../contexts/ToastContext.jsx";
import { useModal } from "../contexts/ModalContext.jsx";
import { deriveUserStatus, isInactiveLockout } from "../lib/userState.js";
import { displayUser } from "../lib/userDisplay.js";
import { isAppAdminRole } from "../lib/roleUtils.js";
import { writeItemsListScope } from "../lib/itemsListScopeStorage.js";
import { useAddItemPreflight } from "./useAddItemPreflight.js";

export const STAFF_SUSPEND_REASONS = [
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

export function staffBasePath(role) {
  return isAppAdminRole(role) ? "/admin" : "/cashier";
}

export function useStaffProfileUserActions({
  targetUser,
  sessionUser,
  onUserUpdated,
  onAfterDelete,
}) {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { confirm } = useModal();
  const { goToAddItem, tasksLoading: addItemLoading } = useAddItemPreflight();

  const canAdminister = isAppAdminRole(sessionUser?.role);
  const base = staffBasePath(sessionUser?.role);
  const usersPath = `${base}/users`;

  const [busy, setBusy] = useState(false);
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
  const suspendVerb = suspendStatus === "disabled" ? "Disable" : "Suspend";
  const disabled = busy || addItemLoading;
  const showAccountDropdown = isDeleted || !lockoutRestricted || canAdminister;
  const profilePath = targetId ? `${base}/profile?user=${encodeURIComponent(targetId)}` : `${base}/profile`;

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

  function goToAddItemForTarget() {
    if (!accountActive) {
      addToast({
        type: "error",
        message: "Items can only be registered for active accounts. Reactivate the account first.",
      });
      return;
    }
    void goToAddItem({ ownerId: targetId, ownerLabel: displayName });
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
      if (onAfterDelete) onAfterDelete();
      else navigate(usersPath);
    } catch (e) {
      addToast({ type: "error", message: e?.message || "Failed to delete user" });
    } finally {
      setBusy(false);
    }
  }

  return {
    base,
    profilePath,
    targetUser,
    targetId,
    displayName,
    canAdminister,
    accountActive,
    isDeleted,
    lockoutRestricted,
    isSelf,
    disabled,
    busy,
    showAccountDropdown,
    suspendVerb,
    roleModalOpen,
    setRoleModalOpen,
    roleNext,
    setRoleNext,
    submitRoleChange,
    suspendModalOpen,
    setSuspendModalOpen,
    suspendReason,
    setSuspendReason,
    suspendPreset,
    setSuspendPreset,
    suspendStatus,
    goToItems,
    goToTopup,
    goToTransactions,
    goToEdit,
    goToAddItemForTarget,
    openRoleModal,
    quickChangeRole,
    openSuspendModal,
    submitSuspend,
    quickReactivate,
    handleDelete,
  };
}
