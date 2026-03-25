// src/lib/invokeWithAuth.js
import { supabase } from "./supabase";
import { getAuthHeaders } from "./authHeaders";
import { emitSessionTokenRefreshed } from "./sessionEvents";

export async function invokeWithAuth(name, options = {}) {

  const response = await supabase.functions.invoke(name, {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...options.headers,
    },
  });

  const { data, error } = response;

  /* SESSION EXPIRED */
  if (error?.context?.status === 401) {

    localStorage.removeItem("session");

    if (window.location.pathname !== "/login") {
      window.location.href = "/login";
    }

    return { data: null, error };
  }

  /* 🔄 TOKEN REFRESH */
  if (data?.session_token) {
    localStorage.setItem("session", data.session_token);
    emitSessionTokenRefreshed(data.session_token);
  }

  return response;
}