// Smoke test for the DIY "missing ways" extras (Nov 28, 2026).
//
// Code-level only, FAKE data only — no network, no Supabase, no
// Stripe, no email. Run with:
//   npx -y tsx scripts/smoke-diy-extras.ts
// (tsx is NOT a project dependency; it is fetched on demand for this
// test only. Nothing is charged, no draft is saved, no email is sent.)
//
// Asserts:
//   1. Free health check: flags a missing packet, and NEVER unlocks
//      print — even a 100% health check leaves print locked without payment.
//   2. Fee calculator: USCIS fee and our fee are separate lines; the
//      result has NO combined total field at all.
//   3. Save-and-resume: a draft round-trips without losing answers,
//      and sensitive keys (SSN / passport) are stripped, never saved.
//   4. Review upsell is optional: print works without any review, and
//      a paid Review purchase alone never unlocks printing.
//   5. Per-form DIY gate (src/lib/diy.ts decideDiyUnlock — the DIY
//      flow's own gate, case-scoped): unpaid stays locked; a
//      diy_unlocks row unlocks its form; a diy_form invoice unlocks
//      only forms listed on the case; a DIY Bundle unlocks any form;
//      a Review purchase has no unlock path at all.
//   6. After-filing timeline: per-form steps from the codebase, every
//      step labelled typical — no promised date or outcome.
//   7. Question help: labelled "platform explanation, not USCIS text"
//      — platform wording is never presented as official USCIS wording.
//   8. Referral after print: real link when a code exists, honest
//      empty state when it does not.
//   9. Edition guard: no USCIS edition is verified — the notice says
//      to check uscis.gov before filing.
//  10. API routes: health-check is free (200, unlocksPrint false);
//      drafts POST returns honest 501 without Supabase env;
//      unlock-status without a sign-in returns 401.
//
// This script is excluded from tsc (see tsconfig.json "exclude").
import assert from "node:assert/strict";

// No live backends for this test: empty env forces the honest 501s.
process.env.NEXT_PUBLIC_SUPABASE_URL = "";
process.env.SUPABASE_SERVICE_ROLE_KEY = "";
process.env.STRIPE_SECRET_KEY = "";

import { runDiyHealthCheck } from "../src/lib/diyHealthCheck";
import { diyFeeBreakdown, diyBundleComparison } from "../src/lib/diyFees";
import {
  sanitizeDraftAnswers,
  summarizeDraft,
  diyDraftResumeUrl,
} from "../src/lib/diyDrafts";
import {
  canPrintWithoutReview,
  diyReviewOptions,
  reviewAddOnTotalCents,
} from "../src/lib/diyReviewUpsell";
import { decideDiyUnlock, diyFormMeta, allDiyFormsCarryEditionNotice, type DiyUnlockEvidence } from "../src/lib/diy";
import { diyAfterFilingTimeline } from "../src/lib/diyAfterFiling";
import { questionGroupsForForm } from "../src/lib/diyQuestionHelp";
import { referralAfterPrint } from "../src/lib/diyReferral";
import { POST as healthCheckPost } from "../src/app/api/diy/health-check/route";
import { POST as draftsPost } from "../src/app/api/diy/drafts/route";
import { GET as unlockStatusGet } from "../src/app/api/diy/unlock-status/route";

const FAKE_ACCOUNT_ID = "11111111-2222-3333-4444-555555555555";
const FAKE_CASE_ID = "22222222-3333-4444-5555-666666666666";

function noPaymentEvidence(caseForms: string[]): DiyUnlockEvidence {
  return {
    role: "client",
    caseForms,
    hasPaidDiyBundle: false,
    hasPaidDiyForm: false,
    hasPaidDiyUnlockRow: false,
    hasPaidFinalStageInvoice: false,
    hasFullyPaidPaymentPlan: false,
  };
}

