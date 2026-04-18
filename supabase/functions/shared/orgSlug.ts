/** Normalizes a display name into a URL segment (lowercase, hyphenated). */
export function slugifyOrgName(name: string): string {
  const s = String(name || "")
    .trim()
    .toLowerCase();
  const x = s.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return (x || "org").slice(0, 96);
}

/** Stable org slug: base from name + first 8 hex chars of uuid (no dashes). */
export function orgSlugFromNameAndId(name: string, id: string): string {
  const base = slugifyOrgName(name);
  const suf = String(id).replace(/-/g, "").slice(0, 8);
  return `${base}-${suf}`.toLowerCase();
}
