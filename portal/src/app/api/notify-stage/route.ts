import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import {
  getNotificationTemplate,
  renderTemplateText,
  PORTAL_URL,
  NOTIFICATION_SENDER,
  CONTACT_EMAIL,
  STAGE_KEYS,
  STAGE_NUMBERS,
  stageKeyForNumber,
  type NotificationStageKey,
} from "@/lib/notificationTemplates";
import type { LanguageCode } from "@/lib/i18n";
import {
  resolveChannels,
  maskContact,
  type NotifyRecipient,
  type NotifyTrigger,
  type NotificationChannel,
  type NotificationLogEntry,
  type NotificationStatus,
} from "@/lib/notify";

// Automated SMS / WhatsApp / Email Notification Engine — ROUTE + QUEUE
// LOGIC ONLY. NOT live. Nothing is actually sent by this route today.
//
// Env names only — NO keys in code:
//   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER,
//   TWILIO_WHATSAPP_NUMBER, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
// Email sends through the platform AWS SES sender (src/lib/email.ts).
// Until SES is set, the email channel returns 501 and sends nothing.
// SMS / WhatsApp are still logic-only (Twilio SDK not installed).
// This route NEVER claims a message was sent when it was not.
//
// Corrections vs the pasted draft (do not re-introduce them):
//  * Portal URL is https://immigration.niptei.com (NOT https://niptei.com).
//  * Sender is updates@niptei.com via AWS SES (platform sender,
//    src/lib/email.ts) — UNVERIFIED until the niptei.com domain
//    identity is verified in SES and the DKIM records are added in
//    IONOS. The real contact in every footer is nipteiapp@gmail.com.
//  * WhatsApp via Twilio needs WhatsApp Business approval — labelled
//    below; approval is a separate step from having the env vars.
//  * NO A-Numbers in messages. Any payload containing an A-Number
//    field is rejected with 400. Case/receipt numbers are rendered
//    ONLY for at_uscis + nvc_processing, in the body / SMS text —
//    never in an email subject. Case numbers belong in the portal
//    link, not in SMS subjects.
//
// Recipients: the caller passes the Primary Client AND all linked
// Family Members / Joint Sponsors (case_family_members, migration
// 0009), each in their own preferred_language. The route renders
// each recipient's message in that recipient's language.
//
// Logging: every attempted / skipped notification is logged as
// (recipient, language, channel, stage, status) — recipient is the
// account id when known, otherwise a MASKED contact (j***@… /
// ***-***-1234). Message bodies are NEVER logged in full (they
// contain PII). Persistence, in order:
//   1. notification_logs (migration 0010, by a parallel builder —
//      append-only, NO message-body column; status check allows
//      only 'sent' | 'failed' | 'not_configured', so skipped /
//      not-implemented entries cannot go here and fall through to 2).
//      NOTE: migration 0010 is an untracked file in this repo, NOT
//      yet applied live — the table may not exist in the live DB
//      yet, so the insert is best-effort and falls through on error.
//   2. audit_log (migration 0001) detail jsonb, when Supabase is
//      configured and the insert succeeds.
//   3. In-memory log returned in the response.
// Note the anon key normally cannot INSERT into audit_log (no INSERT
// policy for ordinary users, migration 0003), so the in-memory /
// returned log is the expected path until a service-role sender is built.

import { isEmailConfigured, sendEmail } from "@/lib/email";

const SMS_ENVS = ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_PHONE_NUMBER"];
const WHATSAPP_ENVS = [...SMS_ENVS, "TWILIO_WHATSAPP_NUMBER"];
// SES region + sender have defaults (us-east-1 / updates@niptei.com),
// so only the IAM credentials gate the email channel.
const EMAIL_ENVS = ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"];

const IN_MEMORY_LOG: NotificationLogEntry[] = [];
const MAX_MEMORY_LOG = 500;

function missingEnvs(names: string[]): string[] {
  return names.filter((n) => !process.env[n]);
}

