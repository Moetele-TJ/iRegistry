// supabase/functions/shared/cors.ts

export function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") ?? "*";
  const requestHeaders =
    req.headers.get("access-control-request-headers") ??
    "authorization, content-type, apikey, x-client-info";

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": requestHeaders,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}