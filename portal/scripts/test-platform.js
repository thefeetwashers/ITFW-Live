// ITFW Live — platform smoke test (CORRECTED).
// Tests ONLY what this build actually does, and never claims a live
// order, invoice, payment or send that did not happen.
//
//   (1) POST /api/confirm-intake-order with EXAMPLE data:
//       - When Supabase is wired: expects 201 with a caseId (a UUID)
//         and redirectUrl /portal?caseId=...
//       - When Supabase is NOT wired (the state of this build):
//         expects 501 / "not configured" — that IS the passing result
//         here, and the script reports "NOT WIRED — no order created"
//         instead of claiming a live order.
//   (2) POST /api/notify-stage with EXAMPLE data:
//       - Expects 501 / not_configured without Twilio/Resend keys
//         (and never claims a message was sent).
//
// Usage:
//   BASE_URL=http://localhost:3000 node scripts/test-platform.js [providerSlug]
//   BASE_URL=https://immigration.niptei.com node scripts/test-platform.js [providerSlug]
//
//   providerSlug defaults to the PLACEHOLDER 'your-name' — replace it
//   with a real storefront slug (immigration.niptei.com/p/<slug>).
//   With the placeholder the confirm test expects 404 (no professional
//   with that slug) WHEN Supabase is wired, or 501 when it is not.
//   Either way the script says which one it got.
//
// EXAMPLE DATA ONLY — nothing below is a real person, case or invoice:
//   Client: "Carlos & Elena Mendez" / test.client@example.com /
//   +17725550194 — EXAMPLE names/contacts, used only to exercise the
//   endpoint. Do NOT treat them as a real client.
//   Case "PHP2026514009" and Invoice "42117188" are EXAMPLE reference
//   labels from the brief (what a real case/invoice number looks
//   like). A real run returns a UUID caseId and an invoice number like
//   INV-xxxxxxxx-1 — never "PHP2026514009" / "42117188". If a response
//   ever contains those exact strings, it is echoing example input,
//   not a real record.
//
// paymentOption MUST be a LOCKED plan: full_upfront (Pay in Full) /
// installments_3 (Pay in 3) / monthly_6 / monthly_12. There is NO
// split_50_50 plan for immigration. prepFee / govFee figures used here
// are the LOCKED bundle price (Family Adjustment Bundle, Standard
// $1,799) + the LOCKED I-485 paper gov fee ($1,440); every other gov
// fee in the calculator is TO BE CONFIRMED and is not asserted here.
//
// Stripe webhook (manual, needs founder Stripe account confirmation):
//   stripe listen --forward-to localhost:3000/api/stripe/webhook
//   stripe trigger checkout.session.completed
//   stripe trigger invoice.paid
//   stripe trigger customer.subscription.created
// The webhook route is /api/stripe/webhook (NOT /api/webhooks/stripe)
// and is still a 501 skeleton until signature verification + the
// invoice-paid unlock are implemented — a trigger returning 501 is
// the EXPECTED result today, not a failure.

const BASE_URL = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const PROVIDER_SLUG = process.argv[2] || "your-name";

// --- EXAMPLE data only (see header) ---------------------------------------
const EXAMPLE_CLIENT = {
  name: "Carlos & Elena Mendez", // EXAMPLE — not a real person
  email: "test.client@example.com", // EXAMPLE — not a real client
  phone: "+17725550194", // EXAMPLE — not a real number
};
const EXAMPLE_CASE_REFERENCE = "PHP2026514009"; // EXAMPLE label only
const EXAMPLE_INVOICE_REFERENCE = "42117188"; // EXAMPLE label only

// Locked plan + locked prices exercised by this test:
// Family green card, inside US, paper filing, Standard bundle $1,799
// + Rush $199 = $1,998 prep; I-485 paper gov fee $1,440 LOCKED.
const EXAMPLE_ORDER = {
  providerSlug: PROVIDER_SLUG,
  goal: "family",
  beneficiaryLocation: "inside_us",
  filingMethod: "paper",
  speed: "rush",
  tierSelections: [{ key: "family-adjustment-bundle", tier: "standard" }],
  paymentPlan: "installments_3", // LOCKED plan (Pay in 3) — never split_50_50
  premiumProcessing: false,
  clientName: EXAMPLE_CLIENT.name,
  clientEmail: EXAMPLE_CLIENT.email,
  clientPhone: EXAMPLE_CLIENT.phone,
  preferredLanguage: "en",
};

const EXPECTED_PREP_TOTAL_CENTS = 179900 + 19900; // $1,799 Standard + $199 Rush
const EXPECTED_LOCKED_GOV_FEE_CENTS = 144000; // I-485 paper $1,440 LOCKED