function channelConfigured(channel: NotificationChannel): {
  configured: boolean;
  missing: string[];
} {
  const missing =
    channel === "email"
      ? missingEnvs(EMAIL_ENVS)
      : channel === "whatsapp"
        ? missingEnvs(WHATSAPP_ENVS)
        : missingEnvs(SMS_ENVS);
  return { configured: missing.length === 0, missing };
}

function recipientLabel(r: NotifyRecipient): string {
  if (r.id) return r.id;
  if (r.email) return maskContact(r.email);
  if (r.phone) return maskContact(r.phone);
  return `${r.role}:name-only`;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const LANGUAGE_CODES: readonly LanguageCode[] = [
  "en",
  "es",
  "ht",
  "fr",
  "pt",
  "zh",
  "ar",
];

function normalizeLanguage(value: unknown): LanguageCode {
  return typeof value === "string" &&
    (LANGUAGE_CODES as readonly string[]).includes(value)
    ? (value as LanguageCode)
    : "en";
}

/** Best-effort log persistence. Never throws; returns where it landed.
 *  notification_logs (0010) only accepts status sent/failed/
 *  not_configured and has no message-body column — skipped and
 *  not-implemented entries fall through to audit_log / memory. */
async function persistLogEntry(
  entry: NotificationLogEntry,
  caseId: string,
  recipient: NotifyRecipient
): Promise<"notification_logs" | "audit_log" | "memory"> {
  const supabase = getSupabase();
  const uuidOrNull = (v: string | undefined): string | null =>
    v && UUID_RE.test(v) ? v : null;
  if (
    supabase &&
    UUID_RE.test(caseId) &&
    (entry.status === "sent" ||
      entry.status === "failed" ||
      entry.status === "not_configured")
  ) {
    try {
      const { error } = await supabase.from("notification_logs").insert({
        case_id: caseId,
        recipient_account_id: uuidOrNull(recipient.id),
        recipient_family_member_id: uuidOrNull(recipient.familyMemberId),
        channel: entry.channel,
        stage_key: entry.stage,
        language: entry.language,
        status: entry.status,
        sent_at: entry.status === "sent" ? entry.attemptedAt : null,
      });
      if (!error) return "notification_logs";
    } catch {
      // Fall through to audit_log, then memory.
    }
  }
  if (supabase && UUID_RE.test(caseId)) {
    try {
      const { error } = await supabase.from("audit_log").insert({
        actor_id: null,
        actor_role: null,
        action: "notification_attempt",
        entity_type: "case",
        entity_id: caseId,
        case_id: caseId,
        detail: {
          stage: entry.stage,
          channel: entry.channel,
          language: entry.language,
          recipient_role: entry.recipientRole,
          recipient: entry.recipient,
          status: entry.status,
          reason: entry.reason,
        },
      });
      if (!error) return "audit_log";
    } catch {
      // Fall through to the in-memory log.
    }
  }
  IN_MEMORY_LOG.push(entry);
  if (IN_MEMORY_LOG.length > MAX_MEMORY_LOG) IN_MEMORY_LOG.shift();
  return "memory";
}

export async function POST(req: Request) {
  const warnings: string[] = [];
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  // A-Numbers must never be sent or logged.
  if (
    body.aNumber !== undefined ||
    body.alienRegistrationNumber !== undefined ||
    body.a_number !== undefined
  ) {
    return NextResponse.json(
      {
        error:
          "A-Numbers must never be sent in notifications. Remove the A-Number field and retry; see src/lib/agency.ts maskANumber.",
      },
      { status: 400 }
    );
  }

  const caseId = typeof body.caseId === "string" ? body.caseId : "";
  if (!caseId) {
    return NextResponse.json({ error: "caseId is required." }, { status: 400 });
  }

  // Stage: by key, by number 1-6, or derived from the agency trigger.
  let stage: NotificationStageKey | null = null;
  if (typeof body.stage === "string" && (STAGE_KEYS as readonly string[]).includes(body.stage)) {
    stage = body.stage as NotificationStageKey;
  } else if (typeof body.stageNumber === "number") {
    stage = stageKeyForNumber(body.stageNumber);
  }
  const trigger = (typeof body.trigger === "string" ? body.trigger : "stage_advance") as NotifyTrigger;
  const agency = typeof body.agency === "string" ? body.agency : undefined;
  if (!stage && trigger === "agency_number_added") {
    if (agency === "USCIS") stage = "at_uscis";
    else if (agency === "NVC") stage = "nvc_processing";
  }
  if (!stage) {
    return NextResponse.json(
      {
        error:
          "A valid stage is required: stage key (quote_sent, payment_plan, active_drafting, at_uscis, nvc_processing, visa_travel_closed), stageNumber 1-6, or trigger agency_number_added with agency USCIS/NVC.",
        stageNumbers: STAGE_NUMBERS,
      },
      { status: 400 }
    );
  }

  const recipients = Array.isArray(body.recipients)
    ? (body.recipients as NotifyRecipient[])
    : [];
  if (recipients.length === 0) {
    return NextResponse.json(
      {
        error:
          "recipients is required and must be a non-empty array: the Primary Client AND all linked Family Members / Joint Sponsors, each with name, language and notificationPreference.",
      },
      { status: 400 }
    );
  }
  for (const r of recipients) {
    if (!r || typeof r.name !== "string" || !r.name) {
      return NextResponse.json(
        { error: "Every recipient needs a name." },
        { status: 400 }
      );
    }
  }

  // Case/receipt numbers only where the template already uses them.
  const caseNumberAllowed = stage === "at_uscis" || stage === "nvc_processing";
  const caseNumber =
    caseNumberAllowed && typeof body.caseNumber === "string" ? body.caseNumber : undefined;
  if (typeof body.caseNumber === "string" && body.caseNumber && !caseNumberAllowed) {
    warnings.push(
      `caseNumber was dropped: it is only rendered for at_uscis / nvc_processing, not for ${stage}. Case numbers belong in the portal link, not in SMS subjects.`
    );
  }

  const vars = {
    service: typeof body.service === "string" ? body.service : "Immigration with NIPTEI",
    amount: typeof body.amount === "string" ? body.amount : "",
    invoiceId: typeof body.invoiceId === "string" ? body.invoiceId : "",
    caseNumber: caseNumber ?? "",
    missingCount:
      typeof body.missingCount === "number" ? String(body.missingCount) : "",
    portalUrl:
      typeof body.portalUrl === "string" && body.portalUrl ? body.portalUrl : PORTAL_URL,
  };

  // Render (in memory only, for the planned log) + resolve channels per recipient.
  const log: NotificationLogEntry[] = [];
  const logPairs: { entry: NotificationLogEntry; recipient: NotifyRecipient }[] = [];
  const missingEnvSet = new Set<string>();
  let plannedCount = 0;
  let sentCount = 0;

  for (const recipient of recipients) {
    const entriesBefore = log.length;
    const language = normalizeLanguage(recipient.language);
    const template = getNotificationTemplate(stage, language);
    // Rendered here for the actual send; the rendered text is NOT
    // logged and NOT returned (PII).
    const emailSubject = renderTemplateText(template.emailSubject, { ...vars, name: recipient.name });
    const emailBody = renderTemplateText(template.emailBody, { ...vars, name: recipient.name });
    void renderTemplateText(template.smsText, { ...vars, name: recipient.name });

    const { channels, skipped } = resolveChannels({
      ...recipient,
      language,
      notificationPreference: recipient.notificationPreference ?? "all",
    });

    for (const s of skipped) {
      log.push({
        recipientRole: recipient.role ?? "primary_client",
        recipient: recipientLabel(recipient),
        language,
        channel: s.channel,
        stage,
        status: s.status,
        reason: s.reason,
        attemptedAt: new Date().toISOString(),
      });
    }
    for (const channel of channels) {
      plannedCount += 1;
      if (channel === "email") {
        // Email is the one live channel: platform AWS SES.
        if (!recipient.email) {
          log.push({
            recipientRole: recipient.role ?? "primary_client",
            recipient: recipientLabel(recipient),
            language,
            channel,
            stage,
            status: "skipped_no_contact",
            reason: "No email address on file. Nothing was sent.",
            attemptedAt: new Date().toISOString(),
          });
          continue;
        }
        if (!isEmailConfigured()) {
          for (const m of EMAIL_ENVS) {
            if (!process.env[m]) missingEnvSet.add(m);
          }
          log.push({
            recipientRole: recipient.role ?? "primary_client",
            recipient: recipientLabel(recipient),
            language,
            channel,
            stage,
            status: "not_configured",
            reason: "Email not configured — AWS SES is not connected. Nothing was sent.",
            attemptedAt: new Date().toISOString(),
          });
          continue;
        }
        const result = await sendEmail({
          to: recipient.email,
          subject: emailSubject,
          text: emailBody,
        });
        if (result.ok) {
          sentCount += 1;
          log.push({
            recipientRole: recipient.role ?? "primary_client",
            recipient: recipientLabel(recipient),
            language,
            channel,
            stage,
            status: "sent",
            reason: "Email sent via AWS SES.",
            attemptedAt: new Date().toISOString(),
          });
        } else {
          log.push({
            recipientRole: recipient.role ?? "primary_client",
            recipient: recipientLabel(recipient),
            language,
            channel,
            stage,
            status: "failed",
            reason: result.error,
            attemptedAt: new Date().toISOString(),
          });
        }
        continue;
      }
      const { configured, missing } = channelConfigured(channel);
      for (const m of missing) missingEnvSet.add(m);
      log.push({
        recipientRole: recipient.role ?? "primary_client",
        recipient: recipientLabel(recipient),
        language,
        channel,
        stage,
        status: configured ? "not_implemented" : "not_configured",
        reason: configured
          ? `${channel} provider is configured but the sender is not implemented yet — Twilio SDK is not installed, so nothing was sent.`
          : `${channel} not configured — missing env: ${missing.join(", ")}. Nothing was sent.`,
        attemptedAt: new Date().toISOString(),
      });
    }
    for (const entry of log.slice(entriesBefore)) {
      logPairs.push({ entry, recipient });
    }
  }

  // Persist the log (notification_logs, then audit_log, else in-memory). Never log bodies.
  const destinations = new Set<"notification_logs" | "audit_log" | "memory">();
  for (const { entry, recipient } of logPairs) {
    destinations.add(await persistLogEntry(entry, caseId, recipient));
  }
  const persistence = destinations.has("notification_logs")
    ? "notification_logs"
    : destinations.has("audit_log")
      ? "audit_log"
      : "memory";

  const missingEnv = Array.from(missingEnvSet);
  const sent = sentCount > 0;
  return NextResponse.json(
    {
      ...(sent
        ? { ok: true }
        : {
            error:
              missingEnv.length > 0
                ? "Notification sending not configured — Twilio + AWS SES are not connected. Nothing was sent."
                : "Notification senders not implemented — Twilio SDK is not installed and no email was sent. Nothing was sent.",
          }),
      sent,
      sentCount,
      plannedCount,
      stage,
      stageNumber: STAGE_NUMBERS[stage],
      trigger,
      portalUrl: PORTAL_URL,
      sender: {
        name: NOTIFICATION_SENDER.name,
        email: NOTIFICATION_SENDER.email,
        verified: NOTIFICATION_SENDER.verified,
        note: NOTIFICATION_SENDER.note,
      },
      contactEmail: CONTACT_EMAIL,
      whatsappNote:
        "WhatsApp via Twilio needs WhatsApp Business approval — approval is a separate step from setting TWILIO_WHATSAPP_NUMBER.",
      missingEnv,
      warnings,
      log,
      logPersistence: persistence,
      logNote:
        "Attempts are written to notification_logs (migration 0010, when applied and the insert succeeds), else audit_log, else the in-memory log returned here. notification_logs only accepts status sent/failed/not_configured and has no message-body column; skipped / not-implemented entries fall through to audit_log / memory. No message bodies are logged.",
    },
    { status: sent ? 200 : 501 }
  );
}
