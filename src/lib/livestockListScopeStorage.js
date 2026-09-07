/** Privileged "View as" value — all owners. */
export const LIVESTOCK_VIEW_ALL = "__all__";

const PREFIX = "iregistry:livestock-list-scope:";

function storageKey(sessionUserId, view) {
  return `${PREFIX}${sessionUserId}:${view || "active"}`;
}

export function readLivestockListScope(sessionUserId, view) {
  if (!sessionUserId) return null;
  try {
    const raw = sessionStorage.getItem(storageKey(sessionUserId, view));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export function writeLivestockListScope(sessionUserId, view, scope) {
  if (!sessionUserId || !scope) return;
  try {
    sessionStorage.setItem(storageKey(sessionUserId, view), JSON.stringify(scope));
  } catch {
    /* ignore */
  }
}

export function patchLivestockListScope(sessionUserId, view, partial) {
  if (!sessionUserId || !partial) return;
  const prev = readLivestockListScope(sessionUserId, view) || {};
  writeLivestockListScope(sessionUserId, view, { ...prev, ...partial });
}

export function clearLivestockListScope(sessionUserId, view) {
  if (!sessionUserId) return;
  try {
    sessionStorage.removeItem(storageKey(sessionUserId, view));
  } catch {
    /* ignore */
  }
}

export function clearAllLivestockListScopeForUser(sessionUserId) {
  if (!sessionUserId) return;
  for (const v of ["active", "missing", "recovered", "deleted"]) {
    clearLivestockListScope(sessionUserId, v);
  }
}
