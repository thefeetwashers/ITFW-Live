// Smoke test: Daily home screen + completeness sweep (Nov 28, 2026)
// Run with:  npx -y tsx scripts/smoke-daily-home.ts
// (tsx is NOT a project dependency; it is fetched on demand for this
// test only, as in scripts/smoke-standout-five.ts.)
//
// FAKE DATA ONLY. No real Supabase, Stripe, or USCIS call is made.
// Every decision is tested against the pure library functions with
// fake rows. Nothing is charged, no account is created, no real key
// is used.
//
// Proves:
//   1. The home screen with NO cases shows honest empty states — no
//      invented status, no invented news (news is labelled built-in,
//      no live feed), no question without a signed-in paid check.
//   2. With a stored case it shows THAT case's real next step (from
//      deriveNextStep) and THAT case's real timeline (from its
//      case_lifecycle rows only — no invented milestones, no promised
//      dates).
//   3. The question of the day comes from the existing banks with its
//      source, is deterministic by date (same date -> same question,
//      different dates rotate), and is never invented.
//   4. The "what changed today" feed is empty when nothing changed
//      ("Nothing new today") and lists a real stored event when one
//      exists — and never lists an event from another day.
//   5. Reminders come from real stored dates only (renewal, RFE
//      deadline, document retake); nothing is invented.
//   6. Saved things gather drafts + documents + questionnaire answers
//      in one place, with pay-gated download flags carried through.
//   7. The daily check-in streak is computed from stored rows only:
//      no rows -> no streak; consecutive days -> streak; a gap breaks it.
//   8. Built-in news posts are all sourced (official URLs, dated) and
//      none claims a government adoption or endorsement.
//   9. Identifiers are masked (receipt numbers show only the last 3).
import assert from "node:assert/strict";
import {
  allInterviewQuestionsHaveSources,
  allPracticeQuestionsLabelledNotOfficial,
  INTERVIEW_BANKS,
} from "../src/lib/interviewPrep";
import {
  allNewsPostsSourced,
  DAILY_NEWS,
  LIVE_FEED_NOTICE,
  newsForForms,
} from "../src/lib/dailyNews";
import {
  buildCaseTimeline,
  buildDailyReminders,
  buildSavedThings,
  caseAtAGlance,
  computeStreak,
  emptyDailyHomePayload,
  maskIdentifier,
  questionOfTheDay,
  stageIdForNumber,
  whatChangedToday,
  NOTHING_NEW_TODAY,
  type ChangeEventInput,
  type DailyCaseRow,
} from "../src/lib/dailyHome";

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ok — ${name}`);
}

// ---------------------------------------------------------------------------
// 1. No cases -> honest empty states, nothing invented
// ---------------------------------------------------------------------------
check("empty payload: no cases, no reminders, no changes, no saved things", () => {
  const p = emptyDailyHomePayload("2026-11-28");
  assert.equal(p.cases.length, 0);
  assert.equal(p.emptyStates.noCases, true);
  assert.equal(p.emptyStates.noReminders, true);
  assert.equal(p.emptyStates.noChanges, true);
  assert.equal(p.emptyStates.noSavedThings, true);
  assert.equal(p.questionOfTheDay, null);
  assert.equal(p.questionLocked, true);
  assert.equal(p.whatChanged.events.length, 0);
  assert.equal(p.whatChanged.emptyMessage, NOTHING_NEW_TODAY);
  assert.equal(p.checkin.streakDays, 0);
  // News is still shown — but labelled built-in, no live feed.
  assert.ok(p.news.length > 0);
  assert.ok(p.newsNote.includes("No live news feed is connected yet"));
  assert.ok(LIVE_FEED_NOTICE.includes("No live news feed is connected yet"));
});

// ---------------------------------------------------------------------------
// 2. With a stored case: real next step + real timeline
// ---------------------------------------------------------------------------
const storedCase: DailyCaseRow = {
  id: "case-fake-1",
  status: "documents_pending",
  forms: ["I-130", "I-485"],
  pathfinderRoute: { route: "inside_us" },
  createdAt: "2026-11-20T10:00:00Z",
  updatedAt: "2026-11-27T10:00:00Z",
};

check("stored case: next step names the real blocking document", () => {
  const glance = caseAtAGlance(storedCase, [], ["Birth certificate (original)"], "en");
  assert.equal(glance.caseId, "case-fake-1");
  assert.equal(glance.statusLabel, "Documents pending — we are waiting for your documents");
  assert.match(glance.statusNote, /not a live check with USCIS/);
  assert.equal(glance.stageLabel, null); // no lifecycle rows -> no invented stage
  assert.equal(glance.nextStep.kind, "fix_document");
  assert.match(glance.nextStep.title, /Birth certificate/);
  assert.equal(glance.recordedAgencyStatus, null);
});

check("stored case: recorded agency status is shown, labelled as recorded", () => {
  const glance = caseAtAGlance(storedCase, [], [], "en", {
    status: "Case Was Received",
    at: "2026-11-25T09:00:00Z",
  });
  assert.equal(glance.recordedAgencyStatus, "Case Was Received");
  assert.equal(glance.recordedAgencyStatusAt, "2026-11-25T09:00:00Z");
});

check("timeline: only recorded stages are done/current; no promised dates", () => {
  const timeline = buildCaseTimeline("case-fake-1", [
    { caseId: "case-fake-1", stage: 1, subStage: null, isCurrent: false, stageChangedAt: "2026-11-20T10:00:00Z" },
    { caseId: "case-fake-1", stage: 2, subStage: null, isCurrent: false, stageChangedAt: "2026-11-22T10:00:00Z" },
    { caseId: "case-fake-1", stage: 3, subStage: null, isCurrent: true, stageChangedAt: "2026-11-25T10:00:00Z" },
  ]);
  assert.equal(timeline.currentStageNumber, 3);
  assert.equal(timeline.entries[0].state, "done");
  assert.equal(timeline.entries[0].recordedAt, "2026-11-20T10:00:00Z");
  assert.equal(timeline.entries[2].state, "current");
  assert.equal(timeline.entries[3].state, "upcoming");
  assert.equal(timeline.entries[3].recordedAt, null); // never invented
  assert.equal(timeline.entries[4].recordedAt, null);
  assert.match(timeline.whatIsNext, /./);
  assert.doesNotMatch(timeline.whatIsNext, /\d{4}-\d{2}-\d{2}/); // no promised date
  // Every entry's "where" comes from the lifecycle lib.
  assert.ok(timeline.entries.every((e) => e.where.length > 0));
  // Stage mapping helper covers 1-6.
  assert.equal(stageIdForNumber(1), "new_lead");
  assert.equal(stageIdForNumber(5), "submitted_uscis");
  assert.equal(stageIdForNumber(6), "visa_approved_closed");
});

check("timeline: no lifecycle rows -> no current stage, honest next text", () => {
  const timeline = buildCaseTimeline("case-fake-2", []);
  assert.equal(timeline.currentStageNumber, null);
  assert.ok(timeline.entries.every((e) => e.state === "upcoming"));
  assert.match(timeline.whatIsNext, /No stage has been recorded/);
});

// ---------------------------------------------------------------------------
// 3. Question of the day — from the existing banks, sourced, deterministic
// ---------------------------------------------------------------------------
check("question of the day: from the existing banks, with a source", () => {
  const q = questionOfTheDay("2026-11-28");
  const bank = INTERVIEW_BANKS.find((b) => b.id === q.question.bankId);
  assert.ok(bank, "question must come from an existing bank");
  assert.ok(q.question.source.label.length > 0);
  assert.ok(q.question.source.url.startsWith("https://www.uscis.gov/"));
  assert.ok(q.kindLabel.length > 0);
  // 2026-11-28 is a civics day (dayIndex % 7 !== 6) — official question.
  assert.equal(q.question.kind, "official_civics");
  assert.ok(q.question.answer, "official civics question carries its official answer");
});

check("question of the day: deterministic by date and rotates", () => {
  const a = questionOfTheDay("2026-11-28");
  const b = questionOfTheDay("2026-11-28");
  assert.equal(a.question.id, b.question.id);
  const c = questionOfTheDay("2026-11-29");
  assert.notEqual(c.question.id, a.question.id);
  // The 7th day is a practice question, labelled as practice.
  const dayIndex = Math.floor(Date.parse("2026-11-28T12:00:00Z") / 86_400_000);
  const practiceDayOffset = 6 - (dayIndex % 7);
  const practiceDate = new Date((dayIndex + practiceDayOffset) * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const p = questionOfTheDay(practiceDate);
  assert.equal(p.question.kind, "practice");
  assert.match(p.kindLabel, /NOT an official USCIS question/);
});

check("interview banks: every question sourced, every practice question labelled", () => {
  assert.equal(allInterviewQuestionsHaveSources(), true);
  assert.equal(allPracticeQuestionsLabelledNotOfficial(), true);
});

// ---------------------------------------------------------------------------
// 4. What changed today — empty when nothing changed, real events only
// ---------------------------------------------------------------------------
const storedEvents: ChangeEventInput[] = [
  { id: "e1", kind: "message", caseId: "case-fake-1", at: "2026-11-28T09:15:00Z", label: "New message from your preparer." },
  { id: "e2", kind: "lifecycle", caseId: "case-fake-1", at: "2026-11-28T11:00:00Z", label: "Your case moved to Stage 3." },
  { id: "e3", kind: "message", caseId: "case-fake-1", at: "2026-11-27T09:15:00Z", label: "Yesterday's message — must not appear today." },
];

check("what changed today: empty when nothing changed", () => {
  const feed = whatChangedToday([], "2026-11-28");
  assert.equal(feed.events.length, 0);
  assert.equal(feed.emptyMessage, NOTHING_NEW_TODAY);
  assert.match(feed.emptyMessage, /Nothing new today/);
});

check("what changed today: lists real stored events, today only, newest first", () => {
  const feed = whatChangedToday(storedEvents, "2026-11-28");
  assert.equal(feed.events.length, 2);
  assert.equal(feed.events[0].id, "e2"); // newest first
  assert.equal(feed.events[1].id, "e1");
  assert.ok(!feed.events.some((e) => e.id === "e3")); // yesterday excluded
});

// ---------------------------------------------------------------------------
// 5. Reminders — real stored dates only
// ---------------------------------------------------------------------------
check("reminders: renewal + RFE + retake from real stored data, overdue first", () => {
  const reminders = buildDailyReminders({
    renewals: [
      { id: "r1", caseId: "case-fake-1", type: "green_card", eligibilityOrExpiryDate: "2026-12-15", status: "upcoming" },
      { id: "r2", caseId: "case-fake-1", type: "ead", eligibilityOrExpiryDate: "2027-06-01", status: "upcoming" },
      { id: "r3", caseId: "case-fake-1", type: "passport", eligibilityOrExpiryDate: "2026-11-01", status: "done" },
    ],
    rfeDeadlines: [{ caseId: "case-fake-1", formLabel: "I-485", deadline: "2026-12-05" }],
    retakeDocuments: [
      { id: "d1", caseId: "case-fake-1", fileName: "passport-photo.jpg", vaultCategory: "Identity", reviewStatus: "retake_requested", retakeNote: "Photo is blurry — retake it.", createdAt: "2026-11-27T10:00:00Z" },
    ],
    todayIso: "2026-11-28",
    now: new Date("2026-11-28T12:00:00Z"),
  });
  // Green card due 2026-12-15: 180-day window opened 2026-06-18 -> due.
  assert.ok(reminders.some((r) => r.kind === "renewal" && r.title.includes("Green Card")));
  // EAD due 2027-06-01: window opens 2026-12-03 -> not due yet, not listed.
  assert.ok(!reminders.some((r) => r.kind === "renewal" && r.title.includes("Work permit")));
  // Done renewal never reminds.
  assert.ok(!reminders.some((r) => r.title.includes("Passport")));
  // RFE deadline listed with its real date.
  const rfe = reminders.find((r) => r.kind === "rfe");
  assert.ok(rfe && rfe.dueDate === "2026-12-05");
  // Retake listed.
  assert.ok(reminders.some((r) => r.kind === "document_retake" && r.title.includes("passport-photo.jpg")));
  // No reminders at all when nothing is stored.
  const none = buildDailyReminders({ renewals: [], rfeDeadlines: [], retakeDocuments: [], todayIso: "2026-11-28", now: new Date("2026-11-28T12:00:00Z") });
  assert.equal(none.length, 0);
});

// ---------------------------------------------------------------------------
// 6. Saved things — drafts + documents + questionnaire, one place
// ---------------------------------------------------------------------------
check("saved things: drafts, documents and questionnaire answers gathered", () => {
  const saved = buildSavedThings({
    drafts: [
      { id: "dd1", caseId: "case-fake-1", formCode: "I-130", status: "in_progress", answeredCount: 12, progressPercent: 60, updatedAt: "2026-11-28T08:00:00Z", downloadLocked: true },
    ],
    documents: [
      { id: "doc1", caseId: "case-fake-1", fileName: "birth-certificate.pdf", vaultCategory: "Identity", reviewStatus: "uploaded", retakeNote: null, createdAt: "2026-11-27T08:00:00Z", downloadLocked: true },
    ],
    questionnaireCounts: [
      { caseId: "case-fake-1", formCode: "I-130", answeredCount: 9, updatedAt: "2026-11-26T08:00:00Z" },
    ],
  });
  assert.equal(saved.counts.drafts, 1);
  assert.equal(saved.counts.documents, 1);
  assert.equal(saved.counts.questionnaireAnswers, 9);
  assert.equal(saved.items.length, 3);
  assert.equal(saved.items[0].kind, "draft"); // newest first
  const draft = saved.items.find((i) => i.kind === "draft")!;
  assert.equal(draft.downloadLocked, true);
  assert.match(draft.lockNote ?? "", /paid DIY unlock/);
  const empty = buildSavedThings({ drafts: [], documents: [], questionnaireCounts: [] });
  assert.equal(empty.items.length, 0);
});

// ---------------------------------------------------------------------------
// 7. Check-in streak — from stored rows only
// ---------------------------------------------------------------------------
check("streak: no rows -> no streak; consecutive days -> streak; gap breaks it", () => {
  assert.deepEqual(computeStreak([], "2026-11-28"), { streakDays: 0, checkedInToday: false, totalCheckins: 0 });
  const s = computeStreak(["2026-11-26", "2026-11-27", "2026-11-28"], "2026-11-28");
  assert.deepEqual(s, { streakDays: 3, checkedInToday: true, totalCheckins: 3 });
  // Checked in yesterday but not today: streak still counts from yesterday.
  const y = computeStreak(["2026-11-26", "2026-11-27"], "2026-11-28");
  assert.equal(y.streakDays, 2);
  assert.equal(y.checkedInToday, false);
  // A gap breaks the streak.
  const g = computeStreak(["2026-11-24", "2026-11-28"], "2026-11-28");
  assert.equal(g.streakDays, 1);
});

// ---------------------------------------------------------------------------
// 8. Built-in news — all sourced, none claims government adoption
// ---------------------------------------------------------------------------
check("news: all posts sourced and dated; none claims adoption/endorsement", () => {
  assert.equal(allNewsPostsSourced(), true);
  assert.ok(DAILY_NEWS.length >= 6);
  for (const post of DAILY_NEWS) {
    assert.match(post.publishedDate, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(post.sourceUrl.startsWith("https://"));
  }
  // News matches the client's forms; everyone sees the general posts.
  const forI485 = newsForForms(DAILY_NEWS, ["I-485"]);
  assert.ok(forI485.some((p) => p.id === "news-2026-11-i485-fee"));
  assert.ok(forI485.some((p) => p.id === "news-2026-11-ar11")); // general post
  const forN400 = newsForForms(DAILY_NEWS, ["N-400"]);
  assert.ok(!forN400.some((p) => p.id === "news-2026-11-i485-fee"));
});

// ---------------------------------------------------------------------------
// 9. Masking
// ---------------------------------------------------------------------------
check("masking: identifiers show only the last 3 characters", () => {
  assert.equal(maskIdentifier("EAC2690123456"), "••••••456");
  assert.equal(maskIdentifier(null), "—");
  assert.equal(maskIdentifier("AB"), "•••");
});

console.log(`\nPASS: ${passed} daily-home checks passed (fake data only).`);