let failures = 0;
function check(name, ok, detail) {
  // eslint-disable-next-line no-console
  console.log(`${ok ? "PASS" : "FAIL"} — ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures += 1;
}

async function postJson(path, payload) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  let data = {};
  try {
    data = await res.json();
  } catch {
    data = { _unparseable: true };
  }
  return { status: res.status, data };
}

async function testConfirmIntakeOrder() {
  // eslint-disable-next-line no-console
  console.log(`\n[1] POST /api/confirm-intake-order (providerSlug="${PROVIDER_SLUG}", EXAMPLE client ${EXAMPLE_CLIENT.email})`);
  // eslint-disable-next-line no-console
  console.log(`    EXAMPLE references (labels only, never asserted as real): case ${EXAMPLE_CASE_REFERENCE}, invoice ${EXAMPLE_INVOICE_REFERENCE}`);
  const { status, data } = await postJson("/api/confirm-intake-order", EXAMPLE_ORDER);

  if (status === 501) {
    check("confirm-intake-order returns 501 when Supabase is not wired", true, "NOT WIRED — no client, case, order or invoice was created (expected in this build)");
    check("501 body does not claim an order was created", typeof data.error === "string" && !/created|caseId/i.test(String(data.ok)), String(data.error || "").slice(0, 120));
    return;
  }
  if (status === 404 && PROVIDER_SLUG === "your-name") {
    check("confirm-intake-order returns 404 for placeholder slug 'your-name'", true, "replace the slug with a real storefront slug to test a live order");
    return;
  }
  if (status === 201) {
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    check("201 returns a UUID caseId", typeof data.caseId === "string" && uuidRe.test(data.caseId), `caseId=${data.caseId}`);
    check("caseId is NOT the example label", data.caseId !== EXAMPLE_CASE_REFERENCE, `caseId=${data.caseId}`);
    check(
      "201 returns redirectUrl /portal?caseId=...",
      typeof data.redirectUrl === "string" && data.redirectUrl === `/portal?caseId=${data.caseId}`,
      `redirectUrl=${data.redirectUrl}`
    );
    check("prep total is the locked $1,799 + $199 Rush", data.prepTotalCents === EXPECTED_PREP_TOTAL_CENTS, `prepTotalCents=${data.prepTotalCents}`);
    check("locked gov fee is the locked $1,440 I-485 paper fee", data.lockedGovFeeCents === EXPECTED_LOCKED_GOV_FEE_CENTS, `lockedGovFeeCents=${data.lockedGovFeeCents}`);
    check("payment plan is a LOCKED plan, not split_50_50", data.paymentPlan === "installments_3", `paymentPlan=${data.paymentPlan}`);
    check("3 installments were created", Array.isArray(data.installments) && data.installments.length === 3, `installments=${(data.installments || []).length}`);
    check(
      "invoice numbers are real (INV-…), not the example label",
      Array.isArray(data.invoiceNumbers) && data.invoiceNumbers.length === 3 && data.invoiceNumbers.every((n) => typeof n === "string" && n.startsWith("INV-") && n !== EXAMPLE_INVOICE_REFERENCE),
      `invoiceNumbers=${(data.invoiceNumbers || []).join(", ")}`
    );
    check("invoices are drafts — no payment was taken", data.invoiceStatus === "draft", `invoiceStatus=${data.invoiceStatus}`);
    check("checklist rows landed in inbox_items + packet_audit_items", data.checklist && data.checklist.insertedInboxItems > 0 && data.checklist.insertedAuditItems > 0, JSON.stringify(data.checklist || {}));
    check("lead landed in the Lead Sheet as converted", data.leadId && data.lifecycleStage === 2, `leadId=${data.leadId}, lifecycleStage=${data.lifecycleStage}`);
    return;
  }
  check(`confirm-intake-order returned an expected status (501 not wired / 404 placeholder slug / 201 wired)`, false, `got HTTP ${status}: ${JSON.stringify(data).slice(0, 300)}`);
}

async function testNotifyStage() {
  // eslint-disable-next-line no-console
  console.log("\n[2] POST /api/notify-stage (EXAMPLE data — expects 501 without Twilio/Resend keys)");
  const { status, data } = await postJson("/api/notify-stage", {
    caseId: "00000000-0000-0000-0000-000000000000",
    stage: "payment_plan",
    recipients: [{ name: EXAMPLE_CLIENT.name, email: EXAMPLE_CLIENT.email, language: "en", notificationPreference: "email", role: "primary_client" }],
  });
  if (status === 501) {
    check("notify-stage returns 501 without Twilio/Resend keys", true, String(data.error || "").slice(0, 120));
    check("notify-stage sent nothing", data.sent === false && data.sentCount === 0, `sent=${data.sent}, sentCount=${data.sentCount}`);
    return;
  }
  check("notify-stage returns 501 / not_configured without Twilio/Resend keys", false, `got HTTP ${status}: ${JSON.stringify(data).slice(0, 300)}`);
}

async function main() {
  // eslint-disable-next-line no-console
  console.log(`ITFW Live platform test — BASE_URL=${BASE_URL}`);
  // eslint-disable-next-line no-console
  console.log("EXAMPLE DATA ONLY — no real client, case, invoice, payment or send is created or claimed by this script.");
  await testConfirmIntakeOrder();
  await testNotifyStage();
  // eslint-disable-next-line no-console
  console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
  // eslint-disable-next-line no-console
  console.log("Stripe webhook manual test (needs founder Stripe account confirmation):");
  // eslint-disable-next-line no-console
  console.log("  stripe listen --forward-to localhost:3000/api/stripe/webhook");
  // eslint-disable-next-line no-console
  console.log("  stripe trigger checkout.session.completed");
  // eslint-disable-next-line no-console
  console.log("  stripe trigger invoice.paid");
  // eslint-disable-next-line no-console
  console.log("  stripe trigger customer.subscription.created");
  // eslint-disable-next-line no-console
  console.log("  (Expect 501 from the webhook today — its handler is still a skeleton.)");
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(`FAIL — test script could not run: ${e instanceof Error ? e.message : String(e)} (Is the dev server running? BASE_URL=${BASE_URL})`);
  process.exit(1);
});
