/** Idle session length — extended on each authenticated request (sliding window). */
export const SESSION_TTL_MS = 60 * 60 * 1000; // 1 hour

export const SESSION_TTL_SEC = Math.floor(SESSION_TTL_MS / 1000);

/** Rotate stored session JWT when `exp` is within this window (avoids invalidating in-flight requests). */
export const JWT_ROTATE_WITHIN_MS = 15 * 60 * 1000;

export function jwtNeedsRotation(token: string): boolean {
  if (!token || typeof token !== "string") return true;
  const parts = token.split(".");
  if (parts.length < 2) return true;
  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const payload = JSON.parse(atob(padded));
    if (typeof payload.exp !== "number") return true;
    return payload.exp * 1000 - Date.now() < JWT_ROTATE_WITHIN_MS;
  } catch {
    return true;
  }
}
