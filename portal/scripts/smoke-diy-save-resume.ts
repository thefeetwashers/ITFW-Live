// Smoke test: DIY save-and-resume + automatic answer transfer — run with:
//   npx -y tsx scripts/smoke-diy-save-resume.ts
// (tsx is NOT a project dependency; it is fetched on demand for this
// test only, as in scripts/smoke-stripe.ts.)
//
// FAKE DATA ONLY. No real Supabase, Stripe, or USCIS call is made:
// Supabase env vars are cleared so every route fails closed, and
// every decision is tested against the pure functions with fake
// answers. Nothing is charged, no account is created, no real key is
// used, no draft is saved to a real database.
//
// Proves:
//   1. An answer saved mid-form is retrievable with the EXACT resume
//      position (first unanswered required question — section index,
//      question index, field name — recomputed from the schema).
//   2. A half-finished form does NOT transfer and does NOT generate
//      a packet (completion gate 409 at the pure level; the transfer
//      route fails closed 501 with no Supabase, and never returns a
//      signed URL without a completed, paid transfer).
//   3. A completed form transfers its answers (mapping output
//      contains the saved answers; unmapped answers are listed, never
//      dropped; sensitive required fields are listed as
//      must-enter-on-the-official-form, never stored).
//   4. The pay gate still blocks print/save/email until payment is
//      confirmed (decideDiyUnlock: unpaid -> locked; paid DIY $25 /
//      $99 bundle -> unlocked; locked prices unchanged).
//   5. Sensitive keys are never saved (sanitize strips SSN /
//      A-Number / passport keys; a VALUE mentioning "passport" is not
//      stripped — only keys are matched).
//   6. "And more" after transfer is honest: checklist + draft cover
//      letter + submission guide name G-1450 / G-1650, say to confirm
//      the fee/address at uscis.gov, and never invent a filing address.
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { sanitizeDraftAnswers, type DiyDraftAnswers } from "../src/lib/diyDrafts";
import {
  answerableRequiredFields,
  buildDiyTransferBundle,
  diyCompletionStatus,
  resolveTransferValue,
  resumePositionFor,
  transferAnswersToForm,
} from "../src/lib/diyTransfer";
import { decideDiyUnlock, diySinglePrice, diyBundlePrice, type DiyUnlockEvidence } from "../src/lib/diy";
import {
  buildDiyCoverLetter,
  submissionGuideForForms,
  checklistTitlesForForm,
} from "../src/lib/diySubmission";
import { getRegistrySchema } from "../src/lib/dynamicIntakeSchemas";
import { POST as draftsPost, GET as draftsGet } from "../src/app/api/diy/drafts/route";
import { POST as transferPost } from "../src/app/api/diy/transfer/route";

// No live backends in this test: clear the env vars the routes read.
process.env.NEXT_PUBLIC_SUPABASE_URL = "";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "";
process.env.SUPABASE_SERVICE_ROLE_KEY = "";
process.env.STRIPE_SECRET_KEY = "";

let passed = 0;
function ok(name: string, cond: boolean) {
  assert.equal(cond, true, name);
  passed += 1;
  console.log(`  PASS ${name}`);
}

// --- Pick a real form with answerable required fields --------------------
// Derive the fields from the registry itself — never hard-code a field
// name the schema does not have.
const FORM_CODE = "I-130";
const required = answerableRequiredFields(FORM_CODE);
ok(`${FORM_CODE} has answerable required fields`, required.length >= 2);
const schema = getRegistrySchema(FORM_CODE);
assert.ok(schema, `${FORM_CODE} schema exists`);

function fakeAnswersFor(fields: { name: string }[]): DiyDraftAnswers {
  const out: DiyDraftAnswers = {};
  for (const f of fields) out[f.name] = `test answer for ${f.name}`;
  return out;
}

const fullAnswers = fakeAnswersFor(required);
const halfFields = required.slice(0, Math.floor(required.length / 2));
const halfAnswers = fakeAnswersFor(halfFields);
const firstMissing = required[halfFields.length];

// --- 1. Completion + progress ---------------------------------------------
{
  const half = diyCompletionStatus(FORM_CODE, halfAnswers);
  ok("half-finished form is not complete", half.complete === false);
  ok("half-finished progress is between 0 and 100", half.progressPercent > 0 && half.progressPercent < 100);
  ok(
    "half-finished answered count matches the answers given",
    half.answeredCount === halfFields.length
  );
  ok(
    "half-finished missing list starts with the first unanswered field",
    half.missing[0]?.name === firstMissing.name
  );
  const full = diyCompletionStatus(FORM_CODE, fullAnswers);
  ok("fully-answered form is complete", full.complete === true);
  ok("fully-answered progress is 100", full.progressPercent === 100);
  ok("fully-answered missing list is empty", full.missing.length === 0);
  ok(
    "unknown form is never complete",
    diyCompletionStatus("NO-SUCH-FORM", fullAnswers).complete === false
  );
}

