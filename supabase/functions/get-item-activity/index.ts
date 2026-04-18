//  supabase/functions/get-item-activity/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

import { getCorsHeaders } from "../shared/cors.ts";
import { respond } from "../shared/respond.ts";
import { validateSession } from "../shared/validateSession.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const LIMIT = 40;

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const auth = req.headers.get("authorization") || req.headers.get("Authorization");

    const session = await validateSession(supabase, auth);

    if (!session) {
      return respond(
        {
          success: false,
          message: "Invalid session",
        },
        corsHeaders,
        401,
      );
    }

    const body = await req.json().catch(() => ({}));
    const { itemId } = body;

    if (!itemId) {
      return respond(
        {
          success: false,
          message: "itemId is required",
        },
        corsHeaders,
        400,
      );
    }

    const [alRes, orgRes] = await Promise.all([
      supabase
        .from("activity_logs")
        .select(`
        id,
        entity_type,
        entity_id,
        entity_name,
        action,
        message,
        metadata,
        created_at,
        actor_id,
        actor_role
      `)
        .eq("entity_type", "item")
        .eq("entity_id", itemId)
        .order("created_at", { ascending: false })
        .limit(LIMIT),
      supabase
        .from("org_item_activity_logs")
        .select("id, action, message, metadata, created_at, actor_user_id")
        .eq("item_id", itemId)
        .order("created_at", { ascending: false })
        .limit(LIMIT),
    ]);

    if (alRes.error) throw alRes.error;
    if (orgRes.error) throw orgRes.error;

    const fromLogs = (alRes.data || []).map((r: Record<string, unknown>) => ({
      ...r,
      source: "activity_log",
    }));

    const fromOrg = (orgRes.data || []).map((r: Record<string, unknown>) => ({
      id: r.id,
      entity_type: "item",
      entity_id: itemId,
      entity_name: "Organization",
      action: r.action,
      message: r.message ?? null,
      metadata: r.metadata ?? null,
      created_at: r.created_at,
      actor_id: r.actor_user_id ?? null,
      actor_role: null,
      source: "org_item",
    }));

    const merged = [...fromLogs, ...fromOrg].sort((a, b) => {
      const ta = new Date(String((a as { created_at?: string }).created_at || 0)).getTime();
      const tb = new Date(String((b as { created_at?: string }).created_at || 0)).getTime();
      return tb - ta;
    });

    const activity = merged.slice(0, LIMIT);

    return respond(
      {
        success: true,
        activity,
      },
      corsHeaders,
      200,
    );
  } catch (err) {
    console.error("get-item-activity crash:", err);

    return respond(
      {
        success: false,
        message: "Failed to fetch item activity",
      },
      corsHeaders,
      500,
    );
  }
});
