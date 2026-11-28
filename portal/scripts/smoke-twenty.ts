// Smoke test: Twelfth Addition part B — 20 differentiators + 180s script.
// Run with: npx -y tsx scripts/smoke-twenty.ts
// (tsx is NOT a project dependency; fetched on demand, as in the other
// smoke tests.)
//
// FAKE DATA ONLY. No Supabase, Stripe, USCIS, Google, or SES call is
// made. No real key is used. Nothing is sent, charged, or posted.
//
// Proves:
//   1. Every differentiator marked BUILT resolves to a real file/route
//      in the repo (no dead links).
//   2. The interview simulator builds a run plan with questions ONLY
//      (no official answers leak into the plan), scores a practice run
//      (civics correct-count uses USCIS's own 6-of-10 mark), and every
//      result carries the PRACTICE ONLY label + the no-prediction
//      notice, with no outcome-prediction language anywhere.
//   3. The professional invite flow validates (bad email refused) and
//      never verifies a professional.
//   4. Google Calendar/Drive is honestly NOT connected (status
//      needs_founder_consent, isConnected false).
//   5. Locked prices are unchanged (spot-check of known locked Price IDs).
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildRunPlan,
  civicsAnswerIsCorrect,
  scoreRun,
  simulatorResultIsHonest,
  PRACTICE_LABEL,
  NO_PREDICTION_NOTICE,
} from "../src/lib/interviewSimulator";
import {
  createProfessionalInvite,
  professionalInviteIsExpired,
  PROFESSIONAL_INVITE_NOTICE,
} from "../src/lib/professionalInvites";
import {
  googleWorkspaceConnectState,
  googleWorkspaceIsConnected,
} from "../src/lib/googleWorkspace";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const file = (p: string) => join(root, p);

// --- 1. Every BUILT differentiator resolves to a real file/route ---
const BUILT_PATHS: [string, string][] = [
  ["1 Journey Map lib", "src/lib/journeyMap.ts"],
  ["1 Journey Map page", "src/app/journey/page.tsx"],
  ["2 family case lib", "src/lib/familyCase.ts"],
  ["2 family invites lib", "src/lib/invites.ts"],
  ["3 i18n (7 languages)", "src/lib/i18n.ts"],
  ["4 Packet Rescue lib", "src/lib/packetRescue.ts"],
  ["5 whole-journey tracking lib", "src/lib/caseTracking.ts"],
  ["5 case-status route", "src/app/api/case-status/route.ts"],
  ["6 verified directory lib", "src/lib/verifiedDirectory.ts"],
  ["6 professionals page", "src/app/professionals/page.tsx"],
  ["7 renewal radar lib", "src/lib/renewalReminders.ts"],
  ["8 fee waiver checker", "src/lib/feeWaiverChecker.ts"],
  ["9 cost estimator", "src/lib/totalCostEstimator.ts"],
  ["10 vault expiry lib", "src/lib/vaultExpiry.ts"],
  ["10 vault-expiry route", "src/app/api/vault-expiry/route.ts"],
  ["11 form chaining", "src/lib/formChains.ts"],
  ["12 save-and-resume DIY", "src/lib/diyDrafts.ts"],
  ["13 pay-to-print gate", "src/lib/diyHealthCheck.ts"],
  ["14 case-aware news", "src/lib/immigrationNews.ts"],
  ["14 news alert component", "src/components/copilot/NewsAlert.tsx"],
  ["15 interview simulator (this build)", "src/lib/interviewSimulator.ts"],
  ["15 simulator route (this build)", "src/app/api/interview-simulator/route.ts"],
  ["16 document resend lib (parallel builder)", "src/lib/docResend.ts"],
  ["16 document resend route (parallel builder)", "src/app/api/documents/resend/route.ts"],
  ["16 resend migration (parallel builder)", "../supabase/migrations/0030_itfw_pro_discovery_google_docresend.sql"],
  ["17 Google Workspace contract (this build)", "src/lib/googleWorkspace.ts"],
  ["18 professional invites (this build)", "src/lib/professionalInvites.ts"],
  ["19 daily home lib", "src/lib/dailyHome.ts"],
  ["19 today page", "src/app/today/page.tsx"],
  ["20 question of the day route", "src/app/api/today/route.ts"],
  ["21 instant answers lib", "src/lib/askNiptei.ts"],
  ["22 form checklists", "src/lib/formChecklists.ts"],
  ["180s video script doc", "docs/niptei-tv-180-script-2026-11-28.md"],
  ["20-list doc", "docs/twenty-differentiators-2026-11-28.md"],
];
for (const [label, p] of BUILT_PATHS) {
  assert.ok(existsSync(file(p)), `MISSING: ${label} -> ${p}`);
}
console.log(`ok: all ${BUILT_PATHS.length} BUILT paths resolve to real files`);

