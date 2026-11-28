import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import {
  ATTORNEY_REVIEW_LABEL,
  getDraftTemplate,
  listDraftTemplates,
  renderDraft,
  type DraftVars,
} from "@/lib/draftedEmails";
import {
  UUID_RE,
  containsSensitiveIdentifier,
  firstNameOf,
  insertCaseThreadMessage,
  recordEmailSend,
  type ChannelDelivery,
  type DeliveryStatus,
} from "@/lib/caseStatusSync";
import type { LanguageCode } from "@/lib/i18n";

// GET /api/case-status/draft-email — list the draft templates
// (metadata only, no PII) for the professional's picker.
// POST /api/case-status/draft-email — one-click drafted email:
//   { caseId, templateId, vars?, subject?, body?, previewOnly?,
//     professionalId?, confirmAttorneyReview? }
//   * previewOnly: true → render the full draft, send NOTHING.
//   * otherwise the professional's edited subject/body (when given)
//     wins over the rendered draft, SES sends it, an in-app copy is
//     stored in the thread, and delivery is recorded per channel
//     (notification_logs for email, message_sends for both channels).
//   * Legal-content templates (needsAttorneyReview) are labelled
//     "Draft — for a licensed attorney to review before sending" and
//     REQUIRE confirmAttorneyReview: true before they send.
//   * SES not configured → email "not_configured", in-app copy still
//     lands. Supabase not configured → 501, nothing stored/sent.
//   * Subjects / bodies containing an A-Number or SSN pattern, or an
//     explicit aNumber / ssn / dateOfBirth / passportNumber field,
//     are rejected with 400.
const SENSITIVE_FIELDS = ["aNumber", "a_number", "alienRegistrationNumber", "ssn", "dateOfBirth", "dob", "passportNumber", "passport_number"];

const LANGUAGE_CODES: readonly LanguageCode[] = ["en", "es", "ht", "fr", "pt", "zh", "ar"];

