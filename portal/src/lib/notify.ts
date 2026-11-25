// Notification call-site helper — posts stage-advance / agency-number
// events to POST /api/notify-stage. LOGIC + CLIENT ONLY. Nothing is
// actually sent by this file: the route returns 501 until Twilio +
// Resend are connected (see src/app/api/notify-stage/route.ts).
//
// Reuses the repo's existing patterns:
//  * LanguageCode from src/lib/i18n.ts (7 languages, accounts.preferred_language).
//  * NotificationPreference from src/lib/nudges.ts ("in_app" | "email" | "sms" | "all").
//  * Stage keys 1-6 from src/lib/notificationTemplates.ts.
//
// WHERE TO CALL THIS (exact call sites — no server-side lifecycle
// endpoint exists yet, so nothing was wired into another builder's
// file; do NOT call from a component until its save writes a real row):
//
//  1. STAGE ADVANCE: the future server-side stage-advance route /
//     server action that updates cases.status (migration 0001
//     case_status) must call notifyStageAdvance() AFTER the status
//     write succeeds, passing the Primary Client (accounts row:
//     full_name, email, phone, preferred_language,
//     notification_preference) plus every linked family member /
//     joint sponsor from case_family_members (migration 0009 —
//     full_name, email, phone, relationship; their language /
//     preference come from their own accounts row when one exists,
//     otherwise fall back to the Primary Client's language).
//     Pass each family member's case_family_members.id as
//     familyMemberId so the attempt logs to
//     notification_logs.recipient_family_member_id (migration 0010).
//     The natural trigger is the server code that inserts a
//     case_lifecycle row (migration 0010, stage-change history) —
//     no such server code exists in portal/src yet, so the call
//     lives with whoever builds the stage-advance endpoint.
//     If the caller works in lifecycle.ts terms (LifecycleStageId,
//     src/lib/lifecycle.ts — definitions only, no advance function
//     yet), map it first with notificationStageForLifecycle() below:
//     consultation_quote -> quote_sent, payment_arrangement ->
//     payment_plan, active_client -> active_drafting,
//     submitted_uscis + 5A -> at_uscis, submitted_uscis + 5B ->
//     nvc_processing, visa_approved_closed -> visa_travel_closed.
//     NOTE: lifecycle numbering and notification numbering differ —
//     lifecycle stage 1 is new_lead (no notification: nothing has
//     been quoted or filed yet); notification stage 1 is quote_sent.
//     Do NOT pass a lifecycle number as a notification stageNumber.
//     ```ts
//     import { notifyStageAdvance } from "@/lib/notify";
//     await notifyStageAdvance({
//       caseId: case.id,
//       fromStage: 2, toStage: 3,
//       service: "Family Adjustment Bundle (I-130 & I-485)",
//       missingCount: 2,
//       recipients: [primaryClient, ...familyMembers],
//     });
//     ```
//
//  2. AGENCY NUMBER ADDED: when a new USCIS receipt or NVC case /
//     invoice number is saved to case_agency_numbers (migration
//     0009), call notifyAgencyNumberAdded() AFTER the insert.
//     USCIS -> stage at_uscis (4); NVC -> stage nvc_processing (5).
//     ```ts
//     import { notifyAgencyNumberAdded } from "@/lib/notify";
//     await notifyAgencyNumberAdded({
//       caseId, agency: "NVC",
//       service: "Family Adjustment Bundle (I-130 & I-485)",
//       caseNumber: nvcCaseNumber, invoiceId: nvcInvoiceId,
//       recipients: [primaryClient, ...familyMembers],
//     });
//     ```
//     Do NOT call this from AgencyNumberHub.tsx yet: its "Save &
//     Sync" button today only writes local React state (example
//     numbers, no Supabase row), so there is no real number to
//     notify about. Wire it into the hub only once the hub writes
//     a real case_agency_numbers row.
//
//  3. NEVER call with an A-Number. A-Numbers are masked in the UI
//     (see src/lib/agency.ts maskANumber) and must never be sent
//     in a message or a log. The route rejects any payload that
//     contains one.

import type { LanguageCode } from "./i18n";
import type { NotificationPreference } from "./nudges";
import type { LifecycleStageId, Stage5SubStage } from "./lifecycle";
import {
  STAGE_NUMBERS,
  stageKeyForNumber,
  type NotificationStageKey,
} from "./notificationTemplates";

export type NotificationChannel = "email" | "sms" | "whatsapp";

export type NotificationStatus =
  | "sent"
  | "not_configured"
  | "not_implemented"
  | "skipped_opted_out"
  | "skipped_preference"
  | "skipped_no_contact"
  | "failed";

export type NotifyRecipientRole =
  | "primary_client"
  | "family_member"
  | "joint_sponsor";

