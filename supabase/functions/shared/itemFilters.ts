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
    query = query.eq("deletedat", null);
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

  /* ================= DATE RANGE ================= */

  if (createdFrom) {
    query = query.gte("createdon", createdFrom);
  }

  if (createdTo) {
    query = query.lte("createdon", createdTo);
  }

  /* ================= SEARCH ================= */

  if (search) {
    const safeSearch = search.replace(/,/g, "");
    query = query.or(
      `name.ilike.%${safeSearch}%,serial1.ilike.%${safeSearch}%`
    );
  }

  return query;
}