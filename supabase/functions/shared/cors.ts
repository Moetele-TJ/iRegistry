// supabase/functions/shared/cors.ts
export function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") ?? "";

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "authorization, content-type, apikey, x-client-info",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}