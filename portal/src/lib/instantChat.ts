// Instant-answer chat — Ask NIPTEI wired into the professional↔client chat
// ---------------------------------------------------------------------------
// What this is: the thin wrapper that turns the rule-based engine
// (src/lib/askNiptei.ts — answers ONLY from locked data) into an
// instant in-thread answer. When a client asks a question in the
// case chat, the system immediately posts a sourced answer in the
// SAME thread — the client does not wait for a person to reply.
//
// HARD RULES (same as the engine — do not weaken):
//  * Every system answer carries the system label:
//    "Ask NIPTEI — answered by the system, not a person —
//    educational information only, not legal advice, not USCIS"
//    — and its source citation(s).
//  * The engine NEVER decides relief / eligibility, evidence
//    strength, or safe-to-leave / safe-to-travel; NEVER gives legal
//    advice, represents, or files. A legal-decision question gets NO
//    legal answer — it escalates to Find Attorney / Find DOJ
//    (justice.gov/eoir roster) + Review $99 / Human Review $199
//    (locked prices), and the escalation is logged
//    (buildCopilotEscalationLogEntry) and flagged to the professional
//    in the same thread.
//  * Unknown questions get EXACTLY:
//    "I do not know — check uscis.gov / ask your preparer / ask an
//    attorney" — plus the question is flagged to the professional in
//    the same thread. Nothing is invented as official.
//  * The BYO AI copilot stays optional and 501 until a key is set
//    (src/lib/copilotByo.ts, POST /api/ask-niptei) — never a fake
//    AI answer. These instant answers are non-AI answers from the
//    locked guides, and they say so.
//
// NOTE on the unknown wording: the engine's own UNKNOWN_ANSWER is a
// longer paragraph. This wrapper normalises unknown/time/status/
// outcome questions to the exact short sentence above, so the chat
// never shows two different "I do not know" wordings.
//
// This module is pure (no Supabase, no fetch, no secrets) so it is
// safe to call from the API route, from components, and from the
// smoke test (scripts/smoke-instant-chat.ts, fake data only).
import {
  answerCopilot,
  buildCopilotEscalationLogEntry,
  type CopilotAnswer,
  type CopilotEscalationLogEntry,
  type CopilotSource,
  type LanguageCode,
} from "./askNiptei";
import type { AuditItem } from "./audit";
import type { TimelineGap } from "./validator";

/** Label on EVERY system answer in the chat. The chat is the
 *  platform's helper, Ask NIPTEI — it is NOT USCIS, NOT a
 *  government officer, and NOT an attorney. Distinct from a
 *  person's message at a glance. */
export const SYSTEM_LABEL =
  "Ask NIPTEI — answered by the system, not a person — educational information only, not legal advice, not USCIS";

/** The ONLY answer an unknown question ever gets, word for word. */
export const UNKNOWN_ANSWER_EXACT =
  "I do not know — check uscis.gov / ask your preparer / ask an attorney";

export interface InstantChatResult {
  question: string;
  language: LanguageCode;
  /** The text posted into the thread as the system answer. */
  answer: string;
  intent: CopilotAnswer["intent"];
  sources: CopilotSource[];
  systemLabel: string;
  /** True when the question needed a legal decision. No legal
   *  answer was given — see `answer`, which is the escalation text. */
  escalated: boolean;
  escalationReason: string | null;
  /** True when the question was unknown (exact "I do not know"
   *  answer). Also flagged to the professional. */
  unknown: boolean;
  /** True when a human professional must follow up in this thread:
   *  every escalation and every unknown question. */
  needsProfessional: boolean;
  /** Same as needsProfessional — the flag the professional sees in
   *  the thread ("Flagged for you"). */
  flaggedForProfessional: boolean;
  /** Escalation log entry when escalated, else null. persisted is
   *  false in this build (no Supabase) — see askNiptei.ts. */
  escalation: CopilotEscalationLogEntry | null;
  /** Full engine answer, for callers that need the checklist /
   *  packet-score detail behind the thread text. */
  engineAnswer: CopilotAnswer;
}

export interface InstantThreadMessage {
  id: string;
  sender: "client" | "professional" | "system";
  text: string;
  at: string;
  systemLabel?: string;
  sources?: CopilotSource[];
  escalated?: boolean;
  flaggedForProfessional?: boolean;
  intent?: CopilotAnswer["intent"];
}

