import { useCallback, useEffect, useMemo, useState } from "react";
import { invokeFn } from "../lib/invokeFn";

let cachedTasks = null;
let loadPromise = null;

async function loadTasksOnce() {
  if (cachedTasks) return cachedTasks;
  if (!loadPromise) {
    loadPromise = (async () => {
      const { data, error: invErr } = await invokeFn("list-tasks", {}, { withAuth: false });
      if (invErr || !data?.success) {
        throw new Error(data?.message || invErr?.message || "Failed to load pricing");
      }
      cachedTasks = data.tasks || [];
      return cachedTasks;
    })().finally(() => {
      loadPromise = null;
    });
  }
  return loadPromise;
}

/**
 * Loads `list-tasks` once (shared cache) for credit cost labels (by task code).
 */
export function useTaskPricing() {
  const [tasks, setTasks] = useState(() => cachedTasks || []);
  const [loading, setLoading] = useState(!cachedTasks);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const t = await loadTasksOnce();
        if (!cancelled) setTasks(t);
      } catch (e) {
        if (!cancelled) setError(e.message || "Failed to load pricing");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const byCode = useMemo(() => {
    const m = {};
    for (const t of tasks) {
      if (t?.code) m[t.code] = t;
    }
    return m;
  }, [tasks]);

  const getCost = useCallback(
    (code) => {
      const t = code ? byCode[code] : null;
      const n = Number(t?.credits_cost);
      return Number.isFinite(n) ? n : null;
    },
    [byCode]
  );

  const getLabel = useCallback(
    (code) => (code ? byCode[code]?.name || code : ""),
    [byCode]
  );

  const describeCharges = useCallback(
    (codes) => {
      const list = Array.isArray(codes) ? codes : [];
      return list.map((c) => {
        const cost = getCost(c);
        const label = getLabel(c);
        if (cost != null) return `${label} (${c}): ${cost} credits`;
        return `${label || c}`;
      });
    },
    [getCost, getLabel]
  );

  return {
    tasks,
    loading,
    error,
    byCode,
    getCost,
    getLabel,
    describeCharges,
  };
}
