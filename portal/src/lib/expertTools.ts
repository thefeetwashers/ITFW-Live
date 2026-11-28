// Expert tools — Immigration with NIPTEI (Nov 28, 2026, founder's question:
// "what else other tool you want to add").
//
// Seven tools, all pure logic in this file; the API routes under
// src/app/api/ are thin wrappers over these functions.
//
// HARD RULES (same as the rest of the portal):
//  * REAL ONLY — never invent a signature, meeting link, translation,
//    invoice, revenue figure, or a "live" claim. Every tool reports its
//    connection state honestly (connected / BYO slot / not connected).
//  * Document-preparation service, NOT a law firm, NOT USCIS affiliated.
//    Only a licensed attorney or DOJ-accredited representative gives
//    legal advice (8 CFR 292.1). No AI decides relief / eligibility /
//    evidence strength / safe-to-leave. Never promise or imply approval.
//  * Locked prices in src/lib/stripePrices.ts are never changed here.
//    Translation is $45/page (addon_translation_page, 4500 cents).
//  * DOB, A-Number, SSN, passport numbers: masked in UI, never logged,
//    never in email subjects — and never in any export built here.
//  * Email is AWS SES via src/lib/email.ts; unconfigured => 501, never
//    "sent".
//
// Connection states (Nov 28, 2026):
//  1. E-signature ......... IN-PLATFORM (typed electronic) — no outside
//     e-sign provider connected; BYO slot "esign" in src/lib/byo.ts.
//  2. Video meetings ...... NOT CONNECTED (Google OAuth setup not done;
//     google_connections has calendar/drive/gmail only, no Meet event
//     creation) — manual-link path instead. Never a fake Meet link.
//  3. Document scanner/OCR  NOT AVAILABLE — no OCR library is installed
//     and pinning is not safely achievable in this build (see OCR_STATUS).
//  4. Translation ordering  NOT CONNECTED (Google Cloud Translation BYO
//     slot, GOOGLE_TRANSLATE_API_KEY) — orders stay "pending".
//  5. Invoicing & receipts  Stripe invoices (invoices, 0001) + webhook
//     records — receipt view added here; USCIS fee always separate.
//  6. Founder analytics ... REAL ROWS ONLY (src/lib/reporting.ts) —
//     per-month / per-form / per-professional already existed; the
//     aggregator below adds translation + signature queues. No
//     subscriptions table exists, so subscription revenue is NOT
//     reported (never invented from Stripe — it is not in DB rows).
//  7. Backup & export ..... reuses packet generation + print paths;
//     manifest lists what is included and what is not, audit-logged.
import { createHash } from "crypto";
import { getLockedPriceByKey } from "@/lib/stripePrices";
import {
  formatCents,
  summarizeCasesByStage,
  summarizeLeads,
  summarizeMoney,
  summarizeNotifications,
  summarizeOperations,
  type CasesByStage,
  type DocumentRow,
  type InboxItemRow,
  type InvoiceRow,
  type LeadsSummary,
  type LeadRow,
  type LifecycleRow,
  type MoneySummary,
  type NotificationLogRow,
  type NotificationsSummary,
  type OperationsSummary,
  type OrderInvoiceRow,
  type PaymentPlanRow,
} from "@/lib/reporting";
import {
  translationEstimate,
  TRANSLATION_PRICE_PER_PAGE_CENTS,
  type TranslationItem,
} from "@/lib/moreAdded";
import { ESIGN_PROVIDER_STATUS } from "@/lib/businessTools";

export { formatCents, TRANSLATION_PRICE_PER_PAGE_CENTS };

// ===========================================================================
// 1. E-SIGNATURE — in-platform typed electronic signature + audit trail.
//    The signatures table (migration 0001) already had: case_id,
//    client_id, form_code, document_id, signer_full_name,
//    signature_method ('typed_electronic'), digital_review_confirmed,
//    signed_at, ip_address. Migration 0033 adds: packet_ref,
//    packet_version_hash, intent_confirmed, signed_from, provider.
//    The request flow (buildSignatureRequest / POST
//    /api/signatures/request) already existed — it creates an UNSIGNED
//    row (signed_at null). This completes it: a signature is recorded
//    ONLY when the signer types their own name, confirms they reviewed
//    the document, and ticks the intent checkbox. There is NO code path
//    that signs on anyone's behalf — completeSignature() refuses every
//    input that lacks any of those three, and nothing auto-fills them.
// ===========================================================================

