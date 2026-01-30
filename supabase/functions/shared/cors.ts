// supabase/shared/cors.ts
export function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") ?? "*";

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}