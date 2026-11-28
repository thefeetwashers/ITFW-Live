// Smoke test: form chaining for the guided DIY flow — run with:
//   npx -y tsx scripts/smoke-form-chains.ts
// (tsx is NOT a project dependency; it is fetched on demand for this
// test only, as in scripts/smoke-paywall-interview.ts.)
//
// FAKE DATA ONLY. No real Supabase, Stripe, or USCIS call is made:
// Supabase env vars are cleared so the chain-status route fails
// closed (501, no data), and every decision is tested against the
// pure chain functions with fake evidence rows. Nothing is charged,
// no account is created, no real key is used.
//
// Proves:
//   1. The Green Card Bundle chain contains exactly the bundle's 7
//      forms (FAMILY_ADJUSTMENT_BUNDLE.forms in src/lib/bundles.ts),
//      in filing order I-130 → I-130A → I-864 → I-485 → I-765 → I-131
//      → I-693 (see src/lib/formChains.ts for why the bundle list
//      itself is a set, not a filing order).
//   2. Completing form N shows form N+1 with its plain-English
//      reason ("Form 3 of 7 — I-864 next"), and completing all 7
//      reports the chain complete with no next form.
//   3. A form already completed can be revisited; a form not yet
//      reached is locked, never shown as completed.
//   4. A form whose DIY fee is unpaid stays locked for print / save /
//      email even if completed; the DIY Bundle $99 payment unlocks
//      the bundle's forms; I-130A follows the I-130 payment (free
//      with I-130); I-693 has no DIY print gate (doctor step).
//   5. Locked prices are unchanged (DIY $25/form, DIY Bundle $99,
//      with the locked Price IDs).
//   6. Every chain step carries the "check the current USCIS form
//      edition at uscis.gov before filing" notice and a plain-English
//      reason; every questions step has a Dynamic Intake Engine schema
//      (I-693 is the only doctor step, with no question set).
//   7. The chain-status API route fails closed without Supabase
//      (501, no data) and rejects a bad case id (400).
import assert from "node:assert/strict";
import {
  FORM_CHAINS,
  GREEN_CARD_BUNDLE_CHAIN,
  TPS_EAD_CHAIN,
  CONSULAR_NVC_CHAIN,
  chainForForm,
  chainProgress,
  nextStepAfter,
  decideChainFormUnlock,
  payGateFormCode,
  chainDiyPrices,
  validateChains,
  allChainsValid,
  CHAIN_EDITION_NOTICE,
  DRAFT_SCHEMA_NOTICE,
} from "../src/lib/formChains";
import { FAMILY_ADJUSTMENT_BUNDLE } from "../src/lib/bundles";
import { getRegistrySchema } from "../src/lib/dynamicIntakeSchemas";
import { getLockedPriceByKey } from "../src/lib/stripePrices";
import type { DiyUnlockEvidence } from "../src/lib/diy";
import { GET as chainStatusGet } from "../src/app/api/diy/chain-status/route";

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

function evidence(partial: Partial<DiyUnlockEvidence>): DiyUnlockEvidence {
  return {
    role: "client",
    caseForms: [],
    hasPaidDiyBundle: false,
    hasPaidDiyForm: false,
    hasPaidDiyUnlockRow: false,
    hasPaidFinalStageInvoice: false,
    hasFullyPaidPaymentPlan: false,
    ...partial,
  };
}

