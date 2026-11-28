// Smoke test — business tools (Nov 28, 2026). Run with:
//   npx -y tsx scripts/smoke-business-tools.ts
// FAKE data only. No network, no Supabase, no Stripe, no SES, no real
// keys. Proves: every business tool shows an honest "not connected" /
// empty state when its provider is unconfigured or no rows exist, and
// real data only when rows exist; the monthly summary sums only real
// invoice rows; no credential is stored or logged in plain text.
import assert from "node:assert/strict";
import {
  BYO_STRIPE_NOT_CONNECTED,
  CALENDAR_NOT_CONNECTED,
  ESIGN_PROVIDER_STATUS,
  SMS_WHATSAPP_NOT_CONNECTED,
  buildSignatureRequest,
  countUnreadByCase,
  describeByoStripe,
  filterPipelineClients,
  groupVaultByClient,
  invoiceSendBlockedReason,
  listProfessionalInvoices,
  mergeCalendarEvents,
  publicConnectionView,
  summarizeMonthlyProfessional,
  unreadForCase,
} from "../src/lib/businessTools";
import { last4 } from "../src/lib/byo";
import { GET as calendarGet } from "../src/app/api/business-tools/calendar/route";
import { POST as invoicePost } from "../src/app/api/invoices/route";
import { POST as signaturePost } from "../src/app/api/signatures/request/route";
import type { PipelineClientRow } from "../src/lib/pipeline";

delete process.env.NEXT_PUBLIC_SUPABASE_URL;
delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.AWS_ACCESS_KEY_ID;
delete process.env.AWS_SECRET_ACCESS_KEY;

let passed = 0;
function ok(name: string, cond: boolean) {
  assert.equal(cond, true, name);
  passed += 1;
  console.log(`  PASS ${name}`);
}

