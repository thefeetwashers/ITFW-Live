// Unpriced forms — quoted individually, never priced by invention.
// ---------------------------------------------------------------------------
// Which forms have NO locked price in this codebase (see the note at the
// bottom of src/lib/stripePrices.ts — "NOT created, by design"):
//   * I-526E / I-526 / I-829 — quoted individually.
//   * I-693 — free booking; the doctor's fee ($250–$500) is paid to the
//     doctor, not here (see src/lib/formChains.ts + src/lib/bundles.ts).
//
// A client who needs one of these forms can REQUEST A PRICING QUOTE from
// the service catalog (src/components/portal/ServiceCatalog.tsx — the
// "Quoted individually" section, rendered by
// src/components/portal/RequestQuoteForm.tsx). The request is saved to
// the existing public.quote_requests table (migration 0002: id, name,
// email, phone, description, status, created_at). Migration 0025 adds
// three nullable columns — form_code, account_id, case_id — so the
// request can be tied to a form and a case; the API route
// (/api/quote-requests) still saves the request even before 0025 runs,
// by falling back to the 0002 columns with the form code written into
// the description. No price is ever invented for a quoted form — the UI
// shows "quoted individually — no price invented" and nothing here
// returns a price, a quote amount, or a quote expiry.
//
// Notification: the route attempts one SES email to the platform
// contact (nipteiapp@gmail.com — src/lib/notificationTemplates.ts
// CONTACT_EMAIL) via src/lib/email.ts. When SES is not configured the
// send returns 501/not_configured and the route says so honestly —
// it never claims the professional was notified. No DOB, A-Number,
// SSN or passport number is ever part of a quote request, and none
// appears in an email subject.
//
// This module is pure (no Supabase, no fetch, no secrets) except for
// the re-exported contact constant; the route owns all I/O.

import { CONTACT_EMAIL } from "./notificationTemplates";

export { CONTACT_EMAIL };

/** The address a quote-request notification is sent to (SES, via
 *  src/lib/email.ts). The professional assigned to the case is
 *  notified through the same send when the route knows one; a quote
 *  request has no assigned professional yet, so the platform intake
 *  contact is notified. Never claim sent when SES is unconfigured. */
export const QUOTE_NOTIFICATION_EMAIL = CONTACT_EMAIL;

/** A form with no locked price — the price is quoted individually. */
export interface UnpricedForm {
  formCode: "I-526E" | "I-526" | "I-829" | "I-693";
  name: string;
  /** Why there is no price shown — the honest state, in plain words. */
  pricingState: string;
  /** What the client can do instead. */
  nextStep: string;
}

export const UNPRICED_FORMS: UnpricedForm[] = [
  {
    formCode: "I-526E",
    name: "Form I-526E — Immigrant Petition by Regional Center Investor",
    pricingState: "Quoted individually — no price invented.",
    nextStep:
      "Request a pricing quote below. A professional replies with a quote for your situation — no price is shown until they do.",
  },
  {
    formCode: "I-526",
    name: "Form I-526 — Immigrant Petition by Standalone Investor",
    pricingState: "Quoted individually — no price invented.",
    nextStep:
      "Request a pricing quote below. A professional replies with a quote for your situation — no price is shown until they do.",
  },
  {
    formCode: "I-829",
    name: "Form I-829 — Petition by Investor to Remove Conditions",
    pricingState: "Quoted individually — no price invented.",
    nextStep:
      "Request a pricing quote below. A professional replies with a quote for your situation — no price is shown until they do.",
  },
  {
    formCode: "I-693",
    name: "Form I-693 — Report of Immigration Medical Examination and Vaccination Record",
    pricingState:
      "Free booking — no preparation price. The doctor's fee ($250–$500) is paid to the doctor, not here.",
    nextStep:
      "Book a USCIS-designated civil surgeon — the doctor completes and seals the form. Use the quote form below only if you want a professional to help arrange the booking.",
  },
];

export const UNPRICED_FORM_CODES: string[] = UNPRICED_FORMS.map(
  (f) => f.formCode
);

