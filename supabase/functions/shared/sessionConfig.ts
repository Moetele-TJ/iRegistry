/** Idle session length — extended on each authenticated request (sliding window). */
export const SESSION_TTL_MS = 60 * 60 * 1000; // 1 hour

export const SESSION_TTL_SEC = Math.floor(SESSION_TTL_MS / 1000);
