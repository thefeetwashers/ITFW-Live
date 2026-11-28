// Smoke test for the case-status sync + one-click drafted emails
// (src/lib/caseStatusSync.ts, src/lib/draftedEmails.ts).
//
// Code-level only, FAKE data only — no real email is ever sent, no DB
// is touched, no network call is made except the SES guard check (which
// makes NO call when the env vars are missing). Run with:
//   npx -y tsx scripts/smoke-status-sync.ts
//
// Asserts:
//   1. Status write links to the right client case: the plan targets
//      the same case id for the case update, the lifecycle row and the
//      in-app message, and the message recipient is the case's
//      client_id — not the professional, not another case.
//   2. Email is NOT sent when SES is unconfigured: sendEmail returns
//      email_not_configured and attempts no network call; the sync
//      would record the email as not_configured, never as sent.
//   3. No DOB / A-Number / SSN appears in the generated subject line:
//      the subject is built from the form label only, and the
//      sensitive-identifier guard flags text that contains them (the
//      route rejects such payloads with 400).
//   4. Draft rendering: first name only in the greeting, form and
//      missing items filled in, RFE needs a deadline + attorney-review
//      label, and the single-item general request reuses the existing
//      7-language nudge.
//
// This script is excluded from tsc (see tsconfig.json "exclude").
import assert from "node:assert";

process.env.AWS_ACCESS_KEY_ID = "";
process.env.AWS_SECRET_ACCESS_KEY = "";
process.env.AWS_SES_REGION = "";
process.env.EMAIL_FROM = "";

import * as email from "../src/lib/email";
import {
  buildStatusEmailBody,
  buildStatusSubject,
  containsSensitiveIdentifier,
  firstNameOf,
  lifecycleStageForCaseStatus,
  planCaseStatusSync,
  resolveStatusPair,
} from "../src/lib/caseStatusSync";
import { ATTORNEY_REVIEW_LABEL, renderDraft } from "../src/lib/draftedEmails";

