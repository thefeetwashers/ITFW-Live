// Smoke test for the tenth addition — expert features INSIDE the
// dashboards (Nov 28, 2026). FAKE data only — no real people, no real
// email, no live service.
// Run with:
//   npx -y tsx scripts/smoke-dashboard-embedded.ts
//
// Asserts:
//   1. The Renewal & Expiry Radar flags a passport expiring in 30
//      days (in the 180/90/30/7-day ladder) and does NOT flag one
//      expiring in 2 years. Advance parole + visa types exist, with
//      their locked Basic prep prices (I-131 $250; visa: none).
//   2. The Fee Waiver Checker NEVER says "you qualify" — the strongest
//      answer is "You may qualify — an attorney/DOJ rep should
//      confirm." The 150% threshold for household 4, contiguous US,
//      is $49,500 (locked 2026 I-864P 100% column $33,000 × 1.5).
//   3. The Total Cost Estimator shows the USCIS fee and our fee
//      SEPARATELY, with NO combined-total field anywhere on the
//      result (per form, Family Adjustment Bundle, and DIY).
//   4. The Vault flags an expiring medical exam and says birth
//      certificate translations do not expire.
//   5. Each dashboard home renders its embedded sections — checked
//      statically: the client dashboard home and at least one
//      professional dashboard (preparer command center) import and
//      render the radar, waiver checker, estimator, and vault
//      sections (the pages are client components, so the smoke test
//      verifies the wiring in source rather than mounting React).
//   6. Renewal reminders are honest: with SES unconfigured,
//      sendRenewalReminder returns email_not_configured and sends
//      nothing, while renewalRemindersDue still lists what WOULD
//      go out.
//
// This script is excluded from tsc (see tsconfig.json "exclude").
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// SES + Supabase env vars cleared BEFORE any call, so every send /
// write in this script must fail honestly with 501 / not_configured.
process.env.AWS_ACCESS_KEY_ID = "";
process.env.AWS_SECRET_ACCESS_KEY = "";
process.env.AWS_SES_REGION = "";
process.env.EMAIL_FROM = "";
process.env.NEXT_PUBLIC_SUPABASE_URL = "";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "";
process.env.SUPABASE_SERVICE_ROLE_KEY = "";

import {
  deriveRenewals,
  renewalPrepPrice,
  renewalReminderRungs,
  type RenewalInput,
} from "../src/lib/renewals";
import {
  checkFeeWaiver,
  FEE_WAIVER_MAY_QUALIFY,
  feeWaiver150Threshold,
} from "../src/lib/feeWaiverChecker";
import {
  estimateForDiy,
  estimateForFamilyAdjustmentBundle,
  estimateForForm,
} from "../src/lib/totalCostEstimator";
import {
  deriveVaultExpiries,
  VAULT_TRANSLATION_NEVER_EXPIRES,
  type VaultDocumentInput,
} from "../src/lib/vaultExpiry";
import {
  renewalRemindersDue,
  sendRenewalReminder,
} from "../src/lib/renewalReminders";

