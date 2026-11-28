// Client document resend — email / SMS / in-app copy / vault link.
// Nov 28, 2026 (twelfth addition, part A).
//
// WHAT ALREADY EXISTED (reused, not rebuilt):
//   * Platform email — src/lib/email.ts (AWS SES). Resend-by-email
//     goes through sendEmail() with a vault signed URL in the body.
//     NEVER a raw file attachment, NEVER a claim of "sent" when SES
//     is not configured (email_not_configured → honest 501).
//   * SMS — the professional's OWN Twilio (BYO, src/lib/byo.ts +
//     provider_settings 0014). Twilio is NOT connected, so SMS
//     resend ALWAYS returns 501 / not_configured in this build.
//     /api/messages/send already does exactly this for SMS.
//   * In-app copy — messages + message_sends (0001/0014) via
//     insertCaseThreadMessage() in src/lib/caseStatusSync.ts.
//     The resend route reuses it; the thread copy is the same
//     unified thread the client already reads in their portal.
//   * Vault — documents table (0001, Supabase Storage bucket
//     'vault'). A resend links to the vault, never attaches the
//     file. A vault_link resend creates a single-document share
//     token (document_resends.share_token, migration 0030) that
//     resolves at /vault/shared/<token> and expires after 7 days.
//   * Logging — notification_logs (0010, email + SMS channels)
//     and message_sends (0014, portal_chat + email). Every resend
//     attempt is also written to document_resends (0030).
//
// HARD RULES (do not weaken):
//   * DOB, A-Number, SSN, passport numbers: masked in UI, NEVER
//     logged, NEVER in email subjects. The subject is built from
//     the form label ONLY — the professional's free text never
//     enters a subject, and any payload containing an identifier
//     pattern is rejected with 400.
//   * No message body is stored in document_resends or
//     notification_logs (no body column, by design).
//   * Only a licensed attorney or DOJ-accredited representative
//     gives legal advice (8 CFR 292.1). A resend is a delivery
//     action, never advice.

import { PORTAL_URL } from "./notificationTemplates";

export type ResendChannel = "email" | "sms" | "portal_chat" | "vault_link";

export type ResendStatus = "sent" | "failed" | "not_configured";

export const RESEND_CHANNELS: ResendChannel[] = ["email", "sms", "portal_chat", "vault_link"];

export const RESEND_CHANNEL_LABELS: Record<ResendChannel, string> = {
  email: "Email",
  sms: "Text message (SMS)",
  portal_chat: "In-app message",
  vault_link: "Shareable vault link",
};

/** A resend attempt is logged with one of these statuses — never a
 *  fake "sent". */
export interface ResendAvailability {
  channel: ResendChannel;
  /** HTTP status the route returns for this channel right now. */
  httpStatus: number;
  status: ResendStatus;
  detail: string;
}

/**
 * Decide, per channel, whether a resend can be attempted right now —
 * pure function, no I/O, so the smoke test can prove it.
 *   email: needs SES configured (isEmailConfigured()).
 *   sms: needs the professional's OWN Twilio connected — NOT
 *     connected in this build, so ALWAYS not_configured.
 *   portal_chat: needs Supabase (messages table).
 *   vault_link: needs Supabase (document_resends table).
 */
export function resendChannelAvailability(
  channel: ResendChannel,
  deps: { emailConfigured: boolean; supabaseConfigured: boolean }
): ResendAvailability {
  switch (channel) {
    case "email":
      return deps.emailConfigured
        ? { channel, httpStatus: 200, status: "sent", detail: "Email will be sent through the platform AWS SES sender." }
        : {
            channel,
            httpStatus: 501,
            status: "not_configured",
            detail:
              "Email not configured — the platform AWS SES sender is not connected (missing AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY). No email was sent.",
          };
    case "sms":
      return {
        channel,
        httpStatus: 501,
        status: "not_configured",
        detail:
          "SMS not configured — the professional's own Twilio account is not connected (missing TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER). No text was sent.",
      };
    case "portal_chat":
      return deps.supabaseConfigured
        ? { channel, httpStatus: 200, status: "sent", detail: "The in-app copy will be stored in the case message thread." }
        : {
            channel,
            httpStatus: 501,
            status: "not_configured",
            detail: "In-app message not configured — Supabase is not connected, so the message cannot be stored. Nothing was sent.",
          };
    case "vault_link":
      return deps.supabaseConfigured
        ? { channel, httpStatus: 200, status: "sent", detail: "A shareable vault link will be created for this one document (expires in 7 days)." }
        : {
            channel,
            httpStatus: 501,
            status: "not_configured",
            detail: "Vault link not configured — Supabase is not connected, so the share link cannot be created. Nothing was shared.",
          };
  }
}

// ---------------------------------------------------------------------------
// Identifier guards — DOB / A-Number / SSN / passport: never in a
// subject, never in a log, never in a share link.
// ---------------------------------------------------------------------------

