import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext.jsx";
import { invokeWithAuth } from "../lib/invokeWithAuth.js";
import { displayUser } from "../lib/userDisplay.js";
import { deriveUserStatus } from "../lib/userState.js";
import {
  clearStaffUserScope,
  readStaffUserScope,
  writeStaffUserScope,
} from "../lib/staffUserScopeStorage.js";
import {
  resetPrivilegedItemsViewToSelf,
  writeItemsListScope,
} from "../lib/itemsListScopeStorage.js";
import { staffUsersListPath } from "../lib/staffProfileRoute.js";

const StaffUserScopeContext = createContext(null);

export function StaffUserScopeProvider({ children }) {
  const { user: sessionUser } = useAuth();
  const navigate = useNavigate();
  const sessionUserId = sessionUser?.id != null ? String(sessionUser.id) : "";

  const [scope, setScope] = useState(() =>
    sessionUserId ? readStaffUserScope(sessionUserId) : null,
  );
  const [targetUser, setTargetUser] = useState(null);
  const [targetLoading, setTargetLoading] = useState(false);

  const isActive = Boolean(scope?.targetUserId && sessionUserId);

  const enterScope = useCallback(
    (u) => {
      if (!sessionUserId || !u?.id) return;
      const targetUserId = String(u.id);
      if (targetUserId === sessionUserId) return;

      const next = {
        targetUserId,
        displayName: displayUser(u) || "",
        role: u.role,
        status: deriveUserStatus(u),
      };
      writeStaffUserScope(sessionUserId, next);
      setScope(next);

      writeItemsListScope(sessionUserId, "active", {
        ownerScope: targetUserId,
        query: "",
        statusFilter: "All",
        categoryFilter: "All",
        page: 1,
        scrollY: 0,
      });
    },
    [sessionUserId],
  );

  const exitScope = useCallback(() => {
    if (!sessionUserId) return;
    clearStaffUserScope(sessionUserId);
    setScope(null);
    setTargetUser(null);
    resetPrivilegedItemsViewToSelf(sessionUserId);
    navigate(staffUsersListPath(sessionUser?.role));
  }, [sessionUserId, sessionUser?.role, navigate]);

  const refreshTargetUser = useCallback(async () => {
    if (!scope?.targetUserId) return null;
    setTargetLoading(true);
    try {
      const { data, error } = await invokeWithAuth("get-user-profile", {
        body: { user_id: scope.targetUserId },
      });
      if (error || !data?.success) {
        throw new Error(data?.message || error?.message || "Could not load user");
      }
      const loaded = data.user ?? null;
      setTargetUser(loaded);
      if (loaded && sessionUserId) {
        writeStaffUserScope(sessionUserId, {
          targetUserId: String(loaded.id),
          displayName: displayUser(loaded) || scope.displayName,
          role: loaded.role,
          status: deriveUserStatus(loaded),
        });
      }
      return loaded;
    } catch {
      return null;
    } finally {
      setTargetLoading(false);
    }
  }, [scope?.targetUserId, scope?.displayName, sessionUserId]);

  useEffect(() => {
    if (!sessionUserId) {
      setScope(null);
      setTargetUser(null);
      return;
    }
    const stored = readStaffUserScope(sessionUserId);
    setScope(stored);
  }, [sessionUserId]);

  useEffect(() => {
    if (!scope?.targetUserId) {
      setTargetUser(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setTargetLoading(true);
      try {
        const { data, error } = await invokeWithAuth("get-user-profile", {
          body: { user_id: scope.targetUserId },
        });
        if (cancelled) return;
        if (error || !data?.success) {
          setTargetUser(null);
          return;
        }
        setTargetUser(data.user ?? null);
      } catch {
        if (!cancelled) setTargetUser(null);
      } finally {
        if (!cancelled) setTargetLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [scope?.targetUserId]);

  const value = useMemo(
    () => ({
      scope,
      targetUser,
      targetLoading,
      isActive,
      scopedUserId: scope?.targetUserId ? String(scope.targetUserId) : "",
      scopedDisplayName: scope?.displayName || "",
      enterScope,
      exitScope,
      refreshTargetUser,
      sessionUser,
    }),
    [
      scope,
      targetUser,
      targetLoading,
      isActive,
      enterScope,
      exitScope,
      refreshTargetUser,
      sessionUser,
    ],
  );

  return (
    <StaffUserScopeContext.Provider value={value}>{children}</StaffUserScopeContext.Provider>
  );
}

export function useStaffUserScope() {
  const ctx = useContext(StaffUserScopeContext);
  if (!ctx) {
    throw new Error("useStaffUserScope must be used within StaffUserScopeProvider");
  }
  return ctx;
}

/** Safe when provider is absent (returns inactive defaults). */
export function useStaffUserScopeOptional() {
  return useContext(StaffUserScopeContext);
}
