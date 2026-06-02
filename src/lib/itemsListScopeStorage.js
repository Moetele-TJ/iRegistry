/** Privileged "View as" value — all owners in the registry. */
export const PRIVILEGED_VIEW_ALL = "__all__";

const PREFIX = "iregistry:items-list-scope:";

function storageKey(sessionUserId, view) {
  return `${PREFIX}${sessionUserId}:${view || "active"}`;
}

export function getItemsListScrollY() {
  if (typeof window === "undefined") return 0;
  const y = window.scrollY ?? 0;
  const doc = document.documentElement?.scrollTop ?? 0;
  const body = document.body?.scrollTop ?? 0;
  return Math.max(y, doc, body);
}

export function setItemsListScrollY(y) {
  if (typeof window === "undefined") return;
  const top = Math.max(0, Math.floor(Number(y) || 0));
  try {
    window.scrollTo({ top, left: 0, behavior: "instant" });
  } catch {
    window.scrollTo(0, top);
  }
  if (document.documentElement) document.documentElement.scrollTop = top;
  if (document.body) document.body.scrollTop = top;
}

export function getMaxScrollY() {
  if (typeof window === "undefined") return 0;
  const doc = document.documentElement;
  const body = document.body;
  const height = Math.max(
    doc?.scrollHeight ?? 0,
    body?.scrollHeight ?? 0,
    doc?.offsetHeight ?? 0
  );
  return Math.max(0, height - window.innerHeight);
}

/**
 * Scroll when layout is tall enough; retries until content paints or attempts exhaust.
 */
export function restoreItemsListScrollY(targetY, { maxAttempts = 32, onDone } = {}) {
  if (typeof window === "undefined") {
    onDone?.();
    return () => {};
  }
  const y = Math.max(0, Math.floor(Number(targetY) || 0));
  if (y <= 0) {
    onDone?.();
    return () => {};
  }

  let attempts = 0;
  let cancelled = false;

  const tick = () => {
    if (cancelled) return;
    const maxScroll = getMaxScrollY();
    if (maxScroll >= y - 12 || attempts >= maxAttempts) {
      setItemsListScrollY(Math.min(y, maxScroll));
      onDone?.();
      return;
    }
    attempts += 1;
    requestAnimationFrame(tick);
  };

  requestAnimationFrame(tick);
  return () => {
    cancelled = true;
  };
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

/** Merge partial fields into stored scope (keeps scrollY unless overridden). */
export function patchItemsListScope(sessionUserId, view, partial) {
  if (!sessionUserId || !partial) return;
  const prev = readItemsListScope(sessionUserId, view) || {};
  writeItemsListScope(sessionUserId, view, { ...prev, ...partial });
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

/**
 * Privileged staff: reset "View as" to the logged-in user's registry (all tabs).
 * Keeps filters/scroll where sensible; clears cross-user view-as from item-details return.
 */
export function resetPrivilegedItemsViewToSelf(sessionUserId) {
  if (!sessionUserId) return;
  const self = String(sessionUserId);
  for (const v of ["active", "deleted", "legacy"]) {
    const prev = readItemsListScope(self, v) || {};
    writeItemsListScope(self, v, {
      ...prev,
      ownerScope: self,
      page: 1,
      scrollY: 0,
    });
  }
}
