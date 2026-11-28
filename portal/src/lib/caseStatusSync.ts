// Case-status sync — ONE entry point for a professional's status update.
//
// The professional enters a case status ONCE (stage, plain-English status
// text, USCIS receipt number if any). POST /api/case-status then:
//   (i)   writes it to cases.status + case_lifecycle (+ case_watch /
//         case_agency_numbers when a receipt number is given),
//   (ii)  links it to the client account via cases.client_id, so it
//         appears in the client portal,
//   (iii) sends it to the client automatically — SES email + in-app
//         message thread (messages + message_sends),
//   (iv)  records delivery status per channel (sent / queued / failed /
//         not_configured). If SES is not configured the in-app copy
//         still lands and the email is recorded as not_configured —
//         never claimed as sent.
//
// This file is PURE + DB-helper only: no SES import, no Supabase client
// construction, so client components may import the types and pure
// helpers. The route (src/app/api/case-status/route.ts) does the sends.
//
// SCHEMA (migrations 0001–0020 — existing columns ONLY, no migration
// 0021 was needed):
//   * cases.status — case_status enum (0001): intake, documents_pending,
//     in_preparation, ready_to_sign, filed, uscis_pending, rfe,
//     interview, approved, denied, closed.
//   * case_lifecycle — stage 1–6 + sub_stage 5A/5B, is_current (0010).
//     One row per change; the old current row is flipped to false.
//   * case_watch — receipt_number + uscis_status text (0001).
//   * case_agency_numbers — agency + case_number + agency_status (0009).
//   * messages — in-app thread copy (0001); message_sends — per-channel
//     delivery (portal_chat / email; queued / sent / failed /
//     not_configured) (0014).
//   * notification_logs — email channel ONLY (0010): its CHECK allows
//     channel sms/whatsapp/email and status sent/failed/not_configured —
//     there is NO in_app channel and NO queued/skipped status there, so
//     the in-app copy is recorded in message_sends, never here.
//   * audit_log — fallback record of the sync (0001).
// There is NO status-text column on cases or case_lifecycle, so the
// free-text update lives in the message body + case_watch.uscis_status
// (when receipt-linked) + audit_log detail — never silently added.
//
// HONESTY RULES (do not weaken):
//   * A manually-entered status is NEVER presented as a live USCIS
//     lookup. Receipt numbers are manually entered (EXAMPLE / labelled)
//     until a real Production USCIS key exists. Live USCIS lookup is
//     NOT built (see src/lib/agency.ts).
//   * No DOB, A-Number, SSN or passport number in email subjects or
//     logs. The subject is built from the form label ONLY — the
//     professional's free text never enters a subject. Payloads that
//     contain an A-Number / SSN pattern, or an explicit aNumber / ssn /
//     dateOfBirth / passportNumber field, are rejected (400).
//   * Platform is a document-preparation service, NOT a law firm, NOT
//     USCIS affiliated. Only a licensed attorney or DOJ-accredited
//     representative gives legal advice (8 CFR 292.1). No AI decides
//     relief / eligibility / evidence strength / safe-to-leave — this
//     module never infers a case status from free text; the
//     professional states it explicitly.
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  PORTAL_URL,
  renderStatusUpdate,
} from "./notificationTemplates";
import type { Stage5SubStage } from "./lifecycle";

export type CaseStatusEnum =
  | "intake"
  | "documents_pending"
  | "in_preparation"
  | "ready_to_sign"
  | "filed"
  | "uscis_pending"
  | "rfe"
  | "interview"
  | "approved"
  | "denied"
  | "closed";

export const CASE_STATUSES: CaseStatusEnum[] = [
  "intake",
  "documents_pending",
  "in_preparation",
  "ready_to_sign",
  "filed",
  "uscis_pending",
  "rfe",
  "interview",
  "approved",
  "denied",
  "closed",
];

export type DeliveryStatus = "sent" | "queued" | "failed" | "not_configured";

export type SyncChannel = "email" | "portal_chat";

export interface ChannelDelivery {
  channel: SyncChannel;
  status: DeliveryStatus;
  /** Plain-English explanation — safe to show the professional. */
  detail: string;
}

export type Agency = "USCIS" | "NVC" | "EOIR" | "DOL";

