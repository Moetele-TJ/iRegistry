import { isPrivilegedRole } from "./billingUx.js";
import { roleIs } from "./roleUtils.js";

export function isActiveRegistryItem(item) {
  return !!item && !item.deletedAt && !item.legacyAt;
}

/** Match hard-delete-item replacement serial check (same owner, active row). */
export function serialsMatchForReplacement(deletedItem, candidate) {
  const s1 = String(deletedItem?.serial1 ?? "").trim();
  const s2 = String(deletedItem?.serial2 ?? "").trim();
  if (!s1 && !s2) return false;

  const c1 = String(candidate?.serial1 ?? "").trim();
  const c2 = String(candidate?.serial2 ?? "").trim();

  if (s1 && s2) {
    return (c1 && c1 === s1) || (c2 && c2 === s2);
  }
  if (s1) {
    return (c1 && c1 === s1) || (c2 && c2 === s1);
  }
  if (s2) {
    return (c1 && c1 === s2) || (c2 && c2 === s2);
  }
  return false;
}

export function findActiveReplacementForDeletedItem(deletedItem, itemsPool = []) {
  if (!deletedItem?.deletedAt) return null;
  const ownerId = deletedItem.ownerId;
  if (!ownerId) return null;

  for (const it of itemsPool) {
    if (!it || String(it.id) === String(deletedItem.id)) continue;
    if (!isActiveRegistryItem(it)) continue;
    if (String(it.ownerId) !== String(ownerId)) continue;
    if (serialsMatchForReplacement(deletedItem, it)) return it;
  }
  return null;
}

export function canPermanentlyDeleteDeletedItem(deletedItem, itemsPool, viewerRole) {
  if (!deletedItem?.deletedAt) return false;
  if (isPrivilegedRole(viewerRole)) return true;
  return !!findActiveReplacementForDeletedItem(deletedItem, itemsPool);
}

export function isAssignedOrganizationItem(item, sessionUserId) {
  if (!item?.ownerOrgId || !sessionUserId) return false;
  return String(item.assignedUserId || "") === String(sessionUserId);
}

/** Registry staff removing an item that belongs to another user. */
export function isStaffDeletingOthersItem(item, user) {
  if (!item || !user?.id) return false;
  if (!isPrivilegedRole(user?.role)) return false;
  return String(item.ownerId) !== String(user.id);
}

export function canManagePersonalItemLifecycle(item, user) {
  if (!item || !user?.id) return false;
  if (roleIs(user.role, "police") && String(item.ownerId) !== String(user.id)) {
    return false;
  }
  const isOwner = String(item.ownerId) === String(user.id);
  if (
    isOwner &&
    item.ownerOrgId &&
    isAssignedOrganizationItem(item, user.id)
  ) {
    return false;
  }
  return isOwner || isPrivilegedRole(user.role);
}

export const SOFT_DELETE_CONFIRM_MESSAGE =
  "The item moves to your recycle bin (Deleted items). You can restore it later unless you register another active item with the same serial.";

export const PERMANENT_DELETE_CONFIRM_MESSAGE =
  "This permanently removes the item from the registry. This cannot be undone.";
