import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

// POST /api/messages/send — Unified Thread send endpoint.
// One thread per case; every message is stored in messages (0001)
// with sender, role, channel, original language + original text +
// English translation, timestamp, and delivery status
// (queued / sent / failed / not_configured — see 0014 message_sends).
//
// NOT LIVE: nothing is actually sent by this route today.
//  * Portal Chat needs Supabase (messages table) — not configured in
//    this build, so it returns 501.
//  * SMS / WhatsApp need the professional's OWN Twilio account
//    (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER /
//    TWILIO_WHATSAPP_NUMBER) — not connected, so they return 501 with
//    delivery_status "not_configured".
//  * Email needs the professional's OWN Resend (RESEND_API_KEY) or AWS
//    SES account — not connected, so it returns 501 "not_configured".
// The route NEVER claims a message was sent when it was not.
// No A-Numbers in messages: any payload containing one is rejected
// with 400 (same rule as /api/notify-stage).
const A_NUMBER_PATTERN = /\bA-?\d{8,9}\b/;

type Channel = "portal_chat" | "sms" | "whatsapp" | "email";

function missingEnvs(names: string[]): string[] {
  return names.filter((n) => !process.env[n]);
}

export async function POST(req: Request) {
  let body: { caseId?: unknown; channel?: unknown; body?: unknown; phone?: unknown; email?: unknown; senderRole?: unknown } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body.", deliveryStatus: "failed" }, { status: 400 });
  }
  const caseId = typeof body.caseId === "string" ? body.caseId : "";
  const channel = (typeof body.channel === "string" ? body.channel : "") as Channel;
  const text = typeof body.body === "string" ? body.body : "";
  const phone = typeof body.phone === "string" ? body.phone : undefined;
  const email = typeof body.email === "string" ? body.email : undefined;
  if (!caseId || !text.trim()) {
    return NextResponse.json({ error: "caseId and body are required.", deliveryStatus: "failed" }, { status: 400 });
  }
  if (A_NUMBER_PATTERN.test(text)) {
    return NextResponse.json({ error: "A-Numbers must never be sent in a message.", deliveryStatus: "failed" }, { status: 400 });
  }
  if (!["portal_chat", "sms", "whatsapp", "email"].includes(channel)) {
    return NextResponse.json({ error: "channel must be portal_chat, sms, whatsapp, or email.", deliveryStatus: "failed" }, { status: 400 });
  }
  if ((channel === "sms" || channel === "whatsapp") && !phone) {
    return NextResponse.json({ error: "Enter a phone number first — SMS / WhatsApp sends through your own Twilio account, never from a personal phone.", deliveryStatus: "not_configured" }, { status: 400 });
  }
  if (channel === "email" && !email) {
    return NextResponse.json({ error: "Enter an email address first — email sends through your own Resend / AWS SES account, never from a personal email.", deliveryStatus: "not_configured" }, { status: 400 });
  }

  // Participant check happens in the database (RLS: is_case_participant
  // + 0014 student policies) once Supabase is live. Without Supabase
  // there is no participant list to check against, so nothing is stored
  // and nothing is sent.
  if (channel === "portal_chat") {
    if (!getSupabase()) {
      return NextResponse.json(
        { error: "Portal Chat not configured — Supabase is not connected, so the message cannot be stored in the messages table. Nothing was sent.", deliveryStatus: "not_configured", caseId, channel },
        { status: 501 }
      );
    }
    return NextResponse.json(
      { error: "Portal Chat storage is not wired yet — Supabase is configured but no message insert runs in this build. Nothing was sent.", deliveryStatus: "not_configured", caseId, channel },
      { status: 501 }
    );
  }
  if (channel === "sms") {
    const missing = missingEnvs(["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_PHONE_NUMBER"]);
    return NextResponse.json(
      { error: `SMS not configured — your own Twilio account is not connected (missing: ${missing.join(", ") || "none — SDK not installed"}). Message queued only, not sent.`, deliveryStatus: "not_configured", caseId, channel, missing },
      { status: 501 }
    );
  }
  if (channel === "whatsapp") {
    const missing = missingEnvs(["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_WHATSAPP_NUMBER"]);
    return NextResponse.json(
      { error: `WhatsApp not configured — your own Twilio / WhatsApp Business account is not connected (missing: ${missing.join(", ") || "none — SDK not installed; WhatsApp Business approval is also a separate step"}). Message queued only, not sent.`, deliveryStatus: "not_configured", caseId, channel, missing },
      { status: 501 }
    );
  }
  const resendMissing = missingEnvs(["RESEND_API_KEY"]);
  const sesMissing = missingEnvs(["AWS_SES_ACCESS_KEY_ID", "AWS_SES_SECRET_ACCESS_KEY", "AWS_SES_REGION"]);
  return NextResponse.json(
    { error: `Email not configured — your own Resend account (missing: ${resendMissing.join(", ") || "none — SDK not installed"}) and your own AWS SES account (missing: ${sesMissing.join(", ") || "none — SDK not installed"}) are both not connected. Message queued only, not sent.`, deliveryStatus: "not_configured", caseId, channel },
    { status: 501 }
  );
}
