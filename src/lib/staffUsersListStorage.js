/** Persist admin/cashier manage-users list filters when opening a profile and returning. */

const PREFIX = "iregistry:staff-users-list:";

/**
 * @returns {{
 *   q?: string,
 *   roleFilter?: string,
 *   statusFilter?: string,
 *   stationFilter?: string,
 *   sortBy?: string,
 *   sortDir?: string,
 *   scrollY?: number,
 * } | null}
 */
export function readStaffUsersListScope(sessionUserId) {
  if (!sessionUserId) return null;
  try {
    const raw = sessionStorage.getItem(`${PREFIX}${sessionUserId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export function writeStaffUsersListScope(sessionUserId, scope) {
  if (!sessionUserId || !scope) return;
  try {
    sessionStorage.setItem(`${PREFIX}${sessionUserId}`, JSON.stringify(scope));
  } catch {
    /* ignore */
  }
}

export function clearStaffUsersListScope(sessionUserId) {
  if (!sessionUserId) return;
  try {
    sessionStorage.removeItem(`${PREFIX}${sessionUserId}`);
  } catch {
    /* ignore */
  }
}
