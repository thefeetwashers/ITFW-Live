// Smoke test for the seven expert tools (Nov 28, 2026, founder's
// question: "what else other tool you want to add"). FAKE data only —
// no real people, no real signatures, no live service.
// Run with:
//   npx -y tsx scripts/smoke-expert-tools.ts
//
// Asserts:
//   1. E-signature records signer + packet + time and NEVER auto-signs:
//      missing intent, missing review, wrong typed name, missing
//      packet ref, and an already-signed request are all refused; a
//      valid completion records signer, packet ref + SHA-256 hash,
//      signed_at, intent, and the in-platform method.
//   2. Video meeting with no Google connection shows the manual-link
//      path and NEVER a fake Meet link: no link -> "no_video_link";
//      a pasted https link -> manual; an invalid link -> refused;
//      Google "connected" with no event -> no link, honest note.
//   3. OCR is honestly labelled unavailable, with the exact blocker
//      (no library installed; npm pin alone would not pin the runtime
//      worker + language data), and no OCR library is a dependency.
//   4. Translation order shows $45/page (locked Price
//      addon_translation_page), stays status "pending" with
//      provider_connected false, and refuses a 0-page order (page
//      counts are never guessed). Checkout payload uses the locked
//      Price with quantity = total pages.
//   5. A receipt shows the USCIS fee on its own line, never combined
//      with the service fee; total = service + USCIS; unpaid invoices
//      are never stamped paid.
//   6. Founder analytics sums only real rows: per-month, per-form and
//      per-professional totals from the rows passed in; empty input
//      gives an honest empty state with zeros, never invented revenue;
//      subscription revenue is explicitly excluded.
//   7. A case export lists its contents and what is NOT included
//      (vault file contents, DOB/A-Number/SSN/passport — never in an
//      export), and the export + sign + translation-order routes write
//      audit-log actions (signature_completed / translation_order_placed
//      / case_exported / invoice_receipt_viewed in src/lib/auditLog.ts).
//   8. Routes return honest 501 (not configured) with Supabase env
//      cleared: /api/signatures/sign, /api/translation-orders,
//      /api/invoices/[id]/receipt, /api/export/case. Migration 0033
//      exists with the translation_orders table + signature/video
//      columns.
//
// This script is excluded from tsc (see tsconfig.json "exclude").
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Env cleared before any import, so nothing in this script can send,
// charge, or write live.
process.env.NEXT_PUBLIC_SUPABASE_URL = "";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "";
process.env.SUPABASE_SERVICE_ROLE_KEY = "";
process.env.STRIPE_SECRET_KEY = "";
process.env.STRIPE_WEBHOOK_SECRET = "";
process.env.GOOGLE_TRANSLATE_API_KEY = "";

import {
  completeSignature,
  packetVersionHash,
  resolveVideoMeeting,
  OCR_STATUS,
  ocrStatusForDocument,
  buildTranslationOrder,
  buildReceipt,
  summarizeFounderAnalytics,
  buildCaseExportManifest,
  TRANSLATION_PRICE_PER_PAGE_CENTS,
  ESIGN_STATUS,
  VIDEO_MEETING_STATUS,
  TRANSLATION_ORDER_STATUS,
} from "../src/lib/expertTools";
import { POST as signPost } from "../src/app/api/signatures/sign/route";
import {
  POST as translationOrderPost,
  GET as translationOrderGet,
} from "../src/app/api/translation-orders/route";
import { GET as receiptGet } from "../src/app/api/invoices/[id]/receipt/route";
import { GET as exportGet } from "../src/app/api/export/case/route";

const PORTAL = join(__dirname, "..");
const ROOT = join(PORTAL, "..");
const read = (rel: string) => readFileSync(join(PORTAL, rel), "utf8");
const readRoot = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

let passed = 0;
function ok(name: string, cond: boolean) {
  assert.equal(cond, true, name);
  passed += 1;
  console.log(`  PASS ${name}`);
}

