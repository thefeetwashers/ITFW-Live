import { NextResponse } from "next/server";
import { isEmailConfigured, sendEmail } from "@/lib/email";

// POST /api/byo/test-send — test-send to the professional's OWN
// email/phone only, after they connect their own provider account.
// NEVER to a client. For provider "aws_ses" the platform AWS SES
// sender (src/lib/email.ts) is used for the test send to the
// professional's own address. Other providers are NOT LIVE: Twilio /
// the professional's own Resend account are not connected and no
// sending SDK for them is installed, so those return 501
// "not configured" and send nothing. No key is accepted here and
// no key is ever logged.
const PROVIDER_ENVS: Record<string, string[]> = {
  resend: ["RESEND_API_KEY"],
  aws_ses: ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"],
  twilio: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_PHONE_NUMBER"],
  whatsapp_business: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_WHATSAPP_NUMBER"],
  google_translate: ["GOOGLE_TRANSLATE_API_KEY"],
  stripe_own: ["STRIPE_SECRET_KEY"],
};

export async function POST(req: Request) {
  let body: { provider?: unknown; ownEmail?: unknown; ownPhone?: unknown } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body.", status: "not_configured" }, { status: 400 });
  }
  const provider = typeof body.provider === "string" ? body.provider : "";
  const ownEmail = typeof body.ownEmail === "string" ? body.ownEmail : "";
  const ownPhone = typeof body.ownPhone === "string" ? body.ownPhone : "";
  if (!provider || !(provider in PROVIDER_ENVS)) {
    return NextResponse.json({ error: "provider must be one of: resend, aws_ses, twilio, whatsapp_business, google_translate, stripe_own.", status: "not_configured" }, { status: 400 });
  }
  if (!ownEmail && !ownPhone) {
    return NextResponse.json({ error: "Test-send goes only to your OWN email/phone — provide your own contact first. Never to a client.", status: "not_configured" }, { status: 400 });
  }
  // Platform SES test send — to the professional's OWN email only.
  if (provider === "aws_ses") {
    if (!ownEmail) {
      return NextResponse.json({ error: "AWS SES test-send needs your OWN email address — provide ownEmail. Never a client address.", status: "not_configured" }, { status: 400 });
    }
    if (!isEmailConfigured()) {
      const missing = PROVIDER_ENVS.aws_ses.filter((n) => !process.env[n]);
      return NextResponse.json(
        { error: `aws_ses test-send not configured — the platform AWS SES sender is not connected (missing env: ${missing.join(", ")}). Nothing was sent, including to your own contact.`, status: "not_configured", provider, missing },
        { status: 501 }
      );
    }
    const result = await sendEmail({
      to: ownEmail,
      subject: "Immigration with NIPTEI — test email",
      text: "This is a test email from Immigration with NIPTEI, sent through AWS SES to your own address. No client was contacted.",
    });
    if (!result.ok) {
      return NextResponse.json(
        { error: `Test email could not be sent. ${result.error}`, status: "failed", provider, code: result.code },
        { status: 502 }
      );
    }
    return NextResponse.json(
      { ok: true, status: "sent", provider, to: "own_email", messageId: result.messageId },
      { status: 200 }
    );
  }
  const missing = PROVIDER_ENVS[provider].filter((n) => !process.env[n]);
  return NextResponse.json(
    {
      error: `${provider} test-send not configured — your own account is not connected (missing env: ${missing.join(", ") || "none — sending SDK not installed"}). Nothing was sent, including to your own contact.`,
      status: "not_configured",
      provider,
      missing,
    },
    { status: 501 }
  );
}
