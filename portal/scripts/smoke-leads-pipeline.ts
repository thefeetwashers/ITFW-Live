// Smoke test for the Lead Generator + Client Pipeline build.
// FAKE data only — no real people, no real email, no live service.
// Run with:
//   npx -y tsx scripts/smoke-leads-pipeline.ts
//
// Asserts:
//   1. Empty pipeline / empty leads render the HONEST empty states
//      ("No clients … yet" / "No leads yet …") — never invented rows.
//   2. Masked DOB never contains a full date (••/••/1990 only).
//   3. A draft email is NOT sent when SES is unconfigured: sendEmail
//      returns email_not_configured, and POST /api/pipeline/draft-email
//      returns 501 / notConfigured. Nothing is claimed sent.
//   4. Conversion writes the correct values: preparer_leads
//      pipeline_stage 'converted' + case_lifecycle stage 2, and refuses
//      when no case exists (a case is never invented) or the quote
//      expired without re-confirmation.
//   5. Lead scoring is transparent (every point has its reason) and
//      payment status derives from invoice records, never a flag.
//
// This script is excluded from tsc (see tsconfig.json "exclude").
import assert from "node:assert";

// SES + Supabase env vars cleared BEFORE any call, so every send /
// write in this script must fail honestly with 501 / not_configured.
process.env.AWS_ACCESS_KEY_ID = "";
process.env.AWS_SECRET_ACCESS_KEY = "";
process.env.AWS_SES_REGION = "";
process.env.EMAIL_FROM = "";
process.env.NEXT_PUBLIC_SUPABASE_URL = "";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "";
process.env.SUPABASE_SERVICE_ROLE_KEY = "";

import { scoreLead, followUpStatus, validateLeadCapture } from "../src/lib/leadScoring";
import {
  maskDob,
  derivePaymentStatus,
  buildConversionUpdate,
  buildMissingDocDraft,
  leadsEmptyState,
  pipelineEmptyState,
  LEGAL_REVIEW_LABEL,
} from "../src/lib/pipeline";
import { sendEmail } from "../src/lib/email";
import { POST as postDraftEmail } from "../src/app/api/pipeline/draft-email/route";
import { POST as postConvert } from "../src/app/api/leads/convert/route";
import { POST as postLead } from "../src/app/api/leads/route";

