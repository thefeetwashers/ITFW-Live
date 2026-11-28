import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import { insertCaseThreadMessage, UUID_RE } from "@/lib/caseStatusSync";

// POST /api/messages/send — Unified Thread send endpoint.
// One thread per case; every message is stored in messages (0001)
// with sender, role, channel, original language + original text +
// English translation, timestamp, and delivery status
// (queued / sent / failed / not_configured — see 0014 message_sends).
//
// NOT LIVE: nothing is actually sent by this route today, except the
// portal_chat channel, which stores the message in the unified thread
// (messages + message_sends) once Supabase is configured and a sender
// account id is given — wired by the case-status sync build
// (src/lib/caseStatusSync.ts insertCaseThreadMessage).
//  * Portal Chat needs Supabase (messages table) — not configured in
//    this build, so it returns 501 when Supabase is absent, or when no
//    senderId (accounts.id UUID) is given.
//  * SMS / WhatsApp need the professional's OWN Twilio account
//    (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER /
//    TWILIO_WHATSAPP_NUMBER) — not connected, so they return 501 with
//    delivery_status "not_configured".
//  * Email sends through the platform AWS SES sender (src/lib/email.ts)
//    — not connected until AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY
//    are set, so it returns 501 "not_configured".
// The route NEVER claims a message was sent when it was not.
// No A-Numbers in messages: any payload containing one is rejected
// with 400 (same rule as /api/notify-stage).
const A_NUMBER_PATTERN = /\bA-?\d{8,9}\b/;

type Channel = "portal_chat" | "sms" | "whatsapp" | "email";

function missingEnvs(names: string[]): string[] {
  return names.filter((n) => !process.env[n]);
}

export async function POST(req: Request) {
  let body: { caseId?: unknown; channel?: unknown; body?: unknown; phone?: unknown; email?: unknown; senderRole?: unknown; senderId?: unknown } = {};
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
    return NextResponse.json({ error: "Enter an email address first — email sends through the platform AWS SES sender, never from a personal email.", deliveryStatus: "not_configured" }, { status: 400 });
  }

  // Participant check happens in the database (RLS: is_case_participant
  // + 0014 student policies) once Supabase is live. Without Supabase
  // there is no participant list to check against, so nothing is stored
  // and nothing is sent.
  if (channel === "portal_chat") {
    const supabase = getSupabase();
    if (!supabase) {
      return NextResponse.json(
        { error: "Portal Chat not configured — Supabase is not connected, so the message cannot be stored in the messages table. Nothing was sent.", deliveryStatus: "not_configured", caseId, channel },
        { status: 501 }
      );
    }
    // Wired by the case-status sync build (src/lib/caseStatusSync.ts):
    // with a real sender account id, the message is stored in the
    // unified thread (messages + message_sends, portal_chat / sent).
    // Without one there is no sender_id to store, so nothing is stored.
    const senderId = typeof body.senderId === "string" ? body.senderId : "";
    const senderRole =
      typeof body.senderRole === "string" ? body.senderRole : "preparer";
    if (!senderId || !UUID_RE.test(senderId)) {
      return NextResponse.json(
        { error: "Portal Chat needs a sender account id (senderId, an accounts.id UUID) — without it the message cannot be stored in the messages table. Nothing was sent.", deliveryStatus: "not_configured", caseId, channel },
        { status: 501 }
      );
    }
    if (!["client", "preparer", "attorney", "nonprofit", "admin"].includes(senderRole)) {
      return NextResponse.json({ error: "senderRole must be client, preparer, attorney, nonprofit, or admin.", deliveryStatus: "failed" }, { status: 400 });
    }
    const { data: caseRow, error: caseError } = await supabase
      .from("cases")
      .select("id, client_id, assigned_provider_id")
      .eq("id", caseId)
      .single();
    if (caseError || !caseRow) {
      return NextResponse.json({ error: `Case not found: ${caseError?.message ?? caseId}`, deliveryStatus: "failed", caseId, channel }, { status: 404 });
    }
    const recipientId =
      senderRole === "client"
        ? ((caseRow as { assigned_provider_id?: string | null }).assigned_provider_id ?? null)
        : (caseRow.client_id as string);
    if (!recipientId) {
      return NextResponse.json({ error: "No recipient on this case yet — the case has no assigned provider (client sender) or no client. Nothing was sent.", deliveryStatus: "failed", caseId, channel }, { status: 400 });
    }
    const stored = await insertCaseThreadMessage(supabase, {
      caseId,
      senderId,
      senderRole: senderRole as "client" | "preparer" | "attorney" | "nonprofit" | "admin",
      recipientId,
      recipientRole: senderRole === "client" ? "preparer" : "client",
      body: text,
    });
    if (!stored.ok) {
      return NextResponse.json({ error: `Portal Chat message could not be stored: ${stored.error ?? "unknown error"}`, deliveryStatus: "failed", caseId, channel }, { status: 502 });
    }
    return NextResponse.json(
      { ok: true, deliveryStatus: "sent", caseId, channel, messageId: stored.messageId },
      { status: 200 }
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
  // Email channel: platform AWS SES sender (src/lib/email.ts).
  if (!isEmailConfigured()) {
    const sesMissing = ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"].filter(
      (n) => !process.env[n]
    );
    return NextResponse.json(
      { error: `Email not configured — the platform AWS SES sender is not connected (missing: ${sesMissing.join(", ")}). Message queued only, not sent.`, deliveryStatus: "not_configured", caseId, channel },
      { status: 501 }
    );
  }
  const result = await sendEmail({
    to: email as string,
    subject: "Immigration with NIPTEI — message about your case",
    text,
  });
  if (!result.ok) {
    return NextResponse.json(
      { error: `Email could not be sent. ${result.error}`, deliveryStatus: "failed", caseId, channel, code: result.code },
      { status: 502 }
    );
  }
  return NextResponse.json(
    { ok: true, deliveryStatus: "sent", caseId, channel, messageId: result.messageId },
    { status: 200 }
  );
}
