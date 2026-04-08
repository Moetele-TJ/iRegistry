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

        if (error || !data?.success) {
          await logout({ silent: true });
        } else {
          setUser(data.user);

          if (data.session_token) {
            localStorage.setItem("session", data.session_token);
          }
        }
      } catch (err) {
        console.error("Session validation failed:", err);
        await logout({ silent: true });
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

    const id = window.setInterval(() => {
      const t = localStorage.getItem("session");
      if (t) void validateSessionRef.current(t);
    }, SESSION_SLIDE_INTERVAL_MS);

    return () => window.clearInterval(id);
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
