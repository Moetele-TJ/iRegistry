import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { invokeWithAuth } from "../lib/invokeWithAuth.js";
import { parseCreditBalance } from "../lib/parseCreditBalance.js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Resolves the org segment from the route (UUID or server-stored path key) via get-org-wallet.
 * Pass `org_id` from `orgId` to all other APIs; never display the path key in the UI.
 */
export function useOrgRouteResolution() {
  const { orgKey } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [organization, setOrganization] = useState(null);
  const [orgId, setOrgId] = useState(null);
  const [balance, setBalance] = useState(null);
  const [creditsUpdatedAt, setCreditsUpdatedAt] = useState(null);
  const [role, setRole] = useState(null);

  const reload = useCallback(async () => {
    if (!orgKey) {
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
      const raw = String(orgKey || "").trim();
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
      setBalance(parseCreditBalance(data.balance) ?? 0);
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
  }, [orgKey]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (loading || error || !organization?.slug || !orgKey) return;
    const key = String(orgKey).trim();
    if (!UUID_RE.test(key)) return;
    if (String(organization.id).toLowerCase() !== key.toLowerCase()) return;
    const slug = String(organization.slug).trim().toLowerCase();
    if (!slug || slug === key.toLowerCase()) return;
    const path = location.pathname;
    const needle = `/organizations/${key}`;
    if (!path.includes(needle)) return;
    const next =
      path.slice(0, path.indexOf(needle)) +
      `/organizations/${slug}` +
      path.slice(path.indexOf(needle) + needle.length);
    if (next !== path) {
      navigate(`${next}${location.search}${location.hash}`, { replace: true });
    }
  }, [loading, error, organization, orgKey, location.pathname, location.search, location.hash, navigate]);

  return {
    orgKey,
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
