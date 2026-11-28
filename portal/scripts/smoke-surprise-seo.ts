// Smoke test: Surprise signature feature + tell-a-friend + SEO +
// honest lead-finding (ELEVENTH ADDITION, Nov 28, 2026)
// Run with:  npx -y tsx scripts/smoke-surprise-seo.ts
// (tsx is NOT a project dependency; it is fetched on demand for this
// test only, as in scripts/smoke-standout-five.ts.)
//
// FAKE DATA ONLY. No real Supabase, Stripe, or USCIS call is made.
// Every decision is tested against the pure library functions with
// fake rows. Nothing is charged, no account is created, no real key
// is used.
//
// Proves:
//   1. Journey Map with NO stored case -> honest empty state (null
//      map), never an invented journey.
//   2. Journey Map WITH a stored case -> that case's real next step
//      and its real missing items; interview date shown only when
//      stored; green-card line uses only the locked 30–90 day range;
//      no promised dates anywhere in the map.
//   3. Referral reward is shown as "to be announced by the founder"
//      with no invented amount; referral counts come only from real
//      rows (0/0 with no rows).
//   4. The sitemap contains ONLY public pages (every entry passes
//      isPublicSitemapUrl; no dashboard/portal/family/API path
//      appears); per-form landing content comes from the locked
//      catalog only (unknown form -> null).
//   5. The SEO note states no ranking is guaranteed (and names
//      Google, Yahoo, Bing).
//   6. The lead page carries the honest boundary note (system does
//      NOT track searchers); the lead loop reuses existing code and
//      summarises real leads only (0 + empty state with no leads).
//   7. Locked Stripe prices are unchanged (132) — this addition
//      touches no price.
import assert from "node:assert/strict";
import {
  buildJourneyMap,
  JOURNEY_MAP_EMPTY_STATE,
  JOURNEY_MAP_NO_INTERVIEW_DATE,
  JOURNEY_MAP_SHARE_NOTE,
  journeyMapHeadings,
  type JourneyMapCaseInput,
} from "../src/lib/journeyMap";
import {
  REFERRAL_REWARD_LABEL,
  referralCounts,
} from "../src/lib/referrals";
import {
  isPublicSitemapUrl,
  sitemapEntries,
  formLanding,
  SEO_NO_RANKING_NOTE,
  SEO_FAQS,
  buildOrganizationJsonLd,
  buildFaqJsonLd,
  PRIVATE_PATH_PREFIXES,
} from "../src/lib/seo";
import {
  LEAD_BOUNDARY_NOTE,
  ARRIVAL_CHANNELS,
  leadLoopSteps,
  summarizeLeadLoop,
} from "../src/lib/leadLoop";
import { EXAMPLE_LEADS } from "../src/lib/lifecycle";
import {
  LOCKED_STRIPE_PRICE_COUNT,
  getLockedPriceByKey,
} from "../src/lib/stripePrices";

let passed = 0;
function ok(name: string, cond: boolean) {
  assert.equal(cond, true, name);
  passed++;
  console.log(`ok ${passed} - ${name}`);
}

// --- 1. Journey Map: no case -> honest empty state -----------------------
const noCase = buildJourneyMap(null);
ok("no stored case -> map is null (empty state, never invented)", noCase === null);
ok(
  "empty state says no case on file yet",
  JOURNEY_MAP_EMPTY_STATE.includes("No case on file yet")
);
ok(
  "share note says no public link to a case",
  JOURNEY_MAP_SHARE_NOTE.includes("There is no public link to your case")
);