export const ESIGN_PROVIDER = "in_platform_typed_electronic" as const;

export interface SignatureRequestRow {
  id?: string;
  signed_at: string | null;
  signer_full_name: string;
  digital_review_confirmed: boolean;
  intent_confirmed?: boolean | null;
}

export interface SignatureCompletionInput {
  /** Exactly what the signer typed. Must match the request name. */
  typedName: string;
  /** "I intend to sign this document electronically." — required. */
  intentConfirmed: boolean;
  /** "I reviewed the document." — required (matches the 0001 check
   *  constraint: signed_at is null unless digital_review_confirmed). */
  reviewConfirmed: boolean;
  /** What was signed: packet id (e.g. the generate-packet output id). */
  packetRef: string;
  /** Packet version (e.g. "v3" or a draft timestamp) — hashed with the
   *  packet id so the record pins exactly what was signed. */
  packetVersion: string;
  /** Signed-at time; defaults to now. Never backdated by the server. */
  signedAtIso?: string;
}

/** SHA-256 of "<packetRef>@<packetVersion>" — pins what was signed. */
export function packetVersionHash(packetRef: string, packetVersion: string): string {
  return createHash("sha256").update(`${packetRef}@${packetVersion}`, "utf8").digest("hex");
}

export function completeSignature(
  request: SignatureRequestRow,
  input: SignatureCompletionInput
):
  | {
      ok: true;
      patch: {
        signer_full_name: string;
        signature_method: "typed_electronic";
        digital_review_confirmed: true;
        intent_confirmed: true;
        signed_at: string;
        packet_ref: string;
        packet_version_hash: string;
        signed_from: string;
        provider: typeof ESIGN_PROVIDER;
      };
      audit: { who: string; what: string; when: string; from: string };
    }
  | { ok: false; error: string } {
  if (request.signed_at) {
    return { ok: false, error: "This signature request is already signed. A signed record is never re-signed or overwritten." };
  }
  if (!input.intentConfirmed) {
    return { ok: false, error: "The signer must tick the intent checkbox (\"I intend to sign this document electronically\"). No signature was recorded." };
  }
  if (!input.reviewConfirmed) {
    return { ok: false, error: "The signer must confirm they reviewed the document. No signature was recorded." };
  }
  const typed = input.typedName.trim();
  if (typed.length < 2) {
    return { ok: false, error: "The signer must type their full name. No signature was recorded." };
  }
  if (typed.toLowerCase() !== request.signer_full_name.trim().toLowerCase()) {
    return {
      ok: false,
      error: "The typed name does not match the name on the signature request. Only the named signer can sign — no one else can sign for them, and no signature was recorded.",
    };
  }
  if (!input.packetRef.trim() || !input.packetVersion.trim()) {
    return { ok: false, error: "packetRef and packetVersion are required — a signature must record exactly what was signed." };
  }
  const signedAt = input.signedAtIso ?? new Date().toISOString();
  const hash = packetVersionHash(input.packetRef.trim(), input.packetVersion.trim());
  return {
    ok: true,
    patch: {
      signer_full_name: typed,
      signature_method: "typed_electronic",
      digital_review_confirmed: true,
      intent_confirmed: true,
      signed_at: signedAt,
      packet_ref: input.packetRef.trim(),
      packet_version_hash: hash,
      signed_from: "typed name + intent checkbox (in-platform)",
      provider: ESIGN_PROVIDER,
    },
    audit: {
      who: typed,
      what: `${input.packetRef.trim()}@${input.packetVersion.trim()} (sha256 ${hash.slice(0, 16)}…)`,
      when: signedAt,
      from: "typed name + intent checkbox (in-platform)",
    },
  };
}