async function main() {
  let passed = 0;
  function check(name: string, cond: boolean) {
    assert.ok(cond, name);
    passed += 1;
    console.log(`PASS ${name}`);
  }

  const CASE_ID = "11111111-1111-4111-8111-111111111111";
  const CLIENT_ID = "22222222-2222-4222-8222-222222222222";
  const PROFESSIONAL_ID = "33333333-3333-4333-8333-333333333333";

  // 1. Status write links to the right client case.
  const plan = planCaseStatusSync(
    {
      caseId: CASE_ID,
      lifecycleStage: 5,
      stage5SubStage: "5A",
      statusText: "USCIS received your packet. Your receipt number is below.",
      receiptNumber: "IOE1234567890",
      formCode: "I-130",
      changedBy: PROFESSIONAL_ID,
    },
    { id: CASE_ID, client_id: CLIENT_ID, forms: ["I-130"], status: "in_preparation" }
  );
  check("plan: case update targets the same case id", plan.caseUpdate.id === CASE_ID);
  check("plan: lifecycle row carries the same case id", plan.lifecycleInsert.case_id === CASE_ID);
  check("plan: lifecycle stage is 5", plan.lifecycleInsert.stage === 5);
  check("plan: lifecycle sub-stage is 5A", plan.lifecycleInsert.sub_stage === "5A");
  check("plan: in-app message targets the same case id", plan.message.case_id === CASE_ID);
  check("plan: in-app message recipient is the case client_id", plan.message.recipient_id === CLIENT_ID);
  check("plan: in-app message recipient is NOT the professional", plan.message.recipient_id !== PROFESSIONAL_ID);
  check("plan: receipt write is flagged", plan.receiptWrites === true);
  check("plan: case status derived from stage 5 is filed", plan.caseUpdate.status === "filed");

  const pair = resolveStatusPair({ caseStatus: "rfe" });
  check("resolve: explicit rfe maps to lifecycle stage 5", pair.lifecycleStage === 5 && pair.caseStatus === "rfe");
  check("resolve: approved maps to stage 6", lifecycleStageForCaseStatus("approved") === 6);
  check("firstNameOf returns first name only", firstNameOf("Ana Maria Lopez") === "Ana");

  // 2. Email is NOT sent when SES is unconfigured.
  check("SES not configured with keys missing", email.isEmailConfigured() === false);
  const missing = await email.sendEmail({
    to: "test@example.com",
    subject: buildStatusSubject("I-130"),
    text: "smoke test — no email should be sent",
  });
  check("missing SES env -> email_not_configured", !missing.ok && missing.code === "email_not_configured");
  check("missing SES env lists both missing vars", email.missingEmailEnvs().length === 2);

  // 3. No DOB / A-Number / SSN in the generated subject line.
  const nasty =
    "Your DOB 01/02/1990 and A123456789 and SSN 123-45-6789 are on file.";
  check("guard flags A-Number / SSN text", containsSensitiveIdentifier(nasty) === true);
  check("guard passes clean text", containsSensitiveIdentifier("USCIS received your packet.") === false);
  const subject = buildStatusSubject("I-130");
  check("subject contains the form label", subject.includes("I-130"));
  check("subject has no DOB value", !subject.includes("01/02/1990"));
  check("subject has no A-Number", !subject.includes("A123456789"));
  check("subject has no SSN", !subject.includes("123-45-6789"));
  check("plan email subject is clean too", !plan.emailSubject.includes("A123456789") && !plan.emailSubject.includes("123-45-6789"));
  const body = buildStatusEmailBody({
    firstName: "Ana",
    formLabel: "I-130",
    statusText: "USCIS received your packet.",
    receiptNumber: "IOE1234567890",
  });
  check("body greets by first name only", body.includes("Hello Ana,"));
  check("body labels the receipt as manually entered", body.includes("manually entered"));
  check("body says it is not a live USCIS lookup", body.includes("not a live USCIS lookup"));

  // 4. Draft rendering.
  const birth = renderDraft("missing_birth_certificate", {
    firstName: "Ana Maria Lopez",
    form: "I-130",
  });
  check("birth-cert draft renders", birth.draft !== null && !birth.error);
  check(
    "birth-cert draft greets by first name only",
    (birth.draft?.body ?? "").includes("Hello Ana,") && !(birth.draft?.body ?? "").includes("Ana Maria")
  );
  check("birth-cert draft names the missing item", (birth.draft?.body ?? "").includes("Birth certificate"));
  check("birth-cert draft subject names the form", (birth.draft?.subject ?? "").includes("I-130"));
  check("birth-cert draft is English only — translation pending", birth.draft?.translationNote === "English only — translation pending");
  check("birth-cert draft needs no attorney review", birth.draft?.needsAttorneyReview === false);

  const rfeNoDeadline = renderDraft("rfe_deadline_reminder", {
    firstName: "Ana",
    form: "I-485",
  });
  check("RFE draft without a deadline is refused", rfeNoDeadline.draft === null && (rfeNoDeadline.error ?? "").includes("deadline"));
  const rfe = renderDraft("rfe_deadline_reminder", {
    firstName: "Ana",
    form: "I-485",
    deadline: "December 20, 2026",
    missingItems: ["A clearer copy of your birth certificate"],
  });
  check("RFE draft renders with a deadline", rfe.draft !== null && !rfe.error);
  check("RFE draft carries the attorney-review label", rfe.draft?.attorneyReviewLabel === ATTORNEY_REVIEW_LABEL);
  check("RFE draft states the deadline", (rfe.draft?.body ?? "").includes("December 20, 2026"));

  const generalEs = renderDraft(
    "general_document_request",
    { firstName: "Ana", form: "I-130", missingItems: ["Birth certificate"] },
    "es"
  );
  check(
    "single-item general request reuses the 7-language nudge (es)",
    generalEs.draft?.translationStatus === "seven_languages" &&
      (generalEs.draft?.subject ?? "").includes("Todavía falta")
  );
  const generalMulti = renderDraft("general_document_request", {
    firstName: "Ana",
    form: "I-130",
    missingItems: ["Birth certificate", "Passport bio page"],
  });
  check(
    "multi-item general request is English only — translation pending",
    generalMulti.draft?.translationStatus === "en_only_pending"
  );
  const unknown = renderDraft("no_such_template", { firstName: "Ana" });
  check("unknown template is refused", unknown.draft === null && (unknown.error ?? "").includes("Unknown template"));

  console.log(`\n${passed}/${passed} assertions passed — no email was sent, no DB was touched.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
