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
