import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

import { getCorsHeaders } from "../../cors.ts";
import { respond } from "../../respond.ts";
import { validateSession } from "../../validateSession.ts";
import { isPrivilegedRole } from "../../roles.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

export async function run(req: Request): Promise<Response> {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  try {
    const auth = req.headers.get("authorization") || req.headers.get("Authorization");
    const session = await validateSession(supabase, auth);
    if (!session) return respond({ success: false, message: "Unauthorized" }, corsHeaders, 401);
    if (!isPrivilegedRole(session.role)) return respond({ success: false, message: "Forbidden" }, corsHeaders, 403);
    if (req.method !== "POST") return respond({ success: false, message: "Method not allowed" }, corsHeaders, 405);

    const body = await req.json().catch(() => ({}));
    const q = typeof body?.q === "string" ? body.q.trim() : "";
    const limit = Math.min(Math.max(Number(body?.limit) || 50, 1), 200);

    let query = supabase
      .from("orgs")
      .select("id, name, registration_no, contact_email, phone, updated_at")
      .order("name", { ascending: true })
      .limit(limit);

    if (q) {
      const esc = q.replace(/[%_]/g, "\\$&");
      query = query.or(`name.ilike.%${esc}%,registration_no.ilike.%${esc}%`);
    }

    const { data: orgs, error } = await query;
    if (error) return respond({ success: false, message: error.message || "Failed to load organizations" }, corsHeaders, 500);

    const orgIds = (orgs || []).map((o: any) => o.id).filter(Boolean);
    if (orgIds.length === 0) return respond({ success: true, organizations: [] }, corsHeaders, 200);

    const { data: creditsRows } = await supabase
      .from("org_credits")
      .select("org_id, balance, updated_at")
      .in("org_id", orgIds)
      .limit(1000);

    const creditsByOrg = new Map<string, any>();
    for (const r of creditsRows || []) creditsByOrg.set(String(r.org_id), r);

    // Fetch a window of recent confirmed payments and pick the latest per org in code.
    const { data: payRows } = await supabase
      .from("org_payments")
      .select("id, org_id, currency, amount, credits_granted, receipt_no, confirmed_at, created_at, status")
      .in("org_id", orgIds)
      .eq("status", "CONFIRMED")
      .order("confirmed_at", { ascending: false })
      .limit(Math.min(orgIds.length * 3, 500));

    const lastPaymentByOrg = new Map<string, any>();
    for (const p of payRows || []) {
      const oid = String(p.org_id);
      if (!lastPaymentByOrg.has(oid)) lastPaymentByOrg.set(oid, p);
    }

    const organizations = (orgs || []).map((o: any) => {
      const credits = creditsByOrg.get(String(o.id)) || null;
      const last_payment = lastPaymentByOrg.get(String(o.id)) || null;
      return {
        ...o,
        wallet: {
          balance: credits ? Number(credits.balance ?? 0) : 0,
          updated_at: credits?.updated_at ?? null,
        },
        last_payment,
      };
    });

    return respond({ success: true, organizations }, corsHeaders, 200);
  } catch (err: any) {
    console.error("staff-list-orgs-summary crash:", err);
    return respond({ success: false, message: err?.message || "Unexpected server error" }, corsHeaders, 500);
  }
}