const A_NUMBER_RE = /\bA-?\d{8,9}\b/i;
const SSN_RE = /\b\d{3}-\d{2}-\d{4}\b/;
const PASSPORT_RE = /\b[A-Z]{1,2}\d{6,9}\b/;
const DOB_FIELD_RE = /\b(date of birth|dob|ssn|social security|passport (number|no\.?|#)|a[-\s]?number)\b/i;

/** True when the text carries an identifier that must never be sent
 *  or logged. The route rejects such payloads with 400. */
export function containsSensitiveIdentifier(text: string): boolean {
  return (
    A_NUMBER_RE.test(text) ||
    SSN_RE.test(text) ||
    PASSPORT_RE.test(text) ||
    DOB_FIELD_RE.test(text)
  );
}

/** Email subject for a document resend — form label ONLY. The
 *  professional's free text never enters a subject. */
export function buildResendEmailSubject(formLabel: string): string {
  const label = formLabel.trim() || "your case";
  return `Immigration with NIPTEI — your ${label} document`;
}

/** Email body for a document resend. Links to the vault — never
 *  attaches the file, never includes an identifier. */
export function buildResendEmailBody(args: {
  fileName: string;
  formLabel: string;
  vaultUrl: string;
}): string {
  return [
    `Your ${args.formLabel} document (${args.fileName}) is ready in your document vault.`,
    "",
    `Open it here: ${args.vaultUrl}`,
    "",
    "This link opens your secure vault — the document is not attached to this email.",
    "If you did not expect this document, contact your professional through your portal.",
    "",
    "Immigration with NIPTEI — a document-preparation service, not a law firm, not affiliated with USCIS.",
  ].join("\n");
}

/** In-app thread copy for a document resend (portal_chat channel). */
export function buildResendThreadBody(args: {
  fileName: string;
  formLabel: string;
  vaultUrl: string;
}): string {
  return `Your ${args.formLabel} document (${args.fileName}) is ready in your document vault: ${args.vaultUrl}`;
}

/** Portal vault URL for a document (the client opens it signed in).
 *  A signed storage URL is appended by the route when Supabase
 *  Storage can create one; this portal link is the fallback. */
export function vaultDocumentLink(documentId: string): string {
  return `${PORTAL_URL}/portal?vault_document=${encodeURIComponent(documentId)}`;
}

/** Shareable single-document vault link (vault_link channel). */
export function vaultShareLink(shareToken: string): string {
  return `${PORTAL_URL}/vault/shared/${encodeURIComponent(shareToken)}`;
}

/** Share links expire after 7 days. */
export function shareLinkExpiry(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString();
}

/** Mask a recipient address/phone for display in the UI and logs:
 *  "j•••@example.com" / "+1 ••• ••• 1234" (last 4 digits only). */
export function maskRecipient(value: string): string {
  const v = value.trim();
  if (v.includes("@")) {
    const at = v.indexOf("@");
    if (at <= 1) return "•••";
    return `${v[0]}•••${v.slice(at)}`;
  }
  const digits = v.replace(/\D/g, "");
  if (digits.length <= 4) return "••••";
  return `••• ••• ${digits.slice(-4)}`;
}

export interface ResendRequestInput {
  documentId: string;
  caseId: string;
  channel: ResendChannel;
  senderId: string;
  senderRole: string;
  recipientEmail?: string;
  recipientPhone?: string;
  formLabel?: string;
  note?: string;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Validate a resend request before anything is sent or logged.
 *  Returns the first problem, or null when the request is usable. */
export function validateResendRequest(
  input: Partial<ResendRequestInput>
): string | null {
  if (!input.documentId || !UUID_RE.test(input.documentId)) {
    return "documentId must be a document id (UUID).";
  }
  if (!input.caseId || !UUID_RE.test(input.caseId)) {
    return "caseId must be a case id (UUID).";
  }
  if (!input.channel || !RESEND_CHANNELS.includes(input.channel)) {
    return "channel must be email, sms, portal_chat, or vault_link.";
  }
  if (!input.senderId || !UUID_RE.test(input.senderId)) {
    return "senderId must be an accounts.id UUID.";
  }
  if (
    !input.senderRole ||
    !["preparer", "attorney", "nonprofit", "admin"].includes(input.senderRole)
  ) {
    return "senderRole must be preparer, attorney, nonprofit, or admin — only a professional resends a client document.";
  }
  if (input.channel === "email" && !input.recipientEmail?.trim()) {
    return "recipientEmail is required for email resend.";
  }
  if (input.channel === "sms" && !input.recipientPhone?.trim()) {
    return "recipientPhone is required for SMS resend.";
  }
  const note = input.note ?? "";
  const formLabel = input.formLabel ?? "";
  if (containsSensitiveIdentifier(note) || containsSensitiveIdentifier(formLabel)) {
    return "Do not include a date of birth, A-Number, SSN, or passport number in a resend — those identifiers are never sent or logged.";
  }
  return null;
}

/** Row written to document_resends (0030) for one attempt. No body. */
export interface DocumentResendLogRow {
  document_id: string;
  case_id: string;
  resent_by: string;
  channel: ResendChannel;
  recipient_email: string | null;
  recipient_phone: string | null;
  status: ResendStatus;
  provider: string | null;
  provider_message_id: string | null;
  error_message: string | null;
  message_id: string | null;
  share_token: string | null;
  share_expires_at: string | null;
}

export function buildResendLogRow(args: {
  input: ResendRequestInput;
  status: ResendStatus;
  provider: string | null;
  providerMessageId?: string | null;
  errorMessage?: string | null;
  messageId?: string | null;
  shareToken?: string | null;
  shareExpiresAt?: string | null;
}): DocumentResendLogRow {
  return {
    document_id: args.input.documentId,
    case_id: args.input.caseId,
    resent_by: args.input.senderId,
    channel: args.input.channel,
    recipient_email: args.input.recipientEmail?.trim() ?? null,
    recipient_phone: args.input.recipientPhone?.trim() ?? null,
    status: args.status,
    provider: args.provider,
    provider_message_id: args.providerMessageId ?? null,
    error_message: args.errorMessage ?? null,
    message_id: args.messageId ?? null,
    share_token: args.shareToken ?? null,
    share_expires_at: args.shareExpiresAt ?? null,
  };
}