// --- 2. Journey Map: stored case -> real next step + missing items -------
const storedCase: JourneyMapCaseInput = {
  caseId: "case-fake-1",
  forms: ["I-130", "I-485"],
  status: "in_preparation",
  createdAt: "2026-11-01T10:00:00Z",
  currentStage: 4,
  stageRecordedAt: {
    1: "2026-11-01",
    2: "2026-11-05",
    3: "2026-11-10",
    4: "2026-11-15",
  },
  interviewDate: null,
  immigrantFeePaid: false,
  usEntryAt: null,
  missingItems: [
    { id: "m1", label: "Beneficiary passport / ID" },
    { id: "m2", label: "Passport photos (2x2)" },
  ],
  familyMemberCount: 1,
};
const map = buildJourneyMap(storedCase);
ok("stored case -> map is built", map !== null);
assert.ok(map);
ok(
  "where-now is Stage 4 (Active Client) from the stored stage",
  map.currentStageNumber === 4 && (map.currentStageLabel ?? "").includes("Active Client")
);
ok(
  "what-is-next is Stage 5's real next step (filed at USCIS)",
  map.whatIsNext.length > 0 && /USCIS|filed/i.test(map.whatIsNext)
);
ok(
  "missing items are exactly the stored ones",
  map.missingItems.length === 2 &&
    map.missingItems[0].label === "Beneficiary passport / ID" &&
    map.missingItems[1].label === "Passport photos (2x2)"
);
ok(
  "no stored interview date -> null, with the honest no-date line",
  map.interviewDate === null &&
    JOURNEY_MAP_NO_INTERVIEW_DATE.includes("No interview date on file yet")
);
ok(
  "green-card line uses only the locked 30–90 day range, no date promised",
  map.greenCardLine.includes("30–90 days after entry") &&
    !/\d{4}-\d{2}-\d{2}/.test(map.greenCardLine) &&
    /not a promised date|no exact date is promised/i.test(map.greenCardLine)
);
ok("map promises no dates", map.noPromisedDates === true);
ok(
  "map steps carry real states (stages 1–3 done, 4 current, 5–6 upcoming)",
  map.steps.filter((s) => s.state === "done").length >= 3 &&
    map.steps.some((s) => s.state === "current") &&
    map.steps.some((s) => s.state === "upcoming")
);

// Stored interview date + entry date are shown, never invented.
const withDates = buildJourneyMap({
  ...storedCase,
  currentStage: 5,
  stageRecordedAt: { ...storedCase.stageRecordedAt, 5: "2026-11-20" },
  interviewDate: "2027-01-15",
  immigrantFeePaid: true,
  usEntryAt: "2027-02-01",
});
assert.ok(withDates);
ok(
  "stored interview date is shown (from the client's own letter)",
  withDates.interviewDate === "2027-01-15"
);
ok(
  "stored entry date anchors the 30–90 day range",
  withDates.greenCardLine.includes("2027-02-01") &&
    withDates.greenCardLine.includes("30–90 days after entry")
);
ok(
  "immigrant fee paid flag comes from the stored row",
  withDates.immigrantFeePaid === true
);

// Bilingual headings: English always shown; no locked translation for
// these headings yet, so a non-English language honestly says pending.
const headingsEs = journeyMapHeadings("es");
ok(
  "headings show the English original in every language",
  headingsEs.every((h) => h.text.english.length > 0)
);
ok(
  "non-English headings without a locked string say translation pending",
  headingsEs.every((h) => h.text.status === "pending") &&
    headingsEs[0].text.note === "Translation pending — shown in English"
);

// --- 3. Tell-a-friend: reward "to be announced", no invented amount ----
ok(
  "referral reward label is 'to be announced by the founder'",
  REFERRAL_REWARD_LABEL ===
    "Referral reward: to be announced by the founder"
);
ok(
  "reward label contains no dollar amount",
  !/\$\d/.test(REFERRAL_REWARD_LABEL)
);
const counts = referralCounts([], { accountId: "acct-fake", referralCode: "fake-code" });
ok(
  "no referral rows -> 0 referred / 0 became clients",
  counts.referred === 0 && counts.becameClients === 0
);
const countsReal = referralCounts(
  [
    { referral_source: "Referral", referrer_account_id: "acct-fake", pipeline_stage: "converted" },
    { referral_source: "Referral", referrer_account_id: "acct-fake", pipeline_stage: "new_lead" },
    { referral_source: "Facebook", referrer_account_id: "acct-fake", pipeline_stage: "converted" },
  ],
  { accountId: "acct-fake", referralCode: null }
);
ok(
  "counts come only from real Referral rows (2 referred, 1 converted; Facebook row excluded)",
  countsReal.referred === 2 && countsReal.becameClients === 1
);