export interface NotifyRecipient {
  /** accounts.id when known; family members without an account may omit it. */
  id?: string;
  /** case_family_members.id when known — logged to
   *  notification_logs.recipient_family_member_id (migration 0010). */
  familyMemberId?: string;
  role: NotifyRecipientRole;
  name: string;
  email?: string;
  phone?: string;
  language: LanguageCode;
  notificationPreference: NotificationPreference;
  /** Explicit opt-outs. There is no opt-out column in migrations
   *  0001-0009 — preference is the stored signal; these flags are
   *  for callers that track an opt-out outside accounts. */
  optedOutSms?: boolean;
  optedOutEmail?: boolean;
}

export type NotifyTrigger = "stage_advance" | "agency_number_added";

export interface NotifyRequest {
  caseId: string;
  stage: NotificationStageKey;
  trigger: NotifyTrigger;
  agency?: "USCIS" | "NVC" | "EOIR" | "DOL";
  service?: string;
  amount?: string;
  invoiceId?: string;
  /** USCIS receipt / NVC case number. Only rendered for at_uscis
   *  and nvc_processing; the route drops it for every other stage. */
  caseNumber?: string;
  missingCount?: number;
  portalUrl?: string;
  recipients: NotifyRecipient[];
}

export interface NotificationLogEntry {
  recipientRole: NotifyRecipientRole;
  /** Account id when known, otherwise the masked contact — never a full email/phone. */
  recipient: string;
  language: LanguageCode;
  channel: NotificationChannel;
  stage: NotificationStageKey;
  status: NotificationStatus;
  reason: string;
  attemptedAt: string;
}

export interface NotifyResponse {
  ok: boolean;
  sent: boolean;
  sentCount: number;
  /** Every attempted / skipped notification — no message bodies, no PII in full. */
  log: NotificationLogEntry[];
  warnings?: string[];
  error?: string;
}

/** Mask a contact for logs: j***@example.com / ***-***-1234. Never log a full address. */
export function maskContact(contact: string): string {
  if (contact.includes("@")) {
    const [local, domain] = contact.split("@");
    return `${local.slice(0, 1)}***@${domain ?? ""}`;
  }
  const digits = contact.replace(/\D/g, "");
  return digits.length >= 4 ? `***-***-${digits.slice(-4)}` : "***";
}

function recipientLabel(r: NotifyRecipient): string {
  if (r.id) return r.id;
  if (r.email) return maskContact(r.email);
  if (r.phone) return maskContact(r.phone);
  return `${r.role}:name-only`;
}

/**
 * Which channels a recipient may receive, from their stored
 * notification_preference (nudges.ts) + explicit opt-outs.
 *  * in_app  -> no external channel (in-app only).
 *  * email   -> email only.
 *  * sms     -> sms + whatsapp (same text; WhatsApp via Twilio needs
 *               WhatsApp Business approval — see the route).
 *  * all     -> email + sms + whatsapp.
 * Opt-outs remove their channel even when the preference allows it.
 */
export function resolveChannels(recipient: NotifyRecipient): {
  channels: NotificationChannel[];
  skipped: { channel: NotificationChannel; status: NotificationStatus; reason: string }[];
} {
  const channels: NotificationChannel[] = [];
  const skipped: { channel: NotificationChannel; status: NotificationStatus; reason: string }[] = [];
  const pref = recipient.notificationPreference;

  const emailAllowed = pref === "email" || pref === "all";
  const textAllowed = pref === "sms" || pref === "all";

  if (emailAllowed) {
    if (recipient.optedOutEmail) {
      skipped.push({ channel: "email", status: "skipped_opted_out", reason: "Recipient opted out of email." });
    } else if (!recipient.email) {
      skipped.push({ channel: "email", status: "skipped_no_contact", reason: "No email address on file." });
    } else {
      channels.push("email");
    }
  }
  if (textAllowed) {
    if (recipient.optedOutSms) {
      skipped.push(
        { channel: "sms", status: "skipped_opted_out", reason: "Recipient opted out of SMS." },
        { channel: "whatsapp", status: "skipped_opted_out", reason: "Recipient opted out of SMS/WhatsApp." }
      );
    } else if (!recipient.phone) {
      skipped.push(
        { channel: "sms", status: "skipped_no_contact", reason: "No phone number on file." },
        { channel: "whatsapp", status: "skipped_no_contact", reason: "No phone number on file." }
      );
    } else {
      channels.push("sms", "whatsapp");
    }
  }
  if (pref === "in_app") {
    skipped.push(
      { channel: "email", status: "skipped_preference", reason: "Recipient chose in-app only." },
      { channel: "sms", status: "skipped_preference", reason: "Recipient chose in-app only." },
      { channel: "whatsapp", status: "skipped_preference", reason: "Recipient chose in-app only." }
    );
  }
  return { channels, skipped };
}