export const ESIGN_STATUS = {
  provider: ESIGN_PROVIDER,
  outsideProviderConnected: false,
  byoSlot: "esign" as const,
  note: ESIGN_PROVIDER_STATUS,
} as const;

// ===========================================================================
// 2. VIDEO MEETINGS — booking that creates a video link, honestly.
//    Google OAuth setup is NOT done, and google_connections (migration
//    0030) has products calendar / drive / gmail only — there is NO Meet
//    event-creation code anywhere. So:
//      * Google connected + a real Meet link returned by a real calendar
//        event  -> that link is used (it came from Google, not from us).
//      * Google connected but no event created yet -> NO link is shown;
//        the honest state is "connected, no event yet".
//      * Otherwise -> the professional pastes their own meeting link
//        (manual-link path). The pasted link must be a valid https URL.
//    A Meet link is NEVER generated, guessed, or fabricated here. A URL
//    that merely looks like meet.google.com is accepted ONLY as a manual
//    link the professional pasted themselves — it is labelled "manual
//    link provided by the professional", never "created by Google".
// ===========================================================================

export type VideoLinkSource = "google_meet" | "manual" | "none";

export interface VideoMeetingInput {
  /** True only when a google_connections row for "calendar" is
   *  status "connected" (see src/lib/googleIntegrations.ts). */
  googleCalendarConnected: boolean;
  /** A Meet link returned by a REAL Google Calendar event creation.
   *  Null in this build — no event-creation code exists yet. */
  googleMeetLinkFromEvent: string | null;
  /** Meeting link the professional pasted themselves, or null. */
  manualLink: string | null;
}

export interface VideoMeetingResolution {
  source: VideoLinkSource;
  /** The link to show the client, or null when there is none. */
  link: string | null;
  status: string;
  note: string;
}

export function isValidManualMeetingLink(link: string): boolean {
  try {
    const url = new URL(link.trim());
    return url.protocol === "https:" && url.hostname.length > 0;
  } catch {
    return false;
  }
}

export function resolveVideoMeeting(input: VideoMeetingInput): VideoMeetingResolution {
  const fromEvent = (input.googleMeetLinkFromEvent ?? "").trim();
  if (fromEvent) {
    try {
      const url = new URL(fromEvent);
      if (url.protocol === "https:" && url.hostname === "meet.google.com") {
        return {
          source: "google_meet",
          link: fromEvent,
          status: "google_meet_from_calendar_event",
          note: "Video link from a real Google Calendar event created in the professional's connected Google account.",
        };
      }
    } catch {
      // Not a usable URL — fall through to the manual path / none.
    }
  }
  if (input.googleCalendarConnected && !fromEvent) {
    const manual = (input.manualLink ?? "").trim();
    if (manual && isValidManualMeetingLink(manual)) {
      return {
        source: "manual",
        link: manual,
        status: "google_connected_no_event_manual_link_used",
        note: "Google Calendar is connected, but no Meet link exists yet — no calendar event has been created for this appointment. Showing the manual link the professional pasted instead.",
      };
    }
    return {
      source: "none",
      link: null,
      status: "google_connected_no_event",
      note: "Google Calendar is connected, but no video link exists yet. A Meet link appears only when a real calendar event is created — this build does not create calendar events. The professional can paste their own meeting link.",
    };
  }
  const manual = (input.manualLink ?? "").trim();
  if (!manual) {
    return {
      source: "none",
      link: null,
      status: "no_video_link",
      note: "No video link yet. Google Meet is not connected (Google OAuth setup is not done), so the professional pastes their own meeting link — no link is generated for them.",
    };
  }
  if (!isValidManualMeetingLink(manual)) {
    return {
      source: "none",
      link: null,
      status: "manual_link_invalid",
      note: "The pasted meeting link is not a valid https URL, so it was not saved. Paste a full https:// meeting link.",
    };
  }
  return {
    source: "manual",
    link: manual,
    status: "manual_link",
    note: "Manual meeting link provided by the professional. Google Meet is not connected — this link was pasted by the professional, not created by the platform.",
  };
}

