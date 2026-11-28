// Smoke test for "more added" — six further expert features beyond the
// 20 differentiators (LAST ADDITION, Nov 28, 2026:
// src/lib/moreAdded.ts, src/app/more-added/page.tsx, migration 0030,
// docs/more-added-2026-11-28.md).
//
// Code-level only, FAKE data only — no network, no DB, no send. Run with:
//   npx -y tsx scripts/smoke-more-added.ts
//
// Asserts:
//   1. Biometrics tracker runs from STORED dates only: days-until from
//      the I-797C date; a past date with status still "scheduled" is
//      "overdue — unconfirmed" (never guessed attended/missed).
//   2. AR-11 helper states the 10-day rule (deadline = move date + 10)
//      and never files: the never-files notice is in the lib and the
//      page, and the checklist covers USCIS + NVC + platform +
//      preparer + notices.
//   3. Emergency guide never gives legal advice: every scenario's
//      attorney note names a licensed attorney / DOJ-accredited
//      representative; the denial scenario points to an attorney and
//      the locked I-290B prices are Basic $599 / Standard $750 /
//      Premium $899 (read from stripePrices, never re-typed).
//   4. Sponsor calculator matches the locked 2026 I-864P 125% figures
//      (HH4 contiguous $41,250; military 100% $33,000), shows the
//      shortfall and the 3x/5x asset multiples, judges a joint sponsor
//      on their own household, and returns NO pass/fail verdict.
//   5. Translation tracker shows $45/page (locked
//      addon_translation_page): 2-page birth + 1-page marriage =
//      3 pages / $135.00; 0 pages costs $0; not-needed is excluded.
//   6. Payment plan dashboard shows the missed-payment math exactly:
//      Standard bundle $1,799 Pay in 3 splits $599.67 / $599.67 /
//      $599.66 (locked splitter); a missed installment carries a 50%
//      penalty on its unpaid part, labelled manual handling only with
//      NO Stripe setting.
//   7. Migration 0030 creates the three new tables with RLS and
//      stores no SSN / A-Number / passport number column and no full
//      street address.
//
// This script is excluded from tsc (see tsconfig.json "exclude").
import assert from "node:assert";
import { readFileSync } from "node:fs";

import {
  AR11_CHECKLIST,
  AR11_DEADLINE_DAYS,
  AR11_NEVER_FILES_NOTICE,
  EMERGENCY_GUIDE,
  MISSED_PAYMENT_RULE,
  TRANSLATION_PRICE_PER_PAGE_CENTS,
  ar11Deadline,
  ar11View,
  biometricsTrackerView,
  emergencyScenario,
  i290bLockedPrices,
  paymentPlanDashboard,
  sponsorCalculator,
  translationEstimate,
  type BiometricsAppointment,
} from "../src/lib/moreAdded";

let passed = 0;
function check(name: string, fn: () => void): void {
  fn();
  passed += 1;
  console.log(`ok ${passed} - ${name}`);
}

// --- 1. Biometrics tracker: stored dates only ----------------------------
const stored: BiometricsAppointment = {
  id: "fake-1",
  caseId: "fake-case",
  appointmentDate: "2026-12-10",
  ascLocation: "ASC on the notice",
  noticeReceivedAt: "2026-11-20",
  status: "scheduled",
  rescheduledFromDate: null,
};
check("biometrics: upcoming counts days from the stored date", () => {
  const view = biometricsTrackerView(stored, "2026-12-01");
  assert.equal(view.daysUntil, 9);
  assert.equal(view.state, "upcoming");
});
check("biometrics: appointment today", () => {
  assert.equal(biometricsTrackerView(stored, "2026-12-10").state, "today");
});
check("biometrics: past date + still scheduled = overdue-unconfirmed, never guessed", () => {
  const view = biometricsTrackerView(stored, "2026-12-15");
  assert.equal(view.state, "overdue-unconfirmed");
  assert.notEqual(view.state, "missed");
  assert.notEqual(view.state, "attended");
  assert.match(view.headline, /does not guess/);
});
check("biometrics: attended and missed come from the stored status", () => {
  assert.equal(
    biometricsTrackerView({ ...stored, status: "attended" }, "2026-12-15").state,
    "attended"
  );
  const missed = biometricsTrackerView({ ...stored, status: "missed" }, "2026-12-15");
  assert.equal(missed.state, "missed");
  assert.match(missed.nextSteps.join(" "), /do not wait for a second letter/);
});
check("biometrics: rescheduled keeps the new stored date", () => {
  const view = biometricsTrackerView(
    { ...stored, status: "rescheduled", rescheduledFromDate: "2026-12-03" },
    "2026-12-01"
  );
  assert.equal(view.state, "rescheduled");
  assert.equal(view.daysUntil, 9);
});

