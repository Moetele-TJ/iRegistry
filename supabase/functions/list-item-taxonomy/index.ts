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

function norm(v: unknown) {
  const s = String(v ?? "").trim().replace(/\s+/g, " ");
  return s;
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

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const auth = req.headers.get("authorization") || req.headers.get("Authorization");
    const session = await validateSession(supabase, auth);
    if (!session) return respond({ success: false, message: "Unauthorized" }, corsHeaders, 401);

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const category = typeof body?.category === "string" ? norm(body.category) : "";
    const make = typeof body?.make === "string" ? norm(body.make) : "";
    const limit = Math.min(Math.max(Number(body?.limit) || 5000, 1), 10000);

    // 1) Categories
    const { data: catRows, error: catErr } = await supabase
      .from("items")
      .select("category")
      .not("category", "is", null)
      .limit(limit);
    if (catErr) return respond({ success: false, message: "Failed to load categories" }, corsHeaders, 500);

    const categories = uniqSorted((catRows || []).map((r: any) => r?.category));

    // 2) Makes (filtered by category if provided)
    let makeQ = supabase
      .from("items")
      .select("make, category")
      .not("make", "is", null)
      .limit(limit);
    if (category) makeQ = makeQ.eq("category", category);

    const { data: makeRows, error: makeErr } = await makeQ;
    if (makeErr) return respond({ success: false, message: "Failed to load makes" }, corsHeaders, 500);

    const makes = uniqSorted(
      (makeRows || [])
        .filter((r: any) => (category ? norm(r?.category) === category : true))
        .map((r: any) => r?.make),
    );

    // 3) Models (filtered by category+make if provided)
    let modelQ = supabase
      .from("items")
      .select("model, category, make")
      .not("model", "is", null)
      .limit(limit);
    if (category) modelQ = modelQ.eq("category", category);
    if (make) modelQ = modelQ.eq("make", make);

    const { data: modelRows, error: modelErr } = await modelQ;
    if (modelErr) return respond({ success: false, message: "Failed to load models" }, corsHeaders, 500);

    const models = uniqSorted(
      (modelRows || [])
        .filter((r: any) => (category ? norm(r?.category) === category : true))
        .filter((r: any) => (make ? norm(r?.make) === make : true))
        .map((r: any) => r?.model),
    );

    return respond(
      {
        success: true,
        categories,
        makes,
        models,
        scope: { category: category || null, make: make || null },
      },
      corsHeaders,
      200,
    );
  } catch (err: unknown) {
    console.error("list-item-taxonomy crash:", err);
    const e = err as { message?: string };
    return respond({ success: false, message: e?.message || "Unexpected server error" }, corsHeaders, 500);
  }
});

