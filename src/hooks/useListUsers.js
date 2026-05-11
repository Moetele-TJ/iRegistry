// src/hooks/useListUsers.js
import { useCallback, useEffect, useState } from "react";
import { invokeWithAuth } from "../lib/invokeWithAuth.js";
import { sortUsersAlphabetically } from "../lib/userDisplay.js";

/**
 * Fetches `list-users` when `enabled`, sorted alphabetically (see `displayUser` in `userDisplay.js`).
 * @param {{ enabled?: boolean }} [options]
 */
export function useListUsers({ enabled = true } = {}) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(!!enabled);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: invErr } = await invokeWithAuth("list-users");
      if (invErr || !data?.success) {
        const msg = data?.message || invErr?.message || "Failed to load users";
        setUsers([]);
        setError(msg);
        return { ok: false, message: msg };
      }
      setUsers(sortUsersAlphabetically(Array.isArray(data.users) ? data.users : []));
      setError(null);
      return { ok: true };
    } catch (e) {
      const msg = e?.message || "Failed to load users";
      setUsers([]);
      setError(msg);
      return { ok: false, message: msg };
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return undefined;
    }
    void refresh();
    return undefined;
  }, [enabled, refresh]);

  return { users, loading, error, refresh };
}