/** Build the per-recipient log entries a caller can record without sending. */
export function planNotificationLog(
  req: NotifyRequest
): NotificationLogEntry[] {
  const now = new Date().toISOString();
  const entries: NotificationLogEntry[] = [];
  for (const r of req.recipients) {
    const { channels, skipped } = resolveChannels(r);
    for (const channel of channels) {
      entries.push({
        recipientRole: r.role,
        recipient: recipientLabel(r),
        language: r.language,
        channel,
        stage: req.stage,
        status: "not_configured",
        reason: "Planned — Twilio/Resend not connected; nothing sent.",
        attemptedAt: now,
      });
    }
    for (const s of skipped) {
      entries.push({
        recipientRole: r.role,
        recipient: recipientLabel(r),
        language: r.language,
        channel: s.channel,
        stage: req.stage,
        status: s.status,
        reason: s.reason,
        attemptedAt: now,
      });
    }
  }
  return entries;
}

/** Map a lifecycle.ts stage to the notification stage key it triggers.
 *  new_lead maps to null — no notification at inquiry stage. */
export const LIFECYCLE_TO_NOTIFICATION_STAGE: Record<
  LifecycleStageId,
  NotificationStageKey | null
> = {
  new_lead: null,
  consultation_quote: "quote_sent",
  payment_arrangement: "payment_plan",
  active_client: "active_drafting",
  submitted_uscis: "at_uscis", // sub-stage 5A; 5B overrides to nvc_processing
  visa_approved_closed: "visa_travel_closed",
};

export function notificationStageForLifecycle(
  stage: LifecycleStageId,
  stage5SubStage: Stage5SubStage | null = null
): NotificationStageKey | null {
  if (stage === "submitted_uscis" && stage5SubStage === "5B") {
    return "nvc_processing";
  }
  return LIFECYCLE_TO_NOTIFICATION_STAGE[stage];
}

/** POST a notification request to the route. Never throws — returns ok:false on failure. */
export async function notifyStage(req: NotifyRequest, baseUrl = ""): Promise<NotifyResponse> {
  try {
    const res = await fetch(`${baseUrl}/api/notify-stage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    });
    const data = (await res.json()) as Partial<NotifyResponse> & { error?: string };
    return {
      ok: res.ok,
      sent: data.sent ?? false,
      sentCount: data.sentCount ?? 0,
      log: data.log ?? planNotificationLog(req),
      warnings: data.warnings,
      error: data.error,
    };
  } catch (err) {
    return {
      ok: false,
      sent: false,
      sentCount: 0,
      log: planNotificationLog(req).map((e) => ({
        ...e,
        status: "failed" as NotificationStatus,
        reason: `Notify call failed: ${err instanceof Error ? err.message : "unknown error"}`,
      })),
      error: err instanceof Error ? err.message : "Notify call failed.",
    };
  }
}

/** Stage advance 1 -> 6. `fromStage`/`toStage` are the founder's stage numbers. */
export async function notifyStageAdvance(
  args: Omit<NotifyRequest, "stage" | "trigger"> & { fromStage: number; toStage: number },
  baseUrl = ""
): Promise<NotifyResponse> {
  const stage = stageKeyForNumber(args.toStage);
  if (!stage) {
    return {
      ok: false,
      sent: false,
      sentCount: 0,
      log: [],
      error: `Invalid toStage ${args.toStage} — stage numbers are 1-6 (${STAGE_NUMBERS.quote_sent}=quote_sent … ${STAGE_NUMBERS.visa_travel_closed}=visa_travel_closed).`,
    };
  }
  if (args.fromStage === args.toStage) {
    return {
      ok: false,
      sent: false,
      sentCount: 0,
      log: [],
      error: `No stage advance: fromStage ${args.fromStage} equals toStage ${args.toStage}.`,
    };
  }
  const { fromStage: _from, toStage: _to, ...rest } = args;
  void _from;
  void _to;
  return notifyStage({ ...rest, stage, trigger: "stage_advance" }, baseUrl);
}

/** New USCIS / NVC number logged. USCIS -> at_uscis (4); NVC -> nvc_processing (5). */
export async function notifyAgencyNumberAdded(
  args: Omit<NotifyRequest, "stage" | "trigger"> & { agency: "USCIS" | "NVC" },
  baseUrl = ""
): Promise<NotifyResponse> {
  const stage: NotificationStageKey =
    args.agency === "USCIS" ? "at_uscis" : "nvc_processing";
  return notifyStage({ ...args, stage, trigger: "agency_number_added" }, baseUrl);
}