export async function GET() {
  return NextResponse.json({
    templates: listDraftTemplates(),
    attorneyReviewLabel: ATTORNEY_REVIEW_LABEL,
    note: "English first. Templates marked en_only_pending carry the label 'English only — translation pending'. The general document request reuses the existing 7-language missing-document nudge when it names exactly one document.",
  });
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }
  for (const f of SENSITIVE_FIELDS) {
    if (body[f] !== undefined) {
      return NextResponse.json(
        { ok: false, error: `Field "${f}" must never be sent here. DOB, A-Numbers, SSNs and passport numbers are never put in subjects or logs.` },
        { status: 400 }
      );
    }
  }
  const caseId = typeof body.caseId === "string" ? body.caseId : "";
  const templateId = typeof body.templateId === "string" ? body.templateId : "";
  if (!caseId) return NextResponse.json({ ok: false, error: "caseId is required." }, { status: 400 });
  const tpl = getDraftTemplate(templateId);
  if (!tpl) return NextResponse.json({ ok: false, error: `Unknown template: ${templateId}.` }, { status: 400 });
  const previewOnly = body.previewOnly === true;
  if (tpl.needsAttorneyReview && !previewOnly && body.confirmAttorneyReview !== true) {
    return NextResponse.json(
      {
        ok: false,
        error: `${ATTORNEY_REVIEW_LABEL} — confirm a licensed attorney has reviewed this draft before sending (pass confirmAttorneyReview: true).`,
        attorneyReviewLabel: ATTORNEY_REVIEW_LABEL,
      },
      { status: 400 }
    );
  }

  const vars: DraftVars = {
    firstName: "",
    ...((body.vars as Partial<DraftVars> | undefined) ?? {}),
  };
  const language: LanguageCode =
    typeof body.language === "string" && (LANGUAGE_CODES as readonly string[]).includes(body.language)
      ? (body.language as LanguageCode)
      : "en";

  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json(
      {
        ok: false,
        caseId,
        templateId,
        deliveries: [
          { channel: "portal_chat", status: "not_configured", detail: "Supabase is not connected — the draft cannot be stored in the thread." },
          { channel: "email", status: "not_configured", detail: "Supabase is not connected — the client could not be loaded." },
        ] satisfies ChannelDelivery[],
        error: "Drafted email not configured — Supabase is not connected. Nothing was stored and nothing was sent.",
      },
      { status: 501 }
    );
  }
  const { data: caseRow, error: caseError } = await supabase
    .from("cases")
    .select("id, client_id, forms")
    .eq("id", caseId)
    .single();
  if (caseError || !caseRow) {
    return NextResponse.json({ ok: false, error: `Case not found: ${caseError?.message ?? caseId}` }, { status: 404 });
  }
  const clientId = caseRow.client_id as string;
  const forms = (caseRow.forms as string[] | null) ?? [];
  const { data: client } = await supabase
    .from("accounts")
    .select("full_name, email, preferred_language, notification_preference")
    .eq("id", clientId)
    .single();
  const clientFullName = (client?.full_name as string | undefined) ?? "";
  const clientEmail = (client?.email as string | undefined) ?? undefined;
  const clientLanguage =
    (client?.preferred_language as LanguageCode | undefined) ?? language;
  const clientPreference = (client?.notification_preference as string | undefined) ?? "all";
  const formLabel = vars.form ?? forms[0] ?? "Immigration with NIPTEI";

  const { draft, error: renderError } = renderDraft(
    templateId,
    { ...vars, firstName: firstNameOf(clientFullName) || vars.firstName || "", form: formLabel },
    clientLanguage
  );
  if (!draft || renderError) {
    return NextResponse.json({ ok: false, error: renderError ?? "Could not render the draft." }, { status: 400 });
  }
  // The professional's edit wins over the rendered draft.
  const subject = typeof body.subject === "string" && body.subject.trim() ? body.subject.trim() : draft.subject;
  const text = typeof body.body === "string" && body.body.trim() ? body.body : draft.body;
  if (containsSensitiveIdentifier(subject) || containsSensitiveIdentifier(text)) {
    return NextResponse.json(
      { ok: false, error: "The draft contains an A-Number or SSN pattern. Remove it and retry — those identifiers are never sent or logged." },
      { status: 400 }
    );
  }

  if (previewOnly) {
    return NextResponse.json({
      ok: true,
      previewOnly: true,
      caseId,
      clientId,
      draft: { ...draft, subject, body: text },
      note: "Preview only — nothing was sent and nothing was stored.",
    });
  }

  const professionalId =
    typeof body.professionalId === "string" && UUID_RE.test(body.professionalId)
      ? body.professionalId
      : undefined;
  const deliveries: ChannelDelivery[] = [];
  const warnings: string[] = [];
  let messageId: string | null = null;
  let emailStatus: DeliveryStatus = "not_configured";
  let emailDetail = "";
  let sesMessageId: string | null = null;

  // In-app copy first — it lands even when email is not configured.
  if (professionalId) {
    const inApp = await insertCaseThreadMessage(supabase, {
      caseId,
      senderId: professionalId,
      senderRole: "preparer",
      recipientId: clientId,
      recipientRole: "client",
      body: text,
      language: draft.language,
    });
    messageId = inApp.messageId;
    if (inApp.ok) {
      deliveries.push({ channel: "portal_chat", status: "sent", detail: "Draft email is in the client's portal thread." });
    } else {
      deliveries.push({ channel: "portal_chat", status: "failed", detail: `In-app copy could not be stored: ${inApp.error ?? "unknown error"}` });
    }
    if (inApp.error) warnings.push(inApp.error);
  } else {
    deliveries.push({
      channel: "portal_chat",
      status: "not_configured",
      detail: "No professional account id (professionalId) was given, so the in-app copy could not be stored — the messages table needs a real sender.",
    });
  }

  const emailAllowed = clientPreference === "email" || clientPreference === "all";
  if (!clientEmail) {
    emailDetail = "No email address on file for the client. Nothing was sent by email.";
    warnings.push(emailDetail);
  } else if (!emailAllowed) {
    emailDetail = `Client chose ${clientPreference} notifications, so no email was sent. The in-app copy above is how they see this message.`;
  } else if (!isEmailConfigured()) {
    emailDetail = "Email not configured — AWS SES is not connected. Nothing was sent by email; the in-app copy above still landed.";
  } else {
    const result = await sendEmail({ to: clientEmail, subject, text });
    if (result.ok) {
      emailStatus = "sent";
      sesMessageId = result.messageId;
      emailDetail = "Email sent via AWS SES.";
    } else {
      emailStatus = "failed";
      emailDetail = result.error;
    }
  }
  deliveries.push({ channel: "email", status: emailStatus, detail: emailDetail });
  if (messageId) {
    await recordEmailSend(supabase, {
      messageId,
      status: emailStatus,
      providerMessageId: sesMessageId,
      errorMessage: emailStatus === "sent" ? null : emailDetail,
    });
  }
  const { error: logError } = await supabase.from("notification_logs").insert({
    case_id: caseId,
    recipient_account_id: clientId,
    channel: "email",
    stage_key: `draft_email:${templateId}`,
    language: draft.language,
    status: emailStatus,
    sent_at: emailStatus === "sent" ? new Date().toISOString() : null,
  });
  if (logError) warnings.push(`Email delivery could not be logged to notification_logs: ${logError.message}`);
  try {
    await supabase.from("audit_log").insert({
      actor_id: professionalId ?? null,
      actor_role: "preparer",
      action: "draft_email_sent",
      entity_type: "case",
      entity_id: caseId,
      case_id: caseId,
      detail: {
        template: templateId,
        language: draft.language,
        attorney_review_required: draft.needsAttorneyReview,
        attorney_review_confirmed: draft.needsAttorneyReview ? true : null,
        email: emailStatus,
        portal_chat: deliveries.find((d) => d.channel === "portal_chat")?.status ?? "not_configured",
      },
    });
  } catch {
    // Audit logging is best-effort.
  }

  return NextResponse.json({
    ok: true,
    caseId,
    clientId,
    templateId,
    subject,
    attorneyReviewLabel: draft.attorneyReviewLabel,
    translationNote: draft.translationNote,
    deliveries,
    warnings,
    ...(deliveries.some((d) => d.status === "sent")
      ? {}
      : { error: "Nothing was delivered — see deliveries for the per-channel reason." }),
  });
}
