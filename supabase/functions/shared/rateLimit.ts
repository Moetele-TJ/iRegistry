// 📁 supabase/functions/shared/rateLimit.ts

export async function checkRateLimit(
  supabase: any,
  {
    ip,
    action,
    limit,
    windowSeconds,
  }: {
    ip: string;
    action: string;
    limit: number;
    windowSeconds: number;
  }
) {
  const since = new Date(
    Date.now() - windowSeconds * 1000
  ).toISOString();

  const { count, error } = await supabase
    .from("request_attempts")
    .select("id", { count: "exact", head: true })
    .eq("ip", ip)
    .eq("action", action)
    .gte("created_at", since);

  if (error) {
    console.error("Rate limit check failed:", error);
    return true; // fail-open so system doesn't break
  }

  return count < limit;
}

export async function recordAttempt(
  supabase: any,
  {
    ip,
    action,
  }: {
    ip: string;
    action: string;
  }
) {
  const { error } = await supabase
    .from("request_attempts")
    .insert({
      ip,
      action,
    });

  if (error) {
    console.error("Rate limit record failed:", error);
  }
}