/** Only question-like client messages get an instant system answer
 *  in the unified thread. A greeting ("hello", "thanks") is a normal
 *  chat message — answering it with "I do not know" and flagging the
 *  professional would be noise. The dedicated InstantAnswerChat box
 *  answers everything typed into it (it IS a question box); this
 *  helper gates only the auto-answer inside the general thread. */
const QUESTION_WORDS: string[] = [
  "what", "which", "when", "where", "who", "how", "why",
  "can i", "can you", "could i", "should i", "do i", "am i", "is it",
  "is my", "will i", "will my", "cuánto", "cuanto", "cómo", "como",
  "qué", "que", "cuándo", "dónde", "puis-je", "comment", "est-ce",
  "fee", "price", "cost", "form", "document", "rfe", "notice",
  "i-130", "i-485", "i-864", "n-400", "i-765", "i-821", "i-589", "i-90",
  "uscis", "nvc", "eligible", "travel", "status", "passport",
];

export function isQuestionLike(text: string): boolean {
  const q = text.trim().toLowerCase();
  if (!q) return false;
  if (q.includes("?")) return true;
  return QUESTION_WORDS.some((w) => q.includes(w));
}

export interface AnswerInstantlyOptions {
  language?: LanguageCode;
  auditItems?: AuditItem[];
  timelineGaps?: TimelineGap[];
  serviceRequested?: NonNullable<Parameters<typeof answerCopilot>[1]>["serviceRequested"];
  /** Form codes on the client's case, for case-aware news matching. */
  caseForms?: string[];
}

export function answerInstantly(
  question: string,
  opts: AnswerInstantlyOptions = {}
): InstantChatResult {
  const engine = answerCopilot(question, {
    language: opts.language,
    auditItems: opts.auditItems,
    timelineGaps: opts.timelineGaps,
    serviceRequested: opts.serviceRequested,
    caseForms: opts.caseForms,
  });

  const base = {
    question: engine.questionOriginal,
    language: engine.language,
    intent: engine.intent,
    sources: engine.sources,
    systemLabel: SYSTEM_LABEL,
    engineAnswer: engine,
  };

  // 1. Legal-decision question: NO legal answer. Escalation text
  // (Find Attorney / Find DOJ + Review $99 / Human Review $199),
  // logged, flagged to the professional in the same thread.
  if (engine.escalated) {
    return {
      ...base,
      answer: engine.answer,
      escalated: true,
      escalationReason: engine.escalationReason,
      unknown: false,
      needsProfessional: true,
      flaggedForProfessional: true,
      escalation: buildCopilotEscalationLogEntry(engine),
    };
  }

  // 2. Unknown / time / status / outcome: the engine never invents
  // a fee, a processing time, a cutoff date, a case status, or a
  // legal outcome. Normalise to the exact short sentence, and flag
  // the question to the professional in the same thread.
  const isUnknown =
    engine.intent === "unknown_time_status_outcome" ||
    (engine.intent === "general" &&
      engine.answer.includes("I do not know the answer to this question"));
  if (isUnknown) {
    return {
      ...base,
      answer: UNKNOWN_ANSWER_EXACT,
      escalated: false,
      escalationReason: null,
      unknown: true,
      needsProfessional: true,
      flaggedForProfessional: true,
      escalation: null,
    };
  }

  // 3. Known question: sourced answer from the locked data, with the
  // system label and its sources. No human follow-up required.
  return {
    ...base,
    answer: engine.answer,
    escalated: false,
    escalationReason: null,
    unknown: false,
    needsProfessional: false,
    flaggedForProfessional: false,
    escalation: null,
  };
}

/** Build the thread message for an instant result (id supplied by
 *  the caller so the thread, not this lib, owns ids). */
export function buildInstantSystemMessage(
  result: InstantChatResult,
  id: string
): InstantThreadMessage {
  return {
    id,
    sender: "system",
    text: result.answer,
    at: new Date().toISOString(),
    systemLabel: result.systemLabel,
    sources: result.sources,
    escalated: result.escalated,
    flaggedForProfessional: result.flaggedForProfessional,
    intent: result.intent,
  };
}
