export type DerivedUserStatus = "active" | "suspended" | "disabled" | "deleted";

export function deriveUserStatus(row: any): DerivedUserStatus {
  if (row?.deleted_at) return "deleted";
  if (row?.disabled_at) return "disabled";
  if (row?.suspended_at) return "suspended";
  return "active";
}

export function isUserActive(row: any): boolean {
  return deriveUserStatus(row) === "active";
}