function daysFromNow(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function noCombinedTotal(obj: object, where: string): void {
  for (const key of Object.keys(obj)) {
    assert.ok(
      !/total/i.test(key) || key === "lockedGovernmentTotalCents",
      `${where}: result must not carry a combined-total field, found key "${key}"`
    );
  }
  assert.ok(
    !("totalCents" in obj) && !("total" in obj) && !("combinedTotal" in obj),
    `${where}: result must not carry any combined total`
  );
}

// --- 1. Renewal & Expiry Radar -------------------------------------------
const now = new Date();
const passportSoon: RenewalInput = {
  id: "r-passport-soon",
  caseId: "case-fake-1",
  type: "passport",
  eligibilityOrExpiryDate: daysFromNow(30),
  status: "upcoming",
};
const passportFar: RenewalInput = {
  id: "r-passport-far",
  caseId: "case-fake-1",
  type: "passport",
  eligibilityOrExpiryDate: daysFromNow(730),
  status: "upcoming",
};
const derived = deriveRenewals([passportSoon, passportFar], now);
const soon = derived.find((r) => r.id === "r-passport-soon")!;
const far = derived.find((r) => r.id === "r-passport-far")!;
assert.strictEqual(soon.isDue, true, "passport expiring in 30 days must be due");
assert.deepStrictEqual(
  soon.reminderRungsDue,
  [180, 90, 30],
  "30-day passport must have the 180/90/30-day rungs due (not the 7-day rung)"
);
assert.strictEqual(far.isDue, false, "passport expiring in 2 years must NOT be due");
assert.deepStrictEqual(far.reminderRungsDue, [], "2-year passport must have no rung due");
assert.deepStrictEqual(
  renewalReminderRungs({ eligibilityOrExpiryDate: daysFromNow(7), status: "upcoming" }, now),
  [180, 90, 30, 7],
  "7-day expiry must have every ladder rung due"
);
const advanceParole: RenewalInput = {
  id: "r-ap",
  caseId: "case-fake-1",
  type: "advance_parole",
  eligibilityOrExpiryDate: daysFromNow(100),
  status: "upcoming",
};
assert.strictEqual(
  deriveRenewals([advanceParole], now)[0].isDue,
  true,
  "advance parole (I-131 renewal) must be a tracked radar type"
);
assert.deepStrictEqual(
  renewalPrepPrice("advance_parole"),
  { label: "I-131 — Basic", amountCents: 25000 },
  "I-131 renewal prep price is the locked Basic $250"
);
assert.strictEqual(renewalPrepPrice("visa"), null, "visa expiry has no USCIS renewal form or prep price");
assert.deepStrictEqual(
  renewalPrepPrice("green_card"),
  { label: "I-90 — Basic", amountCents: 12900 },
  "I-90 renewal prep price is the locked Basic $129"
);
console.log("1. Radar: 30-day passport flagged (rungs 180/90/30), 2-year passport NOT flagged; advance parole + visa types live.");

// --- 2. Fee Waiver Checker (I-912) ---------------------------------------
assert.strictEqual(
  feeWaiver150Threshold(4, "contiguous"),
  49500,
  "150% threshold, household 4, contiguous US, must be $49,500 (locked I-864P 100% $33,000 x 1.5)"
);
const mayQualify = checkFeeWaiver({
  householdSize: 4,
  region: "contiguous",
  annualHouseholdIncome: 40000,
  hasMeansTestedBenefit: true,
  hasFinancialHardship: true,
});
assert.strictEqual(mayQualify.outcome, "may_qualify");
assert.strictEqual(mayQualify.headline, FEE_WAIVER_MAY_QUALIFY);
assert.strictEqual(
  mayQualify.headline,
  "You may qualify — an attorney/DOJ rep should confirm.",
  "strongest headline must be the may-qualify + confirm wording"
);
for (const result of [
  mayQualify,
  checkFeeWaiver({
    householdSize: 2,
    region: "contiguous",
    annualHouseholdIncome: 90000,
    hasMeansTestedBenefit: false,
    hasFinancialHardship: false,
  }),
  checkFeeWaiver({
    householdSize: 4,
    region: "contiguous",
    annualHouseholdIncome: null,
    hasMeansTestedBenefit: null,
    hasFinancialHardship: null,
  }),
]) {
  // The HEADLINE is the claim the user reads: it must never be a
  // bare "you qualify". (The disclaimer legitimately contains the
  // negation "cannot tell you that you qualify" — that is not a
  // claim of eligibility, so the headline, not the disclaimer, is
  // what is asserted here.)
  assert.ok(
    !/^you qualify/i.test(result.headline),
    `headline must never be "you qualify", got: ${result.headline}`
  );
  assert.ok(
    !/["']qualified["']/.test(JSON.stringify(result)),
    "no waiver result may ever say 'qualified'"
  );
  assert.ok(
    ["may_qualify", "no_ground_indicated", "cannot_tell"].includes(result.outcome),
    `outcome must be one of the three non-deciding outcomes, got ${result.outcome}`
  );
  assert.ok(
    result.disclaimer.includes("Only USCIS decides"),
    "every result must carry the only-USCIS-decides disclaimer"
  );
}
assert.ok(
  mayQualify.proofToGather.length === 3,
  "all three indicated grounds must list the proof to gather"
);
console.log("2. Waiver checker: HH4 150% = $49,500; strongest answer is only 'You may qualify — an attorney/DOJ rep should confirm.'");

// --- 3. Total Cost Estimator ---------------------------------------------
const i485 = estimateForForm("I-485", "basic")!;
assert.strictEqual(i485.ourFee.amount, "$750", "I-485 Basic prep fee is $750");
assert.ok(
  i485.governmentFees.some((l) => l.label.includes("I-485") && l.amount === "$1,440"),
  "I-485 USCIS fee $1,440 must be its own separate line"
);
assert.notStrictEqual(i485.ourFee.amount, i485.governmentFees[0]?.amount);
noCombinedTotal(i485, "I-485 estimate");
const bundle = estimateForFamilyAdjustmentBundle("basic");
assert.strictEqual(bundle.ourFee.amount, "$999", "Family Adjustment Bundle Basic is $999");
assert.ok(
  bundle.governmentFees.some((l) => l.amount === "$1,440"),
  "bundle must still list the USCIS fee separately"
);
noCombinedTotal(bundle, "Family Adjustment Bundle estimate");
const diy = estimateForDiy("I-485");
assert.strictEqual(diy.ourFee.amount, "$25", "DIY per-form fee is $25");
assert.ok(
  diy.governmentFees.some((l) => l.amount === "$1,440"),
  "DIY estimate must still list the USCIS fee separately"
);
noCombinedTotal(diy, "DIY estimate");
console.log("3. Estimator: our fee and USCIS fee separate on I-485 ($750 / $1,440), bundle ($999), and DIY ($25) — no combined total anywhere.");

// --- 4. Document Vault expiry --------------------------------------------
const medicalSoon: VaultDocumentInput = {
  id: "v-medical",
  caseId: "case-fake-1",
  kind: "medical_exam",
  label: "Sealed Form I-693 medical exam",
  expiresOn: daysFromNow(30),
};
const translation: VaultDocumentInput = {
  id: "v-translation",
  caseId: "case-fake-1",
  kind: "birth_certificate_translation",
  label: "Birth certificate — certified translation",
  expiresOn: null,
};
const vault = deriveVaultExpiries([medicalSoon, translation], now);
const medical = vault.find((d) => d.id === "v-medical")!;
assert.strictEqual(medical.status, "expiring_soon", "medical exam expiring in 30 days must be flagged");
assert.strictEqual(medical.daysUntilExpiry, 30);
const translated = vault.find((d) => d.id === "v-translation")!;
assert.strictEqual(translated.status, "never_expires", "translations must never expire");
assert.ok(
  translated.statusLabel.toLowerCase().includes("do not expire"),
  "translation status must say translations do not expire"
);
assert.ok(
  VAULT_TRANSLATION_NEVER_EXPIRES.includes("do not expire"),
  "vault copy must state translations do not expire"
);
assert.strictEqual(vault[0].id, "v-medical", "expiring documents sort before never-expiring ones");
console.log("4. Vault: medical exam expiring in 30 days flagged; translations do not expire.");

// --- 5. Dashboards render the embedded sections ---------------------------
const portalRoot = join(__dirname, "..");
function pageSource(rel: string): string {
  return readFileSync(join(portalRoot, rel), "utf8");
}
const EMBEDDED = [
  "RenewalRadarSection",
  "FeeWaiverCheckerSection",
  "TotalCostEstimatorSection",
  "VaultExpirySection",
];
const clientPage = pageSource("src/app/client-dashboard/page.tsx");
for (const section of EMBEDDED) {
  assert.ok(
    clientPage.includes(`from "@/components/dashboard/${section}"`) &&
      clientPage.includes(`<${section}`),
    `client dashboard must import and render ${section}`
  );
}
const preparer = pageSource("src/components/preparer/PreparerDashboard.tsx");
for (const section of EMBEDDED) {
  assert.ok(
    preparer.includes(`from "@/components/dashboard/${section}"`) &&
      preparer.includes(`<${section}`),
    `preparer command center must import and render ${section}`
  );
}
assert.ok(
  preparer.includes('<LeadsPipelineSummary role="preparer"'),
  "preparer dashboard must render the leads + pipeline summary on the command tab"
);
assert.ok(
  clientPage.includes("<TodayRemindersBanner") &&
    clientPage.includes("<DiyProgressSummary") &&
    clientPage.includes("<InterviewQuestionSection") &&
    clientPage.includes("<NewsAlertsSection") &&
    clientPage.includes("<FamilyCaseSummarySection") &&
    clientPage.includes("<PacketRescueSummarySection") &&
    clientPage.includes("<CaseTrackerSummarySection"),
  "client dashboard must render the retrofit embeds (Today, DIY, interview QOTD, news, family, Packet Rescue, case tracker)"
);
const attorneyPage = pageSource("src/app/attorney-dashboard/page.tsx");
assert.ok(
  attorneyPage.includes("<RenewalRadarSection") &&
    attorneyPage.includes("<FeeWaiverCheckerSection") &&
    attorneyPage.includes("<TotalCostEstimatorSection") &&
    attorneyPage.includes("<VaultExpirySection"),
  "attorney dashboard must render all four expert sections"
);
const dojPage = pageSource("src/app/doj-dashboard/page.tsx");
assert.ok(
  dojPage.includes("<RenewalRadarSection") &&
    dojPage.includes("<FeeWaiverCheckerSection") &&
    dojPage.includes("<TotalCostEstimatorSection") &&
    dojPage.includes("<VaultExpirySection"),
  "DOJ dashboard must render all four expert sections"
);
console.log("5. Dashboards: client + preparer + attorney + DOJ homes render the four expert sections; client home also renders all seven retrofit embeds.");

// --- 6. Renewal reminders are honest until SES is connected ---------------
const due = renewalRemindersDue([passportSoon, passportFar], now);
assert.ok(
  due.some((d) => d.renewalId === "r-passport-soon" && d.rungDays === 180),
  "due list must include the 30-day passport's 180-day rung"
);
assert.ok(
  !due.some((d) => d.renewalId === "r-passport-far"),
  "due list must NOT include the 2-year passport"
);
void sendRenewalReminder(
  "fake-client@example.invalid",
  due.find((d) => d.renewalId === "r-passport-soon")!
).then((sendResult) => {
  assert.strictEqual(sendResult.ok, false, "nothing may be sent while SES is unconfigured");
  assert.strictEqual(
    (sendResult as { code?: string }).code,
    "email_not_configured",
    "unconfigured SES must surface email_not_configured, never a false success"
  );
  console.log("6. Reminders: due list computed honestly; SES unconfigured -> email_not_configured, nothing sent.");
  console.log("\nSMOKE OK — dashboard-embedded expert features (all 6 checks passed).");
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