export const VIDEO_MEETING_STATUS = {
  googleMeetConnected: false,
  googleOAuthSetupDone: false,
  eventCreationImplemented: false,
  manualLinkPath: "available",
  note: "Google OAuth setup is NOT done, so no Meet link is ever generated. Booking accepts a manual link the professional pastes, or a Meet link returned by a real Google Calendar event once that path exists.",
} as const;

// ===========================================================================
// 3. DOCUMENT SCANNER / OCR — NOT AVAILABLE, honestly labelled.
//    Why it cannot be pinned safely in this build (verified Nov 28, 2026):
//      * No OCR library is installed — package.json has no OCR
//        dependency and no OCR code is bundled.
//      * Pinning the npm package alone would NOT pin what runs:
//        tesseract.js (latest 7.0.0, registry reachable Nov 28, 2026)
//        downloads its worker script AND its trained language data
//        from a CDN at runtime by default. A version pin in
//        package.json pins the loader, not the worker or the language
//        data — an unpinned CDN fetch would still run.
//      * Safe pinning needs: pinned npm package + self-hosted worker
//        script + self-hosted traineddata files (or pinned SRI-hashed
//        script + pinned data URLs), verified by hash at build time.
//        That is a separate build task; it is NOT done here.
//    Until that exists: no OCR library is loaded, no unpinned CDN
//    script is loaded (DEPLOY.md §13), no text is extracted from any
//    image, and nothing is guessed from a document. The documents
//    table already has ocr_extracted (jsonb, 0001) for when OCR lands.
// ===========================================================================

export const OCR_STATUS = {
  available: false,
  library: "tesseract.js",
  pinnedVersion: null as string | null,
  latestRegistryVersionChecked: "7.0.0",
  checkedAt: "2026-11-28",
  blocker:
    "No OCR library is installed, and pinning the npm package alone would not pin what runs: tesseract.js downloads its worker script and trained language data from a CDN at runtime by default. Safe pinning needs the pinned npm package PLUS self-hosted worker + traineddata (or pinned SRI-hashed script + pinned data URLs), verified by hash at build time. Until that is built, OCR stays unavailable and no text is extracted — nothing is guessed from an image.",
  label: "OCR is not available until the library is pinned (see src/lib/expertTools.ts OCR_STATUS). No OCR library is loaded in this build, and no unpinned CDN is loaded.",
} as const;

export interface OcrDocumentInput {
  ocr_extracted: unknown;
}

export function ocrStatusForDocument(doc: OcrDocumentInput): {
  available: false;
  extracted: unknown;
  label: string;
  blocker: string;
} {
  return {
    available: false,
    // Whatever is already stored (null today) is reported as-is;
    // nothing new is extracted and nothing is invented.
    extracted: doc.ocr_extracted ?? null,
    label: OCR_STATUS.label,
    blocker: OCR_STATUS.blocker,
  };
}

// ===========================================================================
// 4. TRANSLATION ORDERING — certified translation at the LOCKED $45/page.
//    Price: addon_translation_page, 4500 cents, from stripePrices.ts —
//    never re-typed here (TRANSLATION_PRICE_PER_PAGE_CENTS is read from
//    the locked map and throws if the key is missing). Page counts come
//    ONLY from document_translations rows (migration 0030) via
//    translationEstimate() in src/lib/moreAdded.ts — 0 pages means "not
//    counted yet", never guessed. Provider: Google Cloud Translation
//    BYO slot (GOOGLE_TRANSLATE_API_KEY) — NOT connected, so every order
//    stays status "pending" and NO translation is ever claimed done.
//    Payment: Stripe Checkout with the locked Price, quantity = total
//    pages (POST /api/checkout accepts items[].quantity); the webhook
//    (checkout.session.completed, metadata.translation_order_id) flips
//    payment_status to "paid" — the order status itself stays "pending"
//    until a provider is connected and a real translation is delivered.
// ===========================================================================

