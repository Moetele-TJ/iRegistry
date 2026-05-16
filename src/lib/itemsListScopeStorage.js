/** Privileged "View as" value — all owners in the registry. */
export const PRIVILEGED_VIEW_ALL = "__all__";

const PREFIX = "iregistry:items-list-scope:";

function storageKey(sessionUserId, view) {
  return `${PREFIX}${sessionUserId}:${view || "active"}`;
}

export function getItemsListScrollY() {
  if (typeof window === "undefined") return 0;
  return window.scrollY ?? document.documentElement?.scrollTop ?? 0;
}

export function setItemsListScrollY(y) {
  if (typeof window === "undefined") return;
  const top = Math.max(0, Math.floor(Number(y) || 0));
  try {
    window.scrollTo({ top, left: 0, behavior: "instant" });
  } catch {
    window.scrollTo(0, top);
  }
}

/**
 * @returns {{ ownerScope?: string, query?: string, statusFilter?: string, categoryFilter?: string, page?: number, scrollY?: number } | null}
 */
export function readItemsListScope(sessionUserId, view) {
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

export function writeItemsListScope(sessionUserId, view, scope) {
  if (!sessionUserId || !scope) return;
  try {
    sessionStorage.setItem(storageKey(sessionUserId, view), JSON.stringify(scope));
  } catch {
    /* ignore quota / private mode */
  }
}

export function clearItemsListScope(sessionUserId, view) {
  if (!sessionUserId) return;
  try {
    sessionStorage.removeItem(storageKey(sessionUserId, view));
  } catch {
    /* ignore */
  }
}

export function clearAllItemsListScopeForUser(sessionUserId) {
  if (!sessionUserId) return;
  for (const v of ["active", "deleted", "legacy"]) {
    clearItemsListScope(sessionUserId, v);
  }
}
