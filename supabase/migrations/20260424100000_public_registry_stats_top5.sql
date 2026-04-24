-- -----------------------------------------------------------------------------
-- Public registry stats: add top-5 lists
--
-- Adds:
-- - topStolenItems: top 5 most stolen items (by category/make/model)
-- - topUserVillages: top 5 villages/towns with most registered users
-- -----------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.public_registry_stats ();

CREATE OR REPLACE FUNCTION public.public_registry_stats ()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH
    -- last 14 days including today (date in UTC)
    days AS (
      SELECT (d::date) AS day
      FROM generate_series(
        (now() at time zone 'utc')::date - interval '13 days',
        (now() at time zone 'utc')::date,
        interval '1 day'
      ) AS d
    ),

    totals AS (
      SELECT
        -- users
        (SELECT count(*)::int
         FROM public.users u
         WHERE u.deleted_at IS NULL) AS total_users,

        -- items
        (SELECT count(*)::int
         FROM public.items i
         WHERE i.deletedat IS NULL
           AND i.legacyat IS NULL) AS total_items,

        (SELECT count(*)::int
         FROM public.items i
         WHERE i.deletedat IS NULL
           AND i.legacyat IS NULL
           AND i.reportedstolenat IS NULL) AS active_items,

        (SELECT count(*)::int
         FROM public.items i
         WHERE i.deletedat IS NULL
           AND i.legacyat IS NULL
           AND i.reportedstolenat IS NOT NULL) AS stolen_items
    ),

    category_breakdown AS (
      SELECT
        COALESCE(NULLIF(trim(i.category), ''), 'Uncategorized') AS category,
        count(*)::int AS count
      FROM public.items i
      WHERE i.deletedat IS NULL
        AND i.legacyat IS NULL
      GROUP BY 1
    ),

    stolen_category_breakdown AS (
      SELECT
        COALESCE(NULLIF(trim(i.category), ''), 'Uncategorized') AS category,
        count(*)::int AS count
      FROM public.items i
      WHERE i.deletedat IS NULL
        AND i.legacyat IS NULL
        AND i.reportedstolenat IS NOT NULL
      GROUP BY 1
    ),

    daily_item_trend AS (
      SELECT
        to_char(d.day, 'YYYY-MM-DD') AS date,
        COALESCE((
          SELECT count(*)::int
          FROM public.items i
          WHERE i.deletedat IS NULL
            AND i.legacyat IS NULL
            AND (i.createdon at time zone 'utc')::date = d.day
        ), 0) AS count
      FROM days d
      ORDER BY d.day
    ),

    daily_user_trend AS (
      SELECT
        to_char(d.day, 'YYYY-MM-DD') AS date,
        COALESCE((
          SELECT count(*)::int
          FROM public.users u
          WHERE u.deleted_at IS NULL
            AND (u.created_at at time zone 'utc')::date = d.day
        ), 0) AS count
      FROM days d
      ORDER BY d.day
    ),

    daily_stolen_trend AS (
      SELECT
        to_char(d.day, 'YYYY-MM-DD') AS date,
        COALESCE((
          SELECT count(*)::int
          FROM public.items i
          WHERE i.deletedat IS NULL
            AND i.legacyat IS NULL
            AND i.reportedstolenat IS NOT NULL
            AND (i.reportedstolenat at time zone 'utc')::date = d.day
        ), 0) AS count
      FROM days d
      ORDER BY d.day
    ),

    daily_active_trend AS (
      SELECT
        to_char(d.day, 'YYYY-MM-DD') AS date,
        COALESCE((
          SELECT count(*)::int
          FROM public.items i
          WHERE i.deletedat IS NULL
            AND i.legacyat IS NULL
            AND i.reportedstolenat IS NULL
            AND (i.createdon at time zone 'utc')::date = d.day
        ), 0) AS count
      FROM days d
      ORDER BY d.day
    ),

    top_stolen_items AS (
      SELECT
        COALESCE(NULLIF(trim(i.category), ''), 'Uncategorized') AS category,
        COALESCE(NULLIF(trim(i.make), ''), 'Unknown') AS make,
        COALESCE(NULLIF(trim(i.model), ''), 'Unknown') AS model,
        count(*)::int AS count
      FROM public.items i
      WHERE i.deletedat IS NULL
        AND i.legacyat IS NULL
        AND i.reportedstolenat IS NOT NULL
      GROUP BY 1, 2, 3
      ORDER BY count DESC, category ASC, make ASC, model ASC
      LIMIT 5
    ),

    top_user_villages AS (
      SELECT
        COALESCE(NULLIF(trim(u.village), ''), 'Unknown') AS village,
        count(*)::int AS count
      FROM public.users u
      WHERE u.deleted_at IS NULL
      GROUP BY 1
      ORDER BY count DESC, village ASC
      LIMIT 5
    )

  SELECT jsonb_build_object(
    'totals', jsonb_build_object(
      'totalUsers', (SELECT total_users FROM totals),
      'totalItems', (SELECT total_items FROM totals),
      'activeItems', (SELECT active_items FROM totals),
      'stolenItems', (SELECT stolen_items FROM totals)
    ),

    'categoryBreakdown', COALESCE((
      SELECT jsonb_object_agg(category, count)
      FROM category_breakdown
    ), '{}'::jsonb),

    'stolenCategoryBreakdown', COALESCE((
      SELECT jsonb_object_agg(category, count)
      FROM stolen_category_breakdown
    ), '{}'::jsonb),

    'dailyItemTrend', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('date', date, 'count', count))
      FROM daily_item_trend
    ), '[]'::jsonb),

    'dailyUserTrend', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('date', date, 'count', count))
      FROM daily_user_trend
    ), '[]'::jsonb),

    'dailyStolenTrend', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('date', date, 'count', count))
      FROM daily_stolen_trend
    ), '[]'::jsonb),

    'dailyActiveTrend', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('date', date, 'count', count))
      FROM daily_active_trend
    ), '[]'::jsonb),

    'topStolenItems', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'category', category,
        'make', make,
        'model', model,
        'count', count
      ))
      FROM top_stolen_items
    ), '[]'::jsonb),

    'topUserVillages', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'village', village,
        'count', count
      ))
      FROM top_user_villages
    ), '[]'::jsonb)
  );
$$;

GRANT EXECUTE ON FUNCTION public.public_registry_stats () TO service_role;