// --- 4. SEO: sitemap public-only, per-form content from locked catalog --
const entries = sitemapEntries();
ok("sitemap has public entries", entries.length > 0);
ok(
  "every sitemap URL passes the public-only guard",
  entries.every((e) => isPublicSitemapUrl(new URL(e.url).pathname))
);
ok(
  "no sitemap URL is a dashboard/portal/family/API path",
  entries.every(
    (e) =>
      !PRIVATE_PATH_PREFIXES.some((p) =>
        new URL(e.url).pathname.startsWith(p)
      )
  )
);
for (const p of ["/portal", "/today", "/client-dashboard", "/preparer-dashboard", "/family-case", "/api/leads", "/login", "/admin/verifications"]) {
  ok(`private path ${p} is rejected by the sitemap guard`, !isPublicSitemapUrl(p));
}
ok(
  "per-form landing pages are in the sitemap",
  entries.some((e) => e.url.endsWith("/forms/I-130")) &&
    entries.some((e) => e.url.endsWith("/forms/N-400"))
);
const i130 = formLanding("I-130");
ok(
  "I-130 landing comes from the locked catalog (name + locked fee)",
  i130 !== null &&
    i130.name === "Petition for Alien Relative" &&
    i130.serviceFeeText.includes("$499") &&
    i130.checklistCount === 5
);
ok(
  "government fee is shown separately, never combined",
  (i130?.governmentFeeNote ?? "").includes("TO BE CONFIRMED")
);
ok("unknown form code -> no landing page is invented", formLanding("I-999") === null);
ok(
  "FAQ answers all name their locked source",
  SEO_FAQS.length >= 4 && SEO_FAQS.every((f) => f.source.startsWith("Locked:"))
);
ok(
  "Organization JSON-LD names the site and states not-a-law-firm",
  (buildOrganizationJsonLd().description as string).includes("not a law firm")
);
ok(
  "FAQ JSON-LD has one entry per FAQ",
  ((buildFaqJsonLd().mainEntity as unknown[]) ?? []).length === SEO_FAQS.length
);

// --- 5. SEO note: no ranking is guaranteed -------------------------------
ok(
  "SEO note says no ranking is guaranteed",
  SEO_NO_RANKING_NOTE.includes("does not guarantee a ranking")
);
ok(
  "SEO note names Google, Yahoo, Bing and says no one can promise a spot",
  SEO_NO_RANKING_NOTE.includes("Google") &&
    SEO_NO_RANKING_NOTE.includes("Yahoo") &&
    SEO_NO_RANKING_NOTE.includes("Bing") &&
    SEO_NO_RANKING_NOTE.includes("no one can promise that")
);

// --- 6. Lead-finding: honest boundary + arrival/follow-up/return loop ----
ok(
  "boundary note says the system does NOT track searchers",
  LEAD_BOUNDARY_NOTE.includes("does NOT track or identify people searching")
);
ok(
  "boundary note says search engines do not share who searched",
  LEAD_BOUNDARY_NOTE.includes("search engines do not share who searched")
);
ok(
  "boundary note never claims the system watches or tracks searchers",
  !/we (watch|track) (individual )?searchers/i.test(LEAD_BOUNDARY_NOTE)
);
ok(
  "four arrival channels exist (intake, quote, health check, question of the day)",
  ARRIVAL_CHANNELS.length === 4 &&
    ARRIVAL_CHANNELS.map((c) => c.id).join(",") ===
      "intake,quote,packet_health_check,interview_question"
);
const steps = leadLoopSteps();
ok(
  "lead loop has 5 labelled steps ending in tell-a-friend",
  steps.length === 5 && steps[4].title.includes("Tell a friend")
);
ok(
  "every loop step names the existing code it reuses (no second system)",
  steps.every((s) => s.reuses.length > 0)
);
const emptyLoop = summarizeLeadLoop([]);
ok(
  "no leads -> 0 counts + honest empty state",
  emptyLoop.totalLeads === 0 && emptyLoop.emptyState !== null
);
const realLoop = summarizeLeadLoop(EXAMPLE_LEADS, "2026-11-21");
ok(
  "real example leads summarise with follow-ups due (overdue exists)",
  realLoop.totalLeads === EXAMPLE_LEADS.length && realLoop.overdueCount >= 1
);

// --- 7. Locked prices unchanged -------------------------------------------
ok(
  "locked Stripe price count is still 132",
  LOCKED_STRIPE_PRICE_COUNT === 132
);
ok(
  "a locked bundle price still resolves",
  getLockedPriceByKey("bundle_standard") !== undefined
);

console.log(`\nAll ${passed} checks passed.`);
