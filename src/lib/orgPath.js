const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Canonical path key for org routes: decode, lowercase, collapse whitespace to hyphens
 * so `itreq%20inc-abc` matches DB slug `itreq-inc-abc`.
 */
export function normalizeOrgPathKey(key) {
  if (key == null) return "";
  let s = String(key).trim();
  try {
    s = decodeURIComponent(s);
  } catch {
    /* ignore malformed escape sequences */
  }
  s = s.trim();
  if (!s) return "";
  if (UUID_RE.test(s)) return s.toLowerCase();
  return s
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

/**
 * URL segment for org routes (`/organizations/:orgKey/...`).
 * Prefer stable slug; fall back to id when slug is missing (legacy rows).
 */
export function orgPathSegment(orgLike) {
  if (orgLike == null || typeof orgLike !== "object") return "";
  const slug = orgLike.slug;
  if (typeof slug === "string" && slug.trim()) return normalizeOrgPathKey(slug);
  const id = orgLike.id;
  if (id != null && String(id).trim()) return normalizeOrgPathKey(String(id).trim());
  return "";
}
