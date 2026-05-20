/** Idle session length — extended on each authenticated request (sliding window). */
export const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

export const SESSION_TTL_SEC = Math.floor(SESSION_TTL_MS / 1000);
