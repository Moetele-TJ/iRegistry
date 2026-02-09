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
    req
  }
) {
  const ip =
    req.headers.get("x-forwarded-for") ||
    req.headers.get("cf-connecting-ip") ||
    "unknown";

  const ua = req.headers.get("user-agent") || "unknown";

  await supabase.from("audit_logs").insert({
    event,
    user_id,
    channel,
    ip_address: ip,
    user_agent: ua,
    success,
    diag
  });
}