import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

import { getCorsHeaders } from "../shared/cors.ts";
import { respond } from "../shared/respond.ts";
import { validateSession } from "../shared/validateSession.ts";
import { getActiveOrgMembership } from "../shared/orgAuth.ts";
import { isPrivilegedRole } from "../shared/roles.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const uuidRe =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Match client `normalizeOrgPathKey`: spaces → hyphens so URL slugs align with `orgs.slug`. */
function normalizeOrgSlugLookup(s: string): string {
  const t = s.trim().toLowerCase();
  if (uuidRe.test(t)) return t;
  return t.replace(/\s+/g, "-").replace(/-+/g, "-");
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
    const rawOrgId = typeof body?.org_id === "string" ? body.org_id.trim() : "";
    const rawOrgSlug = typeof body?.org_slug === "string" ? body.org_slug.trim() : "";

    let resolvedOrgId = "";
    let slugLookup: string | null = null;

    if (rawOrgId && uuidRe.test(rawOrgId)) {
      resolvedOrgId = rawOrgId;
    } else if (rawOrgSlug) {
      slugLookup = normalizeOrgSlugLookup(rawOrgSlug);
    } else if (rawOrgId && !uuidRe.test(rawOrgId)) {
      slugLookup = normalizeOrgSlugLookup(rawOrgId);
    } else {
      return respond({ success: false, message: "org_id or org_slug is required" }, corsHeaders, 400);
    }

    const staff = isPrivilegedRole(session.role);

    let orgRow: {
      id: string;
      slug: string | null;
      name: string;
      registration_no: string | null;
      contact_email: string | null;
      phone: string | null;
      village: string | null;
      ward: string | null;
      updated_at: string | null;
    } | null = null;
    let orgErr: { message?: string } | null = null;

    if (resolvedOrgId) {
      const q = await supabase
        .from("orgs")
        .select("id, slug, name, registration_no, contact_email, phone, village, ward, updated_at")
        .eq("id", resolvedOrgId)
        .maybeSingle();
      orgRow = q.data as typeof orgRow;
      orgErr = q.error;
    } else if (slugLookup) {
      const q = await supabase
        .from("orgs")
        .select("id, slug, name, registration_no, contact_email, phone, village, ward, updated_at")
        .eq("slug", slugLookup)
        .maybeSingle();
      orgRow = q.data as typeof orgRow;
      orgErr = q.error;
    }

    const orgIdForMembership = orgRow?.id ? String(orgRow.id) : "";

    const membership = staff
      ? null
      : await getActiveOrgMembership(supabase, { orgId: orgIdForMembership, userId: session.user_id });
    if (!staff && !membership) return respond({ success: false, message: "Forbidden" }, corsHeaders, 403);

    if (orgErr || !orgRow) {
      console.error("get-org-wallet org:", orgErr?.message);
      return respond({ success: false, message: "Organization not found" }, corsHeaders, 404);
    }

    const { data: creditRow } = await supabase
      .from("org_credits")
      .select("balance, updated_at")
      .eq("org_id", orgRow.id)
      .maybeSingle();

    const rawBal = creditRow?.balance;
    const n =
      rawBal == null
        ? 0
        : typeof rawBal === "number"
        ? rawBal
        : Number(rawBal);
    const balance = Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0;

    return respond(
      {
        success: true,
        organization: {
          id: orgRow.id,
          slug: orgRow.slug ?? null,
          name: orgRow.name,
          registration_no: orgRow.registration_no ?? null,
          contact_email: orgRow.contact_email ?? null,
          phone: orgRow.phone ?? null,
          village: orgRow.village ?? null,
          ward: orgRow.ward ?? null,
          updated_at: orgRow.updated_at ?? null,
        },
        balance,
        credits_updated_at: creditRow?.updated_at ?? null,
        role: membership?.role ?? (staff ? "STAFF" : null),
      },
      corsHeaders,
      200,
    );
  } catch (err: unknown) {
    const e = err as { message?: string };
    console.error("get-org-wallet crash:", err);
    return respond({ success: false, message: e?.message || "Unexpected server error" }, corsHeaders, 500);
  }
});
