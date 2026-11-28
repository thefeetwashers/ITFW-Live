// Business tools — the professional's "run my whole business online"
// layer (Nov 28, 2026, founder's request). Pure functions only: no
// Supabase, no network, no secrets, no invented data.
//
// What already existed (verified before building — do NOT duplicate):
//   * Platform Stripe checkout + webhook — src/app/api/checkout/route.ts,
//     src/app/api/stripe/webhook/route.ts, src/lib/stripePrices.ts (LOCKED).
//   * BYO integrations — src/lib/byo.ts (provider_settings, 0014):
//     each professional connects their OWN accounts; keys encrypted,
//     last-4 only, "not_configured" until connected + tested.
//   * Booking requests collected — src/lib/booking.ts, /api/bookings,
//     preparer_appointments (0012) + consultation_requests (0017).
//   * E-sign table — signatures (0001). NO request flow existed.
//   * Vault + expiry flags — src/lib/vaultExpiry.ts, documents (0001)
//     + expires_on (0029). NO per-client view existed.
//   * Unified thread — src/components/comms/UnifiedThread.tsx,
//     messages (0001, is_read) + /api/messages/send (501 for SMS/
//     WhatsApp until BYO Twilio connected). NO unread-per-case counts.
//   * Invoices — invoices (0001) + src/lib/reporting.ts summarizeMoney.
//     NO professional invoice list, NO send-via-SES route existed.
//   * Pipeline — src/lib/pipeline.ts + ClientPipeline.tsx. NO
//     name/stage/payment search existed.
//   * Reporting — src/lib/reporting.ts (global money ladder). NO
//     per-professional monthly summary existed.
//
// CANONICAL CALENDAR TABLES (do not invent a second calendar table):
//   * appointments (0001) — the CONFIRMED appointment. This is the
//     calendar's source of truth once a request is accepted.
//   * preparer_appointments (0012, + decision columns 0017) —
//     consultation requests collected from the storefront.
//   * consultation_requests (0017) — consultation requests with
//     mode / duration / locked price ($0 15-min / $99 30-min).
//   Google Calendar is NOT connected (google_connections, 0030, is
//   status-only, no tokens). No calendar event is ever created by
//   this module and no sync is ever claimed.
//
// HARD RULES (same as the rest of the portal):
//   * REAL ONLY: every number comes from rows passed in. Empty input
//     returns zeros + isEmpty — never invented clients/revenue.
//   * Document preparation only, NOT a law firm, NOT USCIS-affiliated.
//     Only a licensed attorney or DOJ-accredited representative gives
//     legal advice (8 CFR 292.1). No approval is ever promised.
//   * DOB / A-Number / SSN / passport numbers: masked, never logged,
//     never in email subjects. This file handles none of them.
//   * No credential is stored or logged here — only key_last4, via
//     src/lib/byo.ts last4(). publicConnectionView() strips everything
//     except provider key, status, last-4 and timestamps.
import { MISSED_PAYMENT_RULE, missedPaymentTotal } from "./order";
import type { ProviderConnection, ProviderKey } from "./byo";
import { last4 } from "./byo";
import type { PipelineClientRow, PaymentStatus } from "./pipeline";
import type { InvoiceRow, OrderInvoiceRow } from "./reporting";
import { formatCents } from "./reporting";
import {
  deriveVaultExpiries,
  type VaultDocumentDerived,
  type VaultDocumentInput,
} from "./vaultExpiry";

export { MISSED_PAYMENT_RULE, formatCents };

// ---------------------------------------------------------------------------
// a. Payments — the professional's OWN Stripe (BYO stripe_own)
// ---------------------------------------------------------------------------

export const BYO_STRIPE_NOT_CONNECTED =
  "Your own Stripe is NOT CONNECTED — client payments into your Stripe account are not live. Connect your own Stripe in BYO Integrations (last 4 only, never a full key) and test it before taking a payment. Platform bundle checkout (locked prices, src/lib/stripePrices.ts) is separate and is paid to the platform, never to you.";

