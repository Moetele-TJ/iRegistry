export const PRIVILEGED_ROLES = [
  "admin",
  "cashier",
];

/** Lowercase trim — use for case-insensitive role checks (matches SQL `lower(role)`). */
export function normalizeRole(role: string | null | undefined): string {
  return String(role ?? "").trim().toLowerCase();
}

/** True if role is one of the expected names (case-insensitive). */
export function roleIs(
  role: string | null | undefined,
  ...expected: string[]
): boolean {
  const r = normalizeRole(role);
  if (!r) return false;
  return expected.some((e) => normalizeRole(e) === r);
}

export function isPrivilegedRole(role: string | null | undefined) {
  return roleIs(role, ...PRIVILEGED_ROLES);
}