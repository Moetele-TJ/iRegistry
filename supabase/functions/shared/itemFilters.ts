//  📁 supabase/functions/shared/itemFilters.ts

export function applyItemFilters(query: any, filters: any) {
  const {
    includeDeleted,
    deletedOnly,
    includeLegacy,
    legacyOnly,
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

  if (deletedOnly) {
    query = query.not("deletedat", "is", null);
  } else if (!includeDeleted) {
    query = query.is("deletedat", null);
  }

  /* ================= LEGACY / OBSOLETE ================= */

  if (legacyOnly) {
    // Legacy items are a separate bucket; do not mix with deleted.
    query = query.not("legacyat", "is", null).is("deletedat", null);
  } else if (!includeLegacy) {
    query = query.is("legacyat", null);
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

  if (reportedStolen === false) {
    // When explicitly false, return only non-stolen (not reported) items.
    query = query.is("reportedstolenat", null);
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