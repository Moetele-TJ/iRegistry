/** Fired when `localStorage.session` is replaced with a new token (same-tab refreshes). */
export const SESSION_TOKEN_REFRESHED = "iregistry:session-token-refreshed";

export function emitSessionTokenRefreshed(token) {
  if (typeof window === "undefined" || !token) return;
  window.dispatchEvent(
    new CustomEvent(SESSION_TOKEN_REFRESHED, { detail: { token } })
  );
}
