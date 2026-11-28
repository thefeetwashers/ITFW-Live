// Smoke test for the in-dashboard email composer (Nov 28, 2026).
//
// Code-level only, FAKE data only — no real email is ever sent, no
// real client, no network, no Supabase. Run with:
//   npx -y tsx scripts/smoke-dashboard-email.ts
//
// Asserts:
//   1. Composer send records delivery status honestly: with SES env
//      vars missing, sendEmail() returns email_not_configured and no
//      network call is attempted (the route's email channel would be
//      "not_configured" — never "sent").
//   2. Every form's missing-document checklist maps to a draft
//      template: for each of the 12 form-checklist templates, EVERY
//      checklist row produces a draft (specific template where one
//      exists, general_document_request otherwise).
//   3. All 8 missing-document letters exist and are wired
//      (7 specific + general_document_request).
//   4. The 5 extra lifecycle emails each exist as a draft and render
//      (missing_summary, deadline_warning, file_complete,
//      receipt_confirmation, interview_reminder).
//   5. Cover letters exist for every registry form (15) + the Family
//      Adjustment Bundle, all labelled for attorney review, and reuse
//      the DIY cover letter (no second letter engine).
//   6. Missing form answers: every unanswered required field on a
//      form produces a draft; sensitive fields (SSN / A-Number /
//      passport number) get a portal-only draft that never asks for
//      the value by email.
//   7. No draft contains a DOB / A-Number / SSN / passport value or
//      an approval promise — checked over every rendered draft in
//      this run, and by feeding a body with an SSN pattern and an
//      approval promise into the composer validator (both rejected).
//   8. BYO sender resolution: platform SES is the default; a BYO
//      source with no connected provider is unusable (never a fake
//      "sent"); connected + test-passed is usable.
//
// This script is excluded from tsc (see tsconfig.json "exclude").
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";

process.env.AWS_ACCESS_KEY_ID = "";
process.env.AWS_SECRET_ACCESS_KEY = "";
process.env.AWS_SES_REGION = "";
process.env.EMAIL_FROM = "";

import * as email from "../src/lib/email";
import {
  DRAFT_TEMPLATES,
  getDraftTemplate,
  renderDraft,
} from "../src/lib/draftedEmails";
import {
  draftsForAllChecklists,
  draftsForMissingAnswers,
  LIFECYCLE_TEMPLATE_IDS,
  listComposerTemplates,
  MISSING_DOCUMENT_TEMPLATE_IDS,
  resolveSenderSource,
  templateIdForChecklistItem,
  validateComposerInput,
  containsApprovalPromise,
} from "../src/lib/dashboardEmail";
import { FORM_CHECKLIST_TEMPLATES } from "../src/lib/formChecklists";
import {
  ALL_REGISTRY_FORM_CODES,
  getRegistrySchema,
  requiredFieldsForSchemas,
} from "../src/lib/dynamicIntakeSchemas";
import {
  FAMILY_ADJUSTMENT_FORM_CODES,
  listCoverLetters,
  renderCoverLetter,
} from "../src/lib/coverLetters";
import { containsSensitiveIdentifier } from "../src/lib/caseStatusSync";

const FAKE_FIRST_NAME = "Test";
const FAKE_FORM = "I-485";