/** What the professional posts to POST /api/case-status (one call). */
export interface CaseStatusUpdateInput {
  caseId: string;
  /** Lifecycle stage 1–6. Optional — derived from caseStatus when omitted. */
  lifecycleStage?: number;
  stage5SubStage?: Stage5SubStage | null;
  /** cases.status enum value. Optional — derived from lifecycleStage. */
  caseStatus?: CaseStatusEnum;
  /** Plain-English update, professional-entered. Required, max 2000 chars. */
  statusText: string;
  /** Manually-entered USCIS receipt / agency number, if any. Labelled
   *  manual — never a live USCIS lookup. */
  receiptNumber?: string;
  agency?: Agency;
  /** Form code the update is about, e.g. "I-130". Defaults to the
   *  case's first form. */
  formCode?: string;
  /** accounts.id (UUID) of the professional posting the update. When
   *  omitted / not a UUID, the in-app message cannot be stored (the
   *  messages table needs a real sender_id) and is skipped honestly. */
  changedBy?: string;
}

export interface CaseStatusSyncResponse {
  ok: boolean;
  caseId: string;
  clientId: string | null;
  caseStatus: CaseStatusEnum | null;
  lifecycleStage: number | null;
  stage5SubStage: Stage5SubStage | null;
  /** Per-channel delivery — the professional sees exactly what landed. */
  deliveries: ChannelDelivery[];
  stored: {
    caseUpdated: boolean;
    lifecycleRow: boolean;
    receiptRecorded: boolean;
    inAppMessage: boolean;
    emailLog: boolean;
  };
  warnings: string[];
  error?: string;
}

export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// A-Number: A + 8–9 digits, with or without a dash. SSN: ###-##-####.
const A_NUMBER_RE = /\bA-?\d{8,9}\b/i;
const SSN_RE = /\b\d{3}-\d{2}-\d{4}\b/;

/** True when text contains an A-Number or SSN pattern. */
export function containsSensitiveIdentifier(text: string): boolean {
  return A_NUMBER_RE.test(text) || SSN_RE.test(text);
}

/** First name only — never a full name in a greeting. */
export function firstNameOf(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? "";
}

/** Default cases.status for a lifecycle stage 1–6. The professional's
 *  explicit caseStatus always wins over this mapping. */
export const LIFECYCLE_STAGE_TO_CASE_STATUS: Record<number, CaseStatusEnum> = {
  1: "intake",
  2: "intake",
  3: "intake",
  4: "in_preparation",
  5: "filed",
  6: "approved",
};

/** Lifecycle stage derived from a cases.status value (reverse map). */
export function lifecycleStageForCaseStatus(
  status: CaseStatusEnum
): number {
  switch (status) {
    case "intake":
      return 1;
    case "documents_pending":
    case "in_preparation":
    case "ready_to_sign":
      return 4;
    case "filed":
    case "uscis_pending":
    case "rfe":
    case "interview":
      return 5;
    case "approved":
    case "denied":
    case "closed":
      return 6;
    default:
      return 1;
  }
}

/** Resolve the (caseStatus, lifecycleStage) pair: explicit values win,
 *  the other side is derived. Returns nulls when neither was given. */
export function resolveStatusPair(input: {
  lifecycleStage?: number;
  caseStatus?: CaseStatusEnum;
}): { caseStatus: CaseStatusEnum | null; lifecycleStage: number | null } {
  const stage =
    typeof input.lifecycleStage === "number" &&
    input.lifecycleStage >= 1 &&
    input.lifecycleStage <= 6
      ? input.lifecycleStage
      : null;
  const status =
    input.caseStatus && CASE_STATUSES.includes(input.caseStatus)
      ? input.caseStatus
      : null;
  if (status && stage) return { caseStatus: status, lifecycleStage: stage };
  if (status) return { caseStatus: status, lifecycleStage: lifecycleStageForCaseStatus(status) };
  if (stage) return { caseStatus: LIFECYCLE_STAGE_TO_CASE_STATUS[stage], lifecycleStage: stage };
  return { caseStatus: null, lifecycleStage: null };
}

/**
 * Subject for the status email. Built from the form label ONLY — the
 * professional's free-text status never enters a subject, so no DOB,
 * A-Number, SSN or passport number can leak into one by construction.
 */
export function buildStatusSubject(formLabel: string): string {
  const { emailSubject } = renderStatusUpdate({
    name: "",
    service: formLabel || "Immigration with NIPTEI",
    statusText: "",
    receiptLine: "",
  });
  return emailSubject;
}

/** Full status email body (English only — translation pending). */
export function buildStatusEmailBody(args: {
  firstName: string;
  formLabel: string;
  statusText: string;
  receiptNumber?: string;
}): string {
  const receiptLine = args.receiptNumber
    ? `Receipt number (manually entered by your preparer — not a live USCIS lookup): ${args.receiptNumber}.\n\n`
    : "";
  const { emailBody } = renderStatusUpdate({
    name: args.firstName,
    service: args.formLabel,
    statusText: args.statusText.trim(),
    receiptLine,
    portalUrl: PORTAL_URL,
  });
  return emailBody;
}

/** Minimal case row the sync needs — loaded by the route, planned here. */
export interface SyncCaseRow {
  id: string;
  client_id: string;
  forms: string[];
  status: string;
}

