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

  /* 1️⃣ Open police cases at this station (case.station matches; not item.location) */

  const { data: openCases } = await supabase
    .from("item_police_cases")
    .select("item_id")
    .eq("station", station.trim())
    .neq("status", "ReturnedToOwner");

  const itemIds = openCases?.map((c) => c.item_id) ?? [];

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
      "ITEM_MARKED_ACTIVE",
      "POLICE_CASE_IN_CUSTODY",
      "POLICE_CASE_CLEARED_FOR_RETURN",
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