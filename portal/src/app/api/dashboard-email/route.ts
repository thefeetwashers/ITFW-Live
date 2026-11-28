// GET /api/dashboard-email — the in-dashboard email composer.
//   Lists every template the composer offers (16 drafted emails +
//   16 cover letters), the sender sources, and whether platform SES
//   is configured. No PII, no send.
//
// POST /api/dashboard-email — compose + send ONE email to the client
// from inside the dashboard:
//   { caseId, professionalId?, senderSource?, templateId?,
//     subject?, body?, vars?, language?, confirmAttorneyReview?,
//     previewOnly?, saveDraft? }
//   * templateId (draft email) → rendered server-side from
//     draftedEmails.ts; templateId "cover_letter:..." → rendered
//     from coverLetters.ts. A free-form compose (subject + body, no
//     templateId) is also accepted — the founder / professional types
//     the email themselves.
//   * The professional's edited subject/body wins over the render.
//   * senderSource "platform_ses" (default) sends via platform AWS
//     SES (src/lib/email.ts). "byo_resend" / "byo_aws_ses" send via
//     the professional's OWN connected email — only when their
//     provider_settings row says connected + test passed. There is no
//     live key-vault decrypt path in this build, so a BYO send that
//     reaches the send step returns 501 / not_configured honestly
//     (the key reference is never decrypted here, never logged, and
//     no email is claimed sent). The honest BYO wiring is: connect +
//     test in BYO settings, then the vault-backed send path (a later
//     build) uses the same provider_settings row.
//   * SES not configured → email "not_configured", in-app copy still
//     lands, 501-style honest response (status 200 with deliveries
//     saying so — mirroring POST /api/case-status/draft-email — is
//     NOT used here: a send that delivered nothing by email returns
//     ok:false with the per-channel reasons, so the UI never shows a
//     success it did not earn). previewOnly → render only, send
//     nothing, store nothing. saveDraft → store the draft in
//     dashboard_email_drafts (migration 0034), send nothing.
//   * Legal-content templates / cover letters REQUIRE
//     confirmAttorneyReview: true.
//   * Subjects / bodies containing an A-Number or SSN pattern, an
//     approval promise, or an explicit sensitive field are rejected
//     with 400. DOB / A-Number / SSN / passport numbers are never in
//     subjects, never logged, and the message body is never written
//     to notification_logs (that table has no body column, by design).
import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import {
  ATTORNEY_REVIEW_LABEL,
  getDraftTemplate,
  renderDraft,
  type DraftVars,
} from "@/lib/draftedEmails";
import {
  composerTemplateKind,
  listComposerTemplates,
  resolveSenderSource,
  SENDER_SOURCE_LABELS,
  validateComposerInput,
  type ByoProviderState,
  type EmailSenderSource,
} from "@/lib/dashboardEmail";
import { renderCoverLetter } from "@/lib/coverLetters";
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

const SENSITIVE_FIELDS = ["aNumber", "a_number", "alienRegistrationNumber", "ssn", "dateOfBirth", "dob", "passportNumber", "passport_number"];

const LANGUAGE_CODES: readonly LanguageCode[] = ["en", "es", "ht", "fr", "pt", "zh", "ar"];

const SENDER_SOURCES: readonly EmailSenderSource[] = ["platform_ses", "byo_resend", "byo_aws_ses"];

