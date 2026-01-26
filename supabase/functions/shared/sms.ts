// supabase/functions/shared/sms.ts

export async function sendSMS(to: string, message: string) {
  const provider = Deno.env.get("SMS_PROVIDER") || "twilio";

  switch (provider) {
    case "twilio":
      return sendViaTwilio(to, message);

    case "africastalking":
      return sendViaAfricasTalking(to, message);

    default:
      throw new Error("UNKNOWN_SMS_PROVIDER");
  }
}

/* ---------------- TWILIO ---------------- */

async function sendViaTwilio(to: string, message: string) {
  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  const from = Deno.env.get("TWILIO_FROM");

  if (!accountSid || !authToken || !from) {
    throw new Error("TWILIO_CONFIG_MISSING");
  }

  const url =
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

  const credentials = btoa(`${accountSid}:${authToken}`);

  const body = new URLSearchParams({
    To: to,
    From: from,
    Body: message,
  });

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const result = await res.json();

  if (!res.ok) {
    console.error("Twilio error:", result);
    throw new Error("TWILIO_SMS_FAILED");
  }

  return {
    provider: "twilio",
    sid: result.sid,
  };
}

/* -------- FUTURE: AFRICAS TALKING -------- */

async function sendViaAfricasTalking(to: string, message: string) {
  throw new Error("NOT_IMPLEMENTED");
}