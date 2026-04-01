// src/lib/invokeFn.js
import { supabase } from "./supabase";
import { getAuthHeaders } from "./authHeaders";
import { emitSessionTokenRefreshed } from "./sessionEvents";

/**
 * Invoke a Supabase edge function, optionally with Authorization.
 * Also handles:
 * - 401: clear local session and redirect to login
 * - session_token rotation: store and broadcast refreshed token
 */
export async function invokeFn(name, options = {}, { withAuth = true } = {}) {
  const headers = {
    ...(withAuth ? getAuthHeaders() : {}),
    ...(options.headers || {}),
  };

  const response = await supabase.functions.invoke(name, {
    ...options,
    headers,
  });

  const { data, error } = response || {};

  // Only force-login for requests that are actually authenticated.
  // Public functions (e.g. item verification) should surface their errors in-UI,
  // not clear the local session or silently redirect.
  const hasAuthHeader = !!headers?.Authorization || !!headers?.authorization;

  if (error?.context?.status === 401 && (withAuth || hasAuthHeader)) {
    localStorage.removeItem("session");
    if (window.location.pathname !== "/login") {
      window.location.href = "/login";
    }
    return { data: null, error };
  }

  if (data?.session_token) {
    localStorage.setItem("session", data.session_token);
    emitSessionTokenRefreshed(data.session_token);
  }

  return response;
}