async function main() {
  // 1) Bundle chain order matches the bundle definition --------------
  console.log("bundle chain order");
  const chainCodes = GREEN_CARD_BUNDLE_CHAIN.steps.map((s) => s.formCode);
  ok(
    "bundle chain is I-130 → I-130A → I-864 → I-485 → I-765 → I-131 → I-693",
    chainCodes.join(",") === "I-130,I-130A,I-864,I-485,I-765,I-131,I-693"
  );
  ok(
    "bundle chain set equals FAMILY_ADJUSTMENT_BUNDLE.forms set",
    chainCodes.length === FAMILY_ADJUSTMENT_BUNDLE.forms.length &&
      FAMILY_ADJUSTMENT_BUNDLE.forms.every((f) => chainCodes.includes(f))
  );
  ok(
    "bundle prices locked ($999 / $1,799 / $2,799)",
    FAMILY_ADJUSTMENT_BUNDLE.price.basic === 999 &&
      FAMILY_ADJUSTMENT_BUNDLE.price.standard === 1799 &&
      FAMILY_ADJUSTMENT_BUNDLE.price.premium === 2799
  );
  ok(
    "chain source names bundles.ts",
    GREEN_CARD_BUNDLE_CHAIN.source.includes("bundles.ts")
  );

  // 2) Completing form N shows form N+1 with its reason --------------
  console.log("next-form flow");
  const after130 = chainProgress(GREEN_CARD_BUNDLE_CHAIN, ["I-130"]);
  ok("after I-130: label is 'Form 2 of 7 — I-130A next'", after130.label === "Form 2 of 7 — I-130A next");
  ok("after I-130: next step is I-130A", after130.currentStep?.formCode === "I-130A");
  ok(
    "after I-130: next reason is plain English and names the I-130",
    (after130.currentStep?.reason ?? "").includes("I-130")
  );
  ok("after I-130: 1 of 7 complete", after130.completedCount === 1);
  const afterThree = chainProgress(GREEN_CARD_BUNDLE_CHAIN, ["I-130", "I-130A", "I-864"]);
  ok("after I-130+I-130A+I-864: label is 'Form 4 of 7 — I-485 next'", afterThree.label === "Form 4 of 7 — I-485 next");
  ok(
    "after I-130+I-130A+I-864: I-485 reason says it is the permanent-resident application",
    (afterThree.currentStep?.reason ?? "").includes("permanent resident")
  );
  ok(
    "nextStepAfter matches chainProgress current step",
    nextStepAfter(GREEN_CARD_BUNDLE_CHAIN, ["I-130", "I-130A"])?.formCode === "I-864"
  );
  const allDone = chainProgress(GREEN_CARD_BUNDLE_CHAIN, [
    "I-130", "I-130A", "I-864", "I-485", "I-765", "I-131", "I-693",
  ]);
  ok("all 7 done: chain complete", allDone.complete === true);
  ok("all 7 done: label is 'All 7 forms complete'", allDone.label === "All 7 forms complete");
  ok("all 7 done: no next step", allDone.currentStep === null);
  ok("all 7 done: nextStepAfter is null", nextStepAfter(GREEN_CARD_BUNDLE_CHAIN, allDone.completedFormCodes) === null);
  const fresh = chainProgress(GREEN_CARD_BUNDLE_CHAIN, []);
  ok("nothing done: label is 'Form 1 of 7 — I-130 next'", fresh.label === "Form 1 of 7 — I-130 next");

  // 3) Completed = revisitable; unreached = locked, never completed ---
  console.log("step statuses");
  const mid = chainProgress(GREEN_CARD_BUNDLE_CHAIN, ["I-130", "I-130A"]);
  ok("I-130 is completed", mid.steps[0].status === "completed");
  ok("I-130A is completed", mid.steps[1].status === "completed");
  ok("I-864 is current (next)", mid.steps[2].status === "current");
  ok("I-485 is locked, not completed", mid.steps[3].status === "locked");
  ok("I-693 is locked, not completed", mid.steps[6].status === "locked");
  ok(
    "no locked step is ever reported completed",
    mid.steps.filter((s) => s.status === "locked").every((s) => !mid.completedFormCodes.includes(s.formCode))
  );
  ok(
    "out-of-order completion still points at the first uncompleted step",
    chainProgress(GREEN_CARD_BUNDLE_CHAIN, ["I-485"]).currentStep?.formCode === "I-130"
  );
  ok(
    "unknown form codes in the completed set are ignored",
    chainProgress(GREEN_CARD_BUNDLE_CHAIN, ["I-130", "N-400"]).completedCount === 1
  );

  // 4) Per-form pay-to-unlock -----------------------------------------
  console.log("per-form unlock");
  const unpaid = decideChainFormUnlock(evidence({ caseForms: ["I-485"] }), "I-485");
  ok("unpaid + completed form stays locked for print/save/email", unpaid.unlocked === false);
  ok("unpaid decision names the DIY $25 / $99 unlock", (unpaid.unlockLabel ?? "").includes("$25"));
  ok("unpaid decision unlock price key is diy_form", unpaid.unlockPriceKey === "diy_form");
  const bundlePaid = decideChainFormUnlock(evidence({ hasPaidDiyBundle: true }), "I-485");
  ok("DIY Bundle $99 unlocks I-485", bundlePaid.unlocked === true);
  const bundlePaid765 = decideChainFormUnlock(evidence({ hasPaidDiyBundle: true }), "I-765");
  ok("DIY Bundle $99 unlocks I-765 too", bundlePaid765.unlocked === true);
  const bundlePaid131 = decideChainFormUnlock(evidence({ hasPaidDiyBundle: true }), "I-131");
  ok("DIY Bundle $99 unlocks I-131 too", bundlePaid131.unlocked === true);
  const singlePaid = decideChainFormUnlock(
    evidence({ hasPaidDiyForm: true, caseForms: ["I-485"] }),
    "I-485"
  );
  ok("DIY $25 for the case unlocks I-485", singlePaid.unlocked === true);
  const singleOtherForm = decideChainFormUnlock(
    evidence({ hasPaidDiyForm: true, caseForms: ["I-485"] }),
    "I-765"
  );
  ok("DIY $25 paid for I-485 does NOT unlock I-765", singleOtherForm.unlocked === false);
  ok(
    "I-130A pay gate follows I-130 (free with I-130)",
    payGateFormCode("I-130A") === "I-130"
  );
  const i130aVia130 = decideChainFormUnlock(
    evidence({ hasPaidDiyForm: true, caseForms: ["I-130"] }),
    "I-130A"
  );
  ok("I-130A unlocks when I-130 is paid", i130aVia130.unlocked === true);
  ok(
    "I-130A unlock reason says it is included free with I-130",
    i130aVia130.reason.includes("included free with I-130")
  );
  const i693 = decideChainFormUnlock(evidence({ hasPaidDiyBundle: true }), "I-693");
  ok("I-693 has no DIY print gate even with the bundle paid", i693.applicable === false);
  ok("I-693 pay gate form code is null", payGateFormCode("I-693") === null);
  const reviewNeverUnlocks = decideChainFormUnlock(evidence({}), "I-485");
  ok("no payment evidence never unlocks", reviewNeverUnlocks.unlocked === false);

  // 5) Locked DIY prices unchanged ------------------------------------
  console.log("locked DIY prices");
  const prices = chainDiyPrices();
  ok("DIY $25/form price id unchanged", prices.single.priceId === "price_1UfS5APfd9SRUcvh47Ks9Lw0");
  ok("DIY $25/form is 2500 cents", prices.single.amountCents === 2500);
  ok("DIY Bundle $99 price id unchanged", prices.bundle.priceId === "price_1UfS5iPfd9SRUcvhKEQxf0pj");
  ok("DIY Bundle is 9900 cents", prices.bundle.amountCents === 9900);
  ok(
    "stripePrices agrees on both keys",
    getLockedPriceByKey("diy_form")?.priceId === "price_1UfS5APfd9SRUcvh47Ks9Lw0" &&
      getLockedPriceByKey("diy_bundle")?.priceId === "price_1UfS5iPfd9SRUcvhKEQxf0pj"
  );

  // 6) Reasons, schemas, edition notice -------------------------------
  console.log("reasons, schemas, edition notice");
  ok("all chains validate", allChainsValid());
  ok("validateChains reports no issues", validateChains().length === 0);
  ok("three chains defined", FORM_CHAINS.length === 3);
  for (const chain of FORM_CHAINS) {
    for (const s of chain.steps) {
      ok(
        `${chain.id} step ${s.formCode} has a plain-English reason`,
        s.reason.trim().length >= 20
      );
    }
  }
  ok(
    "every questions step has a registry schema",
    FORM_CHAINS.every((c) =>
      c.steps
        .filter((s) => s.kind === "questions")
        .every((s) => getRegistrySchema(s.formCode) !== null)
    )
  );
  ok("I-693 is the only doctor step (no question set)", 
    FORM_CHAINS.flatMap((c) => c.steps).filter((s) => s.kind === "doctor").map((s) => s.formCode).join(",") === "I-693"
  );
  ok(
    "I-693 has no registry schema (doctor completes it)",
    getRegistrySchema("I-693") === null
  );
  ok(
    "edition notice names uscis.gov",
    CHAIN_EDITION_NOTICE.includes("uscis.gov") && DRAFT_SCHEMA_NOTICE.includes("uscis.gov")
  );
  ok(
    "TPS chain is I-821 → I-765",
    TPS_EAD_CHAIN.steps.map((s) => s.formCode).join(",") === "I-821,I-765"
  );
  ok(
    "consular chain is I-130 → I-864 → DS-260",
    CONSULAR_NVC_CHAIN.steps.map((s) => s.formCode).join(",") === "I-130,I-864,DS-260"
  );
  ok(
    "chainForForm finds the Green Card chain for I-485",
    chainForForm("I-485")?.id === "green-card-bundle"
  );
  ok(
    "chainForForm returns null for standalone N-400",
    chainForForm("N-400") === null
  );

  // 7) Chain-status route fails closed ---------------------------------
  console.log("chain-status route (no live backends)");
  const badCase = await chainStatusGet(
    new Request("http://localhost/api/diy/chain-status?caseId=not-a-uuid&chainId=green-card-bundle")
  );
  ok("bad caseId returns 400", badCase.status === 400);
  const unknownChain = await chainStatusGet(
    new Request("http://localhost/api/diy/chain-status?caseId=11111111-1111-1111-1111-111111111111&chainId=nope")
  );
  ok("unknown chainId returns 400", unknownChain.status === 400);
  const noAuth = await chainStatusGet(
    new Request("http://localhost/api/diy/chain-status?caseId=11111111-1111-1111-1111-111111111111&chainId=green-card-bundle")
  );
  ok(
    "no token + no Supabase returns 501 (fail closed, no data)",
    noAuth.status === 501
  );
  const noAuthBody = (await noAuth.json().catch(() => ({}))) as Record<string, unknown>;
  ok(
    "501 body carries no chain steps or unlock data",
    !("steps" in noAuthBody) && !("completedFormCodes" in noAuthBody)
  );

  console.log(`\nSMOKE FORM-CHAINS: ${passed} checks passed.`);
}

main().catch((err) => {
  console.error("SMOKE FORM-CHAINS FAILED:", err);
  process.exit(1);
});
