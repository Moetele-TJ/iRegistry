/** UUID v1–v5 shape used for users.id. */
const USER_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUserIdUuid(value) {
  return USER_UUID_RE.test(String(value || "").trim());
}

/** Prefer public profile slug; fall back to id for legacy rows. */
export function staffProfileUserKey(userLike) {
  const slug = typeof userLike?.slug === "string" ? userLike.slug.trim() : "";
  if (slug) return slug;
  if (userLike?.id != null) return String(userLike.id);
  return "";
}

export function staffProfilePath(base, userLike) {
  const key = staffProfileUserKey(userLike);
  if (!key) return `${base}/profile`;
  return `${base}/profile?user=${encodeURIComponent(key)}`;
}
