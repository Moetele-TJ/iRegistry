import { useCallback, useEffect, useState } from "react";
import { invokeFn } from "../lib/invokeFn.js";
import { mergePublicContact, publicContactFromEnv } from "../lib/publicContact.js";

export function usePublicContact() {
  const [contact, setContact] = useState(() => ({ ...publicContactFromEnv }));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchContact = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnErr } = await invokeFn("get-public-contact", {}, { withAuth: false });
      if (fnErr || !data?.success) {
        throw new Error(data?.message || fnErr?.message || "Failed to load contact details");
      }
      setContact(mergePublicContact(data.contact));
    } catch (e) {
      setError(e?.message || "Failed to load contact details");
      setContact(mergePublicContact(null));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchContact();
  }, [fetchContact]);

  return { contact, loading, error, refresh: fetchContact };
}
