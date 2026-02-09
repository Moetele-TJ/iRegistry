// supabase/shared/email.ts

export async function sendEmail(
  to: string,
  otp: string
) {
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

  if (!RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY not configured");
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "iRegistry <no-reply@iregsys.com>",
      to,
      subject: "Your iRegistry OTP",
      html: `
        <p>Your iRegistry verification code is:</p>
        <h2>${otp}</h2>
        <p>This code expires in 5 minutes.</p>
      `,
    }),
  });

  if (!res.ok) {
    const error = await res.text();
    console.error("RESEND ERROR:", error);
    throw new Error(`Resend failed: ${error}`);
  }
}