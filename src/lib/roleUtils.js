/**
 * Case-insensitive role helpers (align with DB / Edge `normalizeRole` / `_is_privileged_user`).
 */

export function normalizeRole(role) {
  return String(role ?? "").trim().toLowerCase();
}

/** True if role matches one of the expected role names (case-insensitive). */
export function roleIs(role, ...expected) {
  const r = normalizeRole(role);
  if (!r) return false;
  return expected.some((e) => normalizeRole(e) === r);
}

/** Platform admin or cashier (session role) — registry staff helping orgs and users. */
export function isAppStaffRole(role) {
  return roleIs(role, "admin", "cashier");
}

/** Platform administrator only (stricter than isAppStaffRole). */
export function isAppAdminRole(role) {
  return roleIs(role, "admin");
}
