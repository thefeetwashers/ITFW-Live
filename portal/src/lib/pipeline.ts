// Client Pipeline — shared logic for the Preparer / Attorney / DOJ
// pipeline views (one shared component, src/components/pipeline/
// ClientPipeline.tsx, with role-specific columns/filters — not three
// copies). Pure functions only: no Supabase, no network, no logging of
// personal data.
//
// PRIVACY RULES (do not weaken):
// - DOB is shown MASKED only (••/••/1990). The full date of birth is
//   never rendered, never returned by /api/pipeline, and never logged.
//   accounts.date_of_birth (migration 0001) is read server-side and
//   masked before it leaves the server.
// - No SSN is stored or shown anywhere. There is no SSN column.
// - Payment status is DERIVED from Stripe-backed records in the DB
//   (invoices.status, migration 0001, + order_invoices.status,
//   migration 0006) — never a front-end flag and never invented.
// - Draft emails are shown to the professional FIRST; they click once
//   and SES sends it. Delivery status is recorded in
//   notification_logs (migration 0010). When SES is not configured the
//   send returns 501 / not_configured and nothing is claimed sent.
import { renderMissingDocumentNudge, PORTAL_URL } from "./notificationTemplates";
import type { LanguageCode } from "./i18n";
import type { LifecycleStageId } from "./lifecycle";
import { isQuoteExpired } from "./lifecycle";

export type PipelineRole = "preparer" | "attorney" | "doj";

export const PIPELINE_ROLES: { id: PipelineRole; label: string }[] = [
  { id: "preparer", label: "Preparer" },
  { id: "attorney", label: "Attorney" },
  { id: "doj", label: "DOJ-Accredited Representative" },
];

/** Role-specific columns. The shared table always shows name, masked
 *  DOB, phone, email, stage, next step, missing documents and payment
 *  status; each role adds the columns only that role needs. */
export const PIPELINE_ROLE_COLUMNS: Record<
  PipelineRole,
  { id: string; label: string }[]
> = {
  preparer: [
    { id: "checklist", label: "Document checklist" },
    { id: "followUp", label: "Follow-up" },
  ],
  attorney: [
    { id: "review", label: "Attorney review" },
    { id: "barNote", label: "Legal review note" },
  ],
  doj: [
    { id: "accreditation", label: "Accreditation check" },
    { id: "eoirNote", label: "EOIR / recognition note" },
  ],
};

/** One pipeline row: a converted lead's case, as the professional sees
 *  it. dateOfBirthMasked is the ONLY DOB field — the full date never
 *  reaches the client component. */
export interface PipelineClientRow {
  caseId: string;
  leadId: string | null;
  clientName: string;
  /** Masked only, e.g. "••/••/1990". "Not provided" when unknown. */
  dateOfBirthMasked: string;
  phone: string | null;
  email: string;
  preferredLanguage: LanguageCode;
  service: string;
  /** 6-stage lifecycle (case_lifecycle.is_current). */
  stage: LifecycleStageId;
  stageNumber: number;
  stage5SubStage: "5A" | "5B" | null;
  /** Professional-set next step (case_next_steps) or the derived step. */
  nextStep: string;
  nextStepByWhen: string | null;
  /** Missing-document titles, from inbox_items (status 'missing') +
   *  packet_audit_items that still fail. Empty = checklist complete. */
  missingDocuments: string[];
  missingCount: number;
  packetReadinessPercent: number | null;
  paymentStatus: PaymentStatus;
  paymentDetail: string;
  /** Assigned professional role for this case (preparer / attorney /
   *  nonprofit = DOJ view). Drives the role filter, never invented. */
  assignedProviderRole: "preparer" | "attorney" | "nonprofit";
}

export type PaymentStatus = "paid" | "instalment_due" | "unpaid" | "no_invoice";

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  paid: "Paid",
  instalment_due: "Instalment due",
  unpaid: "Unpaid",
  no_invoice: "No invoice yet",
};

/** Mask a YYYY-MM-DD date of birth to ••/••/YYYY. Returns
 *  "Not provided" for null/blank/invalid input. The month and day are
 *  never in the output — assert that in the smoke test. */
export function maskDob(dateOfBirth: string | null | undefined): string {
  if (!dateOfBirth) return "Not provided";
  const m = /^(\d{4})-\d{2}-\d{2}$/.exec(dateOfBirth.trim());
  if (!m) return "Not provided";
  return `••/••/${m[1]}`;
}

