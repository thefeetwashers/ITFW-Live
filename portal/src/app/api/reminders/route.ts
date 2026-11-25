import { NextResponse } from "next/server";

// Automated SMS & Email Reminder API — ROUTE + QUEUE LOGIC ONLY. NOT live.
// Sends automatic nudges in English, Spanish, or Haitian Creole when
// items or payments are due, every 48h until cleared, respecting the
// client's notification preference (see src/lib/nudges.ts shouldNudge,
// NUDGE_INTERVAL_HOURS = 48).
// Twilio + Resend/SendGrid are NOT connected, no keys in code.
// Env vars needed before this can send anything:
//   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER,
//   TWILIO_WHATSAPP_NUMBER, RESEND_API_KEY (or SENDGRID_API_KEY)
// (Canonical sender name is TWILIO_PHONE_NUMBER — see DEPLOY.md §2.
// The older name TWILIO_FROM_NUMBER means the same sender; do not set
// both names.)
// Until then this route returns 501 and sends nothing.
export async function POST() {
  return NextResponse.json(
    {
      error:
        "Reminder sending not configured — Twilio + an email provider (Resend/SendGrid) are not connected. Nudge logic + queue live in src/lib/nudges.ts and migration 0005 (reminder_nudges); nothing was sent.",
      intervalHours: 48,
      languages: ["en", "es", "ht"],
    },
    { status: 501 }
  );
}
