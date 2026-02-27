//  📁 supabase/functions/shared/getPoliceCaseActivity.ts
export async function getPoliceCaseActivity(
  supabase: any,
  {
    station,
    limit = 20,
    page = 1,
  }: {
    station: string;
    limit?: number;
    page?: number;
  }
) {
  const safeLimit = Math.min(Number(limit) || 20, 100);
  const safePage = Math.max(Number(page) || 1, 1);
  const offset = (safePage - 1) * safeLimit;

  /* 1️⃣ Get stolen items at station */

  const { data: stolenItems } = await supabase
    .from("items")
    .select("id")
    .eq("status", "Stolen")
    .eq("location", station)
    .is("deletedat", null);

  const itemIds = stolenItems?.map(i => i.id) ?? [];

  if (itemIds.length === 0) {
    return {
      openCases: 0,
      activity: [],
      pagination: {
        page: safePage,
        limit: safeLimit,
        total: 0,
        totalPages: 0,
      },
    };
  }

  /* 2️⃣ Get case-related activity */

  const { data, count } = await supabase
    .from("activity_logs")
    .select(
      "id, entity_id, entity_name, action, message, created_at",
      { count: "exact" }
    )
    .eq("entity_type", "item")
    .in("entity_id", itemIds)
    .in("action", [
      "ITEM_REPORTED_STOLEN",
      "ITEM_RECOVERED",
      "ITEM_IMPOUNDED",
    ])
    .order("created_at", { ascending: false })
    .range(offset, offset + safeLimit - 1);

  return {
    openCases: itemIds.length,
    activity: data ?? [],
    pagination: {
      page: safePage,
      limit: safeLimit,
      total: count ?? 0,
      totalPages: Math.ceil((count ?? 0) / safeLimit),
    },
  };
}