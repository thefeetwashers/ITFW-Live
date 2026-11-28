// Interview simulator with scoring — TWELFTH ADDITION (part B), Nov 28, 2026.
//
// WHAT THIS IS: a timed mock interview built ONLY from the existing
// question banks in src/lib/interviewPrep.ts (4 banks: 25 official
// civics + 38 platform-written practice questions). It is PRACTICE.
// It scores a practice run in plain English and says what to improve.
// It NEVER predicts the real interview outcome.
//
// HONESTY RULES (do not weaken):
//   * PRACTICE ONLY. Every result carries PRACTICE_LABEL and
//     NO_PREDICTION_NOTICE. A good practice score does NOT mean the
//     real interview will go well, and a low one does NOT mean it
//     will go badly. Only USCIS (or the consulate) decides a case.
//   * Civics questions ARE scored against their official answers,
//     because they have fixed official answers. The pass mark used
//     (6 correct out of 10) is USCIS's own published mark for the
//     real civics test — the score says whether THIS practice run
//     reached that mark, nothing more.
//   * Practice questions have NO fixed answer — the officer wants
//     YOUR true answer, consistent with your application. They are
//     scored only on what can honestly be measured from a practice
//     run: did you answer at all, did you answer inside the time
//     limit, and did you name the document that backs the answer
//     up (where the question's answerNote names one). The user
//     self-checks "my answer matched my application" — the platform
//     cannot check that, because it does not decide truth.
//   * Timed: each question has a time limit (civics 30s, personal
//     60s). Answering after the limit counts as "too slow", not
//     as wrong — slowness is something to practise, not a fail.
//   * No legal advice, no eligibility decision, no evidence-strength
//     judgement. If an answer touches arrests, prior refusals, or
//     anything unclear, the improvement note says to talk to an
//     attorney BEFORE the real interview (same rule as the banks).
//   * DATA ONLY — no Supabase, no Stripe, no sending. The API route
//     /api/interview-simulator serves run plans and scores runs only
//     after the same server-side paid-access check as
//     /api/interview-prep (src/lib/paywall.ts, surface
//     "interview_prep"). This file never imports the banks' answers
//     into a page bundle on its own; the route decides what to send.

import {
  INTERVIEW_BANKS,
  NO_GUARANTEE_NOTICE,
  type InterviewBank,
  type InterviewQuestion,
} from "./interviewPrep";

export const PRACTICE_LABEL =
  "PRACTICE ONLY — this is a mock interview for practice. It is not the real interview and it does not predict your result.";

export const NO_PREDICTION_NOTICE =
  "This score describes one practice run only. It does not predict " +
  "whether your real interview will go well or badly, and it does not " +
  "promise an outcome. Only USCIS (or the consulate, for a visa abroad) " +
  "decides your case. " +
  NO_GUARANTEE_NOTICE;

export type SimulatorBankId = InterviewBank["id"];

/** Seconds allowed per question, by kind. */
export const CIVICS_TIME_LIMIT_SECONDS = 30;
export const PRACTICE_TIME_LIMIT_SECONDS = 60;

/** USCIS's own published mark for the real civics test: 6 of 10. */
export const CIVICS_PASS_MARK_CORRECT = 6;
export const CIVICS_RUN_LENGTH = 10;

export interface SimulatorQuestion {
  id: string;
  bankId: SimulatorBankId;
  kind: InterviewQuestion["kind"];
  question: string;
  /** Official answer is included ONLY in the scoring run (server-side),
   *  never in the run plan sent to the browser before answering. */
  timeLimitSeconds: number;
}

export interface SimulatorRunPlan {
  bankId: SimulatorBankId;
  interviewType: InterviewBank["interviewType"];
  practiceLabel: string;
  noPredictionNotice: string;
  /** Civics runs are 10 questions (the real test asks 10). Practice
   *  runs use 5 questions so a run stays short enough to finish. */
  runLength: number;
  questions: SimulatorQuestion[];
  /** What to have ready before starting (from the bank's intro). */
  beforeYouStart: string;
}

export interface SimulatorAnswer {
  questionId: string;
  /** What the user said/typed, in their own words. Free text. */
  answerText: string;
  /** Seconds the user took on this question. */
  secondsTaken: number;
  /** Self-check the user ticks after answering a practice question:
   *  "My answer matched what is on my application." The platform
   *  cannot verify this — only the user knows their application. */
  matchesApplication?: boolean;
  /** Self-check: "I named (or could show) the document that backs
   *  this answer." Only asked where the bank names a document. */
  namedSupportingDocument?: boolean;
}

