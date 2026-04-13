// supabase/shared/logaudit.ts
// ----------------------------------
//  AUDIT LOG FUNCTION
// ----------------------------------
export async function logAudit(
  {
    supabase,
    event,
    user_id,
    channel = null,
    success,
    diag,
    req,
    actor_user_id = null,
    target_user_id = null,
    severity = null,
    metadata = null,
  }
) {
  const ip =
    req.headers.get("x-forwarded-for") ||
    req.headers.get("cf-connecting-ip") ||
    "unknown";

  const ua = req.headers.get("user-agent") || "unknown";
  const requestId =
    req.headers.get("x-request-id") ||
    req.headers.get("cf-ray") ||
    req.headers.get("x-vercel-id") ||
    null;

  await supabase.from("audit_logs").insert({
    event,
    user_id,
    channel,
    ip_address: ip,
    user_agent: ua,
    success,
    diag,
    actor_user_id,
    target_user_id,
    severity,
    metadata,
    request_id: requestId,
  });
}