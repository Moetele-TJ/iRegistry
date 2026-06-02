/** Persist admin/cashier "managing this user" context across pages until cleared. */

const PREFIX = "iregistry:staff-user-scope:";

/**
 * @returns {{
 *   targetUserId: string,
 *   displayName?: string,
 *   role?: string,
 *   status?: string,
 * } | null}
 */
export function readStaffUserScope(sessionUserId) {
  if (!sessionUserId) return null;
  try {
    const raw = sessionStorage.getItem(`${PREFIX}${sessionUserId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.targetUserId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeStaffUserScope(sessionUserId, scope) {
  if (!sessionUserId || !scope?.targetUserId) return;
  try {
    sessionStorage.setItem(`${PREFIX}${sessionUserId}`, JSON.stringify(scope));
  } catch {
    /* ignore */
  }
}

export function clearStaffUserScope(sessionUserId) {
  if (!sessionUserId) return;
  try {
    sessionStorage.removeItem(`${PREFIX}${sessionUserId}`);
  } catch {
    /* ignore */
  }
}

export function getStaffScopedUserId(sessionUserId) {
  const scope = readStaffUserScope(sessionUserId);
  return scope?.targetUserId ? String(scope.targetUserId) : "";
}