async function main() {
  let passed = 0;
  function check(name: string, cond: boolean) {
    assert.ok(cond, name);
    passed += 1;
    console.log(`PASS ${name}`);
  }

  // --- 1. Honest empty states -------------------------------------------
  check("leads empty state says 'No leads yet'", leadsEmptyState().startsWith("No leads yet"));
  check(
    "leads empty state says rows come only from real forms",
    leadsEmptyState().includes("only when a real person fills in the intake form")
  );
  for (const role of ["preparer", "attorney", "doj"] as const) {
    check(
      `pipeline empty state (${role}) says 'No clients'`,
      pipelineEmptyState(role).includes("No clients")
    );
    check(
      `pipeline empty state (${role}) says nothing is shown until conversion`,
      pipelineEmptyState(role).includes("only after a real lead converts")
    );
  }

  // --- 2. Masked DOB never contains a full date --------------------------
  const masked = maskDob("1990-05-14");
  check("maskDob('1990-05-14') is ••/••/1990", masked === "••/••/1990");
  check("masked DOB has no month digits", !masked.includes("05"));
  check("masked DOB has no day digits", !masked.includes("14"));
  check("masked DOB has no full date", !masked.includes("1990-05-14") && !masked.includes("05/14"));
  check("maskDob(null) is 'Not provided'", maskDob(null) === "Not provided");
  check("maskDob('garbage') is 'Not provided'", maskDob("garbage") === "Not provided");
  check("maskDob('') is 'Not provided'", maskDob("") === "Not provided");

  // --- 3. Lead scoring is transparent ------------------------------------
  const hot = scoreLead({
    documentsReady: true,
    interviewDate: "2027-01-15",
    urgency: "urgent",
    serviceRequested: "family_bundle",
    viaReferral: true,
  });
  check("hot lead scores 100 (30+25+20+15+10)", hot.score === 100);
  check("hot lead band is hot", hot.band === "hot");
  check("every scoring rule has a reason", hot.reasons.length === 5);
  check(
    "score reasons name the points",
    hot.reasons.every((r) => /^\+\d+ — /.test(r))
  );
  const cold = scoreLead({
    documentsReady: false,
    interviewDate: null,
    urgency: null,
    serviceRequested: "other",
    viaReferral: false,
  });
  check("cold lead scores 0", cold.score === 0);
  check("cold lead band is new", cold.band === "new");
  check(
    "TO BE CONFIRMED service scores +0 with a reason",
    cold.reasons.some((r) => r.includes("TO BE CONFIRMED"))
  );
  const pastInterview = scoreLead({
    documentsReady: false,
    interviewDate: "2020-01-01",
    urgency: "low",
    serviceRequested: "I-130",
    viaReferral: false,
  });
  check(
    "past interview date adds no points",
    pastInterview.reasons.some((r) => r.includes("in the past"))
  );
  check(
    "past-interview lead still scores only the locked-price points",
    pastInterview.score === 15
  );

  // Follow-up reminders.
  check(
    "overdue follow-up is flagged",
    followUpStatus("2026-11-20", { todayIso: "2026-11-28" }).kind === "overdue"
  );
  check(
    "due-today follow-up is flagged",
    followUpStatus("2026-11-28", { todayIso: "2026-11-28" }).kind === "due_today"
  );
  check(
    "upcoming follow-up is flagged",
    followUpStatus("2026-12-01", { todayIso: "2026-11-28" }).kind === "upcoming"
  );
  check(
    "converted lead needs no follow-up",
    followUpStatus("2026-11-20", { converted: true, todayIso: "2026-11-28" }).kind === "none"
  );
  check(
    "no follow-up date reports none",
    followUpStatus(null).kind === "none"
  );

  // Intake validation never invents a missing value.
  let threw = false;
  try {
    validateLeadCapture({ fullName: "Fake Person", phone: "", email: "fake@example.invalid" });
  } catch {
    threw = true;
  }
  check("intake without a phone is rejected", threw);
  const valid = validateLeadCapture({
    fullName: "Fake Person",
    phone: "772-555-0100",
    email: "fake@example.invalid",
    preferredLanguage: "es",
    serviceRequested: "I-130",
    serviceTier: "standard",
    beneficiaryLocation: "inside_us",
    documentsReady: true,
    interviewDate: "",
    urgency: "high",
    referralCode: null,
    providerSlug: null,
  });
  check("valid fake intake passes validation", valid.fullName === "Fake Person");

  // --- 4. Payment status derives from invoice records --------------------
  check(
    "no invoices -> no_invoice",
    derivePaymentStatus([]).status === "no_invoice"
  );
  check(
    "all paid -> paid",
    derivePaymentStatus([
      { invoiceStatus: "paid", orderInvoiceStatus: null, amountCents: 179900, dueDate: null },
      { invoiceStatus: null, orderInvoiceStatus: "paid", amountCents: 179900, dueDate: null },
    ]).status === "paid"
  );
  check(
    "past-due invoice -> instalment_due",
    derivePaymentStatus([
      { invoiceStatus: "past_due", orderInvoiceStatus: null, amountCents: 29983, dueDate: "2026-11-01" },
    ]).status === "instalment_due"
  );
  check(
    "open invoice -> instalment_due",
    derivePaymentStatus([
      { invoiceStatus: "open", orderInvoiceStatus: null, amountCents: 29983, dueDate: "2026-12-01" },
    ]).status === "instalment_due"
  );
  check(
    "draft-only invoice -> unpaid (not paid)",
    derivePaymentStatus([
      { invoiceStatus: "draft", orderInvoiceStatus: null, amountCents: 179900, dueDate: null },
    ]).status === "unpaid"
  );

  // --- 5. Conversion writes the correct values, never invents a case ----
  const good = buildConversionUpdate({
    leadId: "lead-fake-1",
    caseId: "case-fake-1",
    quoteExpiresAt: "2027-12-31",
    quoteReconfirmed: false,
    currentPipelineStage: "new_lead",
  });
  check("valid conversion is ok", good.ok === true);
  if (good.ok) {
    check(
      "conversion sets pipeline_stage 'converted'",
      good.leadUpdate.pipeline_stage === "converted"
    );
    check("conversion links the existing case id", good.leadUpdate.case_id === "case-fake-1");
    check("conversion writes lifecycle stage 2", good.lifecycleInsert.stage === 2);
    check("lifecycle row is current", good.lifecycleInsert.is_current === true);
  }
  const noCase = buildConversionUpdate({
    leadId: "lead-fake-1",
    caseId: null,
    quoteExpiresAt: null,
    quoteReconfirmed: false,
    currentPipelineStage: "new_lead",
  });
  check("conversion without a case is refused", noCase.ok === false);
  check(
    "refusal says a case is never invented",
    !noCase.ok && noCase.error.includes("never invented")
  );
  const expired = buildConversionUpdate({
    leadId: "lead-fake-1",
    caseId: "case-fake-1",
    quoteExpiresAt: "2026-11-01",
    quoteReconfirmed: false,
    currentPipelineStage: "quote_sent",
  });
  check("expired quote blocks conversion", expired.ok === false);
  const reconfirmed = buildConversionUpdate({
    leadId: "lead-fake-1",
    caseId: "case-fake-1",
    quoteExpiresAt: "2026-11-01",
    quoteReconfirmed: true,
    currentPipelineStage: "quote_sent",
  });
  check("re-confirmed expired quote converts", reconfirmed.ok === true);
  const already = buildConversionUpdate({
    leadId: "lead-fake-1",
    caseId: "case-fake-1",
    quoteExpiresAt: null,
    quoteReconfirmed: false,
    currentPipelineStage: "converted",
  });
  check("already-converted lead is refused", already.ok === false);

  // --- 6. Draft email: shown first, legal content gated ------------------
  const draft = buildMissingDocDraft({
    clientName: "Fake Person",
    clientEmail: "fake@example.invalid",
    service: "I-130",
    missingDocuments: ["Passport bio page", "Birth certificate"],
    language: "es",
    caseId: "case-fake-1",
    legalContent: false,
    attorneyReviewed: false,
  });
  check("clerical missing-doc draft is sendable", draft.sendable === true);
  check(
    "Spanish draft uses the Spanish template",
    draft.subject.includes("falta") || draft.body.includes("falta")
  );
  check("draft body lists the missing documents", draft.body.includes("Passport bio page"));
  check("draft carries the clerical note", draft.labels.some((l) => l.includes("not legal advice")));
  const legalDraft = buildMissingDocDraft({
    clientName: "Fake Person",
    clientEmail: "fake@example.invalid",
    service: "I-130",
    missingDocuments: ["Passport bio page"],
    language: "en",
    caseId: "case-fake-1",
    legalContent: true,
    attorneyReviewed: false,
  });
  check("unreviewed legal draft is NOT sendable", legalDraft.sendable === false);
  check(
    "legal draft carries the attorney-review label",
    legalDraft.labels.includes(LEGAL_REVIEW_LABEL)
  );
  const reviewedLegal = buildMissingDocDraft({
    clientName: "Fake Person",
    clientEmail: "fake@example.invalid",
    service: "I-130",
    missingDocuments: ["Passport bio page"],
    language: "en",
    caseId: "case-fake-1",
    legalContent: true,
    attorneyReviewed: true,
  });
  check("attorney-reviewed legal draft is sendable", reviewedLegal.sendable === true);

  // --- 7. Draft email is NOT sent when SES is unconfigured (501) --------
  const direct = await sendEmail({
    to: "fake@example.invalid",
    subject: "smoke test",
    text: "smoke test — no email should be sent",
  });
  check("sendEmail with no SES env -> email_not_configured", !direct.ok && direct.code === "email_not_configured");

  const draftRes = await postDraftEmail(
    new Request("http://localhost/api/pipeline/draft-email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        caseId: "case-fake-1",
        to: "fake@example.invalid",
        clientName: "Fake Person",
        service: "I-130",
        missingDocuments: ["Passport bio page"],
        language: "en",
        legalContent: false,
        attorneyReviewed: false,
      }),
    })
  );
  check("POST draft-email with no SES env -> 501", draftRes.status === 501);
  const draftBody = (await draftRes.json()) as { notConfigured?: boolean; error?: string };
  check("draft-email 501 says notConfigured", draftBody.notConfigured === true);

  // The legal-content gate fires before any SES check: 400, never sent.
  const legalRes = await postDraftEmail(
    new Request("http://localhost/api/pipeline/draft-email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        caseId: "case-fake-1",
        to: "fake@example.invalid",
        clientName: "Fake Person",
        service: "I-130",
        missingDocuments: ["Passport bio page"],
        language: "en",
        legalContent: true,
        attorneyReviewed: false,
      }),
    })
  );
  check("unreviewed legal draft POST -> 400 (never sent)", legalRes.status === 400);

  // --- 8. Routes return honest 501 when Supabase is unconfigured --------
  const leadRes = await postLead(
    new Request("http://localhost/api/leads", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        fullName: "Fake Person",
        phone: "772-555-0100",
        email: "fake@example.invalid",
        preferredLanguage: "en",
        serviceRequested: "I-130",
        serviceTier: "standard",
        beneficiaryLocation: "inside_us",
        documentsReady: false,
        interviewDate: "",
        urgency: null,
        referralCode: null,
        providerSlug: "fake-provider",
      }),
    })
  );
  check("POST /api/leads with no Supabase env -> 501", leadRes.status === 501);
  const convertRes = await postConvert(
    new Request("http://localhost/api/leads/convert", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ leadId: "lead-fake-1", caseId: "case-fake-1" }),
    })
  );
  check("POST /api/leads/convert with no Supabase env -> 501", convertRes.status === 501);

  console.log(`\n${passed}/${passed} assertions passed — no email was sent, no row was written.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
