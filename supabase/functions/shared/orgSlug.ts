/**
 * Normalizes a display name into a URL segment: lowercase letters/digits, hyphen between word runs.
 * Uses Unicode letters/numbers so casing is folded to lowercase without dropping non-ASCII letters.
 */
export function slugifyOrgName(name: string): string {
  const s = String(name || "").trim().toLocaleLowerCase();
  const x = s
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  return (x || "org").slice(0, 96);
}

/** Stable org slug: base from name + first 8 hex chars of uuid (no dashes). */
export function orgSlugFromNameAndId(name: string, id: string): string {
  const base = slugifyOrgName(name);
  const suf = String(id).replace(/-/g, "").slice(0, 8);
  return `${base}-${suf}`.toLowerCase();
}
