//supabase/shared/respond.ts
export function respond(
  payload: unknown,
  corsHeaders: HeadersInit,
  status = 200
) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: new Headers({
      ...corsHeaders,
      "Content-Type": "application/json",
    }),
  });
}