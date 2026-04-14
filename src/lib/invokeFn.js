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

  async function doInvoke(h) {
    return await supabase.functions.invoke(name, {
      ...options,
      headers: h,
    });
  }

  const response = await doInvoke(headers);

  const { data, error } = response || {};

  // Only force-login for requests that are actually authenticated.
  // Public functions (e.g. item verification) should surface their errors in-UI,
  // not clear the local session or silently redirect.
  const hasAuthHeader = !!headers?.Authorization || !!headers?.authorization;

  // Redirect only when this request carried a session token. `withAuth: true` with no
  // token in storage still sends no Authorization header — a 401 must not send guests to login
  // (e.g. home page loads `list-tasks` for pricing labels via useTaskPricing).
  if (error?.context?.status === 401 && hasAuthHeader) {
    // Token rotation race safety:
    // If another request/tab refreshed localStorage.session since this request started,
    // retry once with the latest token instead of logging out.
    try {
      const sent = String(headers.Authorization || headers.authorization || "");
      const sentToken = sent.startsWith("Bearer ") ? sent.slice("Bearer ".length) : "";
      const latestToken = localStorage.getItem("session") || "";
      if (latestToken && sentToken && latestToken !== sentToken) {
        const retryHeaders = {
          ...headers,
          Authorization: `Bearer ${latestToken}`,
        };
        const retryRes = await doInvoke(retryHeaders);
        const { data: retryData, error: retryError } = retryRes || {};
        if (!retryError) {
          if (retryData?.session_token) {
            localStorage.setItem("session", retryData.session_token);
            emitSessionTokenRefreshed(retryData.session_token);
          }
          return retryRes;
        }
        // fall through to logout below if retry still 401 or other failure
      }
    } catch {
      /* ignore and continue to logout */
    }

    localStorage.removeItem("session");
    if (window.location.pathname !== "/login") {
      window.location.href = "/login";
    }
    return { data: null, error };
  }

  // Non-2xx edge functions set `error` (e.g. FunctionsHttpError) and often leave `data` null.
  // The JSON body is still available on `error.context` and should surface as `data` for UI.
  if (error) {
    let body = null;
    try {
      const ctx = error.context;
      if (ctx && typeof ctx.json === "function") {
        body = await ctx.json();
      }
    } catch {
      /* ignore */
    }
    if (body && typeof body === "object" && !Array.isArray(body)) {
      if (body.session_token) {
        localStorage.setItem("session", body.session_token);
        emitSessionTokenRefreshed(body.session_token);
      }
      return { data: body, error: null };
    }
  }

  if (data?.session_token) {
    localStorage.setItem("session", data.session_token);
    emitSessionTokenRefreshed(data.session_token);
  }

  return response;
}

