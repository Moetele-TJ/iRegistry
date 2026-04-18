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

const USER_SELECT = `
  id,
  channel,
  status,
  currency,
  amount,
  credits_granted,
  receipt_no,
  provider,
  provider_reference,
  created_at,
  confirmed_at,
  reversed_at,
  reversed_reason
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
  created_at,
  confirmed_at,
  orgs:org_id (id, name, slug)
`;

type Unified = Record<string, unknown>;

function mapUserRow(p: Record<string, unknown>): Unified {
  return {
    ...p,
    wallet: "user",
    organization: null,
    reversed_at: p.reversed_at ?? null,
    reversed_reason: p.reversed_reason ?? null,
  };
}

function mapOrgRow(p: Record<string, unknown>): Unified {
  const org = p.orgs as { id?: string; name?: string; slug?: string | null } | null;
  const { orgs: _drop, ...rest } = p;
  return {
    ...rest,
    wallet: "org",
    organization: org
      ? { id: org.id, name: org.name, slug: org.slug ?? null }
      : { id: p.org_id, name: "—", slug: null },
    reversed_at: null,
    reversed_reason: null,
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

    const body = await req.json().catch(() => ({}));
    const rawScope = typeof body?.scope === "string" ? body.scope.trim().toLowerCase() : "";
    const scope = rawScope === "user" || rawScope === "org" ? rawScope : "both";
    const limit = Math.min(Math.max(Number(body?.limit) || 50, 1), 200);
    const offset = Math.max(Number(body?.offset) || 0, 0);

    const { data: memberships, error: memErr } = await supabase
      .from("org_members")
      .select("org_id")
      .eq("user_id", session.user_id)
      .eq("status", "ACTIVE");

    if (memErr) {
      console.error("list-my-payments org_members:", memErr.message);
      return respond({ success: false, message: "Failed to load memberships" }, corsHeaders, 500);
    }

    const orgIds = [...new Set((memberships || []).map((m: { org_id: string }) => m.org_id).filter(Boolean))];

    if (scope === "user") {
      const { data, error, count } = await supabase
        .from("payments")
        .select(USER_SELECT, { count: "exact" })
        .eq("user_id", session.user_id)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        return respond({ success: false, message: error.message || "Failed to list payments" }, corsHeaders, 500);
      }

      const payments = (data || []).map((p) => mapUserRow(p as Record<string, unknown>));
      return respond({ success: true, payments, total: count ?? 0, scope: "user" }, corsHeaders, 200);
    }

    if (scope === "org") {
      if (orgIds.length === 0) {
        return respond({ success: true, payments: [], total: 0, scope: "org" }, corsHeaders, 200);
      }

      const { data, error, count } = await supabase
        .from("org_payments")
        .select(ORG_SELECT, { count: "exact" })
        .in("org_id", orgIds)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        return respond({ success: false, message: error.message || "Failed to list org payments" }, corsHeaders, 500);
      }

      const payments = (data || []).map((p) => mapOrgRow(p as Record<string, unknown>));
      return respond({ success: true, payments, total: count ?? 0, scope: "org" }, corsHeaders, 200);
    }

    // both: merge user + org payments chronologically
    const [{ count: userCount, error: userCountErr }, { count: orgCount, error: orgCountErr }] =
      await Promise.all([
        supabase
          .from("payments")
          .select("id", { count: "exact", head: true })
          .eq("user_id", session.user_id),
        orgIds.length
          ? supabase.from("org_payments").select("id", { count: "exact", head: true }).in("org_id", orgIds)
          : Promise.resolve({ count: 0, error: null }),
      ]);

    if (userCountErr || orgCountErr) {
      console.error("list-my-payments counts:", userCountErr?.message, orgCountErr?.message);
      return respond({ success: false, message: "Failed to count payments" }, corsHeaders, 500);
    }

    const total = (userCount ?? 0) + (orgCount ?? 0);
    const fetchSize = Math.min(offset + limit, 2000);

    const [userRes, orgRes] = await Promise.all([
      supabase
        .from("payments")
        .select(USER_SELECT)
        .eq("user_id", session.user_id)
        .order("created_at", { ascending: false })
        .limit(fetchSize),
      orgIds.length
        ? supabase
            .from("org_payments")
            .select(ORG_SELECT)
            .in("org_id", orgIds)
            .order("created_at", { ascending: false })
            .limit(fetchSize)
        : Promise.resolve({ data: [], error: null }),
    ]);

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
    console.error("list-my-payments crash:", err);
    return respond({ success: false, message: e?.message || "Unexpected server error" }, corsHeaders, 500);
  }
});
