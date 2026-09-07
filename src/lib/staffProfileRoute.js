/**
 * True when admin/cashier is on `/…/profile?user=<other>` (not their own profile).
 * `user` may be a UUID or a surname-name slug.
 */
export function isStaffViewingOtherUserProfile(
  pathname,
  search,
  sessionUserId,
  sessionUserSlug,
) {
  if (!sessionUserId) return false;
  const params = new URLSearchParams(search || "");
  const key = params.get("user");
  if (!key) return false;
  if (String(key) === String(sessionUserId)) return false;
  if (
    sessionUserSlug &&
    String(key).toLowerCase() === String(sessionUserSlug).toLowerCase()
  ) {
    return false;
  }
  const p = String(pathname || "").replace(/\/$/, "");
  return p.endsWith("/admin/profile") || p.endsWith("/cashier/profile");
}

export { staffUsersListPath } from "./staffUsersListView.js";