export async function GET() {
  return NextResponse.json({
    templates: listComposerTemplates(),
    senderSources: SENDER_SOURCES.map((s) => ({ id: s, label: SENDER_SOURCE_LABELS[s] })),
    platformSesConfigured: isEmailConfigured(),
    platformSesNote: isEmailConfigured()
      ? "Platform email (AWS SES) is configured."
      : "Platform email (AWS SES) is not configured — sends will return not_configured and nothing will be sent.",
    byoNote:
      "Your own email (BYO Resend / BYO SES) sends only when your provider_settings row says connected and its test-send passed. There is no live key-vault send path in this build, so a BYO send returns not_configured honestly until the vault-backed send path lands.",
    attorneyReviewLabel: ATTORNEY_REVIEW_LABEL,
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
  if (!caseId) return NextResponse.json({ ok: false, error: "caseId is required." }, { status: 400 });
  const previewOnly = body.previewOnly === true;
  const saveDraft = body.saveDraft === true && !previewOnly;

  const templateId = typeof body.templateId === "string" ? body.templateId : "";
  const kind = templateId ? composerTemplateKind(templateId) : null;
  if (templateId && !kind) {
    return NextResponse.json({ ok: false, error: `Unknown template: ${templateId}.` }, { status: 400 });
  }
  const needsAttorneyReview =
    kind === "cover_letter" ||
    (kind === "draft_email" && (getDraftTemplate(templateId)?.needsAttorneyReview ?? false));
  if (needsAttorneyReview && !previewOnly && body.confirmAttorneyReview !== true) {
    return NextResponse.json(
      {
        ok: false,
        error: `${ATTORNEY_REVIEW_LABEL} — confirm a licensed attorney has reviewed this draft before sending (pass confirmAttorneyReview: true).`,
        attorneyReviewLabel: ATTORNEY_REVIEW_LABEL,
      },
      { status: 400 }
    );
  }

  const senderSource: EmailSenderSource =
    typeof body.senderSource === "string" &&
    (SENDER_SOURCES as readonly string[]).includes(body.senderSource)
      ? (body.senderSource as EmailSenderSource)
      : "platform_ses";
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
        templateId: templateId || null,
        deliveries: [
          { channel: "portal_chat", status: "not_configured", detail: "Supabase is not connected — the draft cannot be stored in the thread." },
          { channel: "email", status: "not_configured", detail: "Supabase is not connected — the client could not be loaded." },
        ] satisfies ChannelDelivery[],
        error: "Dashboard email not configured — Supabase is not connected. Nothing was stored and nothing was sent.",
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
  const formLabel =
    (body.vars as Partial<DraftVars> | undefined)?.form ??
    forms[0] ??
    "Immigration with NIPTEI";

  // Render the draft server-side; the client never supplies the body
  // for a template. A free-form compose supplies subject + body.
  let subject = "";
  let text = "";
  let attorneyReviewLabel: string | null = needsAttorneyReview ? ATTORNEY_REVIEW_LABEL : null;
  let translationNote: string | null = null;
  if (kind === "draft_email") {
    const vars: DraftVars = {
      firstName: "",
      ...((body.vars as Partial<DraftVars> | undefined) ?? {}),
    };
    const { draft, error: renderError } = renderDraft(
      templateId,
      { ...vars, firstName: firstNameOf(clientFullName) || vars.firstName || "", form: formLabel },
      clientLanguage
    );
    if (!draft || renderError) {
      return NextResponse.json({ ok: false, error: renderError ?? "Could not render the draft." }, { status: 400 });
    }
    subject = draft.subject;
    text = draft.body;
    translationNote = draft.translationNote;
  } else if (kind === "cover_letter") {
    const formCodes =
      templateId === "cover_letter:family-adjustment"
        ? ["I-130", "I-485", "I-130A", "I-864", "I-765", "I-131", "I-693"]
        : templateId.replace("cover_letter:", "").split("+").filter(Boolean);
    const { letter, error: letterError } = renderCoverLetter({
      formCodes,
      clientName: clientFullName || null,
      preparerName: typeof body.preparerName === "string" ? body.preparerName : null,
      govPaymentMethod: typeof body.govPaymentMethod === "string" ? body.govPaymentMethod : null,
    });
    if (!letter || letterError) {
      return NextResponse.json({ ok: false, error: letterError ?? "Could not render the cover letter." }, { status: 400 });
    }
    subject = letter.subject;
    text = letter.body;
  }
  // The professional's edit wins over the rendered draft.
  if (typeof body.subject === "string" && body.subject.trim()) subject = body.subject.trim();
  if (typeof body.body === "string" && body.body.trim()) text = body.body;
  const validation = validateComposerInput({ subject, body: text });
  if (!validation.ok) {
    return NextResponse.json({ ok: false, error: validation.error }, { status: 400 });
  }
  if (containsSensitiveIdentifier(subject) || containsSensitiveIdentifier(text)) {
    return NextResponse.json(
      { ok: false, error: "The draft contains an A-Number or SSN pattern. Remove it and retry — those identifiers are never sent or logged." },
      { status: 400 }
    );
  }

  const professionalId =
    typeof body.professionalId === "string" && UUID_RE.test(body.professionalId)
      ? body.professionalId
      : undefined;

  if (previewOnly) {
    return NextResponse.json({
      ok: true,
      previewOnly: true,
      caseId,
      clientId,
      templateId: templateId || null,
      subject,
      body: text,
      attorneyReviewLabel,
      translationNote,
      note: "Preview only — nothing was sent and nothing was stored.",
    });
  }

  if (saveDraft) {
    const { data: draftRow, error: draftError } = await supabase
      .from("dashboard_email_drafts")
      .insert({
        case_id: caseId,
        professional_id: professionalId ?? null,
        template_id: templateId || null,
        sender_source: senderSource,
        subject,
        body: text,
        status: "draft",
      })
      .select("id")
      .single();
    if (draftError || !draftRow?.id) {
      return NextResponse.json(
        { ok: false, error: `Draft could not be saved: ${draftError?.message ?? "unknown error"}` },
        { status: 500 }
      );
    }
    return NextResponse.json({
      ok: true,
      savedDraftId: draftRow.id,
      caseId,
      templateId: templateId || null,
      subject,
      note: "Draft saved — nothing was sent.",
    });
  }

  // Resolve the sender source. BYO needs a connected + tested
  // provider_settings row for this professional.
  let byo: ByoProviderState | null = null;
  if (senderSource !== "platform_ses" && professionalId) {
    const { data: profile } = await supabase
      .from("professional_profiles")
      .select("id")
      .eq("account_id", professionalId)
      .single();
    if (profile?.id) {
      const { data: setting } = await supabase
        .from("provider_settings")
        .select("provider_key, status, test_status, key_last4")
        .eq("profile_id", profile.id)
        .eq("provider_key", senderSource === "byo_resend" ? "resend" : "aws_ses")
        .single();
      if (setting) {
        byo = {
          providerKey: setting.provider_key as "resend" | "aws_ses",
          status: setting.status as "connected" | "not_connected",
          testStatus: setting.test_status as ByoProviderState["testStatus"],
          keyLast4: (setting.key_last4 as string | null) ?? null,
        };
      }
    }
  }
  const resolved = resolveSenderSource({ requested: senderSource, byo });

  const deliveries: ChannelDelivery[] = [];
  const warnings: string[] = [];
  let messageId: string | null = null;
  let emailStatus: DeliveryStatus = "not_configured";
  let emailDetail = "";
  let providerMessageId: string | null = null;
  const providerLabel =
    resolved.source === "platform_ses"
      ? "aws_ses"
      : resolved.source === "byo_resend"
        ? "byo_resend"
        : "byo_aws_ses";

  // In-app copy first — it lands even when email is not configured.
  if (professionalId) {
    const inApp = await insertCaseThreadMessage(supabase, {
      caseId,
      senderId: professionalId,
      senderRole: "preparer",
      recipientId: clientId,
      recipientRole: "client",
      body: text,
      language: clientLanguage,
    });
    messageId = inApp.messageId;
    if (inApp.ok) {
      deliveries.push({ channel: "portal_chat", status: "sent", detail: "Email is in the client's portal thread." });
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
  } else if (!resolved.usable) {
    emailDetail = resolved.reason ?? "Email sender is not configured. Nothing was sent by email.";
  } else if (resolved.source !== "platform_ses") {
    // BYO connected + tested, but there is no live key-vault send path
    // in this build: the key lives only as an encrypted vault
    // reference, and this route never decrypts it. Honest 501-equivalent.
    emailStatus = "not_configured";
    emailDetail =
      "Your own email is connected and tested, but the vault-backed BYO send path is not live in this build — the key is stored only as an encrypted vault reference and this route never decrypts it. Nothing was sent by email; use platform SES for now, or wait for the BYO send path.";
    deliveries.push({ channel: "email", status: emailStatus, detail: emailDetail });
  } else if (!isEmailConfigured()) {
    emailDetail = "Email not configured — AWS SES is not connected. Nothing was sent by email; the in-app copy above still landed.";
  } else {
    const result = await sendEmail({ to: clientEmail, subject, text });
    if (result.ok) {
      emailStatus = "sent";
      providerMessageId = result.messageId;
      emailDetail = "Email sent via AWS SES.";
    } else {
      emailStatus = "failed";
      emailDetail = result.error;
    }
    deliveries.push({ channel: "email", status: emailStatus, detail: emailDetail });
  }
  if (resolved.source !== "platform_ses" && !deliveries.some((d) => d.channel === "email")) {
    deliveries.push({ channel: "email", status: emailStatus, detail: emailDetail });
  }
  if (messageId) {
    await recordEmailSend(supabase, {
      messageId,
      status: emailStatus,
      providerMessageId,
      errorMessage: emailStatus === "sent" ? null : emailDetail,
      provider: providerLabel,
    });
  }
  const { error: logError } = await supabase.from("notification_logs").insert({
    case_id: caseId,
    recipient_account_id: clientId,
    channel: "email",
    stage_key: `dashboard_email:${templateId || "free_form"}`,
    language: clientLanguage,
    status: emailStatus,
    sent_at: emailStatus === "sent" ? new Date().toISOString() : null,
  });
  if (logError) warnings.push(`Email delivery could not be logged to notification_logs: ${logError.message}`);
  try {
    await supabase.from("audit_log").insert({
      actor_id: professionalId ?? null,
      actor_role: "preparer",
      action: "dashboard_email_sent",
      entity_type: "case",
      entity_id: caseId,
      case_id: caseId,
      detail: {
        template: templateId || "free_form",
        sender_source: resolved.source,
        language: clientLanguage,
        attorney_review_required: needsAttorneyReview,
        attorney_review_confirmed: needsAttorneyReview ? true : null,
        email: emailStatus,
        portal_chat: deliveries.find((d) => d.channel === "portal_chat")?.status ?? "not_configured",
      },
    });
  } catch {
    // Audit logging is best-effort.
  }

  const delivered = deliveries.some((d) => d.status === "sent");
  return NextResponse.json({
    ok: delivered,
    caseId,
    clientId,
    templateId: templateId || null,
    senderSource: resolved.source,
    subject,
    attorneyReviewLabel,
    translationNote,
    deliveries,
    warnings,
    ...(delivered
      ? {}
      : { error: "Nothing was delivered — see deliveries for the per-channel reason." }),
  });
}
