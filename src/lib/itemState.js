export function isItemDeleted(item) {
  return !!item?.deletedAt;
}

export function isItemLegacy(item) {
  return !!item?.legacyAt;
}

export function isItemFrozen(item) {
  return isItemDeleted(item) || isItemLegacy(item);
}

export function isItemReportedStolen(item) {
  return !!item?.reportedStolenAt;
}

/** Derived display state per project rule: Deleted/Legacy hide stolen. */
export function getItemDerivedState(item) {
  if (isItemDeleted(item)) return "Deleted";
  if (isItemLegacy(item)) return "Legacy";
  if (isItemReportedStolen(item)) return "Stolen";
  return "Active";
}