// --- 2. AR-11 helper: 10-day rule, never files ---------------------------
check("ar-11: deadline is move date + 10 days", () => {
  assert.equal(AR11_DEADLINE_DAYS, 10);
  assert.equal(ar11Deadline("2026-11-28"), "2026-12-08");
  const view = ar11View("2026-11-28", "2026-12-01");
  assert.equal(view.deadline, "2026-12-08");
  assert.equal(view.daysLeft, 7);
  assert.equal(view.urgency, "ok");
  assert.equal(ar11View("2026-11-28", "2026-12-09").urgency, "overdue");
});
check("ar-11: never files — notice in lib and page, checklist covers all five updates", () => {
  assert.match(AR11_NEVER_FILES_NOTICE, /never files Form AR-11/i);
  assert.match(AR11_NEVER_FILES_NOTICE, /you file it yourself/i);
  const ids = AR11_CHECKLIST.map((c) => c.id);
  for (const id of ["uscis-ar11", "nvc-ceac", "platform-profile", "tell-preparer", "check-notices"]) {
    assert.ok(ids.includes(id), `checklist missing ${id}`);
  }
  const page = readFileSync("src/app/more-added/page.tsx", "utf8");
  assert.ok(page.includes("AR11_NEVER_FILES_NOTICE"), "page must render the never-files notice");
});

// --- 3. Emergency guide: educational only, attorney throughout ------------
check("emergency: all four scenarios exist and every one points to an attorney", () => {
  assert.equal(EMERGENCY_GUIDE.length, 4);
  for (const s of EMERGENCY_GUIDE) {
    assert.match(s.attorneyNote, /licensed attorney or DOJ-accredited representative/);
    assert.ok(s.doNow.length >= 3, `${s.id} needs do-now steps`);
    assert.ok(s.doNot.length >= 2, `${s.id} needs do-not steps`);
    assert.ok(s.deadlineSource.length > 0, `${s.id} needs a deadline source`);
  }
});
check("emergency: denial points to an attorney and locked I-290B prices are $599/$750/$899", () => {
  const denied = emergencyScenario("denied");
  assert.match(denied.attorneyNote, /before any deadline passes/);
  assert.match(denied.doNow.join(" "), /Do not re-file on your own/);
  assert.deepEqual(i290bLockedPrices(), { basic: 59900, standard: 75000, premium: 89900 });
});

// --- 4. Sponsor calculator: locked 125% figures, numbers only ------------
check("sponsor: HH4 contiguous 125% is $41,250; shortfall + 5x assets match", () => {
  const r = sponsorCalculator({
    householdSize: 4,
    region: "contiguous",
    military: false,
    income: 30000,
    assets: 0,
    isSpouseOrMinorChildOfUSC: false,
  });
  assert.equal(r.petitioner.required, 41250);
  assert.equal(r.petitioner.shortfall, 11250);
  assert.equal(r.petitioner.multiplier, 5);
  assert.equal(r.petitioner.assetsNeeded, 56250);
  assert.equal(r.jointSponsor, null);
});
check("sponsor: spouse/minor child uses 3x; military uses the 100% column", () => {
  const r = sponsorCalculator({
    householdSize: 4,
    region: "contiguous",
    military: false,
    income: 30000,
    assets: 0,
    isSpouseOrMinorChildOfUSC: true,
  });
  assert.equal(r.petitioner.multiplier, 3);
  assert.equal(r.petitioner.assetsNeeded, 33750);
  const m = sponsorCalculator({
    householdSize: 4,
    region: "contiguous",
    military: true,
    income: 33000,
    assets: 0,
    isSpouseOrMinorChildOfUSC: false,
  });
  assert.equal(m.petitioner.required, 33000);
  assert.equal(m.petitioner.shortfall, 0);
});
check("sponsor: joint sponsor judged on their own household; NO pass/fail verdict returned", () => {
  const r = sponsorCalculator({
    householdSize: 4,
    region: "contiguous",
    military: false,
    income: 30000,
    assets: 0,
    isSpouseOrMinorChildOfUSC: false,
    jointSponsor: {
      householdSize: 2,
      region: "contiguous",
      military: false,
      income: 27050,
      assets: 0,
      isSpouseOrMinorChildOfUSC: false,
    },
  });
  assert.ok(r.jointSponsor);
  assert.equal(r.jointSponsor.required, 27050);
  assert.equal(r.jointSponsor.shortfall, 0);
  assert.ok(!("qualified" in r), "calculator must not return a qualified verdict");
  assert.ok(!("qualified" in r.petitioner), "petitioner figures must not carry a verdict");
  assert.match(r.notADecision, /only USCIS decides/);
});

