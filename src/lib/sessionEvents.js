/** Fired when `localStorage.session` is replaced with a new token (same-tab refreshes). */
export const SESSION_TOKEN_REFRESHED = "iregistry:session-token-refreshed";

/** Fired when the client clears the session (401 / explicit logout). */
export const SESSION_INVALIDATED = "iregistry:session-invalidated";

export function emitSessionTokenRefreshed(token) {
  if (typeof window === "undefined" || !token) return;
  window.dispatchEvent(
    new CustomEvent(SESSION_TOKEN_REFRESHED, { detail: { token } })
  );
}

export function emitSessionInvalidated() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(SESSION_INVALIDATED));
}
