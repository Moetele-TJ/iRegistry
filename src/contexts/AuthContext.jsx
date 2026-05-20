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

const AuthContext = createContext(null);

/** Background validate-session while logged in (sliding DB session + JWT rotation). */
const SESSION_SLIDE_INTERVAL_MS = 20 * 60 * 1000;

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // { id, role }
  const [loading, setLoading] = useState(true);

  const logout = useCallback(async () => {
    const token = localStorage.getItem("session");

    try {
      if (token) {
        await invokeFn(
          "logout",
          {
            body: { session_token: token },
            headers: { Authorization: `Bearer ${token}` },
          },
          { withAuth: false }
        );
      }
    } catch {
      console.warn("Logout request failed, clearing local session anyway");
    } finally {
      localStorage.removeItem("session");
      setUser(null);
    }
  }, []);

  const validateSession = useCallback(
    async (token) => {
      try {
        const { data, error } = await invokeFn(
          "validate-session",
          { headers: { Authorization: `Bearer ${token}` } },
          { withAuth: false }
        );

        const status = error?.context?.status;
        const sessionDead =
          status === 401 ||
          status === 403 ||
          (data && data.success === false && data.diag === "VAL-SESS-002");

        if (sessionDead) {
          await logout();
        } else if (error || !data?.success) {
          console.warn("Session validation skipped (transient error):", error?.message || data?.message);
        } else {
          setUser(data.user);

          if (data.session_token) {
            localStorage.setItem("session", data.session_token);
          }
        }
      } catch (err) {
        console.error("Session validation failed (network):", err);
      } finally {
        setLoading(false);
      }
    },
    [logout]
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
   * Sliding session: re-validate periodically while logged in
   * (extends server expires_at; validate-session returns a fresh JWT)
   * ---------------------------------- */
  useEffect(() => {
    if (!user?.id) return;

    function slideSession() {
      const t = localStorage.getItem("session");
      if (t) void validateSessionRef.current(t);
    }

    const id = window.setInterval(slideSession, SESSION_SLIDE_INTERVAL_MS);

    function onVisible() {
      if (document.visibilityState === "visible") slideSession();
    }
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [user?.id]);

  const loginWithToken = useCallback(
    async (token) => {
      localStorage.setItem("session", token);
      await validateSession(token);
    },
    [validateSession]
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