// ---------------------------------------------------------------------------
// Payment status — derived ONLY from invoice records in the DB.
// invoices.status (migration 0001 enum): draft | open | pending | paid |
// void | refunded | past_due. order_invoices.status (migration 0006):
// paid | unpaid | overdue | void. Stripe-backed: invoices carry
// stripe_invoice_id / stripe_checkout_url when Stripe issued them.
// ---------------------------------------------------------------------------

export interface InvoiceStatusRow {
  /** invoices.status, or null when the row is an order_invoice only. */
  invoiceStatus: string | null;
  /** order_invoices.status, or null when the row is an invoice only. */
  orderInvoiceStatus: string | null;
  amountCents: number;
  dueDate: string | null;
}

export function derivePaymentStatus(
  rows: InvoiceStatusRow[]
): { status: PaymentStatus; detail: string } {
  if (rows.length === 0) {
    return { status: "no_invoice", detail: "No invoice has been issued for this case yet." };
  }
  const statuses = rows.flatMap((r) => [r.invoiceStatus, r.orderInvoiceStatus]);
  const anyOverdue =
    statuses.includes("past_due") || statuses.includes("overdue");
  const anyUnpaid =
    statuses.includes("unpaid") ||
    statuses.includes("open") ||
    statuses.includes("pending") ||
    statuses.includes("draft");
  const allPaid =
    rows.length > 0 &&
    rows.every(
      (r) =>
        r.invoiceStatus === "paid" ||
        r.orderInvoiceStatus === "paid" ||
        r.invoiceStatus === "void" ||
        r.orderInvoiceStatus === "void"
    ) &&
    !anyUnpaid &&
    !anyOverdue;
  // A draft invoice is not a bill yet: it counts as unpaid only when
  // no other invoice exists in a payable state; the detail says so.
  const payable = rows.filter(
    (r) => r.invoiceStatus !== "draft" && r.invoiceStatus !== "void"
  );
  if (allPaid && payable.length > 0) {
    return { status: "paid", detail: "All issued invoices are paid." };
  }
  if (anyOverdue) {
    return {
      status: "instalment_due",
      detail: "An invoice or instalment is past due. See the invoice dates in the case.",
    };
  }
  if (anyUnpaid) {
    const unpaidCount = rows.filter(
      (r) =>
        r.invoiceStatus === "open" ||
        r.invoiceStatus === "pending" ||
        r.orderInvoiceStatus === "unpaid"
    ).length;
    if (unpaidCount > 0) {
      return {
        status: "instalment_due",
        detail: `${unpaidCount} instalment${unpaidCount === 1 ? "" : "s"} still to pay.`,
      };
    }
    return { status: "unpaid", detail: "Invoice issued (draft) — no payment made yet." };
  }
  return { status: "unpaid", detail: "No payment recorded yet." };
}

// ---------------------------------------------------------------------------
// Conversion — lead -> case. Writes preparer_leads.pipeline_stage =
// 'converted' + a case_lifecycle row with stage 2 (payment_plan), per
// the existing convention in confirm-intake-order/route.ts. A case is
// NEVER invented here: conversion requires an existing caseId (created
// by Smart Intake / confirm-intake-order, or by the professional).
// A quote past its expiry blocks conversion until it is re-confirmed.
// ---------------------------------------------------------------------------

export interface ConversionInput {
  leadId: string;
  /** Existing case id. Missing = no case exists yet: refuse. */
  caseId: string | null;
  /** YYYY-MM-DD quote expiry from preparer_leads, or null. */
  quoteExpiresAt: string | null;
  /** True only when the professional re-confirmed an expired quote. */
  quoteReconfirmed: boolean;
  /** Current pipeline_stage of the lead (must not already be converted). */
  currentPipelineStage: string;
}

export function buildConversionUpdate(
  input: ConversionInput,
  todayIso?: string
):
  | { ok: true; leadUpdate: { pipeline_stage: "converted"; case_id: string }; lifecycleInsert: { case_id: string; stage: 2; is_current: true } }
  | { ok: false; error: string } {
  if (!input.leadId) return { ok: false, error: "Lead id is required." };
  if (!input.caseId) {
    return {
      ok: false,
      error:
        "No case exists for this lead yet — create the case first (Smart Intake / confirm-intake-order), then convert. A case is never invented by conversion.",
    };
  }
  if (input.currentPipelineStage === "converted") {
    return { ok: false, error: "This lead is already converted." };
  }
  if (input.currentPipelineStage === "lost") {
    return { ok: false, error: "This lead is marked lost — it cannot be converted." };
  }
  if (isQuoteExpired(input.quoteExpiresAt, todayIso) && !input.quoteReconfirmed) {
    return {
      ok: false,
      error:
        "The quote has expired — re-confirm the quote with the client first, then convert with quoteReconfirmed set.",
    };
  }
  return {
    ok: true,
    leadUpdate: { pipeline_stage: "converted", case_id: input.caseId },
    lifecycleInsert: { case_id: input.caseId, stage: 2, is_current: true },
  };
}

