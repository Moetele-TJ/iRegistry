/** Normalize DB photos to { original, thumb } for UI + API. */
export function normalizePhotos(photos) {
  if (!Array.isArray(photos)) return [];
  return photos
    .map((p) => {
      if (typeof p === "string") {
        const s = p.trim();
        if (!s) return null;
        return { original: s, thumb: s };
      }
      if (p && typeof p === "object") {
        const o = String(p.original || "").trim();
        const t = String(p.thumb || "").trim();
        if (o && t) return { original: o, thumb: t };
        if (o) return { original: o, thumb: o };
        if (t) return { original: t, thumb: t };
      }
      return null;
    })
    .filter(Boolean);
}
