import { useCallback, useEffect, useMemo, useState } from "react";
import { invokeWithAuth } from "../lib/invokeWithAuth";

const STORAGE_KEY = "activeOrganizationId";

export function useOrganizations() {
  const [memberships, setMemberships] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const [activeOrganizationId, setActiveOrganizationId] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || "";
    } catch {
      return "";
    }
  });

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await invokeWithAuth("list-my-orgs");
      if (error || !data?.success) throw new Error(data?.message || error?.message || "Failed to load organizations");
      const rows = Array.isArray(data.memberships) ? data.memberships : [];
      setMemberships(rows);

      // If current active org is no longer ACTIVE, clear it.
      if (activeOrganizationId) {
        const ok = rows.some((m) => String(m?.org?.id) === String(activeOrganizationId) && m?.status === "ACTIVE");
        if (!ok) setActiveOrganizationId("");
      }
    } catch (e) {
      setError(e.message || "Failed to load organizations");
      setMemberships([]);
    } finally {
      setLoading(false);
    }
  }, [activeOrganizationId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    try {
      if (activeOrganizationId) localStorage.setItem(STORAGE_KEY, String(activeOrganizationId));
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, [activeOrganizationId]);

  const invites = useMemo(
    () => (memberships || []).filter((m) => m?.status === "INVITED" && m?.org?.id),
    [memberships],
  );

  const active = useMemo(
    () => (memberships || []).filter((m) => m?.status === "ACTIVE" && m?.org?.id),
    [memberships],
  );

  async function respondInvite({ orgId, action }) {
    setSaving(true);
    setError(null);
    try {
      const { data, error } = await invokeWithAuth("respond-org-invite", {
        body: { org_id: orgId, action },
      });
      if (error || !data?.success) throw new Error(data?.message || error?.message || "Failed");
      await refresh();
      return { ok: true };
    } catch (e) {
      setError(e.message || "Failed");
      return { ok: false, message: e.message || "Failed" };
    } finally {
      setSaving(false);
    }
  }

  return {
    memberships,
    invites,
    activeMemberships: active,
    loading,
    saving,
    error,
    refresh,
    activeOrganizationId,
    setActiveOrganizationId,
    respondInvite,
  };
}