export interface SimulatorQuestionScore {
  questionId: string;
  kind: InterviewQuestion["kind"];
  answered: boolean;
  withinTime: boolean;
  secondsTaken: number;
  timeLimitSeconds: number;
  /** Civics only: true when the answer matches an accepted official
   *  answer (case-insensitive, punctuation-insensitive). */
  correct?: boolean;
  /** Practice only: the self-checks, reported back as given. */
  matchesApplication?: boolean;
  namedSupportingDocument?: boolean;
  /** One plain-English line for this question. */
  feedback: string;
}

export type SimulatorBand =
  | "strong-practice"
  | "getting-there"
  | "keep-practising";

export interface SimulatorResult {
  bankId: SimulatorBankId;
  interviewType: InterviewBank["interviewType"];
  practiceLabel: string;
  noPredictionNotice: string;
  totalQuestions: number;
  answeredCount: number;
  withinTimeCount: number;
  /** Civics runs only. */
  civicsCorrect?: number;
  civicsOutOf?: number;
  civicsReachedSixOfTen?: boolean;
  band: SimulatorBand;
  bandPlainEnglish: string;
  /** Plain-English list: what to improve before the real interview. */
  whatToImprove: string[];
  perQuestion: SimulatorQuestionScore[];
}

/** Deterministic pick: same bank + same seed date gives the same run,
 *  so a user can repeat a run fairly. No randomness is hidden. */
export function buildRunPlan(
  bankId: SimulatorBankId,
  seedDateIso: string
): SimulatorRunPlan | null {
  const bank = INTERVIEW_BANKS.find((b) => b.id === bankId);
  if (!bank) return null;
  const runLength =
    bankId === "n400-civics" ? CIVICS_RUN_LENGTH : 5;
  const seed = seedNumber(seedDateIso + ":" + bankId);
  const picked = pickSpread(bank.questions, runLength, seed);
  return {
    bankId,
    interviewType: bank.interviewType,
    practiceLabel: PRACTICE_LABEL,
    noPredictionNotice: NO_PREDICTION_NOTICE,
    runLength: picked.length,
    questions: picked.map((q) => ({
      id: q.id,
      bankId: q.bankId as SimulatorBankId,
      kind: q.kind,
      question: q.question,
      timeLimitSeconds:
        q.kind === "official_civics"
          ? CIVICS_TIME_LIMIT_SECONDS
          : PRACTICE_TIME_LIMIT_SECONDS,
    })),
    beforeYouStart:
      bankId === "n400-civics"
        ? "Have the official list of 100 civics questions open on uscis.gov. This run asks 10, like the real test."
        : "Have your own application open. The right answer is always your true answer, consistent with your application and your documents.",
  };
}

function seedNumber(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h || 1;
}

/** Spread pick: step through the bank at a fixed stride from a seeded
 *  start, so a run covers different parts of the bank each day. */
function pickSpread<T>(items: T[], count: number, seed: number): T[] {
  if (items.length <= count) return [...items];
  const start = seed % items.length;
  const stride = Math.max(1, Math.floor(items.length / count));
  const out: T[] = [];
  let i = start;
  while (out.length < count) {
    out.push(items[i % items.length]);
    i += stride;
  }
  return out;
}

/** Normalise an answer for comparison with an official civics answer:
 *  lower-case, strip punctuation, collapse spaces. A civics answer
 *  counts as correct when it contains any one accepted official
 *  answer (USCIS lists several accepted wordings, separated by ";"). */
export function civicsAnswerIsCorrect(
  given: string,
  officialAnswer: string
): boolean {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const g = norm(given);
  if (!g) return false;
  // A number answer counts when it matches a number in the official
  // answer (e.g. "27" for "Twenty-seven (27)", "100" for "One hundred
  // (100)", "6" for "Six (6)"). Numbers are compared as digits.
  const givenDigits: string[] = g.match(/\d+/g) ?? [];
  const officialDigits: string[] = norm(officialAnswer).match(/\d+/g) ?? [];
  if (
    givenDigits.length > 0 &&
    givenDigits.some((d) => officialDigits.includes(d))
  ) {
    return true;
  }
  const accepted = officialAnswer
    .split(";")
    .map((part) =>
      norm(
        part
          .replace(/\(.*?\)/g, "")
          .replace(/any one of these is a correct answer\.?/i, "")
          .replace(/any one\.?/i, "")
          .replace(/any two\.?/i, "")
      )
    )
    .map((a) => a.replace(/\b(any one|any two)\b/g, "").replace(/\s+/g, " ").trim())
    .filter((a) => a.length > 2);
  return accepted.some((a) => g.includes(a) || a.includes(g));
}

