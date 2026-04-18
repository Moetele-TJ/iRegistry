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

    const body = await req.json().catch(() => null);
    const id_number =
      typeof body?.id_number === "string" ? body.id_number.replace(/\s+/g, "").trim() : "";
    const phone = typeof body?.phone === "string" ? body.phone.trim() : "";
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

    if (!id_number && !phone && !email) {
      return respond({ success: true, matches: [] }, corsHeaders, 200);
    }

    // Exact-match lookup only (safe + predictable).
    // Note: We intentionally do not OR-build a single query; we do separate lookups
    // to keep semantics clear and avoid unexpected broad matches.
    const matches: any[] = [];
    const seen = new Set<string>();

    const pick = (u: any) => ({
      id: u.id,
      first_name: u.first_name,
      last_name: u.last_name,
      id_number: u.id_number,
      phone: u.phone,
      email: u.email,
      status: u.status,
      role: u.role,
    });

    if (id_number) {
      const { data } = await supabase
        .from("users")
        .select("id, first_name, last_name, id_number, phone, email, status, role")
        .eq("id_number", id_number)
        .is("deleted_at", null)
        .limit(3);
      for (const u of data || []) {
        if (!seen.has(u.id)) {
          seen.add(u.id);
          matches.push(pick(u));
        }
      }
    }

    if (phone) {
      const { data } = await supabase
        .from("users")
        .select("id, first_name, last_name, id_number, phone, email, status, role")
        .eq("phone", phone)
        .is("deleted_at", null)
        .limit(3);
      for (const u of data || []) {
        if (!seen.has(u.id)) {
          seen.add(u.id);
          matches.push(pick(u));
        }
      }
    }

    if (email) {
      const { data } = await supabase
        .from("users")
        .select("id, first_name, last_name, id_number, phone, email, status, role")
        .eq("email", email)
        .is("deleted_at", null)
        .limit(3);
      for (const u of data || []) {
        if (!seen.has(u.id)) {
          seen.add(u.id);
          matches.push(pick(u));
        }
      }
    }

    return respond({ success: true, matches }, corsHeaders, 200);
  } catch (err: any) {
    console.error("staff-lookup-user crash:", err);
    return respond({ success: false, message: err?.message || "Unexpected server error" }, corsHeaders, 500);
  }
}