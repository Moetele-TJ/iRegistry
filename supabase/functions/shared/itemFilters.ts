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

  if (!includeDeleted) {
    query = query.is("deletedat", null);
  }

  if (category) {
    query = query.eq("category", category);
  }

  if (make) {
    query = query.eq("make", make);
  }

  if (model) {
    query = query.eq("model", model);
  }

  if (reportedStolen === true) {
    query = query.not("reportedstolenat", "is", null);
  }

  if (hasPhotos === true) {
    query = query.not("photos", "is", null);
  }

  if (createdFrom) {
    query = query.gte("createdon", createdFrom);
  }

  if (createdTo) {
    query = query.lte("createdon", createdTo);
  }

  if (search) {
    const safeSearch = search.replace(/,/g, "");
    query = query.or(
      `name.ilike.%${safeSearch}%,serial1.ilike.%${safeSearch}%`
    );
  }

  return query;
}