import { NextResponse } from "next/server";

// POST /api/byo/test-send — test-send to the professional's OWN
// email/phone only, after they connect their own provider account.
// NEVER to a client. NOT LIVE: Twilio / Resend / AWS SES are not
// connected and no sending SDK is installed, so this always returns
// 501 "not configured" and sends nothing. No key is accepted here and
// no key is ever logged.
const PROVIDER_ENVS: Record<string, string[]> = {
  resend: ["RESEND_API_KEY"],
  aws_ses: ["AWS_SES_ACCESS_KEY_ID", "AWS_SES_SECRET_ACCESS_KEY", "AWS_SES_REGION"],
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