// --- 2. Resume position is the EXACT question left off ----------------------
{
  const pos = resumePositionFor(FORM_CODE, halfAnswers);
  assert.ok(pos, "resume position exists for a half-finished form");
  ok("resume field is the first unanswered required field", pos.fieldName === firstMissing.name);
  // Recompute the position by walking the schema in order — the
  // resume position must match the schema order exactly.
  let expected: { sectionIndex: number; questionIndex: number; fieldName: string } | null = null;
  outer: for (let s = 0; s < (schema?.sections.length ?? 0); s += 1) {
    const section = schema!.sections[s];
    let q = 0;
    for (const field of section.fields) {
      if (field.type === "note") continue;
      if (
        field.required &&
        field.type !== "timeline_5yr" &&
        field.sensitive !== true &&
        !((halfAnswers[field.name] ?? "").trim())
      ) {
        expected = { sectionIndex: s, questionIndex: q, fieldName: field.name };
        break outer;
      }
      q += 1;
    }
  }
  assert.ok(expected, "expected resume position recomputed from the schema");
  ok("resume section index matches the schema order", pos.sectionIndex === expected.sectionIndex);
  ok("resume question index matches the schema order", pos.questionIndex === expected.questionIndex);
  const fullPos = resumePositionFor(FORM_CODE, fullAnswers);
  assert.ok(fullPos, "resume position exists for a finished form");
  const allFieldNames = new Set(
    (schema?.sections ?? []).flatMap((s) => s.fields.map((f) => f.name))
  );
  ok(
    "finished form resumes at a real last question (review step), never past the end",
    allFieldNames.has(fullPos.fieldName)
  );
  ok("unknown form has no resume position", resumePositionFor("NO-SUCH-FORM", halfAnswers) === null);
}

// --- 3. Sensitive keys are never saved --------------------------------------
{
  const dirty: DiyDraftAnswers = {
    ...halfAnswers,
    petitioner_ssn: "123-45-6789",
    beneficiary_passport_number: "X1234567",
    i485_a_number: "A123456789",
    trip_purpose: "visit family — my passport is ready",
  };
  const clean = sanitizeDraftAnswers(dirty);
  ok("SSN key is stripped", !("petitioner_ssn" in clean.answers));
  ok("passport key is stripped", !("beneficiary_passport_number" in clean.answers));
  ok("A-Number key is stripped", !("i485_a_number" in clean.answers));
  ok(
    "a VALUE mentioning passport is kept (only keys are matched)",
    clean.answers.trip_purpose === "visit family — my passport is ready"
  );
  ok("stripped keys are reported", clean.strippedKeys.length === 3);
  ok("ordinary answers survive sanitizing", clean.answers[halfFields[0].name] === halfAnswers[halfFields[0].name]);
}

// --- 4b. Key bridge: registry keys fill the legacy mapping keys ---------
// The flow saves registry keys (i130_petitioner_full_name); the USCIS
// mappings use the old questionnaire keys (petitioner_full_name).
// Verbatim aliases bridge them — nothing is joined or reformatted.
{
  const viaAlias = resolveTransferValue("petitioner_full_name", {
    i130_petitioner_full_name: "Test Person",
  });
  ok("alias fills the legacy name key", viaAlias.value === "Test Person");
  ok("alias reports its source key", viaAlias.sourceKey === "i130_petitioner_full_name");
  ok("alias is marked aliased", viaAlias.aliased === true);
  const exact = resolveTransferValue("petitioner_full_name", {
    petitioner_full_name: "Exact Person",
    i130_petitioner_full_name: "Alias Person",
  });
  ok("exact key wins over the alias", exact.value === "Exact Person" && exact.aliased === false);
  const missing = resolveTransferValue("marriage_date_place", {
    i130_marriage_date: "2020-01-01",
    i130_marriage_place: "Fort Pierce, FL",
  });
  ok(
    "date+place are NOT joined into one invented value (no alias)",
    missing.value === "" && missing.sourceKey === null
  );
  const purpose = resolveTransferValue("i131_trip_purpose", {
    i131_travel_purpose: "Humanitarian — family emergency / medical",
    i131_travel_purpose_detail: "My mother is in hospital.",
  });
  ok("trip purpose prefers the client's own words", purpose.value === "My mother is in hospital.");
}

