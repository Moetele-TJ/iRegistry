import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

import { getCorsHeaders } from "../shared/cors.ts";
import { respond } from "../shared/respond.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

function normStation(v: unknown) {
  const s = String(v ?? "").trim();
  if (!s) return "";
  return s.replace(/\s+/g, " ");
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    // Stations are not sensitive; allow public access (used on Signup).
    const limit = 5000;

    const [usersRes, itemsRes, casesRes, foundRes] = await Promise.all([
      supabase.from("users").select("police_station").not("police_station", "is", null).limit(limit),
      supabase.from("items").select("station").not("station", "is", null).limit(limit),
      supabase.from("item_police_cases").select("station").not("station", "is", null).limit(limit),
      supabase.from("found_item_reports").select("station").not("station", "is", null).limit(limit),
    ]);

    const err =
      usersRes.error || itemsRes.error || casesRes.error || foundRes.error;
    if (err) {
      console.error("list-police-stations:", err.message);
      return respond({ success: false, message: "Failed to load police stations" }, corsHeaders, 500);
    }

    const raw: string[] = [];
    for (const r of usersRes.data || []) raw.push(normStation((r as any).police_station));
    for (const r of itemsRes.data || []) raw.push(normStation((r as any).station));
    for (const r of casesRes.data || []) raw.push(normStation((r as any).station));
    for (const r of foundRes.data || []) raw.push(normStation((r as any).station));

    const seen = new Map<string, string>(); // lower -> original
    for (const s of raw) {
      if (!s) continue;
      const k = s.toLowerCase();
      if (!seen.has(k)) seen.set(k, s);
    }

    const stations = [...seen.values()].sort((a, b) => a.localeCompare(b));

    return respond({ success: true, stations }, corsHeaders, 200);
  } catch (err: unknown) {
    console.error("list-police-stations crash:", err);
    const e = err as { message?: string };
    return respond({ success: false, message: e?.message || "Unexpected server error" }, corsHeaders, 500);
  }
});