// --- 2a. Simulator run plan: questions only, never answers ---
const plan = buildRunPlan("n400-civics", "2026-11-28");
assert.ok(plan, "civics run plan builds");
assert.equal(plan?.questions.length, 10, "civics run is 10 questions (like the real test)");
assert.ok(plan?.practiceLabel.includes("PRACTICE ONLY"), "plan carries PRACTICE ONLY label");
assert.ok(
  !JSON.stringify(plan).toLowerCase().includes("the constitution"),
  "run plan leaks no official answer"
);
assert.ok(
  (plan?.questions ?? []).every((q) => q.timeLimitSeconds === 30),
  "civics questions are 30s each"
);
const personalPlan = buildRunPlan("n400-personal", "2026-11-28");
assert.equal(personalPlan?.questions.length, 5, "practice run is 5 questions");
assert.ok(
  (personalPlan?.questions ?? []).every((q) => q.timeLimitSeconds === 60),
  "practice questions are 60s each"
);
console.log("ok: simulator run plans (10 civics / 5 practice, questions only, timed)");

// --- 2b. Civics answer matching (incl. number answers) ---
assert.equal(civicsAnswerIsCorrect("The Constitution.", "The Constitution."), true);
assert.equal(civicsAnswerIsCorrect("27", "Twenty-seven (27)."), true);
assert.equal(civicsAnswerIsCorrect("100", "One hundred (100)."), true);
assert.equal(civicsAnswerIsCorrect("The President", "The President."), true);
assert.equal(civicsAnswerIsCorrect("banana", "The Constitution."), false);
assert.equal(civicsAnswerIsCorrect("", "The Constitution."), false);
console.log("ok: civics answer matching (words + numbers, no empty pass)");

// --- 2c. Score a civics practice run: 7 correct of 10, one slow ---
// Real scored run: use the bank's own questions in order with their
// official answers for 7 of them, wrong text for 3.
import { INTERVIEW_BANKS } from "../src/lib/interviewPrep";
const civicsBank = INTERVIEW_BANKS.find((b) => b.id === "n400-civics");
assert.ok(civicsBank, "civics bank exists");
const scored = scoreRun(
  "n400-civics",
  civicsBank.questions.slice(0, 10).map((q, i) => ({
    questionId: q.id,
    answerText: i < 7 ? (q.answer ?? "") : "wrong answer entirely",
    secondsTaken: 12,
  }))
);
assert.ok(scored, "civics run scores");
assert.equal(scored?.civicsCorrect, 7, "7 of 10 correct counted");
assert.equal(scored?.civicsReachedSixOfTen, true, "reaches USCIS 6-of-10 mark");
assert.equal(scored?.band, "strong-practice", "7/10 in time = strong practice");
assert.ok(scored?.practiceLabel.includes("PRACTICE ONLY"), "result labelled PRACTICE ONLY");
assert.ok(scored?.noPredictionNotice.includes("does not predict"), "result carries no-prediction notice");
assert.ok(simulatorResultIsHonest(scored), "result passes honesty check");
assert.ok(
  !JSON.stringify(scored).toLowerCase().includes("you will pass") &&
    !JSON.stringify(scored).toLowerCase().includes("guaranteed"),
  "no outcome-prediction language in result"
);
console.log("ok: civics practice run scores 7/10, strong-practice band, practice-only + no prediction");