export const TRANSLATION_PROVIDER = "google_cloud_translation" as const;

export interface TranslationOrderInput {
  caseId: string;
  clientId: string;
  items: TranslationItem[];
}

export interface TranslationOrderRow {
  case_id: string;
  client_id: string;
  document_types: string[];
  total_pages: number;
  total_cents: number;
  price_per_page_cents: number;
  status: "pending";
  provider: typeof TRANSLATION_PROVIDER;
  provider_connected: false;
  payment_status: "unpaid";
  stripe_checkout_session_id: null;
}

export function buildTranslationOrder(
  input: TranslationOrderInput
):
  | {
      ok: true;
      row: TranslationOrderRow;
      estimate: ReturnType<typeof translationEstimate>;
      checkout: {
        priceKey: "addon_translation_page";
        quantity: number;
        totalCents: number;
        note: string;
      };
      providerStatus: string;
    }
  | { ok: false; error: string } {
  if (!input.caseId.trim() || !input.clientId.trim()) {
    return { ok: false, error: "caseId and clientId are required." };
  }
  const locked = getLockedPriceByKey("addon_translation_page");
  if (!locked || locked.amountCents !== TRANSLATION_PRICE_PER_PAGE_CENTS) {
    return {
      ok: false,
      error: "Locked translation price (addon_translation_page, $45/page) is missing or does not match stripePrices.ts — do not guess it.",
    };
  }
  const estimate = translationEstimate(input.items);
  const billable = estimate.rows.filter((r) => r.status !== "not-needed" && r.pages > 0);
  if (billable.length === 0) {
    return {
      ok: false,
      error: "No billable pages: every selected document has 0 pages (page count not entered yet) or is marked not-needed. Enter the page count first — page counts are never guessed.",
    };
  }
  return {
    ok: true,
    row: {
      case_id: input.caseId,
      client_id: input.clientId,
      document_types: billable.map((r) => r.documentType),
      total_pages: estimate.totalPages,
      total_cents: estimate.totalCents,
      price_per_page_cents: TRANSLATION_PRICE_PER_PAGE_CENTS,
      status: "pending",
      provider: TRANSLATION_PROVIDER,
      provider_connected: false,
      payment_status: "unpaid",
      stripe_checkout_session_id: null,
    },
    estimate,
    checkout: {
      priceKey: "addon_translation_page",
      quantity: estimate.totalPages,
      totalCents: estimate.totalCents,
      note: "Pay by posting this priceKey + quantity to POST /api/checkout (locked Price, quantity = total pages). The order stays pending until Google Cloud Translation is connected and a real translation is delivered.",
    },
    providerStatus:
      "Google Cloud Translation is NOT connected (GOOGLE_TRANSLATE_API_KEY / BYO slot google_translate). This order is recorded as pending — no translation has been done and none is claimed.",
  };
}

export const TRANSLATION_ORDER_STATUS = {
  provider: TRANSLATION_PROVIDER,
  connected: false,
  byoSlot: "google_translate" as const,
  pricePerPageCents: TRANSLATION_PRICE_PER_PAGE_CENTS,
  note: "Orders are recorded with status pending until a provider is connected. Payment is confirmed only by the Stripe webhook; delivery is confirmed only by a real translation.",
} as const;

// ===========================================================================
// 5. INVOICING & RECEIPTS — per-case receipt, USCIS fee ALWAYS separate.
//    Reuses the invoices table (0001: service_fee_cents +
//    uscis_fee_cents, stripe_invoice_id) and the Stripe webhook records
//    (invoice.paid marks the row paid). The receipt shows two lines and
//    a total that is the SUM of the two lines — the USCIS government fee
//    is never folded into the service fee, and the total is never shown
//    without its two parts. A draft / unpaid invoice renders as a
//    receipt only when it is actually paid; otherwise the view says so
//    and shows the amount due, never a "paid" stamp it has not earned.
// ===========================================================================

