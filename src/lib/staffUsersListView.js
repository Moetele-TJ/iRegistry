/** Sidebar manage-users list views (`/…/users` vs `/…/users/non-active`). */

export const STAFF_USERS_LIST_VIEWS = Object.freeze({
  active: "active",
  nonActive: "non-active",
});

/** @returns {"active"|"non-active"} */
export function staffUsersListViewFromPath(pathname) {
  const p = String(pathname || "").replace(/\/+$/, "");
  if (p.endsWith("/users/non-active")) return STAFF_USERS_LIST_VIEWS.nonActive;
  return STAFF_USERS_LIST_VIEWS.active;
}

export function staffUsersBasePath(role) {
  const r = String(role || "").toLowerCase();
  return r === "admin" ? "/admin/users" : "/cashier/users";
}

/** @param {"active"|"non-active"} [view] */
export function staffUsersListPath(role, view = STAFF_USERS_LIST_VIEWS.active) {
  const base = staffUsersBasePath(role);
  return view === STAFF_USERS_LIST_VIEWS.nonActive ? `${base}/non-active` : base;
}
