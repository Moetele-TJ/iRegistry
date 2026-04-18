import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { invokeWithAuth } from "../lib/invokeWithAuth.js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Resolves `orgSlug` from the route via get-org-wallet. All invocations that need the org
 * should pass `org_id` from the returned `orgId`; URLs use `orgSlug`.
 */
export function useOrgRouteResolution() {
  const { orgSlug } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [organization, setOrganization] = useState(null);
  const [orgId, setOrgId] = useState(null);
  const [balance, setBalance] = useState(null);
  const [creditsUpdatedAt, setCreditsUpdatedAt] = useState(null);
  const [role, setRole] = useState(null);

  const reload = useCallback(async () => {
    if (!orgSlug) {
      setLoading(false);
      setError("Missing organization");
      setOrganization(null);
      setOrgId(null);
      setBalance(null);
      setCreditsUpdatedAt(null);
      setRole(null);
      return;
    }
    setLoading(true);
    setError(null);
    setOrganization(null);
    setOrgId(null);
    setBalance(null);
    setCreditsUpdatedAt(null);
    setRole(null);
    try {
      const raw = String(orgSlug || "").trim();
      const body = UUID_RE.test(raw) ? { org_id: raw } : { org_slug: raw.toLowerCase() };
      const { data, error: invErr } = await invokeWithAuth("get-org-wallet", {
        body,
      });
      if (invErr || !data?.success) {
        throw new Error(data?.message || invErr?.message || "Failed to load organization");
      }
      const org = data.organization || null;
      setOrganization(org);
      setOrgId(org?.id ? String(org.id) : null);
      setBalance(typeof data.balance === "number" ? data.balance : 0);
      setCreditsUpdatedAt(data.credits_updated_at ?? null);
      setRole(data.role ?? null);
    } catch (e) {
      setError(e.message || "Failed");
      setOrganization(null);
      setOrgId(null);
      setBalance(null);
      setCreditsUpdatedAt(null);
      setRole(null);
    } finally {
      setLoading(false);
    }
  }, [orgSlug]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return {
    orgSlug,
    orgId,
    organization,
    balance,
    creditsUpdatedAt,
    role,
    loading,
    error,
    reload,
  };
}
