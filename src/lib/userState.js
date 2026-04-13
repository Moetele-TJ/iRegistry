export function deriveUserStatus(u) {
  if (u?.deleted_at) return "deleted";
  if (u?.disabled_at) return "disabled";
  if (u?.suspended_at) return "suspended";
  return "active";
}

/** Suspended or disabled — account must be reactivated before profile/role edits. */
export function isInactiveLockout(u) {
  const s = deriveUserStatus(u);
  return s === "suspended" || s === "disabled";
}

