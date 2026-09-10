/** Safe return-to-path after login (session expiry, protected routes, etc.). */

const BLOCKED_PATHS = new Set(["/login", "/signup", "/unauthorized", "/redirect"]);

export function currentAppPath() {
  if (typeof window === "undefined") return "/";
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

export function isSafePostLoginPath(path) {
  if (!path || typeof path !== "string") return false;
  const trimmed = path.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return false;
  try {
    const url = new URL(trimmed, typeof window !== "undefined" ? window.location.origin : "https://example.invalid");
    const p = url.pathname || "/";
    if (BLOCKED_PATHS.has(p) || p.startsWith("/login")) return false;
    return true;
  } catch {
    return false;
  }
}

/** Full `/login?redirect=…` href for hard navigations (e.g. session 401). */
export function loginHrefWithReturn(returnPath = currentAppPath()) {
  if (!isSafePostLoginPath(returnPath)) return "/login";
  return `/login?redirect=${encodeURIComponent(returnPath)}`;
}

/**
 * @param {URLSearchParams | { get: (k: string) => string | null }} searchParams
 * @returns {string | null}
 */
export function resolvePostLoginTarget(searchParams) {
  const redirect = searchParams?.get?.("redirect");
  if (!isSafePostLoginPath(redirect)) return null;
  try {
    const url = new URL(redirect, typeof window !== "undefined" ? window.location.origin : "https://example.invalid");
    const serial = searchParams?.get?.("serial");
    if (serial) url.searchParams.set("serial", serial);
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}
