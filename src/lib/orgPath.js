/**
 * URL segment for org routes (`/organizations/:orgKey/...`).
 * Prefer stable slug; fall back to id when slug is missing (legacy rows).
 */
export function orgPathSegment(orgLike) {
  if (orgLike == null || typeof orgLike !== "object") return "";
  const slug = orgLike.slug;
  if (typeof slug === "string" && slug.trim()) return slug.trim().toLowerCase();
  const id = orgLike.id;
  if (id != null && String(id).trim()) return String(id).trim();
  return "";
}
