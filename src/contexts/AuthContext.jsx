// src/contexts/AuthContext.jsx
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import { supabase } from "../lib/supabase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // { id, role }
  const [loading, setLoading] = useState(true);

  /* ----------------------------------
   * Validate session on app start
   * ---------------------------------- */
  useEffect(() => {
    const token = localStorage.getItem("session");
    console.log("REFRESH TOKEN:", token);

    if (!token) {
      setLoading(false);
      return;
    }

    validateSession(token);
  }, []);

  /* ----------------------------------
   * Validate session (DB-backed)
   * ---------------------------------- */
  async function validateSession(token) {
    try {
      const { data, error } = await supabase.functions.invoke(
        "validate-session",
        {
          body: {session_token: token},
        }
      );

      if (error || !data?.success) {
        await logout({silent:true});
      } else {
        setUser({
          id: data.user_id,
          role: data.role,
        });
      }
    } catch (err) {
      console.error("Session validation failed:", err);
      await logout({silent:true});
    } finally {
      setLoading(false);
    }
  }

  /* ----------------------------------
   * Login after OTP verification
   * ---------------------------------- */
  function loginWithToken(token, role, userId = null) {
    localStorage.setItem("session", token);

    setUser({
      id: userId,
      role,
    });

    setLoading(false);
  }

  /* ----------------------------------
   * Logout (local + optional server)
   * ---------------------------------- */
  async function logout({silent=false} ={}) {
    const token = localStorage.getItem("session");

    try {
      if (!silent && token) {
        await supabase.functions.invoke("logout", {
          body: {
            session_token: token
          },
        });
      }
    } catch (err) {
      // Ignore network errors — logout should always succeed locally
      console.warn("Logout request failed, clearing local session anyway");
    } finally {
      localStorage.removeItem("session");
      setUser(null);
    }
  }

  const value = {
    user,
    loading,
    loginWithToken,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
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