export interface ByoStripeStatus {
  providerKey: "stripe_own";
  status: "connected" | "not_connected" | "test_pending";
  keyLast4: string | null;
  canTakePayments: boolean;
  label: string;
}

/** The professional's own-Stripe status, from their BYO connection row
 *  (provider_settings, 0014) — null when they have no row yet. A
 *  payment is possible ONLY when connected AND test-passed. */
export function describeByoStripe(
  conn: ProviderConnection | null
): ByoStripeStatus {
  if (!conn || conn.status === "not_connected") {
    return {
      providerKey: "stripe_own",
      status: "not_connected",
      keyLast4: null,
      canTakePayments: false,
      label: BYO_STRIPE_NOT_CONNECTED,
    };
  }
  if (conn.status === "connected" && conn.testStatus === "passed") {
    return {
      providerKey: "stripe_own",
      status: "connected",
      keyLast4: conn.keyLast4,
      canTakePayments: true,
      label: `Your own Stripe is connected${conn.keyLast4 ? ` (••••${conn.keyLast4.slice(-4)})` : ""} and test-passed — client payments go to your Stripe account, never through the platform.`,
    };
  }
  return {
    providerKey: "stripe_own",
    status: "test_pending",
    keyLast4: conn.keyLast4,
    canTakePayments: false,
    label:
      "Your own Stripe is connected but NOT test-passed yet — test-send / test-charge to your own account first. No client payment can be taken until the test passes.",
  };
}

/** Public view of a BYO connection — safe to render or log. Only the
 *  last 4 of a key ever leaves this function; a full key can never
 *  pass through it because the input type carries keyLast4 only. */
export function publicConnectionView(conn: ProviderConnection): {
  providerKey: ProviderKey;
  status: string;
  keyLast4: string | null;
  connectedAt: string | null;
  lastTestedAt: string | null;
  testStatus: string;
} {
  return {
    providerKey: conn.providerKey,
    status: conn.status,
    keyLast4: conn.keyLast4 ? last4(conn.keyLast4) : null,
    connectedAt: conn.connectedAt,
    lastTestedAt: conn.lastTestedAt,
    testStatus: conn.testStatus,
  };
}

// ---------------------------------------------------------------------------
// b. Scheduling / calendar — merged view over the three canonical tables
// ---------------------------------------------------------------------------

export const CALENDAR_NOT_CONNECTED =
  "Google Calendar is NOT connected — no calendar sync exists yet. Appointments below are the platform's own records only: confirmed appointments plus consultation requests waiting for your answer. Confirm a time with the client by message; no calendar event is created.";

export type CalendarEventSource =
  | "appointment" // appointments (0001) — confirmed
  | "preparer_appointment" // preparer_appointments (0012/0017) — request
  | "consultation_request"; // consultation_requests (0017) — request

export interface CalendarEvent {
  id: string;
  source: CalendarEventSource;
  /** "confirmed" only for appointments rows; requests are "requested". */
  kind: "confirmed" | "requested";
  label: string;
  /** ISO start, or null when the request has no time yet. */
  startsAt: string | null;
  endsAt: string | null;
  mode: string | null;
  priceCents: number | null;
  status: string;
  caseId: string | null;
}

export interface AppointmentRowInput {
  id: string;
  case_id: string;
  client_id: string;
  provider_id: string;
  type: string;
  status: string;
  starts_at: string;
  ends_at: string;
  location_or_link: string | null;
}

export interface PreparerAppointmentRowInput {
  id: string;
  case_id: string | null;
  requester_name: string;
  consultation_type: string;
  preferred_time: string | null;
  status: string;
  decision: string | null;
  proposed_time: string | null;
  created_at: string;
}

export interface ConsultationRequestRowInput {
  id: string;
  requester_name: string;
  mode: string;
  duration_minutes: number;
  price_cents: number;
  requested_time_text: string | null;
  proposed_starts_at: string | null;
  status: string;
  created_at: string;
}

