//  📁 supabase/functions/shared/itemFilters.ts

export function applyItemFilters(query: any, filters: any) {
  const {
    includeDeleted,
    category,
    make,
    model,
    reportedStolen,
    hasPhotos,
    createdFrom,
    createdTo,
    search,
  } = filters;

  /* ================= DELETED ================= */

  if (!includeDeleted) {
    query = query.is("deletedat", null);
  }

  /* ================= BASIC FILTERS ================= */

  if (category) {
    query = query.eq("category", category);
  }

  if (make) {
    query = query.eq("make", make);
  }

  if (model) {
    query = query.eq("model", model);
  }

  /* ================= STATUS ================= */

  if (reportedStolen === true) {
    query = query.not("reportedstolenat", "is", null);
  }

  if (hasPhotos === true) {
    query = query.not("photos", "is", null);
  }

  /* ================= DATE FILTERS ================= */

  if (typeof createdFrom === "string") {
    const trimmed = createdFrom.trim();
    if (trimmed && trimmed !== "null") {
      const parsed = Date.parse(trimmed);
      if (!isNaN(parsed)) {
        query = query.gte("createdon", new Date(parsed).toISOString());
      }
    }
  }

  if (typeof createdTo === "string") {
    const trimmed = createdTo.trim();
    if (trimmed && trimmed !== "null") {
      const parsed = Date.parse(trimmed);
      if (!isNaN(parsed)) {
        query = query.lte("createdon", new Date(parsed).toISOString());
      }
    }
  }

  /* ================= SEARCH ================= */

  if (search && typeof search === "string") {
    const safeSearch = search.replace(/[%_,]/g, "");
    query = query.or(
      `name.ilike.%${safeSearch}%,serial1.ilike.%${safeSearch}%`
    );
  }

  return query;
}