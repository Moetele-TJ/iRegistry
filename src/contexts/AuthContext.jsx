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
          headers: {
            Authorization: `Bearer ${token}`,
          }
        }
      );

      if (error || !data?.success) {
        await logout({silent:true});
      } else {
        setUser(data.user);
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
  async function loginWithToken(token) {
    localStorage.setItem("session", token);

    await validateSession(token);
  }

  /* ----------------------------------
   * Logout (local + optional server)
   * ---------------------------------- */
  async function logout({silent=false} ={}) {
    const token = localStorage.getItem("session");

    try {
      if (!silent && token) {
        await supabase.functions.invoke("logout", {
          headers: {
            Authorization: `Bearer ${token}`,
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