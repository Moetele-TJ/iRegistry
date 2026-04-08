// src/contexts/AuthContext.jsx
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { invokeFn } from "../lib/invokeFn";
import { getJwtExpiryMs } from "../lib/jwtExpiry";
import {
  SESSION_TOKEN_REFRESHED,
  emitSessionTokenRefreshed,
} from "../lib/sessionEvents";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // { id, role }
  const [loading, setLoading] = useState(true);
  const logoutTimerRef = useRef(null);

  const logout = useCallback(async ({ silent = false } = {}) => {
    const token = localStorage.getItem("session");

    try {
      if (!silent && token) {
        await invokeFn(
          "logout",
          { headers: { Authorization: `Bearer ${token}` } },
          { withAuth: false }
        );
      }
    } catch {
      console.warn("Logout request failed, clearing local session anyway");
    } finally {
      if (logoutTimerRef.current) {
        clearTimeout(logoutTimerRef.current);
        logoutTimerRef.current = null;
      }
      localStorage.removeItem("session");
      setUser(null);
    }
  }, []);

  const scheduleAutoLogout = useCallback(
    (token) => {
      const expiry = getJwtExpiryMs(token);
      if (!expiry) return;

      const remaining = expiry - Date.now();

      if (remaining <= 0) {
        void logout({ silent: true });
        return;
      }

      if (logoutTimerRef.current) {
        clearTimeout(logoutTimerRef.current);
      }

      logoutTimerRef.current = setTimeout(() => {
        void logout({ silent: true });

        if (window.location.pathname !== "/login") {
          window.location.href = "/login";
        }
      }, remaining);
    },
    [logout]
  );

  const validateSession = useCallback(
    async (token) => {
      try {
        const { data, error } = await invokeFn(
          "validate-session",
          { headers: { Authorization: `Bearer ${token}` } },
          { withAuth: false }
        );

        if (error || !data?.success) {
          await logout({ silent: true });
        } else {
          setUser(data.user);

          const tokenToUse = data.session_token || token;
          scheduleAutoLogout(tokenToUse);

          if (data.session_token) {
            localStorage.setItem("session", data.session_token);
            emitSessionTokenRefreshed(data.session_token);
          }
        }
      } catch (err) {
        console.error("Session validation failed:", err);
        await logout({ silent: true });
      } finally {
        setLoading(false);
      }
    },
    [logout, scheduleAutoLogout]
  );

  const validateSessionRef = useRef(validateSession);
  validateSessionRef.current = validateSession;

  /* ----------------------------------
   * Validate session on app start
   * ---------------------------------- */
  useEffect(() => {
    const token = localStorage.getItem("session");

    if (!token) {
      setLoading(false);
      return;
    }

    void validateSessionRef.current(token);
  }, []);

  /* ----------------------------------
   * Other tabs: session cleared or rotated
   * ---------------------------------- */
  useEffect(() => {
    function handleStorageChange(e) {
      if (e.key !== "session") return;

      const token = e.newValue;

      if (!token) {
        if (logoutTimerRef.current) {
          clearTimeout(logoutTimerRef.current);
          logoutTimerRef.current = null;
        }
        setUser(null);
        setLoading(false);
        return;
      }

      void validateSessionRef.current(token);
    }

    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  /* ----------------------------------
   * Same tab: token refreshed via invokeWithAuth
   * ---------------------------------- */
  useEffect(() => {
    function handleSessionTokenRefreshed(ev) {
      const t = ev.detail?.token;
      if (t) scheduleAutoLogout(t);
    }

    window.addEventListener(SESSION_TOKEN_REFRESHED, handleSessionTokenRefreshed);

    return () => {
      window.removeEventListener(
        SESSION_TOKEN_REFRESHED,
        
        handleSessionTokenRefreshed
      );
    };
  }, [scheduleAutoLogout]);

  const loginWithToken = useCallback(
    async (token) => {
      localStorage.setItem("session", token);
      scheduleAutoLogout(token);
      await validateSession(token);
    },
    [scheduleAutoLogout, validateSession]
  );

  const refreshUser = useCallback(async () => {
    const token = localStorage.getItem("session");
    if (!token) return;
    await validateSession(token);
  }, [validateSession]);

  const value = {
    user,
    loading,
    loginWithToken,
    logout,
    refreshUser,
  };

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

/* ----------------------------------
 * Hook
 * ---------------------------------- */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return ctx;
}