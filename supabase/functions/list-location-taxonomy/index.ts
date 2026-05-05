import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

import { getCorsHeaders } from "../shared/cors.ts";
import { respond } from "../shared/respond.ts";
import { validateSession } from "../shared/validateSession.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

function norm(v: unknown) {
  return String(v ?? "").trim().replace(/\s+/g, " ");
}

function uniqSorted(list: string[]) {
  const by = new Map<string, string>(); // lower -> original
  for (const raw of list || []) {
    const s = norm(raw);
    if (!s) continue;
    const k = s.toLowerCase();
    if (!by.has(k)) by.set(k, s);
  }
  return [...by.values()].sort((a, b) => a.localeCompare(b));
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const auth = req.headers.get("authorization") || req.headers.get("Authorization");
    const session = await validateSession(supabase, auth);
    if (!session) return respond({ success: false, message: "Unauthorized" }, corsHeaders, 401);

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const village = typeof body?.village === "string" ? norm(body.village) : "";
    const limit = Math.min(Math.max(Number(body?.limit) || 5000, 1), 10000);

    // Town/Village list from items + users
    const [itemsVillRes, usersVillRes] = await Promise.all([
      supabase.from("items").select("village").not("village", "is", null).limit(limit),
      supabase.from("users").select("village").not("village", "is", null).limit(limit),
    ]);
    if (itemsVillRes.error || usersVillRes.error) {
      return respond({ success: false, message: "Failed to load villages" }, corsHeaders, 500);
    }

    const villages = uniqSorted([
      ...(itemsVillRes.data || []).map((r: any) => r?.village),
      ...(usersVillRes.data || []).map((r: any) => r?.village),
    ]);

    // Wards (optionally filtered by village)
    let itemsWardQ = supabase.from("items").select("ward, village").not("ward", "is", null).limit(limit);
    let usersWardQ = supabase.from("users").select("ward, village").not("ward", "is", null).limit(limit);
    if (village) {
      itemsWardQ = itemsWardQ.eq("village", village);
      usersWardQ = usersWardQ.eq("village", village);
    }

    const [itemsWardRes, usersWardRes] = await Promise.all([itemsWardQ, usersWardQ]);
    if (itemsWardRes.error || usersWardRes.error) {
      return respond({ success: false, message: "Failed to load wards" }, corsHeaders, 500);
    }

    const wards = uniqSorted([
      ...(itemsWardRes.data || [])
        .filter((r: any) => (village ? norm(r?.village) === village : true))
        .map((r: any) => r?.ward),
      ...(usersWardRes.data || [])
        .filter((r: any) => (village ? norm(r?.village) === village : true))
        .map((r: any) => r?.ward),
    ]);

    // Stations (optionally filtered by village). Pull from items.station + users.police_station.
    let itemsStQ = supabase.from("items").select("station, village").not("station", "is", null).limit(limit);
    let usersStQ = supabase.from("users").select("police_station, village").not("police_station", "is", null).limit(limit);
    if (village) {
      itemsStQ = itemsStQ.eq("village", village);
      usersStQ = usersStQ.eq("village", village);
    }

    const [itemsStRes, usersStRes] = await Promise.all([itemsStQ, usersStQ]);
    if (itemsStRes.error || usersStRes.error) {
      return respond({ success: false, message: "Failed to load police stations" }, corsHeaders, 500);
    }

    const stations = uniqSorted([
      ...(itemsStRes.data || [])
        .filter((r: any) => (village ? norm(r?.village) === village : true))
        .map((r: any) => r?.station),
      ...(usersStRes.data || [])
        .filter((r: any) => (village ? norm(r?.village) === village : true))
        .map((r: any) => r?.police_station),
    ]);

    return respond(
      {
        success: true,
        villages,
        wards,
        stations,
        scope: { village: village || null },
      },
      corsHeaders,
      200,
    );
  } catch (err: unknown) {
    console.error("list-location-taxonomy crash:", err);
    const e = err as { message?: string };
    return respond({ success: false, message: e?.message || "Unexpected server error" }, corsHeaders, 500);
  }
});