export function mergeCalendarEvents(args: {
  appointments: AppointmentRowInput[];
  preparerAppointments: PreparerAppointmentRowInput[];
  consultationRequests: ConsultationRequestRowInput[];
}): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  for (const a of args.appointments) {
    events.push({
      id: `appointment:${a.id}`,
      source: "appointment",
      kind: "confirmed",
      label: `${a.type} — confirmed appointment`,
      startsAt: a.starts_at,
      endsAt: a.ends_at,
      mode: null,
      priceCents: null,
      status: a.status,
      caseId: a.case_id,
    });
  }
  for (const p of args.preparerAppointments) {
    events.push({
      id: `preparer_appointment:${p.id}`,
      source: "preparer_appointment",
      kind: "requested",
      label: `Consultation request — ${p.requester_name} (${p.consultation_type})`,
      startsAt: p.proposed_time,
      endsAt: null,
      mode: p.consultation_type,
      priceCents: null,
      status: p.decision ?? p.status,
      caseId: p.case_id,
    });
  }
  for (const c of args.consultationRequests) {
    events.push({
      id: `consultation_request:${c.id}`,
      source: "consultation_request",
      kind: "requested",
      label: `Consultation request — ${c.requester_name} (${c.mode}, ${c.duration_minutes} min)`,
      startsAt: c.proposed_starts_at,
      endsAt: null,
      mode: c.mode,
      priceCents: c.price_cents,
      status: c.status,
      caseId: null,
    });
  }
  // Dated first (soonest first); undated requests last, newest first
  // is not knowable from startsAt alone, so they keep input order.
  return events.sort((x, y) => {
    if (!x.startsAt && !y.startsAt) return 0;
    if (!x.startsAt) return 1;
    if (!y.startsAt) return -1;
    return x.startsAt < y.startsAt ? -1 : x.startsAt > y.startsAt ? 1 : 0;
  });
}

export function upcomingCalendarEvents(
  events: CalendarEvent[],
  fromIso: string
): CalendarEvent[] {
  return events.filter((e) => !e.startsAt || e.startsAt >= fromIso);
}