// --- 2d. Score a personal (practice) run with self-checks ---
const personalBank = INTERVIEW_BANKS.find((b) => b.id === "n400-personal");
assert.ok(personalBank, "personal bank exists");
const personalScored = scoreRun(
  "n400-personal",
  personalBank.questions.slice(0, 5).map((q, i) => ({
    questionId: q.id,
    answerText: "I live at the address on my application and I work at the job listed there.",
    secondsTaken: i === 4 ? 90 : 30,
    matchesApplication: i === 2 ? false : true,
    namedSupportingDocument: true,
  }))
);
assert.ok(personalScored, "personal run scores");
assert.equal(personalScored?.answeredCount, 5);
assert.equal(personalScored?.withinTimeCount, 4, "one slow answer counted");
assert.ok(
  (personalScored?.whatToImprove ?? []).some((s) => s.includes("did not match your application")),
  "mismatched-application answer produces an improvement note"
);
assert.ok(simulatorResultIsHonest(personalScored), "personal result passes honesty check");
console.log("ok: personal practice run scores (time + self-checks + improvement notes)");

// --- 2e. The practice label / notice constants themselves ---
assert.ok(PRACTICE_LABEL.includes("PRACTICE ONLY"));
assert.ok(NO_PREDICTION_NOTICE.includes("does not predict"));
console.log("ok: PRACTICE ONLY label + no-prediction notice constants");

// --- 3. Professional invites validate and never verify ---
const bad = createProfessionalInvite({
  kind: "join_platform",
  professionalName: "Jane Attorney",
  professionalEmail: "not-an-email",
  invitedBy: "founder",
});
assert.equal(bad.invite, null, "bad email refused");
assert.ok(bad.error, "bad email gives a reason");
const good = createProfessionalInvite({
  kind: "join_case",
  professionalName: "Jane Attorney",
  professionalEmail: "jane@example.com",
  invitedBy: "client-1",
  caseId: "case-1",
  roleOnCase: "attorney_of_record",
});
assert.ok(good.invite, "valid invite created");
assert.equal(good.invite?.verifiesProfessional, false, "invite never verifies");
assert.equal(good.invite?.status, "draft", "invite is a draft until sent");
assert.ok(
  (good.invite?.expiresAt ?? "") > new Date().toISOString(),
  "invite expires in the future"
);
assert.equal(
  professionalInviteIsExpired({ ...(good.invite as NonNullable<typeof good.invite>), expiresAt: "2020-01-01T00:00:00.000Z" }),
  true,
  "expired invite detected"
);
assert.ok(PROFESSIONAL_INVITE_NOTICE.includes("not verification"), "invite notice states it is not verification");
console.log("ok: professional invites (validation, draft, never verifies, expiry)");

// --- 4. Google Calendar/Drive honestly not connected ---
const gw = googleWorkspaceConnectState();
assert.equal(gw.status, "needs_founder_consent");
assert.equal(gw.calendarConnected, false);
assert.equal(gw.driveConnected, false);
assert.equal(googleWorkspaceIsConnected(gw), false);
assert.ok(gw.founderSteps.length >= 4, "founder steps listed");
console.log("ok: Google Calendar/Drive NOT connected (needs founder consent)");

// --- 5. Locked prices unchanged (spot-check known Price IDs) ---
const prices = readFileSync(file("src/lib/stripePrices.ts"), "utf8");
for (const id of [
  "price_1UfSExPfd9SRUcvh9AjOo2bV", // Mock Interview $199 (locked)
]) {
  assert.ok(prices.includes(id), `locked Price ID missing: ${id}`);
}
assert.ok(prices.includes("19900"), "mock interview $19900 cents still present");
console.log("ok: locked Stripe prices unchanged (spot-check)");

// --- 6. 180s script doc carries the length-conflict flag ---
const script = readFileSync(file("docs/niptei-tv-180-script-2026-11-28.md"), "utf8");
assert.ok(script.includes("LENGTH CONFLICT"), "script flags the length conflict");
assert.ok(script.includes("60-second"), "script names the standing 60-second rule");
assert.ok(script.includes("NOT posted"), "script states it is not posted");
assert.ok(script.includes("immigration.niptei.com"), "script names the website");
assert.ok(
  (script.match(/### Scene /g) ?? []).length === 12,
  "script has 12 scenes"
);
console.log("ok: 180s script doc (12 scenes, conflict flagged, not posted)");

console.log("\nSMOKE-TWENTY: PASS — all checks green (fake data only; nothing sent, charged, or posted).");