export interface ReceiptInvoiceRow {
  id: string;
  description: string;
  form_code: string | null;
  service_fee_cents: number;
  uscis_fee_cents: number;
  status: string;
  due_at: string | null;
  paid_at: string | null;
  created_at: string;
  stripe_invoice_id: string | null;
}

export interface ReceiptLine {
  label: string;
  cents: number;
}

export interface ReceiptView {
  invoiceId: string;
  description: string;
  formCode: string | null;
  status: string;
  paid: boolean;
  paidAt: string | null;
  stripeInvoiceId: string | null;
  lines: ReceiptLine[];
  totalCents: number;
  serviceFeeCents: number;
  uscisFeeCents: number;
  note: string;
}

export function buildReceipt(invoice: ReceiptInvoiceRow): ReceiptView {
  const paid = invoice.status === "paid" && invoice.paid_at !== null;
  const lines: ReceiptLine[] = [
    {
      label: `Service fee — ${invoice.description}${invoice.form_code ? ` (${invoice.form_code})` : ""}`,
      cents: invoice.service_fee_cents,
    },
    {
      label: "USCIS government fee — paid to USCIS (separate from our service fee)",
      cents: invoice.uscis_fee_cents,
    },
  ];
  return {
    invoiceId: invoice.id,
    description: invoice.description,
    formCode: invoice.form_code,
    status: invoice.status,
    paid,
    paidAt: invoice.paid_at,
    stripeInvoiceId: invoice.stripe_invoice_id,
    lines,
    // Total is the sum of the two separate lines — never a single
    // combined figure without its parts.
    totalCents: invoice.service_fee_cents + invoice.uscis_fee_cents,
    serviceFeeCents: invoice.service_fee_cents,
    uscisFeeCents: invoice.uscis_fee_cents,
    note: paid
      ? "Receipt — paid. The USCIS government fee is shown on its own line, separate from our service fee."
      : "Not paid yet — this is the amount due, not a receipt of payment. The USCIS government fee is shown on its own line, separate from our service fee.",
  };
}

// ===========================================================================
// 6. FOUNDER ANALYTICS — Money Ladder / reporting dashboard.
//    VERIFIED Nov 28, 2026: src/lib/reporting.ts ALREADY had per-month
//    totals (paidByMonth), per-form breakdown (paidByService) and
//    per-professional breakdown (paidByProfessional) in summarizeMoney(),
//    plus cases-by-stage, leads, notifications and operations — all from
//    real rows, honest empty states. Nothing there was rebuilt. What was
//    MISSING and is added here: one founder roll-up that combines those
//    summaries with the two new work queues (translation orders pending,
//    signatures pending) so the dashboard shows them in one place.
//    NOT added, deliberately: subscription revenue. There is NO
//    subscriptions table in the migrations — professional subscriptions
//    live only as Stripe subscriptions + professional_profiles
//    .subscription_status (webhook). Reporting money that is not in DB
//    rows would be inventing revenue, so it is excluded and noted.
// ===========================================================================

export interface TranslationOrderSummaryRow {
  id: string;
  status: string;
  payment_status: string;
  total_cents: number;
}

export interface SignatureSummaryRow {
  id: string;
  signed_at: string | null;
}

export interface FounderAnalytics {
  money: MoneySummary;
  casesByStage: CasesByStage;
  leads: LeadsSummary;
  notifications: NotificationsSummary;
  operations: OperationsSummary;
  translationOrdersPending: number;
  translationOrdersPendingCents: number;
  signaturesPending: number;
  signaturesCompleted: number;
  subscriptionsNote: string;
  isEmpty: boolean;
}

