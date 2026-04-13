export function deriveUserStatus(u) {
  if (u?.deleted_at) return "deleted";
  if (u?.disabled_at) return "disabled";
  if (u?.suspended_at) return "suspended";
  return "active";
}