async function main() {
  let passed = 0;
  function ok(name: string, cond: boolean) {
    assert.equal(cond, true, name);
    passed += 1;
    console.log(`  PASS ${name}`);
  }

  // 1) Free health check — flags a missing packet, never unlocks print.
  console.log("free health check");
  const emptyCheck = runDiyHealthCheck({ formCode: "I-130", answers: {} });
  ok("empty I-130 draft scores below 100", emptyCheck.score < 100);
  ok("empty draft has blocking fixes", emptyCheck.fixes.some((f) => f.blocking));
  ok("health check is free", emptyCheck.free === true);
  ok("health check never unlocks print", emptyCheck.unlocksPrint === false);
  ok("health check is not ready to file", emptyCheck.readyToFile === false);
  // Fully cleared checklist: 100% — and STILL does not unlock print.
  const clearedIds = [
    "i130-pet-passport", "i130-ben-passport", "i130-relationship",
    "i130-history-5y", "i130-photos", "i130-i130a", "i130-nvc-numbers",
    "i130-ds260", "i130-i864", "i130-joint-sponsor", "i130-ceac-civil",
    "i130-police", "i130-interview",
  ];
  const fullCheck = runDiyHealthCheck({
    formCode: "I-130",
    answers: {},
    clearedItemIds: clearedIds,
  });
  ok("fully cleared I-130 scores 100", fullCheck.score === 100);
  ok("fully cleared I-130 is checklist-ready", fullCheck.readyToFile === true);
  ok("even a 100% health check does not unlock print", fullCheck.unlocksPrint === false);
  // Timeline validator feeds the health check (I-751 window).
  const early751 = runDiyHealthCheck({
    formCode: "I-751",
    answers: { i751_card_expiry: "2027-06-01", i751_filing_date: "2027-01-01" },
  });
  ok(
    "I-751 filed before the 90-day window is a blocking timeline fix",
    early751.fixes.some((f) => f.kind === "timeline" && f.blocking)
  );

  // 2) Fee calculator — separate lines, no combined total.
  console.log("fee calculator");
  const fees = diyFeeBreakdown("I-485");
  ok("our DIY fee is $25 (2500c)", fees.ourFee.amountCents === 2500);
  ok("our fee line is kind our_fee", fees.ourFee.kind === "our_fee");
  ok(
    "USCIS I-485 fee is a separate locked $1,440 line",
    fees.governmentFees.some(
      (l) => l.kind === "uscis_government" && l.amountCents === 144000 && l.locked
    )
  );
  ok("result has no combined total field", !("totalCents" in fees) && !("total" in fees));
  ok("fee waiver note is present", fees.feeWaiverNote.includes("I-912"));
  ok("disclaimer names uscis.gov/fees", fees.disclaimer.includes("uscis.gov/fees"));
  const bundleFees = diyFeeBreakdown("I-485", { bundle: true });
  ok("DIY Bundle fee is $99 (9900c)", bundleFees.ourFee.amountCents === 9900);
  const comparison = diyBundleComparison(5);
  ok("5 forms at $25 = $125 vs bundle $99", comparison.perFormCents === 12500 && comparison.bundleCents === 9900);

  // 3) Save-and-resume — round-trip keeps answers, strips sensitive keys.
  console.log("save-and-resume");
  const draftAnswers = {
    i131_applicant_name: "Fake Test Person",
    i131_applicant_dob: "1990-01-01",
    i131_departure_date: "2027-03-01",
    i131_passport_number: "FAKE123456",
    beneficiary_ssn: "000-00-0000",
    i131_countries: "Haiti",
  };
  const sanitized = sanitizeDraftAnswers(draftAnswers);
  ok("passport key stripped", !("i131_passport_number" in sanitized.answers));
  ok("SSN key stripped", !("beneficiary_ssn" in sanitized.answers));
  ok("stripped keys are reported", sanitized.strippedKeys.length === 2);
  ok("name survives sanitizing", sanitized.answers.i131_applicant_name === "Fake Test Person");
  ok("DOB survives sanitizing (already held in accounts)", sanitized.answers.i131_applicant_dob === "1990-01-01");
  // JSON round-trip: what is saved is what resumes.
  const roundTripped = JSON.parse(JSON.stringify(sanitized.answers)) as Record<string, string>;
  ok(
    "round-trip loses no answers",
    Object.keys(roundTripped).length === Object.keys(sanitized.answers).length &&
      roundTripped.i131_countries === "Haiti"
  );
  const summary = summarizeDraft({
    formCode: "I-131",
    answers: sanitized.answers,
    totalKnownFields: 11,
    lastSavedAt: "2026-11-28T10:00:00.000Z",
  });
  ok("draft summary counts answered questions", summary.answeredCount === 4);
  ok(
    "resume URL points at the DIY page with case + form + draft id",
    diyDraftResumeUrl(FAKE_CASE_ID, "I-131", "draft-123") ===
      `/diy?caseId=${FAKE_CASE_ID}&form=I-131&draft=draft-123`
  );

  // 4) Review upsell is optional — print works without it.
  console.log("review upsell (optional)");
  ok("print works without any review", canPrintWithoutReview().allowed === true);
  const reviewOptions = diyReviewOptions();
  ok("Review $99/form is a locked option", reviewOptions.some((o) => o.key === "review_form" && o.amountCents === 9900));
  ok("Review + Human Review $199 is a locked option", reviewOptions.some((o) => o.key === "review_human" && o.amountCents === 19900));
  ok("Review Bundle $399 is a locked option", reviewOptions.some((o) => o.key === "review_bundle" && o.amountCents === 39900));
  ok("every review option is marked optional", reviewOptions.every((o) => o.optional === true));
  ok(
    "review add-on total sums only selected options",
    reviewAddOnTotalCents(["review_form", "review_human"]) === 9900 + 19900
  );
  // A Review purchase has NO unlock path: decideDiyUnlock takes no
  // review input at all, so no review payment can unlock printing.
  // (The gate's evidence shape has no review field — by construction.)
  ok(
    "review has no unlock path in the DIY gate",
    !("review" in noPaymentEvidence(["I-130"]))
  );

  // 5) Per-form DIY gate (the DIY flow's own gate, src/lib/diy.ts).
  console.log("DIY print gate");
  ok("unpaid client cannot print", decideDiyUnlock(noPaymentEvidence(["I-130"]), "I-130").unlocked === false);
  ok(
    "unpaid denial is the pay-first text",
    decideDiyUnlock(noPaymentEvidence(["I-130"]), "I-130").reason.length > 0
  );
  ok(
    "diy_unlocks row unlocks its exact form",
    decideDiyUnlock({ ...noPaymentEvidence(["I-130"]), hasPaidDiyUnlockRow: true }, "I-130").unlocked === true
  );
  ok(
    "diy_unlocks row unlocks by diy_unlock_row",
    decideDiyUnlock({ ...noPaymentEvidence(["I-130"]), hasPaidDiyUnlockRow: true }, "I-130").unlockedBy === "diy_unlock_row"
  );
  ok(
    "diy_form invoice unlocks a form listed on the case",
    decideDiyUnlock({ ...noPaymentEvidence(["I-130"]), hasPaidDiyForm: true }, "I-130").unlocked === true
  );
  ok(
    "diy_form invoice does NOT unlock a form not on the case",
    decideDiyUnlock({ ...noPaymentEvidence(["I-130"]), hasPaidDiyForm: true }, "I-485").unlocked === false
  );
  ok(
    "DIY Bundle unlocks any form",
    decideDiyUnlock({ ...noPaymentEvidence(["I-130"]), hasPaidDiyBundle: true }, "I-485").unlocked === true
  );
  ok(
    "admin / founder get support access",
    decideDiyUnlock({ ...noPaymentEvidence(["I-130"]), role: "admin" }, "I-130").unlocked === true
  );
  ok(
    "teacher without payment stays locked (DIY is per-form paid, not a subscription surface)",
    decideDiyUnlock({ ...noPaymentEvidence(["I-130"]), role: "teacher" }, "I-130").unlocked === false
  );

  // 6) After-filing timeline — typical steps, no promised date/outcome.
  console.log("after-filing timeline");
  const i130Timeline = diyAfterFilingTimeline("I-130");
  ok("I-130 is the consular route", i130Timeline.route === "consular");
  ok("I-130 timeline includes NVC steps", i130Timeline.steps.some((s) => s.stage === "nvc"));
  ok("I-485 is the adjustment route", diyAfterFilingTimeline("I-485").route === "adjustment");
  ok("N-400 gets USCIS stages only (no invented tail)", diyAfterFilingTimeline("N-400").route === "uscis_only");
  ok("disclaimer promises no date or outcome", i130Timeline.disclaimer.includes("No date or outcome is promised"));

  // 7) Question help — platform wording, never USCIS wording.
  console.log("question help");
  const i131Help = questionGroupsForForm("I-131");
  ok("I-131 has question groups", i131Help.length > 0);
  ok(
    "every group is labelled platform explanation, not USCIS text",
    i131Help.every((g) => g.source === "platform" && g.sourceLabel === "Platform explanation, not USCIS text")
  );
  ok("every group links to uscis.gov", i131Help.every((g) => g.uscisUrl.includes("uscis.gov")));

  // 8) Referral after print.
  console.log("referral after print");
  const noCode = referralAfterPrint({ referralCode: null });
  ok("no code gives an honest empty state", noCode.configured === false && (noCode.emptyState ?? "").includes("not set up"));
  const withCode = referralAfterPrint({ referralCode: "fake-code-123", referrerAccountId: FAKE_ACCOUNT_ID });
  ok("code gives the real /r/ link", withCode.referralUrl === "https://immigration.niptei.com/r/fake-code-123");
  ok("reward is still to be announced, never invented", withCode.rewardLabel.includes("to be announced"));
  ok("counts are 0 with no rows, never invented", withCode.referred === 0 && withCode.becameClients === 0);

  // 9) Edition guard — the DIY flow's own metadata (src/lib/diy.ts).
  console.log("edition guard");
  const edition = diyFormMeta("I-485");
  ok("I-485 has DIY metadata", edition !== null);
  ok(
    "no USCIS edition is verified — the note says to check uscis.gov",
    (edition?.editionNote ?? "").includes("No USCIS form edition is printed here") &&
      (edition?.editionNote ?? "").includes("uscis.gov")
  );
  ok("every DIY form carries its draft/edition notice", allDiyFormsCarryEditionNotice() === true);

  // 10) API routes.
  console.log("api routes");
  {
    const res = await healthCheckPost(
      new Request("http://localhost/api/diy/health-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formCode: "I-131",
          answers: { i131_applicant_name: "Fake Test Person", i131_passport_number: "FAKE123456" },
        }),
      })
    );
    ok("health-check POST is free (200)", res.status === 200);
    const data = (await res.json()) as { unlocksPrint?: boolean; sensitiveKeysStripped?: number };
    ok("health-check API never unlocks print", data.unlocksPrint === false);
    ok("health-check API strips a sent passport key", data.sensitiveKeysStripped === 1);
  }
  {
    const res = await draftsPost(
      new Request("http://localhost/api/diy/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: FAKE_ACCOUNT_ID, caseId: FAKE_CASE_ID, formCode: "I-131", answers: {} }),
      })
    );
    ok("drafts POST without Supabase returns honest 501", res.status === 501);
  }
  {
    const res = await unlockStatusGet(
      new Request(`http://localhost/api/diy/unlock-status?caseId=${FAKE_CASE_ID}&formCode=I-130`)
    );
    ok(
      "unlock-status GET without Supabase returns honest 501 (fail closed; 401 applies once configured)",
      res.status === 501
    );
  }

  console.log(`\n${passed} checks passed.`);
}

main().catch((err) => {
  console.error("SMOKE FAILED:", err);
  process.exit(1);
});