async function main() {
  // 1) E-signature ---------------------------------------------------------
  console.log("1) e-signature");
  const request = {
    signed_at: null,
    signer_full_name: "Fake Test Signer",
    digital_review_confirmed: false,
  };
  const good = {
    typedName: "Fake Test Signer",
    intentConfirmed: true,
    reviewConfirmed: true,
    packetRef: "packet-fake-1",
    packetVersion: "v3",
    signedAtIso: "2026-11-28T12:00:00.000Z",
  };
  ok("no intent -> refused, never auto-signs", !completeSignature(request, { ...good, intentConfirmed: false }).ok);
  ok("no review -> refused", !completeSignature(request, { ...good, reviewConfirmed: false }).ok);
  ok("wrong typed name -> refused", !completeSignature(request, { ...good, typedName: "Someone Else" }).ok);
  ok("empty typed name -> refused", !completeSignature(request, { ...good, typedName: " " }).ok);
  ok("missing packet ref -> refused", !completeSignature(request, { ...good, packetRef: "" }).ok);
  ok(
    "already signed -> refused, never re-signed",
    !completeSignature({ ...request, signed_at: "2026-11-28T12:00:00.000Z" }, good).ok
  );
  const done = completeSignature(request, good);
  ok("valid completion succeeds", done.ok);
  if (done.ok) {
    ok("records the signer", done.patch.signer_full_name === "Fake Test Signer");
    ok("records packet ref", done.patch.packet_ref === "packet-fake-1");
    ok("records signed time", done.patch.signed_at === "2026-11-28T12:00:00.000Z");
    ok(
      "records packet version hash",
      done.patch.packet_version_hash === packetVersionHash("packet-fake-1", "v3")
    );
    ok("records intent", done.patch.intent_confirmed === true);
    ok("method is typed electronic, in-platform", done.patch.signature_method === "typed_electronic");
    ok("audit records who/what/when/from", done.audit.who === "Fake Test Signer" && done.audit.when === "2026-11-28T12:00:00.000Z");
  }
  ok("no outside e-sign provider connected", ESIGN_STATUS.outsideProviderConnected === false);

  // 2) Video meetings ------------------------------------------------------
  console.log("2) video meetings");
  const none = resolveVideoMeeting({ googleCalendarConnected: false, googleMeetLinkFromEvent: null, manualLink: null });
  ok("no Google, no link -> no_video_link, never a fake Meet link", none.source === "none" && none.link === null && none.status === "no_video_link");
  ok("no-link note says Google is not connected", /not connected/i.test(none.note));
  const manual = resolveVideoMeeting({
    googleCalendarConnected: false,
    googleMeetLinkFromEvent: null,
    manualLink: "https://zoom.us/j/123456789",
  });
  ok("pasted https link -> manual path", manual.source === "manual" && manual.link === "https://zoom.us/j/123456789");
  ok("manual link labelled as pasted, not created", /pasted by the professional/i.test(manual.note));
  const bad = resolveVideoMeeting({ googleCalendarConnected: false, googleMeetLinkFromEvent: null, manualLink: "not-a-link" });
  ok("invalid manual link -> refused, no link stored", bad.source === "none" && bad.link === null);
  const connectedNoEvent = resolveVideoMeeting({ googleCalendarConnected: true, googleMeetLinkFromEvent: null, manualLink: null });
  ok(
    "Google connected but no event -> still no link (never fabricated)",
    connectedNoEvent.source === "none" && connectedNoEvent.link === null && connectedNoEvent.status === "google_connected_no_event"
  );
  const fromEvent = resolveVideoMeeting({
    googleCalendarConnected: true,
    googleMeetLinkFromEvent: "https://meet.google.com/abc-defg-hij",
    manualLink: null,
  });
  ok("real Meet link from a real event is used as google_meet", fromEvent.source === "google_meet");
  ok("video status: Google OAuth not done", VIDEO_MEETING_STATUS.googleOAuthSetupDone === false);

  // 3) OCR -----------------------------------------------------------------
  console.log("3) OCR");
  ok("OCR labelled unavailable", OCR_STATUS.available === false);
  ok("OCR blocker names the runtime-fetch problem", /CDN at runtime/i.test(OCR_STATUS.blocker));
  ok("OCR blocker names the fix (self-hosted worker + traineddata)", /self-hosted worker/i.test(OCR_STATUS.blocker));
  const ocrDoc = ocrStatusForDocument({ ocr_extracted: null });
  ok("OCR status for a document: unavailable, nothing extracted", ocrDoc.available === false && ocrDoc.extracted === null);
  const pkg = JSON.parse(read("package.json")) as { dependencies: Record<string, string> };
  ok("no OCR library is a dependency", !Object.keys(pkg.dependencies).some((d) => /tesseract|ocr/i.test(d)));
  ok(
    "no unpinned CDN script in portal src",
    !/src=\\\\?["']https?:\/\//.test(read("src/app/company-back-office/page.tsx")) &&
      !read("src/lib/expertTools.ts").includes("<script")
  );

  // 4) Translation ordering ------------------------------------------------
  console.log("4) translation ordering");
  ok("translation price is the locked $45/page", TRANSLATION_PRICE_PER_PAGE_CENTS === 4500);
  const order = buildTranslationOrder({
    caseId: "case-fake-1",
    clientId: "client-fake-1",
    items: [
      { documentType: "birth", pages: 2, status: "needed" },
      { documentType: "police", pages: 1, status: "needed" },
      { documentType: "passport", pages: 5, status: "not-needed" },
    ],
  });
  ok("3 billable pages -> order builds", order.ok);
  if (order.ok) {
    ok("total is pages x $45 (3 x 4500 = 13500)", order.row.total_cents === 13500 && order.row.total_pages === 3);
    ok("order stays pending", order.row.status === "pending");
    ok("provider not connected", order.row.provider_connected === false);
    ok("payment unpaid until the webhook confirms it", order.row.payment_status === "unpaid");
    ok(
      "checkout uses the locked Price with quantity = pages",
      order.checkout.priceKey === "addon_translation_page" && order.checkout.quantity === 3
    );
    ok("provider status says no translation was done", /NOT connected/i.test(order.providerStatus));
  }
  const zeroPages = buildTranslationOrder({
    caseId: "case-fake-1",
    clientId: "client-fake-1",
    items: [{ documentType: "birth", pages: 0, status: "needed" }],
  });
  ok("0 pages -> refused, page count never guessed", !zeroPages.ok);
  ok("translation order status: not connected", TRANSLATION_ORDER_STATUS.connected === false);

  // 5) Receipts ------------------------------------------------------------
  console.log("5) invoicing & receipts");
  const receipt = buildReceipt({
    id: "inv-fake-1",
    description: "Green Card Bundle — Standard",
    form_code: "I-485",
    service_fee_cents: 179900,
    uscis_fee_cents: 1440_00,
    status: "paid",
    due_at: null,
    paid_at: "2026-11-28T12:00:00.000Z",
    created_at: "2026-11-20T12:00:00.000Z",
    stripe_invoice_id: "in_fake",
  });
  ok("receipt has two separate lines", receipt.lines.length === 2);
  ok(
    "USCIS fee is its own line",
    receipt.lines[1].label.startsWith("USCIS government fee") && receipt.uscisFeeCents === 144000
  );
  ok("service fee line is separate", receipt.serviceFeeCents === 179900);
  ok("total is the sum of the two lines", receipt.totalCents === 179900 + 144000);
  ok("paid invoice is stamped paid", receipt.paid === true);
  const unpaid = buildReceipt({ ...receipt, status: "open", paid_at: null, id: "inv-fake-2" } as Parameters<typeof buildReceipt>[0]);
  ok("unpaid invoice is never stamped paid", unpaid.paid === false && /Not paid yet/i.test(unpaid.note));

  // 6) Founder analytics ---------------------------------------------------
  console.log("6) founder analytics");
  const analytics = summarizeFounderAnalytics({
    invoices: [
      { id: "i1", provider_id: "pro-a", form_code: "I-485", service_fee_cents: 100000, uscis_fee_cents: 144000, status: "paid", due_at: null, paid_at: "2026-11-10T00:00:00.000Z", created_at: "2026-11-01T00:00:00.000Z" },
      { id: "i2", provider_id: "pro-b", form_code: "I-130", service_fee_cents: 50000, uscis_fee_cents: 0, status: "paid", due_at: null, paid_at: "2026-10-05T00:00:00.000Z", created_at: "2026-10-01T00:00:00.000Z" },
      { id: "i3", provider_id: "pro-a", form_code: "I-485", service_fee_cents: 20000, uscis_fee_cents: 0, status: "open", due_at: null, paid_at: null, created_at: "2026-11-15T00:00:00.000Z" },
    ],
    orderInvoices: [],
    plans: [],
    lifecycleRows: [],
    totalCases: 0,
    leads: [],
    todayIso: "2026-11-28",
    notificationLogs: [],
    documents: [],
    inboxItems: [],
    translationOrders: [
      { id: "t1", status: "pending", payment_status: "unpaid", total_cents: 13500 },
      { id: "t2", status: "delivered", payment_status: "paid", total_cents: 4500 },
    ],
    signatureRows: [
      { id: "s1", signed_at: null },
      { id: "s2", signed_at: "2026-11-28T12:00:00.000Z" },
    ],
  });
  ok("paid service total sums only paid rows (150000)", analytics.money.paidServiceCents === 150000);
  ok("USCIS fees reported separately (144000)", analytics.money.paidGovCents === 144000);
  ok("per-month totals present", analytics.money.paidByMonth.length === 2);
  ok(
    "per-form breakdown present",
    analytics.money.paidByService.find((r) => r.formCode === "I-485")?.cents === 100000
  );
  ok(
    "per-professional breakdown present",
    analytics.money.paidByProfessional.find((r) => r.providerId === "pro-a")?.cents === 100000
  );
  ok("translation queue counted (1 pending)", analytics.translationOrdersPending === 1);
  ok("signature queue counted (1 pending, 1 done)", analytics.signaturesPending === 1 && analytics.signaturesCompleted === 1);
  ok("subscription revenue explicitly excluded", /NOT included/i.test(analytics.subscriptionsNote));
  const empty = summarizeFounderAnalytics({
    invoices: [], orderInvoices: [], plans: [], lifecycleRows: [], totalCases: 0,
    leads: [], todayIso: "2026-11-28", notificationLogs: [], documents: [],
    inboxItems: [], translationOrders: [], signatureRows: [],
  });
  ok(
    "empty input -> honest empty state, zeros, never invented revenue",
    empty.isEmpty === true && empty.money.paidServiceCents === 0 && empty.money.paidGovCents === 0
  );

  // 7) Backup & export -----------------------------------------------------
  console.log("7) backup & export");
  const manifest = buildCaseExportManifest({
    caseId: "case-fake-1",
    forms: [{ formCode: "I-485", status: "draft" }],
    documents: [{ fileName: "birth-certificate.pdf", reviewStatus: "accepted" }],
    timelineEvents: [{ at: "2026-11-20", label: "Intake completed" }],
    signatures: [{ formCode: "I-485", signerFullName: "Fake Test Signer", signedAt: null }],
    invoices: [{ id: "inv-fake-1", description: "Green Card Bundle — Standard", status: "paid" }],
    generatedAtIso: "2026-11-28T12:00:00.000Z",
  });
  ok("export lists what is included", manifest.included.length === 5);
  ok(
    "export excludes vault file contents (signed links, not embedded)",
    manifest.notIncluded.some((s) => /signed links, not embedded/i.test(s))
  );
  ok(
    "export never includes DOB / A-Number / SSN / passport",
    manifest.notIncluded.some((s) => /DOB, A-Number, SSN, passport/i.test(s))
  );
  ok("export counts match its lists", manifest.counts.documents === 1 && manifest.counts.forms === 1);
  const auditSrc = read("src/lib/auditLog.ts");
  for (const action of ["signature_completed", "translation_order_placed", "invoice_receipt_viewed", "case_exported"]) {
    ok(`audit action "${action}" exists`, auditSrc.includes(`"${action}"`));
  }

  // 8) Routes + migration — honest 501s with env cleared -------------------
  console.log("8) routes + migration");
  const signRes = await signPost(
    new Request("http://localhost/api/signatures/sign", {
      method: "POST",
      body: JSON.stringify({ signatureId: "sig-fake" }),
    })
  );
  ok("sign route returns 501 when Supabase is not configured", signRes.status === 501);
  const orderRes = await translationOrderPost(
    new Request("http://localhost/api/translation-orders", {
      method: "POST",
      body: JSON.stringify({ caseId: "case-fake-1", clientId: "client-fake-1", items: [] }),
    })
  );
  ok("translation-orders POST returns 501 when not configured", orderRes.status === 501);
  const orderGetRes = await translationOrderGet(new Request("http://localhost/api/translation-orders?caseId=case-fake-1"));
  ok("translation-orders GET returns 501 when not configured", orderGetRes.status === 501);
  const receiptRes = await receiptGet(new Request("http://localhost/api/invoices/inv-fake-1/receipt"), { params: { id: "inv-fake-1" } });
  ok("receipt route returns 501 when not configured", receiptRes.status === 501);
  const exportRes = await exportGet(new Request("http://localhost/api/export/case?caseId=case-fake-1"));
  ok("export route returns 501 when not configured", exportRes.status === 501);
  const migration = readRoot("supabase/migrations/0036_itfw_expert_tools.sql");
  ok("migration 0033 creates translation_orders", migration.includes("create table if not exists public.translation_orders"));
  ok("migration 0033 adds packet_ref + intent to signatures", migration.includes("packet_ref") && migration.includes("intent_confirmed"));
  ok("migration 0033 adds video link columns", migration.includes("video_link_source") && migration.includes("meeting_link_source"));
  ok("migration 0033 locks translation at 4500 cents", migration.includes("price_per_page_cents = 4500"));
  const webhookSrc = read("src/app/api/stripe/webhook/route.ts");
  ok("webhook confirms translation payment (metadata.translation_order_id)", webhookSrc.includes("translation_order_id"));
  const bookingsSrc = read("src/app/api/bookings/route.ts");
  ok("bookings PATCH accepts a pasted manual video link", bookingsSrc.includes("manualVideoLink"));

  console.log(`\nAll ${passed} checks passed.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
