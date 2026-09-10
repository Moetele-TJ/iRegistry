const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

/** Public URL for a livestock photo entry (path or object with thumb/original). */
export function livestockPhotoSrc(entry, preferThumb = true) {
  if (!entry || !SUPABASE_URL) return null;

  const raw = (() => {
    if (typeof entry === "string") return entry.trim();
    if (typeof entry === "object" && entry) {
      return preferThumb
        ? String(entry.thumb || entry.original || entry.path || entry.url || "").trim()
        : String(entry.original || entry.thumb || entry.path || entry.url || "").trim();
    }
    return "";
  })();

  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;

  const publicPrefix = `${SUPABASE_URL}/storage/v1/object/public/item-photos/`;
  if (raw.startsWith(publicPrefix)) return raw;

  const normalizedPath = raw.replace(/^item-photos\//i, "").replace(/^\/+/, "");
  if (!normalizedPath) return null;
  return `${SUPABASE_URL}/storage/v1/object/public/item-photos/${normalizedPath}`;
}

export function livestockThumb(animal) {
  if (animal?.signed_thumb) return animal.signed_thumb;
  return livestockPhotoSrc(animal?.photos?.[0], true);
}
