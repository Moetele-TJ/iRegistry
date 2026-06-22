import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useDashboard } from "./useDashboard.js";
import { consumePostLoginWelcome } from "../lib/firstItemOnboarding.js";
import { roleIs } from "../lib/roleUtils.js";

/**
 * Decides whether to show the first-item welcome modal for ordinary users with no items.
 */
export function useFirstItemOnboarding() {
  const { user, loading: authLoading } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data, loading: dashLoading } = useDashboard({ limit: 1, page: 1 });
  const [open, setOpen] = useState(false);

  const isOrdinaryUser = roleIs(user?.role, "user");
  const summary = data?.personal?.summary || {};
  const itemCount =
    (Number(summary.activeItems) || 0) + (Number(summary.stolenItems) || 0);

  const dismiss = useCallback(() => {
    setOpen(false);
    if (searchParams.get("welcome")) {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete("welcome");
          return next;
        },
        { replace: true },
      );
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (authLoading || dashLoading || !isOrdinaryUser) {
      setOpen(false);
      return;
    }

    if (itemCount > 0) {
      setOpen(false);
      return;
    }

    const fromQuery = searchParams.get("welcome") === "1";
    const fromLogin = consumePostLoginWelcome();

    if (fromQuery || fromLogin) {
      setOpen(true);
    }
  }, [authLoading, dashLoading, isOrdinaryUser, itemCount, searchParams]);

  return { open, dismiss, itemCount, loading: authLoading || dashLoading };
}