export function groupCalendarByDate(
  events: CalendarEvent[]
): { date: string; events: CalendarEvent[] }[] {
  const map = new Map<string, CalendarEvent[]>();
  for (const e of events) {
    const date = e.startsAt ? e.startsAt.slice(0, 10) : "no date yet";
    const list = map.get(date) ?? [];
    list.push(e);
    map.set(date, list);
  }
  return Array.from(map.entries())
    .map(([date, list]) => ({ date, events: list }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

// ---------------------------------------------------------------------------
// c. E-signature — request flow over the signatures table (0001)
// ---------------------------------------------------------------------------

export const ESIGN_PROVIDER_STATUS =
  "No e-signature provider is connected — signatures are collected in-platform as a typed electronic signature only (signer types their full name and confirms they reviewed the document). Connect your own e-signature provider in BYO Integrations if you want an outside provider; until then nothing here claims an outside provider signed anything.";

export interface SignatureRequestInput {
  caseId: string;
  clientId: string;
  formCode: string;
  documentId: string | null;
  signerFullName: string;
}

export interface SignatureRequestRow {
  case_id: string;
  client_id: string;
  form_code: string;
  document_id: string | null;
  signer_full_name: string;
  signature_method: "typed_electronic";
  digital_review_confirmed: boolean;
  signed_at: null;
  providerStatus: string;
}

/** Build the row POST /api/signatures/request inserts. A request is
 *  UNSIGNED (signed_at null) — the client signs later, in-platform,
 *  by typing their name and confirming review. The row never claims
 *  an outside provider was involved. */
export function buildSignatureRequest(
  input: SignatureRequestInput
): { ok: true; row: SignatureRequestRow } | { ok: false; error: string } {
  if (!input.caseId.trim() || !input.clientId.trim()) {
    return { ok: false, error: "caseId and clientId are required." };
  }
  if (!input.formCode.trim()) {
    return { ok: false, error: "formCode is required (e.g. I-130)." };
  }
  if (input.signerFullName.trim().length < 2) {
    return { ok: false, error: "signerFullName is required." };
  }
  return {
    ok: true,
    row: {
      case_id: input.caseId,
      client_id: input.clientId,
      form_code: input.formCode.trim(),
      document_id: input.documentId,
      signer_full_name: input.signerFullName.trim(),
      signature_method: "typed_electronic",
      digital_review_confirmed: false,
      signed_at: null,
      providerStatus: ESIGN_PROVIDER_STATUS,
    },
  };
}

export function signatureStatusLabel(row: {
  signed_at: string | null;
  digital_review_confirmed: boolean;
}): string {
  if (row.signed_at) return `Signed ${row.signed_at.slice(0, 10)} (typed electronic, in-platform)`;
  return "Signature requested — not signed yet. No e-signature provider connected.";
}

// ---------------------------------------------------------------------------
// d. Document storage — per-client vault view (wires expiry flags in)
// ---------------------------------------------------------------------------

export interface ClientVaultGroup {
  clientLabel: string;
  caseId: string;
  documents: VaultDocumentDerived[];
  expiredCount: number;
  expiringSoonCount: number;
  noExpiryOnFileCount: number;
}

export function groupVaultByClient(
  docs: VaultDocumentInput[],
  now: Date = new Date()
): ClientVaultGroup[] {
  const derived = deriveVaultExpiries(docs, now);
  const map = new Map<string, VaultDocumentDerived[]>();
  for (const d of derived) {
    const key = `${d.caseId}::${d.clientLabel ?? "Client"}`;
    const list = map.get(key) ?? [];
    list.push(d);
    map.set(key, list);
  }
  return Array.from(map.entries())
    .map(([key, documents]) => {
      const [caseId, clientLabel] = key.split("::");
      return {
        clientLabel,
        caseId,
        documents,
        expiredCount: documents.filter((d) => d.status === "expired").length,
        expiringSoonCount: documents.filter((d) => d.status === "expiring_soon").length,
        noExpiryOnFileCount: documents.filter((d) => d.status === "no_expiry_on_file").length,
      };
    })
    .sort((a, b) => b.expiredCount + b.expiringSoonCount - (a.expiredCount + b.expiringSoonCount));
}

// ---------------------------------------------------------------------------
// e. Messaging — unread counts per case (messages.is_read, 0001)
// ---------------------------------------------------------------------------

export interface MessageRowInput {
  id: string;
  case_id: string;
  recipient_id: string;
  is_read: boolean;
}

export function countUnreadByCase(
  messages: MessageRowInput[],
  recipientId: string
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const m of messages) {
    if (m.recipient_id !== recipientId || m.is_read) continue;
    counts[m.case_id] = (counts[m.case_id] ?? 0) + 1;
  }
  return counts;
}

export function unreadForCase(
  unreadByCase: Record<string, number>,
  caseId: string
): number {
  return unreadByCase[caseId] ?? 0;
}

export const SMS_WHATSAPP_NOT_CONNECTED =
  "SMS / WhatsApp return 501 until your own Twilio account is connected (BYO Integrations) and test-sent to your own phone. Portal chat works in-platform; SMS and WhatsApp do not send until then.";

// ---------------------------------------------------------------------------
// f. Invoicing — professional list + send-via-SES + missed-payment rule
// ---------------------------------------------------------------------------

export interface ProfessionalInvoiceView extends InvoiceRow {
  /** DB invoices.description (0001) — reporting.ts InvoiceRow does not
   *  carry it, so the view adds it (falls back to the form code). */
  description: string;
  /** Total the client owes if this invoice is missed (service fee x1.5).
   *  Shown only for past_due / open / pending invoices, per the locked
   *  missed-payment rule in src/lib/order.ts. */
  missedPaymentTotalCents: number | null;
  missedPaymentRule: string;
}

export function listProfessionalInvoices(
  invoices: InvoiceRow[],
  providerId: string
): ProfessionalInvoiceView[] {
  return invoices
    .filter((inv) => inv.provider_id === providerId)
    .map((inv) => ({
      ...inv,
      description:
        (inv as { description?: string | null }).description?.trim() ||
        inv.form_code ||
        "Invoice",
      missedPaymentTotalCents:
        inv.status === "past_due" || inv.status === "open" || inv.status === "pending"
          ? missedPaymentTotal(inv.service_fee_cents)
          : null,
      missedPaymentRule: MISSED_PAYMENT_RULE,
    }))
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

/** Send status for an invoice email. SES is the platform sender
 *  (src/lib/email.ts); when it is not configured the caller must
 *  return 501 and never claim the invoice was sent. */
export function invoiceSendBlockedReason(emailConfigured: boolean): string | null {
  return emailConfigured
    ? null
    : "Email is not connected (AWS SES not configured) — the invoice was NOT sent. Configure SES first.";
}

// ---------------------------------------------------------------------------
// g. Client management — search / filter over pipeline rows
// ---------------------------------------------------------------------------

export interface ClientFilter {
  query?: string;
  stage?: number | null;
  paymentStatus?: PaymentStatus | null;
}

export function filterPipelineClients(
  rows: PipelineClientRow[],
  filter: ClientFilter
): PipelineClientRow[] {
  const q = (filter.query ?? "").trim().toLowerCase();
  return rows.filter((r) => {
    if (q) {
      const haystack = `${r.clientName} ${r.email} ${r.phone ?? ""} ${r.service}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    if (filter.stage != null && r.stageNumber !== filter.stage) return false;
    if (filter.paymentStatus && r.paymentStatus !== filter.paymentStatus) return false;
    return true;
  });
}

// ---------------------------------------------------------------------------
// h. Reporting — per-professional monthly summary (real rows only)
// ---------------------------------------------------------------------------

export interface CaseSummaryRow {
  id: string;
  provider_id: string | null;
  created_at: string;
  /** Null = still open. A closed date is a real row value, never derived. */
  closed_at: string | null;
}

export interface ProfessionalMonthlySummary {
  providerId: string;
  month: string;
  casesOpened: number;
  casesClosed: number;
  /** Service fees actually collected (paid invoices, this provider,
   *  this month). USCIS government fees are reported separately. */
  revenueCollectedCents: number;
  govFeesCollectedCents: number;
  invoicesPaidCount: number;
  isEmpty: boolean;
}

export function summarizeMonthlyProfessional(args: {
  providerId: string;
  month: string; // "YYYY-MM"
  invoices: InvoiceRow[];
  orderInvoices: OrderInvoiceRow[];
  cases: CaseSummaryRow[];
}): ProfessionalMonthlySummary {
  const { providerId, month, invoices, orderInvoices, cases } = args;
  const inMonth = (iso: string | null | undefined): boolean =>
    !!iso && iso.slice(0, 7) === month;
  let revenue = 0;
  let gov = 0;
  let paidCount = 0;
  for (const inv of invoices) {
    if (inv.provider_id !== providerId) continue;
    if (inv.status !== "paid") continue;
    if (!inMonth(inv.paid_at ?? inv.created_at)) continue;
    revenue += inv.service_fee_cents;
    gov += inv.uscis_fee_cents;
    paidCount += 1;
  }
  // Order-invoice milestones carry no provider id, so they are NEVER
  // attributed to a professional here — attributing them would invent
  // revenue for someone. They count in the global money ladder only
  // (src/lib/reporting.ts summarizeMoney).
  void orderInvoices;
  const mine = cases.filter((c) => c.provider_id === providerId);
  const opened = mine.filter((c) => inMonth(c.created_at)).length;
  const closed = mine.filter((c) => inMonth(c.closed_at)).length;
  return {
    providerId,
    month,
    casesOpened: opened,
    casesClosed: closed,
    revenueCollectedCents: revenue,
    govFeesCollectedCents: gov,
    invoicesPaidCount: paidCount,
    isEmpty:
      opened === 0 && closed === 0 && revenue === 0 && gov === 0 && paidCount === 0,
  };
}
