import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

import { getCorsHeaders } from "../shared/cors.ts";
import { respond } from "../shared/respond.ts";
import { validateSession } from "../shared/validateSession.ts";
import { isPrivilegedRole } from "../shared/roles.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const USER_SELECT = `
        id,
        user_id,
        channel,
        status,
        currency,
        amount,
        credits_granted,
        receipt_no,
        provider,
        provider_reference,
        cashier_user_id,
        created_at,
        confirmed_at,
        reversed_at,
        reversed_by,
        reversed_reason,
        metadata,
        users!payments_user_id_fkey(first_name,last_name,email,id_number,phone)
      `;

const ORG_SELECT = `
        id,
        org_id,
        channel,
        status,
        currency,
        amount,
        credits_granted,
        receipt_no,
        provider,
        provider_reference,
        cashier_user_id,
        metadata,
        created_at,
        confirmed_at,
        reversed_at,
        reversed_by,
        reversed_reason,
        orgs:org_id (id, name, slug)
      `;

type Unified = Record<string, unknown>;

function mapUserRow(p: Record<string, unknown>): Unified {
  return {
    ...p,
    wallet: "user",
    organization: null,
  };
}

function mapOrgRow(p: Record<string, unknown>): Unified {
  const org = p.orgs as { id?: string; name?: string; slug?: string | null } | null;
  const { orgs: _drop, ...rest } = p;
  return {
    ...rest,
    wallet: "org",
    user_id: null,
    organization: org
      ? { id: org.id, name: org.name, slug: org.slug ?? null }
      : { id: p.org_id, name: "—", slug: null },
    reversed_at: p.reversed_at ?? null,
    reversed_by: p.reversed_by ?? null,
    reversed_reason: p.reversed_reason ?? null,
    metadata: p.metadata ?? null,
    users: null,
  };
}

function byCreatedAtDesc(a: Unified, b: Unified) {
  const ta = new Date(String(a.created_at || 0)).getTime();
  const tb = new Date(String(b.created_at || 0)).getTime();
  return tb - ta;
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
    const allow = isPrivilegedRole(session.role);
    if (!allow) return respond({ success: false, message: "Forbidden" }, corsHeaders, 403);

    const body = await req.json().catch(() => ({}));
    const rawScope = typeof body?.scope === "string" ? body.scope.trim().toLowerCase() : "";
    const scope = rawScope === "user" || rawScope === "org" ? rawScope : "both";
    const filterUserId = typeof body?.user_id === "string" && body.user_id.trim() ? body.user_id.trim() : "";
    const filterOrgId = typeof body?.org_id === "string" && body.org_id.trim() ? body.org_id.trim() : "";
    const limit = Math.min(Math.max(Number(body?.limit) || 50, 1), 200);
    const offset = Math.max(Number(body?.offset) || 0, 0);
    const status = typeof body?.status === "string" && body.status.trim() ? body.status.trim() : "";

    if (scope === "user") {
      let q = supabase
        .from("payments")
        .select(USER_SELECT, { count: "exact" })
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (filterUserId) q = q.eq("user_id", filterUserId);
      if (status) q = q.eq("status", status);

      const { data, error, count } = await q;
      if (error) return respond({ success: false, message: error.message || "Failed to list payments" }, corsHeaders, 500);

      const payments = (data || []).map((p) => mapUserRow(p as Record<string, unknown>));
      return respond({ success: true, payments, total: count ?? 0, scope: "user" }, corsHeaders, 200);
    }

    if (scope === "org") {
      let q = supabase
        .from("org_payments")
        .select(ORG_SELECT, { count: "exact" })
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (filterOrgId) q = q.eq("org_id", filterOrgId);
      if (status) q = q.eq("status", status);

      const { data, error, count } = await q;
      if (error) return respond({ success: false, message: error.message || "Failed to list org payments" }, corsHeaders, 500);

      const payments = (data || []).map((p) => mapOrgRow(p as Record<string, unknown>));
      return respond({ success: true, payments, total: count ?? 0, scope: "org" }, corsHeaders, 200);
    }

    // both: merge user + org payments
    const [{ count: userCount, error: userCountErr }, { count: orgCount, error: orgCountErr }] = await Promise.all([
      (() => {
        let c = supabase.from("payments").select("id", { count: "exact", head: true });
        if (filterUserId) c = c.eq("user_id", filterUserId);
        if (status) c = c.eq("status", status);
        return c;
      })(),
      (() => {
        let c = supabase.from("org_payments").select("id", { count: "exact", head: true });
        if (filterOrgId) c = c.eq("org_id", filterOrgId);
        if (status) c = c.eq("status", status);
        return c;
      })(),
    ]);

    if (userCountErr || orgCountErr) {
      console.error("list-payments counts:", userCountErr?.message, orgCountErr?.message);
      return respond({ success: false, message: "Failed to count payments" }, corsHeaders, 500);
    }

    const total = (userCount ?? 0) + (orgCount ?? 0);
    const fetchSize = Math.min(offset + limit, 2000);

    let userFetch = supabase.from("payments").select(USER_SELECT).order("created_at", { ascending: false }).limit(fetchSize);
    if (filterUserId) userFetch = userFetch.eq("user_id", filterUserId);
    if (status) userFetch = userFetch.eq("status", status);

    let orgFetch = supabase.from("org_payments").select(ORG_SELECT).order("created_at", { ascending: false }).limit(fetchSize);
    if (filterOrgId) orgFetch = orgFetch.eq("org_id", filterOrgId);
    if (status) orgFetch = orgFetch.eq("status", status);

    const [userRes, orgRes] = await Promise.all([userFetch, orgFetch]);

    if (userRes.error) {
      return respond({ success: false, message: userRes.error.message || "Failed to list payments" }, corsHeaders, 500);
    }
    if (orgRes.error) {
      return respond({ success: false, message: orgRes.error.message || "Failed to list org payments" }, corsHeaders, 500);
    }

    const merged = [
      ...((userRes.data || []) as Record<string, unknown>[]).map(mapUserRow),
      ...((orgRes.data || []) as Record<string, unknown>[]).map(mapOrgRow),
    ].sort(byCreatedAtDesc);

    const payments = merged.slice(offset, offset + limit);

    return respond({ success: true, payments, total, scope: "both" }, corsHeaders, 200);
  } catch (err: unknown) {
    const e = err as { message?: string };
    console.error("list-payments crash:", err);
    return respond({ success: false, message: e?.message || "Unexpected server error" }, corsHeaders, 500);
  }
});