// ---------------------------------------------------------------------------
// Missing-document draft email — shown to the professional FIRST.
// Reuses the 7-language missing-document nudge templates
// (notificationTemplates.renderMissingDocumentNudge); where a template
// exists in the client's language it is used, otherwise English with
// the note below. Drafts with legal content must be labelled
// "Draft — for a licensed attorney to review before sending" and may
// only be sent after attorneyReviewed is true.
// ---------------------------------------------------------------------------

export const LEGAL_REVIEW_LABEL =
  "Draft — for a licensed attorney to review before sending";
export const ENGLISH_ONLY_NOTE =
  "English only — translation pending for this draft.";
export const CLERICAL_NOTE =
  "Clerical request — not legal advice. No approval is guaranteed.";

export interface MissingDocDraftInput {
  clientName: string;
  clientEmail: string;
  service: string;
  /** Titles of the missing documents, from the pipeline row. */
  missingDocuments: string[];
  language: LanguageCode;
  caseId: string;
  /** True when the draft contains legal content (a letter, not a
   *  document request). Missing-document requests are clerical. */
  legalContent: boolean;
  /** True only when a licensed attorney has reviewed this draft. */
  attorneyReviewed: boolean;
}

export interface MissingDocDraft {
  subject: string;
  body: string;
  /** Shown above the draft in the UI. */
  labels: string[];
  /** False when legalContent is true and no attorney has reviewed. */
  sendable: boolean;
  blockedReason: string | null;
  /** English fallback was used because no template exists in the
   *  client's language (only possible for languages outside the 7). */
  englishFallback: boolean;
}

const TEMPLATE_LANGUAGES: readonly string[] = ["en", "es", "ht", "fr", "pt", "zh", "ar"];

export function buildMissingDocDraft(input: MissingDocDraftInput): MissingDocDraft {
  const labels: string[] = [CLERICAL_NOTE];
  const englishFallback = !TEMPLATE_LANGUAGES.includes(input.language);
  if (englishFallback) labels.push(ENGLISH_ONLY_NOTE);
  if (input.legalContent) labels.push(LEGAL_REVIEW_LABEL);
  const sendable = !(input.legalContent && !input.attorneyReviewed);
  const blockedReason = sendable
    ? null
    : "This draft contains legal content and has not been reviewed by a licensed attorney yet.";
  const missingList =
    input.missingDocuments.length > 0 ? input.missingDocuments.join(", ") : "—";
  // One draft per missing document would spam the client; the nudge
  // names the first missing document and the count, and the body lists
  // them all. The subject uses the first document so it stays short.
  const rendered = renderMissingDocumentNudge(
    englishFallback ? "en" : input.language,
    {
      name: input.clientName,
      service: input.service,
      missingDocument: input.missingDocuments[0] ?? "a document",
      portalUrl: PORTAL_URL,
    }
  );
  const body =
    rendered.emailBody +
    (input.missingDocuments.length > 1
      ? `\n\nAll documents still missing: ${missingList}.`
      : "") +
    `\n\n${CLERICAL_NOTE}`;
  return {
    subject: rendered.emailSubject,
    body,
    labels,
    sendable,
    blockedReason,
    englishFallback,
  };
}

// ---------------------------------------------------------------------------
// Honest empty states — never invent rows.
// ---------------------------------------------------------------------------

export function leadsEmptyState(): string {
  return "No leads yet — share your referral link to bring in your first enquiry. Leads appear here only when a real person fills in the intake form.";
}

export function pipelineEmptyState(role: PipelineRole): string {
  const label =
    role === "preparer"
      ? "preparer"
      : role === "attorney"
        ? "attorney"
        : "DOJ-accredited";
  return `No clients in the ${label} pipeline yet — convert a lead to create your first case. Cases appear here only after a real lead converts; nothing is shown until then.`;
}

export function pipelineRowMatchesRole(
  row: PipelineClientRow,
  role: PipelineRole
): boolean {
  if (role === "preparer") return row.assignedProviderRole === "preparer";
  if (role === "attorney") return row.assignedProviderRole === "attorney";
  return row.assignedProviderRole === "nonprofit";
}
