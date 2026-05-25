// src/lib/invokeFn.js
import { supabase, supabaseAnonKey, supabaseUrl } from "./supabase";
import { getAuthHeaders } from "./authHeaders";
import { emitSessionInvalidated, emitSessionTokenRefreshed } from "./sessionEvents";

/**
 * Invoke a Supabase edge function via fetch (reliable on mobile browsers).
 * Also handles:
 * - 401: clear local session and redirect to login
 * - session_token rotation: store and broadcast refreshed token
 */
export async function invokeFn(name, options = {}, { withAuth = true } = {}) {
  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      data: null,
      error: { message: "Supabase client is not configured (missing env vars)." },
    };
  }

  const authHeaders = withAuth ? getAuthHeaders() : {};
  if (withAuth && !authHeaders.Authorization) {
    return {
      data: null,
      error: {
        message: "Your session has expired. Please sign in again.",
        context: { status: 401 },
      },
    };
  }

  const headers = {
    apikey: supabaseAnonKey,
    "Content-Type": "application/json",
    ...authHeaders,
    ...(options.headers || {}),
  };

  const q = name.indexOf("?");
  const fnPath = q === -1 ? name : name.slice(0, q);
  const query = q === -1 ? "" : name.slice(q);
  const url = `${supabaseUrl}/functions/v1/${fnPath}${query}`;

  async function doInvoke(h) {
    const init = {
      method: options.method || "POST",
      headers: h,
    };
    if (options.body !== undefined) {
      init.body =
        typeof options.body === "string" ? options.body : JSON.stringify(options.body);
    }
    try {
      const res = await fetch(url, init);
      let data = null;
      const text = await res.text();
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          data = { message: text };
        }
      }
      if (!res.ok) {
        return {
          data: data && typeof data === "object" ? data : null,
          error: {
            message: data?.message || res.statusText || "Request failed",
            context: { status: res.status, json: async () => data },
          },
        };
      }
      return { data, error: null };
    } catch (err) {
      return {
        data: null,
        error: {
          message:
            err instanceof Error
              ? err.message
              : "Failed to send a request to the Edge Function",
        },
      };
    }
  }

  const response = await doInvoke(headers);

  const { data, error } = response || {};

  const hasAuthHeader = !!headers?.Authorization || !!headers?.authorization;

  if (error?.context?.status === 401 && hasAuthHeader) {
    const sent = String(headers.Authorization || headers.authorization || "");
    const sentToken = sent.startsWith("Bearer ") ? sent.slice("Bearer ".length) : "";

    async function retryWithLatestToken() {
      const latestToken = localStorage.getItem("session") || "";
      if (!latestToken) return null;
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
      return null;
    }

    try {
      if (sentToken) {
        let retryRes = await retryWithLatestToken();
        if (!retryRes) {
          await new Promise((r) => setTimeout(r, 80));
          retryRes = await retryWithLatestToken();
        }
        if (retryRes) return retryRes;
      }
    } catch {
      /* ignore */
    }

    const revokeToken =
      localStorage.getItem("session") ||
      (sentToken && sentToken.length > 0 ? sentToken : "");
    if (revokeToken) {
      void invokeFn(
        "logout",
        {
          body: { session_token: revokeToken },
          headers: { Authorization: `Bearer ${revokeToken}` },
        },
        { withAuth: false }
      );
    }
    localStorage.removeItem("session");
    emitSessionInvalidated();
    if (window.location.pathname !== "/login") {
      window.location.href = "/login";
    }
    return { data: null, error };
  }

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

// Keep supabase export usable for storage/auth elsewhere
export { supabase };