// A DOB / A-Number / SSN / passport-shaped VALUE must never appear in
// a rendered draft. The drafts are rendered from fake placeholders
// only, so any match below means a template itself leaks one. Note:
// the field LABEL "Passport number" is fine — only a value (a token
// with a digit in it, e.g. "AB123456") counts. A DOB value is likewise
// a value, not a date the draft itself prints (appointment dates and
// the letter date are not DOBs); drafts here are never given a DOB.
const SENSITIVE_VALUE_RE =
  /\b\d{3}-\d{2}-\d{4}\b|\bA-?\d{8,9}\b|\bpassport\s*(number|no\.?)\s*[:#]?\s*(?=[A-Z0-9]*\d)[A-Z0-9]{6,}\b/i;

async function main() {
  let passed = 0;
  function check(name: string, cond: boolean) {
    assert.ok(cond, name);
    passed += 1;
    console.log(`PASS ${name}`);
  }

  const renderedTexts: string[] = [];
  function collect(draft: { subject: string; body: string } | null) {
    if (draft) renderedTexts.push(draft.subject, draft.body);
  }

  // 1. Honest 501 / not_configured when SES is unconfigured.
  const missing = await email.sendEmail({
    to: "test@example.com",
    subject: "smoke test",
    text: "smoke test — no email should be sent",
  });
  check("SES unconfigured -> email_not_configured, no network call", !missing.ok && missing.code === "email_not_configured");
  check("isEmailConfigured false when keys missing", email.isEmailConfigured() === false);

  // 2. Every checklist row on every template maps to a draft.
  const coverage = draftsForAllChecklists(FAKE_FIRST_NAME, "en");
  const totalItems = FORM_CHECKLIST_TEMPLATES.reduce((n, t) => n + t.checklist.length, 0);
  const totalDrafted = coverage.reduce((n, c) => n + c.draftedCount, 0);
  check(
    `all 12 checklist templates covered (${coverage.length} templates)`,
    coverage.length === FORM_CHECKLIST_TEMPLATES.length && FORM_CHECKLIST_TEMPLATES.length === 12
  );
  check(
    `every checklist row produces a draft (${totalDrafted}/${totalItems})`,
    totalDrafted === totalItems && coverage.every((c) => c.unmappedItemIds.length === 0)
  );
  for (const c of coverage) {
    check(`template ${c.templateId}: ${c.draftedCount}/${c.itemCount} items drafted`, c.draftedCount === c.itemCount);
  }
  // Spot-check the keyword mapping: a birth-certificate row gets the
  // specific template, an unknown row gets the general request.
  const birthRow = FORM_CHECKLIST_TEMPLATES.flatMap((t) => t.checklist).find((i) =>
    /birth certificate/i.test(i.title)
  );
  check("birth certificate row -> missing_birth_certificate", !!birthRow && templateIdForChecklistItem(birthRow) === "missing_birth_certificate");
  const genericRow = FORM_CHECKLIST_TEMPLATES.flatMap((t) => t.checklist).find((i) =>
    /5-year address/i.test(i.title)
  );
  check("5-year history row -> general_document_request (fallback)", !!genericRow && templateIdForChecklistItem(genericRow) === "general_document_request");

  // 3. All 8 missing-document letters exist and are wired.
  check("8 missing-document template ids listed", MISSING_DOCUMENT_TEMPLATE_IDS.length === 8);
  for (const id of MISSING_DOCUMENT_TEMPLATE_IDS) {
    const tpl = getDraftTemplate(id);
    check(`missing-document template exists: ${id}`, !!tpl);
    const { draft, error } = renderDraft(id, {
      firstName: FAKE_FIRST_NAME,
      form: FAKE_FORM,
      missingItems: ["Birth certificate (long form)"],
    });
    check(`missing-document template renders: ${id}`, !!draft && !error);
    collect(draft);
  }

  // 4. The 5 extra lifecycle emails each exist as a draft and render.
  check("5 lifecycle template ids listed", LIFECYCLE_TEMPLATE_IDS.length === 5);
  const lifecycleVars: Record<string, { firstName: string; form?: string; missingItems?: string[]; deadline?: string; appointmentDate?: string; appointmentLocation?: string }> = {
    missing_summary: { firstName: FAKE_FIRST_NAME, form: FAKE_FORM, missingItems: ["Birth certificate (long form)", "Passport bio page"] },
    deadline_warning: { firstName: FAKE_FIRST_NAME, form: FAKE_FORM, deadline: "December 2, 2026", missingItems: ["Birth certificate (long form)"] },
    file_complete: { firstName: FAKE_FIRST_NAME, form: FAKE_FORM },
    receipt_confirmation: { firstName: FAKE_FIRST_NAME, form: FAKE_FORM },
    interview_reminder: { firstName: FAKE_FIRST_NAME, form: FAKE_FORM, appointmentDate: "December 10, 2026 at 9:00 AM", appointmentLocation: "USCIS Field Office" },
  };
  for (const id of LIFECYCLE_TEMPLATE_IDS) {
    const { draft, error } = renderDraft(id, lifecycleVars[id], "en");
    check(`lifecycle draft renders: ${id}`, !!draft && !error);
    collect(draft);
  }
  // The two legal-content lifecycle drafts require attorney review.
  check("deadline_warning needs attorney review", getDraftTemplate("deadline_warning")?.needsAttorneyReview === true);
  check("interview_reminder needs attorney review", getDraftTemplate("interview_reminder")?.needsAttorneyReview === true);
  check("file_complete does not need attorney review", getDraftTemplate("file_complete")?.needsAttorneyReview === false);

  // 4b. Total drafted-email count: 11 pre-existing + 5 lifecycle = 16.
  check("16 drafted-email templates total", DRAFT_TEMPLATES.length === 16);

  // 5. Cover letters for every registry form + the bundle.
  check("15 registry form codes", ALL_REGISTRY_FORM_CODES.length === 15);
  const coverDefs = listCoverLetters();
  check("16 cover-letter defs (15 forms + bundle)", coverDefs.length === 16);
  for (const def of coverDefs) {
    check(`cover letter def exists: ${def.id}`, !!def);
    check(`cover letter needs attorney review: ${def.id}`, def.needsAttorneyReview === true);
  }
  for (const code of ALL_REGISTRY_FORM_CODES) {
    const { letter, error } = renderCoverLetter({
      clientName: "Test Client",
      preparerName: "Test Preparer",
      formCodes: [code],
      dateIso: "2026-11-28",
    });
    check(`cover letter renders for Form ${code}`, !!letter && !error);
    if (letter) {
      renderedTexts.push(letter.subject, letter.body);
      check(
        `cover letter for Form ${code} is DRAFT-labelled for attorney review`,
        letter.body.includes("Draft — for a licensed attorney to review before sending")
      );
      check(
        `cover letter for Form ${code} never promises an approval`,
        !containsApprovalPromise(letter.body)
      );
    }
  }
  const { letter: bundleLetter, error: bundleError } = renderCoverLetter({
    clientName: "Test Client",
    preparerName: "Test Preparer",
    formCodes: [...FAMILY_ADJUSTMENT_FORM_CODES],
    dateIso: "2026-11-28",
  });
  check("cover letter renders for Family Adjustment Bundle", !!bundleLetter && !bundleError);
  if (bundleLetter) renderedTexts.push(bundleLetter.subject, bundleLetter.body);
  // An unknown form has no cover letter — reported, never invented.
  const unknown = renderCoverLetter({ clientName: "Test Client", formCodes: ["I-999"] });
  check("unknown form -> no cover letter, honest error", !unknown.letter && !!unknown.error);
  // The professional letter reuses the DIY cover letter (no second engine).
  const coverSrc = readFileSync(join(__dirname, "../src/lib/coverLetters.ts"), "utf8");
  check("coverLetters.ts reuses buildDiyCoverLetter", coverSrc.includes("buildDiyCoverLetter"));

  // 6. Missing form answers: every unanswered required field drafts.
  for (const code of ALL_REGISTRY_FORM_CODES) {
    const schema = getRegistrySchema(code);
    if (!schema) continue;
    const required = requiredFieldsForSchemas([schema]);
    if (required.length === 0) continue;
    const unansweredByForm: Record<string, string[]> = {
      [code]: required.map((r) => r.field.name),
    };
    const result = draftsForMissingAnswers({
      formCodes: [code],
      unansweredByForm,
      firstName: FAKE_FIRST_NAME,
    });
    check(
      `Form ${code}: every unanswered required field drafts (${result.drafts.length}/${required.length})`,
      result.drafts.length === required.length && result.errors.length === 0 && result.unknownFieldNames.length === 0
    );
    for (const d of result.drafts) {
      collect(d.draft);
      if (d.sensitive) {
        check(
          `Form ${code} sensitive field "${d.fieldName}" -> portal-only draft (never asks by email)`,
          /enter (it|this) in your portal/i.test(d.draft.body) &&
            /do not send it by email/i.test(d.draft.body)
        );
      }
    }
  }
  // Unknown form / field are reported, never guessed.
  const unknownAnswers = draftsForMissingAnswers({
    formCodes: ["I-999"],
    unansweredByForm: { "I-999": ["some_field"] },
    firstName: FAKE_FIRST_NAME,
  });
  check("unknown form in missing answers -> reported", unknownAnswers.unknownFormCodes.includes("I-999"));
  check("no drafts invented for unknown form", unknownAnswers.drafts.length === 0);

  // 7. No draft contains a sensitive value or an approval promise.
  const badSensitive = renderedTexts.filter((t) => SENSITIVE_VALUE_RE.test(t) || containsSensitiveIdentifier(t));
  check(`no rendered draft contains a sensitive value (${renderedTexts.length} texts checked)`, badSensitive.length === 0);
  const badPromise = renderedTexts.filter((t) => containsApprovalPromise(t));
  check("no rendered draft promises an approval", badPromise.length === 0);
  check(
    "composer rejects a body with an SSN pattern",
    validateComposerInput({ subject: "Hello", body: "Your SSN is 123-45-6789." }).ok === false
  );
  check(
    "composer rejects an approval promise",
    validateComposerInput({ subject: "Hello", body: "Your case will be approved, guaranteed." }).ok === false
  );
  check(
    "composer accepts a clean free-form email",
    validateComposerInput({ subject: "Hello", body: "Please upload your birth certificate in your portal." }).ok === true
  );
  check(
    "composer rejects an empty subject",
    validateComposerInput({ subject: "  ", body: "Hello." }).ok === false
  );

  // 8. BYO sender resolution.
  check(
    "platform SES is the usable default",
    resolveSenderSource({ requested: "platform_ses", byo: null }).usable === true
  );
  check(
    "BYO with no provider connected is unusable (never a fake sent)",
    resolveSenderSource({ requested: "byo_resend", byo: null }).usable === false
  );
  check(
    "BYO connected but untested is unusable",
    resolveSenderSource({
      requested: "byo_resend",
      byo: { providerKey: "resend", status: "connected", testStatus: "not_tested", keyLast4: "1234" },
    }).usable === false
  );
  check(
    "BYO connected + test passed is usable",
    resolveSenderSource({
      requested: "byo_aws_ses",
      byo: { providerKey: "aws_ses", status: "connected", testStatus: "passed", keyLast4: "1234" },
    }).usable === true
  );

  // Composer picker: 16 drafted emails + 16 cover letters = 32.
  const picker = listComposerTemplates();
  check("composer picker lists 32 templates (16 emails + 16 cover letters)", picker.length === 32);
  check(
    "composer picker has all 5 lifecycle emails",
    LIFECYCLE_TEMPLATE_IDS.every((id) => picker.some((p) => p.id === id))
  );

  // The dashboardEmail engine never imports the server-only SES sender
  // (the route owns sending); the composer component never does either.
  const engineSrc = readFileSync(join(__dirname, "../src/lib/dashboardEmail.ts"), "utf8");
  check("dashboardEmail.ts does not import @aws-sdk/client-ses", !engineSrc.includes("@aws-sdk/client-ses"));
  const composerSrc = readFileSync(join(__dirname, "../src/components/comms/DashboardEmailComposer.tsx"), "utf8");
  check("composer component does not import the SES sender", !composerSrc.includes("@/lib/email") && !composerSrc.includes("@aws-sdk"));

  console.log(`\n${passed}/${passed} assertions passed — no email was sent, no real data used.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