// --- 4. Transfer: half-finished transfers nothing ---------------------------
{
  const half = transferAnswersToForm(FORM_CODE, halfAnswers);
  ok("half-finished transfer reports incomplete", half.complete === false);
  ok("half-finished transfer lists the missing questions", half.missing.length > 0);
  ok(
    "half-finished transfer never claims the mappings are verified",
    half.mappedFields.every((f) => f.mappingStatus === "UNVERIFIED" && f.verified === false)
  );
}

// --- 5. Transfer: completed form transfers its answers ----------------------
{
  const full = transferAnswersToForm(FORM_CODE, fullAnswers);
  ok("completed transfer reports complete", full.complete === true);
  ok("completed transfer has no missing questions", full.missing.length === 0);
  // Every mapped field marked answered carries the saved answer from
  // its source key (the mapping key itself, or its registry alias).
  let checked = 0;
  for (const row of full.mappedFields) {
    if (!row.answered) continue;
    assert.ok(row.sourceKey, `answered field ${row.questionKey} records its source key`);
    checked += 1;
    assert.equal(
      row.value,
      fullAnswers[row.sourceKey as string],
      `mapped field ${row.questionKey} carries the saved answer from ${row.sourceKey}`
    );
  }
  ok("mapped output contains saved answers for mapped keys", checked > 0);
  // Answers with no mapping are listed, never dropped: an answer
  // counts as consumed when it is a mapping key or an alias source
  // for one (see TransferredField.sourceKey).
  const consumed = new Set<string>(full.mappedFields.map((f) => f.questionKey));
  for (const f of full.mappedFields) {
    if (f.sourceKey) consumed.add(f.sourceKey);
  }
  const unmappedKeys = Object.keys(fullAnswers).filter((k) => !consumed.has(k));
  ok(
    "answers with no mapping are listed as unmapped, never dropped",
    full.unmappedAnswers.length === unmappedKeys.length
  );
  // Sensitive required fields are must-enter-on-form, never stored:
  // every mustEnterOnForm field is a sensitive schema field.
  const sensitiveNames = new Set(
    (schema?.sections ?? [])
      .flatMap((s) => s.fields)
      .filter((f) => f.sensitive === true)
      .map((f) => f.name)
  );
  ok(
    "every must-enter-on-form field is a sensitive schema field",
    full.mustEnterOnForm.every((f) => sensitiveNames.has(f.name))
  );
  const bundle = buildDiyTransferBundle(FORM_CODE, fullAnswers);
  assert.ok(bundle, "transfer bundle builds for a known form");
  ok("bundle carries the transfer result", bundle.transfer.complete === true);
  ok("bundle carries a checklist", bundle.checklistTitles.length > 0);
  ok(
    "bundle checklist matches the form checklist",
    JSON.stringify(bundle.checklistTitles) === JSON.stringify(checklistTitlesForForm(FORM_CODE))
  );
  ok("bundle cover letter is labelled DRAFT", bundle.coverLetter.includes("DRAFT"));
  ok(
    "bundle submission guide names G-1450 and G-1650",
    bundle.submissionGuide.steps.some(
      (s) => s.detail.includes("G-1450") && s.detail.includes("G-1650")
    )
  );
  ok(
    "bundle submission guide says to confirm at uscis.gov",
    bundle.submissionGuide.confirmLine.includes("uscis.gov")
  );
  ok("unknown form builds no bundle", buildDiyTransferBundle("NO-SUCH-FORM", fullAnswers) === null);
}

// --- 6. "And more" honesty: cover letter + guide ----------------------------
{
  const letter = buildDiyCoverLetter({
    clientName: "Test Person",
    formCodes: [FORM_CODE],
    dateIso: "2026-11-28",
  });
  ok("cover letter is labelled DRAFT", letter.includes("DRAFT"));
  ok("cover letter names the form", letter.includes(`Form ${FORM_CODE}`));
  ok("cover letter never claims to file the case", letter.includes("does not file your case"));
  const guide = submissionGuideForForms([FORM_CODE]);
  ok(
    "guide names G-1450 (card) and G-1650 (ACH)",
    guide.steps.some((s) => s.detail.includes("G-1450") && s.detail.includes("G-1650"))
  );
  ok("guide never invents a filing address", guide.confirmLine.includes("uscis.gov"));
  ok(
    "guide says no personal checks or money orders",
    guide.steps.some((s) => s.detail.includes("no personal checks or money orders"))
  );
}