async function main() {
  console.log("a. payments — own Stripe (BYO)");
  const stripeNone = describeByoStripe(null);
  ok("no BYO row -> not_connected", stripeNone.status === "not_connected");
  ok("no BYO row -> cannot take payments", stripeNone.canTakePayments === false);
  ok("not-connected label says NOT CONNECTED", stripeNone.label.includes("NOT CONNECTED"));
  ok("label text matches the exported constant", stripeNone.label === BYO_STRIPE_NOT_CONNECTED);
  const stripeUntested = describeByoStripe({
    providerKey: "stripe_own", status: "connected", keyLast4: "••••4242",
    connectedAt: "2026-11-28T00:00:00Z", lastTestedAt: null, testStatus: "not_tested",
  });
  ok("connected but untested -> cannot take payments", stripeUntested.canTakePayments === false);
  const stripeOk = describeByoStripe({
    providerKey: "stripe_own", status: "connected", keyLast4: "••••4242",
    connectedAt: "2026-11-28T00:00:00Z", lastTestedAt: "2026-11-28T00:00:00Z", testStatus: "passed",
  });
  ok("connected + test-passed -> can take payments", stripeOk.canTakePayments === true);

  console.log("b. calendar — merged view, no sync claimed");
  ok("calendar note says NOT connected", CALENDAR_NOT_CONNECTED.includes("NOT connected"));
  const events = mergeCalendarEvents({
    appointments: [{
      id: "a1", case_id: "c1", client_id: "cl1", provider_id: "p1",
      type: "consultation", status: "confirmed",
      starts_at: "2026-12-01T10:00:00Z", ends_at: "2026-12-01T10:30:00Z",
      location_or_link: null,
    }],
    preparerAppointments: [{
      id: "pa1", case_id: null, requester_name: "Fake Client",
      consultation_type: "video", preferred_time: "weekday mornings",
      status: "request_collected", decision: "pending", proposed_time: null,
      created_at: "2026-11-28T00:00:00Z",
    }],
    consultationRequests: [{
      id: "cr1", requester_name: "Fake Client 2", mode: "phone",
      duration_minutes: 30, price_cents: 9900, requested_time_text: "evenings",
      proposed_starts_at: null, status: "requested", created_at: "2026-11-28T00:00:00Z",
    }],
  });
  ok("three canonical sources merge into 3 events", events.length === 3);
  ok("confirmed appointment is kind confirmed", events.some((e) => e.source === "appointment" && e.kind === "confirmed"));
  ok("requests are kind requested", events.filter((e) => e.kind === "requested").length === 2);
  ok("30-min request keeps locked $99 price", events.some((e) => e.priceCents === 9900));
  ok("empty merge -> empty array", mergeCalendarEvents({ appointments: [], preparerAppointments: [], consultationRequests: [] }).length === 0);

  console.log("c. e-signature — unsigned request, no provider");
  ok("e-sign status says no provider connected", ESIGN_PROVIDER_STATUS.includes("No e-signature provider is connected"));
  const sig = buildSignatureRequest({
    caseId: "c1", clientId: "cl1", formCode: "I-130", documentId: null, signerFullName: "Fake Signer",
  });
  ok("valid request builds", sig.ok === true);
  if (sig.ok) {
    ok("request is unsigned (signed_at null)", sig.row.signed_at === null);
    ok("request is typed_electronic only", sig.row.signature_method === "typed_electronic");
    ok("request carries the no-provider status", sig.row.providerStatus === ESIGN_PROVIDER_STATUS);
  }
  ok("missing signer is rejected", buildSignatureRequest({ caseId: "c1", clientId: "cl1", formCode: "I-130", documentId: null, signerFullName: " " }).ok === false);

  console.log("d. vault — per-client grouping with expiry flags");
  const groups = groupVaultByClient([
    { id: "d1", caseId: "c1", clientLabel: "Fake Client A", kind: "passport", label: "Passport", expiresOn: "2026-11-20" },
    { id: "d2", caseId: "c1", clientLabel: "Fake Client A", kind: "birth_certificate_translation", label: "Birth cert translation", expiresOn: null },
    { id: "d3", caseId: "c2", clientLabel: "Fake Client B", kind: "other", label: "Other", expiresOn: null },
  ], new Date("2026-11-28T00:00:00Z"));
  ok("two client groups", groups.length === 2);
  const gA = groups.find((g) => g.caseId === "c1");
  ok("expired passport flagged", gA?.expiredCount === 1);
  ok("translation never expires (not flagged)", gA?.documents.some((d) => d.status === "never_expires") === true);
  ok("no-expiry doc flagged no_expiry_on_file", groups.find((g) => g.caseId === "c2")?.noExpiryOnFileCount === 1);
  ok("empty vault -> no groups", groupVaultByClient([]).length === 0);

  console.log("e. messaging — unread per case, SMS/WhatsApp 501");
  ok("SMS/WhatsApp note says 501 until Twilio connected", SMS_WHATSAPP_NOT_CONNECTED.includes("501"));
  const unread = countUnreadByCase([
    { id: "m1", case_id: "c1", recipient_id: "p1", is_read: false },
    { id: "m2", case_id: "c1", recipient_id: "p1", is_read: false },
    { id: "m3", case_id: "c1", recipient_id: "p1", is_read: true },
    { id: "m4", case_id: "c2", recipient_id: "other", is_read: false },
  ], "p1");
  ok("two unread on c1", unreadForCase(unread, "c1") === 2);
  ok("other recipient's message not counted", unreadForCase(unread, "c2") === 0);
  ok("empty messages -> no unread", Object.keys(countUnreadByCase([], "p1")).length === 0);

  console.log("f. invoicing — list + missed-payment rule + SES gate");
  const invoices = listProfessionalInvoices([
    { id: "i1", provider_id: "p1", form_code: "I-130", service_fee_cents: 100000, uscis_fee_cents: 62500, status: "past_due", due_at: "2026-11-01T00:00:00Z", paid_at: null, created_at: "2026-10-01T00:00:00Z" },
    { id: "i2", provider_id: "p1", form_code: "I-485", service_fee_cents: 50000, uscis_fee_cents: 0, status: "paid", due_at: null, paid_at: "2026-11-15T00:00:00Z", created_at: "2026-10-02T00:00:00Z" },
    { id: "i3", provider_id: "p2", form_code: "I-130", service_fee_cents: 99999, uscis_fee_cents: 0, status: "open", due_at: null, paid_at: null, created_at: "2026-10-03T00:00:00Z" },
  ], "p1");
  ok("only this professional's invoices", invoices.length === 2);
  ok("past-due invoice shows missed total x1.5", invoices.find((i) => i.id === "i1")?.missedPaymentTotalCents === 150000);
  ok("paid invoice has no missed total", invoices.find((i) => i.id === "i2")?.missedPaymentTotalCents === null);
  ok("SES unconfigured blocks invoice send", invoiceSendBlockedReason(false) !== null);
  ok("SES configured does not block", invoiceSendBlockedReason(true) === null);
  ok("empty invoices -> empty list", listProfessionalInvoices([], "p1").length === 0);

  console.log("g. client management — search / filter");
  const row = (over: Partial<PipelineClientRow>): PipelineClientRow => ({
    caseId: "c1", leadId: null, clientName: "Fake Client", dateOfBirthMasked: "••/••/1990",
    phone: null, email: "fake@example.com", preferredLanguage: "en", service: "I-130",
    stage: 4 as never, stageNumber: 4, stage5SubStage: null, nextStep: "Collect docs",
    nextStepByWhen: null, missingDocuments: [], missingCount: 0, packetReadinessPercent: null,
    paymentStatus: "unpaid", paymentDetail: "Unpaid", assignedProviderRole: "preparer", ...over,
  });
  const rows = [row({}), row({ caseId: "c2", clientName: "Other Person", stageNumber: 2, stage: 2 as never, paymentStatus: "paid" })];
  ok("name search finds one", filterPipelineClients(rows, { query: "other" }).length === 1);
  ok("stage filter finds one", filterPipelineClients(rows, { stage: 2 }).length === 1);
  ok("payment filter finds one", filterPipelineClients(rows, { paymentStatus: "paid" }).length === 1);
  ok("no match -> empty, not invented", filterPipelineClients(rows, { query: "zzz" }).length === 0);

  console.log("h. reporting — monthly summary sums only real rows");
  const summary = summarizeMonthlyProfessional({
    providerId: "p1", month: "2026-11",
    invoices: [
      { id: "i1", provider_id: "p1", form_code: "I-130", service_fee_cents: 100000, uscis_fee_cents: 62500, status: "paid", due_at: null, paid_at: "2026-11-15T00:00:00Z", created_at: "2026-10-01T00:00:00Z" },
      { id: "i2", provider_id: "p1", form_code: "I-485", service_fee_cents: 50000, uscis_fee_cents: 0, status: "paid", due_at: null, paid_at: "2026-11-20T00:00:00Z", created_at: "2026-10-02T00:00:00Z" },
      { id: "i3", provider_id: "p1", form_code: "I-130", service_fee_cents: 99999, uscis_fee_cents: 0, status: "open", due_at: null, paid_at: null, created_at: "2026-11-01T00:00:00Z" },
      { id: "i4", provider_id: "p2", form_code: "I-130", service_fee_cents: 77700, uscis_fee_cents: 0, status: "paid", due_at: null, paid_at: "2026-11-10T00:00:00Z", created_at: "2026-10-03T00:00:00Z" },
    ],
    orderInvoices: [{ id: "o1", order_id: "ord1", amount_cents: 999999, status: "paid", paid_at: "2026-11-12T00:00:00Z", created_at: "2026-11-01T00:00:00Z" }],
    cases: [
      { id: "c1", provider_id: "p1", created_at: "2026-11-02T00:00:00Z", closed_at: null },
      { id: "c2", provider_id: "p1", created_at: "2026-10-05T00:00:00Z", closed_at: "2026-11-20T00:00:00Z" },
      { id: "c3", provider_id: "p2", created_at: "2026-11-03T00:00:00Z", closed_at: null },
    ],
  });
  ok("revenue is paid invoices only ($1,500.00)", summary.revenueCollectedCents === 150000);
  ok("gov fees kept separate ($625.00)", summary.govFeesCollectedCents === 62500);
  ok("order-invoice milestone NOT attributed to the professional", summary.revenueCollectedCents !== 150000 + 999999);
  ok("other professional's paid invoice excluded", summary.invoicesPaidCount === 2);
  ok("cases opened in month = 1", summary.casesOpened === 1);
  ok("cases closed in month = 1", summary.casesClosed === 1);
  const emptySummary = summarizeMonthlyProfessional({ providerId: "p1", month: "2026-11", invoices: [], orderInvoices: [], cases: [] });
  ok("empty input -> zeros + isEmpty", emptySummary.isEmpty === true && emptySummary.revenueCollectedCents === 0);

  console.log("credentials — never plain text");
  ok("last4 masks a fake key", last4("sk_live_FAKE12345678") === "••••5678");
  const pub = publicConnectionView({
    providerKey: "stripe_own", status: "connected", keyLast4: "••••4242",
    connectedAt: "2026-11-28T00:00:00Z", lastTestedAt: null, testStatus: "not_tested",
  });
  ok("public view carries last-4 only", pub.keyLast4 === "••••4242");
  ok("public view has no full key field", !("apiKey" in pub) && !("secret" in pub) && !("key" in pub));

  console.log("routes — honest 501 when unconfigured (no Supabase / SES)");
  {
    const res = await calendarGet(new Request("http://localhost/api/business-tools/calendar?providerId=p1"));
    ok("calendar GET without Supabase -> 501", res.status === 501);
    const data = (await res.json()) as { calendarConnected?: boolean };
    ok("calendar 501 says calendar not connected", data.calendarConnected === false);
  }
  {
    const res = await signaturePost(new Request("http://localhost/api/signatures/request", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ caseId: "c1", clientId: "cl1", formCode: "I-130", signerFullName: "Fake Signer" }),
    }));
    ok("signature POST without Supabase -> 501", res.status === 501);
  }
  {
    const res = await invoicePost(new Request("http://localhost/api/invoices", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invoiceId: "i1", toEmail: "fake@example.com" }),
    }));
    ok("invoice send without SES -> 501, not sent", res.status === 501);
    const data = (await res.json()) as { sent?: boolean };
    ok("invoice 501 says sent=false", data.sent === false);
  }

  console.log(`\nBusiness-tools smoke: ${passed} checks passed.`);
}

main().catch((err) => {
  console.error("SMOKE FAILED:", err);
  process.exit(1);
});
