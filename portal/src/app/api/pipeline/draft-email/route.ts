// POST /api/pipeline/draft-email — send a missing-document email the
// professional has already reviewed.
//
// The draft is built by the pipeline UI from the 7-language templates
// (lib/pipeline.ts buildMissingDocDraft) and shown to the professional
// FIRST. This route re-builds the same draft server-side from the
// posted fields (never trusting a client-supplied body), checks the
// legal-content gate, and sends it ONCE via the platform AWS SES
// sender (lib/email.ts). Delivery status is recorded in
// notification_logs (migration 0010: case_id, channel 'email',
// stage_key 'missing_document', language, status sent / failed /
// not_configured, sent_at). The message BODY is never logged —
// notification_logs has no body column, by design.
//
// When SES is not configured the route returns 501 / not_configured,
// sends NOTHING, and records the attempt as not_configured (best
// effort). A draft with legal content that no licensed attorney has
// reviewed is refused with 400 and never sent.
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildMissingDocDraft } from "@/lib/pipeline";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import type { LanguageCode } from "@/lib/i18n";

export const runtime = "nodejs";

const LANGUAGE_CODES: readonly string[] = ["en", "es", "ht", "fr", "pt", "zh", "ar"];

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const caseId = typeof body.caseId === "string" ? body.caseId.trim() : "";
  const to = typeof body.to === "string" ? body.to.trim() : "";
  const clientName = typeof body.clientName === "string" ? body.clientName.trim() : "";
  const service = typeof body.service === "string" ? body.service.trim() : "";
  const missingDocuments = Array.isArray(body.missingDocuments)
    ? (body.missingDocuments as unknown[]).filter((d): d is string => typeof d === "string" && d.trim() !== "")
    : [];
  const languageRaw = typeof body.language === "string" ? body.language : "en";
  const language: LanguageCode = LANGUAGE_CODES.includes(languageRaw)
    ? (languageRaw as LanguageCode)
    : "en";
  const legalContent = body.legalContent === true;
  const attorneyReviewed = body.attorneyReviewed === true;

  if (!caseId) return NextResponse.json({ error: "caseId is required." }, { status: 400 });
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return NextResponse.json({ error: "A valid recipient email (to) is required." }, { status: 400 });
  }
  if (!clientName) return NextResponse.json({ error: "clientName is required." }, { status: 400 });
  if (missingDocuments.length === 0) {
    return NextResponse.json(
      { error: "No missing documents were listed — there is nothing to chase." },
      { status: 400 }
    );
  }

  // Re-build the draft server-side; the client never supplies the body.
  const draft = buildMissingDocDraft({
    clientName,
    clientEmail: to,
    service: service || "your case",
    missingDocuments,
    language,
    caseId,
    legalContent,
    attorneyReviewed,
  });
  if (!draft.sendable) {
    return NextResponse.json(
      { error: draft.blockedReason ?? "This draft cannot be sent yet.", labels: draft.labels },
      { status: 400 }
    );
  }

  // Record the outcome in notification_logs (best effort — the table
  // may not exist live yet if migration 0010 has not run).
  const logAttempt = async (status: "sent" | "failed" | "not_configured"): Promise<void> => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return;
    try {
      const admin = createClient(url, key, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      await admin.from("notification_logs").insert({
        case_id: caseId,
        channel: "email",
        stage_key: "missing_document",
        language,
        status,
        ...(status === "sent" ? { sent_at: new Date().toISOString() } : {}),
      });
    } catch {
      // Logging must never block or mask the send result.
    }
  };

  if (!isEmailConfigured()) {
    await logAttempt("not_configured");
    return NextResponse.json(
      {
        error:
          "Email sending is not connected (AWS SES not configured), so no email was sent. The draft was not lost — it is still shown in the pipeline; configure SES and send it again.",
        notConfigured: true,
        status: "not_configured",
        draft: { subject: draft.subject, labels: draft.labels },
      },
      { status: 501 }
    );
  }

  const result = await sendEmail({ to, subject: draft.subject, text: draft.body });
  if (!result.ok) {
    await logAttempt("failed");
    return NextResponse.json(
      {
        error: `SES did not send the email: ${result.error} No email was sent.`,
        status: "failed",
        code: result.code,
      },
      { status: 502 }
    );
  }

  await logAttempt("sent");
  return NextResponse.json({
    ok: true,
    status: "sent",
    messageId: result.messageId,
    to,
    subject: draft.subject,
    labels: draft.labels,
  });
}
