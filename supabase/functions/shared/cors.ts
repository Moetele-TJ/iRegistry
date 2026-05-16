// supabase/functions/shared/cors.ts

const PRODUCTION_ORIGIN = "https://iregsys.com";

/** Origins allowed to call edge functions from the browser. */
const ALLOWED_ORIGIN_PATTERNS = [
  /^https:\/\/([a-z0-9-]+\.)?iregsys\.com$/i,
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
];

function isAllowedOrigin(origin: string): boolean {
  return ALLOWED_ORIGIN_PATTERNS.some((re) => re.test(origin));
}

/**
 * Resolve ACAO for credentialed CORS. Reflect known app origins; fall back to production
 * when Origin is missing or "null" (common on some mobile WebViews).
 */
export function resolveCorsOrigin(req: Request): string {
  const origin = req.headers.get("origin");
  if (origin && origin !== "null" && isAllowedOrigin(origin)) {
    return origin;
  }
  return PRODUCTION_ORIGIN;
}

export function getCorsHeaders(req: Request) {
  return {
    "Access-Control-Allow-Origin": resolveCorsOrigin(req),
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "authorization, content-type, apikey, x-client-info",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}