// --- 5. Translation tracker: $45/page --------------------------------------
check("translation: $45/page locked; 2 + 1 pages = 3 pages / $135.00", () => {
  assert.equal(TRANSLATION_PRICE_PER_PAGE_CENTS, 4500);
  const est = translationEstimate([
    { documentType: "birth", pages: 2, status: "needed" },
    { documentType: "marriage", pages: 1, status: "needed" },
  ]);
  assert.equal(est.totalPages, 3);
  assert.equal(est.totalCents, 13500);
});
check("translation: 0 pages costs $0 and not-needed is excluded", () => {
  const est = translationEstimate([
    { documentType: "birth", pages: 0, status: "needed" },
    { documentType: "police", pages: 4, status: "not-needed" },
  ]);
  assert.equal(est.totalCents, 0);
  assert.equal(est.totalPages, 0);
});

// --- 6. Payment plan dashboard: exact missed-payment math ------------------
check("payment plan: $1,799 Pay in 3 splits $599.67 / $599.67 / $599.66", () => {
  const d = paymentPlanDashboard(
    {
      id: "fake-plan",
      caseId: "fake-case",
      totalServiceFeeCents: 179900,
      payChoice: "installments_3",
      installmentAmountsCents: [59967, 59967, 59966],
      paidCents: 179900,
      missedPaymentPenaltyPercent: 50,
      status: "active",
    },
    "installments_3",
    "2026-11-01",
    "2026-11-15"
  );
  assert.deepEqual(
    d.installments.map((i) => i.amountCents),
    [59967, 59967, 59966]
  );
  assert.equal(d.remainingCents, 0);
  assert.equal(d.nextPayment, null);
});
check("payment plan: missed installment = 50% penalty on the unpaid part, manual handling only", () => {
  const d = paymentPlanDashboard(
    {
      id: "fake-plan",
      caseId: "fake-case",
      totalServiceFeeCents: 179900,
      payChoice: "installments_3",
      installmentAmountsCents: [59967, 59967, 59966],
      paidCents: 59967,
      missedPaymentPenaltyPercent: 50,
      status: "active",
    },
    "installments_3",
    "2026-11-01",
    "2026-12-15"
  );
  // Due dates: Nov 1 / Dec 1 / Jan 1. Only the first is paid; Dec 1 is missed.
  assert.equal(d.installments[0].state, "paid");
  assert.equal(d.installments[1].state, "missed");
  assert.equal(d.installments[1].unpaidCents, 59967);
  assert.equal(d.installments[1].penaltyCents, Math.round((59967 * 50) / 100));
  assert.equal(d.installments[1].nowDueCents, 59967 + Math.round((59967 * 50) / 100));
  assert.equal(d.missedTotalCents, 59967);
  assert.equal(d.missedPenaltyCents, Math.round((59967 * 50) / 100));
  assert.match(d.missedRule, /manual handling only/);
  assert.match(d.missedRule, /NO Stripe setting/);
  assert.match(MISSED_PAYMENT_RULE, /50%/);
});
check("payment plan: no stored start date means dates unknown, never guessed", () => {
  const d = paymentPlanDashboard(
    {
      id: "fake-plan",
      caseId: "fake-case",
      totalServiceFeeCents: 179900,
      payChoice: "installments_3",
      installmentAmountsCents: [59967, 59967, 59966],
      paidCents: 0,
      missedPaymentPenaltyPercent: 50,
      status: "active",
    },
    "installments_3",
    null,
    "2026-12-15"
  );
  assert.equal(d.datesKnown, false);
  assert.ok(d.installments.every((i) => i.dueDate === null));
  assert.ok(d.installments.every((i) => i.state !== "missed"));
});

// --- 7. Migration 0030 -------------------------------------------------------
check("migration 0030: three tables with RLS, no sensitive-identifier columns, no street address", () => {
  const sql = readFileSync(
    "../supabase/migrations/0035_itfw_more_added.sql",
    "utf8"
  );
  for (const t of ["biometrics_appointments", "address_changes", "document_translations"]) {
    assert.ok(sql.includes(`create table if not exists public.${t}`), `missing table ${t}`);
    assert.ok(sql.includes(`enable row level security`), "RLS must be enabled");
  }
  assert.ok(!/ssn\s+(text|varchar|citext)/i.test(sql), "no SSN column");
  assert.ok(!/passport_number/i.test(sql), "no passport number column");
  assert.ok(!/a_number/i.test(sql), "no A-Number column");
  assert.match(sql, /never a full street address/i);
  assert.match(sql, /never files Form AR-11/i);
});

console.log(`\nAll ${passed} smoke checks passed (fake data only).`);