/** True when the form has no locked price and must be quoted. */
export function isUnpricedForm(formCode: string): boolean {
  return UNPRICED_FORM_CODES.includes(formCode);
}

export function unpricedForm(formCode: string): UnpricedForm | null {
  return UNPRICED_FORMS.find((f) => f.formCode === formCode) ?? null;
}

/** The honest pricing state shown on the form page. Never a price. */
export function quotedFormPricingState(formCode: string): string {
  const form = unpricedForm(formCode);
  if (!form) return "";
  return `${form.name}: ${form.pricingState}`;
}

// ---------------------------------------------------------------------------
// Quote-request input — pure builder + validator for /api/quote-requests.
// ---------------------------------------------------------------------------

export interface QuoteRequestInput {
  name: string;
  email: string;
  phone: string | null;
  formCode: string;
  /** Free text from the client — what they need quoted. */
  description: string;
  accountId: string | null;
  caseId: string | null;
}

export interface QuoteRequestRow {
  name: string;
  email: string;
  phone: string | null;
  description: string;
  status: "pending";
  form_code: string;
  account_id: string | null;
  case_id: string | null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validate + build the row for public.quote_requests. Returns an error
 * string (never throws) when the input cannot be saved honestly.
 * The description always starts with the form code, so the request
 * stays readable even on the pre-0025 schema (no form_code column).
 */
export function buildQuoteRequestRow(input: {
  name?: unknown;
  email?: unknown;
  phone?: unknown;
  formCode?: unknown;
  description?: unknown;
  accountId?: unknown;
  caseId?: unknown;
}): { row: QuoteRequestRow; error: null } | { row: null; error: string } {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const email = typeof input.email === "string" ? input.email.trim() : "";
  const phone =
    typeof input.phone === "string" && input.phone.trim()
      ? input.phone.trim()
      : null;
  const formCode =
    typeof input.formCode === "string" ? input.formCode.trim() : "";
  const detail =
    typeof input.description === "string" ? input.description.trim() : "";
  const accountId =
    typeof input.accountId === "string" && UUID_RE.test(input.accountId)
      ? input.accountId
      : null;
  const caseId =
    typeof input.caseId === "string" && UUID_RE.test(input.caseId)
      ? input.caseId
      : null;

  if (!name) return { row: null, error: "Your name is required." };
  if (!email || !EMAIL_RE.test(email))
    return { row: null, error: "A valid email address is required." };
  if (!formCode || !isUnpricedForm(formCode))
    return {
      row: null,
      error: `Pricing quotes are only taken for unpriced forms (${UNPRICED_FORM_CODES.join(", ")}). Form "${formCode || "(none)"}" has a locked price — see the catalog.`,
    };
  if (name.length > 200 || email.length > 200 || (phone && phone.length > 40))
    return { row: null, error: "Name, email or phone is too long." };
  if (detail.length > 2000)
    return { row: null, error: "Your message is too long (2,000 characters max)." };

  const description =
    `Pricing quote request — Form ${formCode}` +
    (detail ? `: ${detail}` : ". No price has been quoted yet.");
  return {
    row: {
      name,
      email,
      phone,
      description,
      status: "pending",
      form_code: formCode,
      account_id: accountId,
      case_id: caseId,
    },
    error: null,
  };
}

/** Subject line for the notification email — form code only, never a
 *  name, email or other personal detail (no PII in subjects). */
export function quoteNotificationSubject(formCode: string): string {
  return `New pricing quote request — Form ${formCode}`;
}

/** Plain-text body for the notification email. Personal details live
 *  in the body only — never in the subject, never in a log line. */
export function quoteNotificationBody(row: QuoteRequestRow): string {
  return (
    `A client asked for a pricing quote (Immigration with NIPTEI).\n\n` +
    `Form: ${row.form_code}\n` +
    `Name: ${row.name}\n` +
    `Email: ${row.email}\n` +
    `Phone: ${row.phone ?? "(not given)"}\n` +
    `Request: ${row.description}\n\n` +
    `Status: pending. Reply to the client with a quote for their situation — ` +
    `no price was shown to them, and none has been invented. ` +
    `Only a licensed attorney or DOJ-accredited representative gives legal advice.`
  );
}
