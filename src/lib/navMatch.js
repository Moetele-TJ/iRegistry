/** Exact path match — layout home links must not stay active on child routes (e.g. `/admin` vs `/admin/users`). */
export function isExactNavPath(pathname, to) {
  const norm = (s) => String(s || "").replace(/\/+$/, "") || "/";
  return norm(pathname) === norm(to);
}