// --- 7. Pay gate still blocks print/save/email until paid --------------------
{
  const base: DiyUnlockEvidence = {
    role: "client",
    caseForms: [FORM_CODE],
    hasPaidDiyBundle: false,
    hasPaidDiyForm: false,
    hasPaidDiyUnlockRow: false,
    hasPaidFinalStageInvoice: false,
    hasFullyPaidPaymentPlan: false,
  };
  ok("unpaid client is locked", decideDiyUnlock(base, FORM_CODE).unlocked === false);
  ok(
    "paid DIY $25/form unlocks the form listed on the case",
    decideDiyUnlock({ ...base, hasPaidDiyForm: true }, FORM_CODE).unlocked === true
  );
  ok(
    "paid DIY Bundle $99 unlocks every form",
    decideDiyUnlock({ ...base, hasPaidDiyBundle: true }, FORM_CODE).unlocked === true
  );
  ok(
    "paid DIY $25 for a case NOT listing the form stays locked",
    decideDiyUnlock(
      { ...base, hasPaidDiyForm: true, caseForms: ["I-485"] },
      FORM_CODE
    ).unlocked === false
  );
  const single = diySinglePrice();
  ok("DIY $25/form priceId is unchanged", single.priceId === "price_1UfS5APfd9SRUcvh47Ks9Lw0");
  ok("DIY $25/form is 2500 cents", single.amountCents === 2500);
  const bundlePrice = diyBundlePrice();
  ok("DIY Bundle $99 priceId is unchanged", bundlePrice.priceId === "price_1UfS5iPfd9SRUcvhKEQxf0pj");
  ok("DIY Bundle $99 is 9900 cents", bundlePrice.amountCents === 9900);
}

// --- 8. Routes fail closed with no Supabase (no packet, no unlock) -----------
// (Async — runs inside main() below, because top-level await is not
// supported in this test runner's output format.)
async function main() {
{
  const noAuth = new Request("http://localhost/api/diy/drafts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      caseId: "11111111-1111-1111-1111-111111111111",
      formCode: FORM_CODE,
      answers: halfAnswers,
    }),
  });
  const draftsRes = await draftsPost(noAuth);
  ok("POST /api/diy/drafts with no Supabase fails closed (501)", draftsRes.status === 501);
  const draftsBody = (await draftsRes.json()) as Record<string, unknown>;
  ok("drafts refusal carries an error, never a saved draft", typeof draftsBody.error === "string");

  const draftsGetRes = await draftsGet(
    new Request("http://localhost/api/diy/drafts?caseId=11111111-1111-1111-1111-111111111111")
  );
  ok("GET /api/diy/drafts with no Supabase fails closed (501)", draftsGetRes.status === 501);

  const transferRes = await transferPost(
    new Request("http://localhost/api/diy/transfer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        caseId: "11111111-1111-1111-1111-111111111111",
        formCode: FORM_CODE,
      }),
    })
  );
  ok("POST /api/diy/transfer with no Supabase fails closed (501)", transferRes.status === 501);
  const transferBody = (await transferRes.json()) as Record<string, unknown>;
  ok(
    "transfer refusal carries an error and no signed URL",
    typeof transferBody.error === "string" && !("signedUrl" in transferBody)
  );

  const badCaseRes = await transferPost(
    new Request("http://localhost/api/diy/transfer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ caseId: "not-a-uuid", formCode: FORM_CODE }),
    })
  );
  ok("POST /api/diy/transfer with a bad case id returns 400", badCaseRes.status === 400);
}

// --- 9. Migration 0023 exists and is the drafts home -------------------------
{
  const migrationsDir = join(process.cwd(), "..", "supabase", "migrations");
  const file0023 = join(migrationsDir, "0023_itfw_diy_drafts.sql");
  ok("migration 0023 file exists", existsSync(file0023));
  const sql = readFileSync(file0023, "utf8");
  ok("0023 creates diy_drafts", sql.includes("create table if not exists public.diy_drafts"));
  ok("0023 stores the resume position", sql.includes("current_section_index") && sql.includes("current_field_name"));
  ok("0023 has the sensitive-key backstop trigger", sql.includes("diy_drafts_no_sensitive_keys"));
  ok("0023 does NOT recreate diy_unlocks (0022 owns it)", !/create table[^;]*diy_unlocks/i.test(sql));
  ok("0023 never stores SSNs", !/ssn\s+text/i.test(sql) && sql.includes("NO SSN"));
}

console.log(`\nSMOKE DIY SAVE-RESUME: ${passed} checks passed.`);
console.log(
  "Note: live-database behaviour (a real draft round-trip, a real paid transfer, a real packet PDF) is NOT covered here — it needs Supabase + Stripe + a USCIS template in the vault, none of which this test touches."
);
}

main().catch((err) => {
  console.error("SMOKE DIY SAVE-RESUME FAILED:", err);
  process.exit(1);
});