export function summarizeFounderAnalytics(input: {
  invoices: InvoiceRow[];
  orderInvoices: OrderInvoiceRow[];
  plans: PaymentPlanRow[];
  lifecycleRows: LifecycleRow[];
  totalCases: number;
  leads: LeadRow[];
  todayIso: string;
  notificationLogs: NotificationLogRow[];
  documents: DocumentRow[];
  inboxItems: InboxItemRow[];
  translationOrders: TranslationOrderSummaryRow[];
  signatureRows: SignatureSummaryRow[];
}): FounderAnalytics {
  const money = summarizeMoney(input.invoices, input.orderInvoices, input.plans);
  const pendingOrders = input.translationOrders.filter((o) => o.status === "pending");
  return {
    money,
    casesByStage: summarizeCasesByStage(input.lifecycleRows, input.totalCases),
    leads: summarizeLeads(input.leads, input.todayIso),
    notifications: summarizeNotifications(input.notificationLogs),
    operations: summarizeOperations(input.documents, input.inboxItems, input.todayIso),
    translationOrdersPending: pendingOrders.length,
    translationOrdersPendingCents: pendingOrders.reduce((n, o) => n + o.total_cents, 0),
    signaturesPending: input.signatureRows.filter((s) => !s.signed_at).length,
    signaturesCompleted: input.signatureRows.filter((s) => s.signed_at).length,
    subscriptionsNote:
      "Subscription revenue is NOT included: there is no subscriptions table in the migrations, so professional/member subscription money is not in database rows. It is excluded rather than estimated from Stripe.",
    isEmpty:
      money.isEmpty &&
      input.translationOrders.length === 0 &&
      input.signatureRows.length === 0,
  };
}

// ===========================================================================
// 7. BACKUP & EXPORT — one-click export of a client's whole file.
//    Reuses the packet generation route (/api/generate-packet) and the
//    printable-page pattern (window.print + print CSS) — the export is a
//    printable packet manifest, not a new PDF generator. The manifest
//    lists exactly what is included and what is NOT:
//      INCLUDED: form list, document list (file names + review status),
//        timeline events, signature records (who / what / when, typed
//        name only), invoice/receipt list (amounts from real rows).
//      NOT INCLUDED: vault file contents (download via signed links,
//        not embedded in the export), DOB / A-Number / SSN / passport
//        numbers (never in an export), OCR text (OCR is unavailable),
//        email bodies. Every export writes an audit_log entry
//        (action "case_exported", ids only — see src/lib/auditLog.ts).
// ===========================================================================

export interface ExportManifestInput {
  caseId: string;
  forms: { formCode: string; status: string }[];
  documents: { fileName: string; reviewStatus: string }[];
  timelineEvents: { at: string; label: string }[];
  signatures: { formCode: string; signerFullName: string; signedAt: string | null }[];
  invoices: { id: string; description: string; status: string }[];
  generatedAtIso: string;
}

export interface ExportManifest {
  caseId: string;
  generatedAt: string;
  included: string[];
  notIncluded: string[];
  forms: ExportManifestInput["forms"];
  documents: ExportManifestInput["documents"];
  timeline: ExportManifestInput["timelineEvents"];
  signatures: ExportManifestInput["signatures"];
  invoices: ExportManifestInput["invoices"];
  counts: { forms: number; documents: number; timelineEvents: number; signatures: number; invoices: number };
}

export function buildCaseExportManifest(input: ExportManifestInput): ExportManifest {
  return {
    caseId: input.caseId,
    generatedAt: input.generatedAtIso,
    included: [
      `${input.forms.length} form(s) — form code + status only`,
      `${input.documents.length} document(s) — file name + review status only`,
      `${input.timelineEvents.length} timeline event(s)`,
      `${input.signatures.length} signature record(s) — signer name, form, signed date/time only`,
      `${input.invoices.length} invoice(s) — description + status only`,
    ],
    notIncluded: [
      "Vault file contents — download separately via signed links, not embedded in this export",
      "DOB, A-Number, SSN, passport numbers — never in an export",
      "OCR text — OCR is unavailable (see OCR_STATUS)",
      "Email bodies",
    ],
    forms: input.forms,
    documents: input.documents,
    timeline: input.timelineEvents,
    signatures: input.signatures,
    invoices: input.invoices,
    counts: {
      forms: input.forms.length,
      documents: input.documents.length,
      timelineEvents: input.timelineEvents.length,
      signatures: input.signatures.length,
      invoices: input.invoices.length,
    },
  };
}
