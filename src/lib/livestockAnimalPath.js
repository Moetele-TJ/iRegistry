/** Public livestock detail URL: `/livestock/{owner-slug}/{animal-id}`. */
export function livestockAnimalPath(animalId, ownerLike) {
  const id = String(animalId || "").trim();
  if (!id) return "/livestock";
  const slug =
    typeof ownerLike === "string"
      ? ownerLike.trim()
      : typeof ownerLike?.slug === "string"
        ? ownerLike.slug.trim()
        : "";
  if (slug) return `/livestock/${slug}/${id}`;
  return `/livestock/${id}`;
}