/**
 * Pure plan for a status sync, from the input + the loaded case row.
 * The smoke test asserts on this: the message recipient is the case's
 * client_id, the case update targets the same case id, and the
 * lifecycle row carries the same case id. No DB, no network, no send.
 */
export function planCaseStatusSync(
  input: CaseStatusUpdateInput,
  caseRow: SyncCaseRow
): {
  caseUpdate: { id: string; status: CaseStatusEnum | null };
  lifecycleInsert: {
    case_id: string;
    stage: number | null;
    sub_stage: Stage5SubStage | null;
    stage_changed_by: string | null;
  };
  message: {
    case_id: string;
    sender_id: string | null;
    recipient_id: string;
    body: string;
  };
  emailSubject: string;
  receiptWrites: boolean;
} {
  const { caseStatus, lifecycleStage } = resolveStatusPair(input);
  const formLabel =
    input.formCode ?? caseRow.forms?.[0] ?? "Immigration with NIPTEI";
  const senderId =
    input.changedBy && UUID_RE.test(input.changedBy) ? input.changedBy : null;
  return {
    caseUpdate: { id: caseRow.id, status: caseStatus },
    lifecycleInsert: {
      case_id: caseRow.id,
      stage: lifecycleStage,
      sub_stage:
        lifecycleStage === 5 ? (input.stage5SubStage ?? null) : null,
      stage_changed_by: senderId,
    },
    message: {
      case_id: caseRow.id,
      sender_id: senderId,
      recipient_id: caseRow.client_id,
      body: buildStatusEmailBody({
        firstName: "",
        formLabel,
        statusText: input.statusText,
        receiptNumber: input.receiptNumber,
      }),
    },
    emailSubject: buildStatusSubject(formLabel),
    receiptWrites: Boolean(input.receiptNumber?.trim()),
  };
}

/**
 * Store the in-app copy of a status update in the unified thread
 * (messages, 0001) and record its delivery in message_sends (0014,
 * channel portal_chat, delivery_status sent — it landed in the DB, so
 * the client sees it in their portal). Returns the message id when
 * stored. Shared by POST /api/case-status and POST /api/messages/send
 * (portal_chat) so the thread insert lives in exactly one place.
 * Never throws — callers record the failure honestly instead.
 */
export async function insertCaseThreadMessage(
  supabase: SupabaseClient,
  args: {
    caseId: string;
    senderId: string;
    senderRole: "client" | "preparer" | "attorney" | "nonprofit" | "admin";
    recipientId: string;
    recipientRole: "client" | "preparer" | "attorney" | "nonprofit" | "admin";
    body: string;
    language?: string;
  }
): Promise<{ ok: boolean; messageId: string | null; error?: string }> {
  try {
    const { data, error } = await supabase
      .from("messages")
      .insert({
        case_id: args.caseId,
        sender_id: args.senderId,
        sender_role: args.senderRole,
        recipient_id: args.recipientId,
        recipient_role: args.recipientRole,
        body_original: args.body,
        original_language: args.language ?? "en",
      })
      .select("id")
      .single();
    if (error || !data?.id) {
      return { ok: false, messageId: null, error: error?.message ?? "Message insert returned no row." };
    }
    const { error: sendError } = await supabase.from("message_sends").insert({
      message_id: data.id,
      channel: "portal_chat",
      delivery_status: "sent",
      provider: "portal",
    });
    if (sendError) {
      // The message landed; only the delivery row failed. Report it.
      return { ok: true, messageId: data.id, error: `Message stored, delivery row failed: ${sendError.message}` };
    }
    return { ok: true, messageId: data.id };
  } catch (err) {
    return {
      ok: false,
      messageId: null,
      error: err instanceof Error ? err.message : "Message insert failed.",
    };
  }
}

/** Record one email delivery attempt in message_sends (0014). */
export async function recordEmailSend(
  supabase: SupabaseClient,
  args: {
    messageId: string;
    status: DeliveryStatus;
    providerMessageId?: string | null;
    errorMessage?: string | null;
    /** Provider that attempted the send — "aws_ses" (platform) by
     *  default; "byo_resend" / "byo_aws_ses" for a professional's own
     *  connected email. The provider name is the only thing recorded
     *  — never a key. */
    provider?: string;
  }
): Promise<void> {
  try {
    await supabase.from("message_sends").insert({
      message_id: args.messageId,
      channel: "email",
      delivery_status: args.status,
      provider: args.provider ?? "aws_ses",
      provider_message_id: args.providerMessageId ?? null,
      error_message: args.errorMessage ?? null,
    });
  } catch {
    // Delivery logging is best-effort; the response carries the status.
  }
}
