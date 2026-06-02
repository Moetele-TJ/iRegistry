/** True when admin/cashier is on `/…/profile?user=<other>` (not their own profile). */
export function isStaffViewingOtherUserProfile(pathname, search, sessionUserId) {
  if (!sessionUserId) return false;
  const params = new URLSearchParams(search || "");
  const uid = params.get("user");
  if (!uid || String(uid) === String(sessionUserId)) return false;
  const p = String(pathname || "").replace(/\/$/, "");
  return p.endsWith("/admin/profile") || p.endsWith("/cashier/profile");
}

export function staffUsersListPath(role) {
  const r = String(role || "").toLowerCase();
  return r === "admin" ? "/admin/users" : "/cashier/users";
}