const ATTORNEY_TOPICS = [
  "arrest",
  "charged",
  "crime",
  "refus",
  "voted",
  "citizen",
  "overstay",
  "unlawful",
];

export function scoreRun(
  bankId: SimulatorBankId,
  answers: SimulatorAnswer[]
): SimulatorResult | null {
  const bank = INTERVIEW_BANKS.find((b) => b.id === bankId);
  if (!bank) return null;
  const byId = new Map(bank.questions.map((q) => [q.id, q]));
  const plan = buildRunPlan(bankId, "score-run");
  const planIds = new Set((plan?.questions ?? []).map((q) => q.id));
  // Score the questions actually answered; unanswered plan questions
  // count as not answered (the run is incomplete, said plainly).
  const answerById = new Map(answers.map((a) => [a.questionId, a]));
  // Union of plan + answered, de-duplicated, in plan order then
  // answered order. (No Set spread: this tsconfig has no
  // downlevelIteration, so Set/Map iterables are walked with forEach.)
  const questionIds: string[] = [];
  const seen: Record<string, boolean> = {};
  planIds.forEach((id) => {
    if (!seen[id] && byId.has(id)) {
      seen[id] = true;
      questionIds.push(id);
    }
  });
  answers.forEach((a) => {
    if (!seen[a.questionId] && byId.has(a.questionId)) {
      seen[a.questionId] = true;
      questionIds.push(a.questionId);
    }
  });

  const perQuestion: SimulatorQuestionScore[] = [];
  let answeredCount = 0;
  let withinTimeCount = 0;
  let civicsCorrect = 0;
  let civicsOutOf = 0;
  const whatToImprove: string[] = [];
  let slowCount = 0;
  let unmatchedApplicationCount = 0;
  let attorneyTopicCount = 0;

  for (const id of questionIds) {
    const q = byId.get(id) as InterviewQuestion;
    const a = answerById.get(id);
    const timeLimit =
      q.kind === "official_civics"
        ? CIVICS_TIME_LIMIT_SECONDS
        : PRACTICE_TIME_LIMIT_SECONDS;
    const answered = !!a && a.answerText.trim().length > 0;
    const withinTime = answered && (a as SimulatorAnswer).secondsTaken <= timeLimit;
    if (answered) answeredCount++;
    if (withinTime) withinTimeCount++;
    if (!withinTime && answered) slowCount++;

    let feedback: string;
    let correct: boolean | undefined;
    if (q.kind === "official_civics") {
      civicsOutOf++;
      correct = answered
        ? civicsAnswerIsCorrect((a as SimulatorAnswer).answerText, q.answer ?? "")
        : false;
      if (correct) civicsCorrect++;
      feedback = !answered
        ? "Not answered — practise this one again."
        : correct
          ? withinTime
            ? "Correct, and in time."
            : "Correct, but slower than the 30-second limit — keep practising it until the answer comes quickly."
          : "Not the official answer — check the official answer on uscis.gov and learn it, then try again.";
    } else {
      const matches = a?.matchesApplication;
      const namedDoc = a?.namedSupportingDocument;
      if (matches === false) unmatchedApplicationCount++;
      if (
        a &&
        ATTORNEY_TOPICS.some((t) =>
          (q.question + " " + a.answerText).toLowerCase().includes(t)
        )
      ) {
        attorneyTopicCount++;
      }
      feedback = !answered
        ? "Not answered — say it in your own words next time, even if it is short."
        : !withinTime
          ? "Answered, but after the 60-second limit — practise saying it shorter and clearer."
          : matches === false
            ? "You marked this as NOT matching your application — read your application again and correct the answer before the real interview."
            : "Answered in time. Check it against your application and your documents before you call it done.";
    }

    perQuestion.push({
      questionId: id,
      kind: q.kind,
      answered,
      withinTime,
      secondsTaken: a?.secondsTaken ?? 0,
      timeLimitSeconds: timeLimit,
      ...(q.kind === "official_civics" ? { correct } : {}),
      ...(q.kind === "practice"
        ? {
            matchesApplication: a?.matchesApplication,
            namedSupportingDocument: a?.namedSupportingDocument,
          }
        : {}),
      feedback,
    });
  }

  if (questionIds.length > answeredCount) {
    whatToImprove.push(
      `You left ${questionIds.length - answeredCount} question(s) unanswered in this run — finish a full run next time, even if an answer is short.`
    );
  }
  if (slowCount > 0) {
    whatToImprove.push(
      `${slowCount} answer(s) took longer than the time limit — practise short, clear sentences so the answer comes quickly.`
    );
  }
  if (bankId === "n400-civics") {
    if (civicsCorrect < CIVICS_PASS_MARK_CORRECT) {
      whatToImprove.push(
        `You got ${civicsCorrect} of ${civicsOutOf} civics questions right in this run. The real test needs 6 of 10 — study the full list of 100 on uscis.gov in small groups, and say each answer aloud.`
      );
    } else {
      whatToImprove.push(
        `You reached ${civicsCorrect} of ${civicsOutOf} in this run — the same mark the real test uses (6 of 10). Keep going: study ALL 100 questions on uscis.gov, because the real test draws from the full list, not from this practice run.`
      );
    }
  }
  if (unmatchedApplicationCount > 0) {
    whatToImprove.push(
      `${unmatchedApplicationCount} answer(s) did not match your application — read your own application before the real interview and correct any mistake at the start of the interview.`
    );
  }
  if (attorneyTopicCount > 0) {
    whatToImprove.push(
      "One or more answers touched arrests, charges, a prior refusal, or a similar topic — talk to a licensed attorney BEFORE the real interview if anything in your past is unclear. Do not guess at the interview."
    );
  }
  if (whatToImprove.length === 0) {
    whatToImprove.push(
      "Nothing specific stood out in this run — repeat it another day with a fresh set of questions, and keep studying the full official list."
    );
  }

  const band: SimulatorBand =
    bankId === "n400-civics"
      ? civicsCorrect >= CIVICS_PASS_MARK_CORRECT && slowCount === 0
        ? "strong-practice"
        : civicsCorrect >= 4
          ? "getting-there"
          : "keep-practising"
      : answeredCount === questionIds.length &&
          slowCount === 0 &&
          unmatchedApplicationCount === 0
        ? "strong-practice"
        : answeredCount >= Math.ceil(questionIds.length / 2)
          ? "getting-there"
          : "keep-practising";

  const bandPlainEnglish: Record<SimulatorBand, string> = {
    "strong-practice":
      "Strong practice run — your answers were complete and in time. This is practice only: it does not predict your real interview.",
    "getting-there":
      "Getting there — most answers were in, but some were slow, missing, or did not match your application. Practise the points below.",
    "keep-practising":
      "Keep practising — several answers were missing or slow. Work through the points below, then run it again another day.",
  };

  return {
    bankId,
    interviewType: bank.interviewType,
    practiceLabel: PRACTICE_LABEL,
    noPredictionNotice: NO_PREDICTION_NOTICE,
    totalQuestions: questionIds.length,
    answeredCount,
    withinTimeCount,
    ...(bankId === "n400-civics"
      ? {
          civicsCorrect,
          civicsOutOf,
          civicsReachedSixOfTen: civicsCorrect >= CIVICS_PASS_MARK_CORRECT,
        }
      : {}),
    band,
    bandPlainEnglish: bandPlainEnglish[band],
    whatToImprove,
    perQuestion,
  };
}

/** True only when a result carries the practice label and the
 *  no-prediction notice, and its text never promises an outcome. */
export function simulatorResultIsHonest(result: SimulatorResult): boolean {
  const text = JSON.stringify(result).toLowerCase();
  if (!result.practiceLabel.includes("PRACTICE ONLY")) return false;
  if (!result.noPredictionNotice.includes("does not predict")) return false;
  const banned = [
    "you will pass",
    "you will be approved",
    "guaranteed approval",
    "you will fail",
    "predicted outcome",
  ];
  return !banned.some((phrase) => text.includes(phrase));
}
