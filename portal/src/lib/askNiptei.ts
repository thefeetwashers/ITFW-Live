// Ask NIPTEI — AI Copilot core (non-AI FAQ engine in this build)
// ---------------------------------------------------------------------------
// What this is: the rule-based answer engine behind "Ask NIPTEI".
// A client types any immigration question in their own language (7
// languages: EN ES HT FR PT ZH AR — src/lib/i18n.ts LANGUAGES). The
// copilot answers from the platform's LOCKED data only — form
// checklists (src/lib/formChecklists.ts), locked prep fees, locked
// government fees, and the locked Review $99 / Human Review $199
// offers (src/lib/storefront.ts) — with a SOURCE cited for every
// factual answer (uscis.gov, travel.state.gov, justice.gov/eoir, or
// the platform's own locked prices/fees).
//
// What this is NOT (hard guardrails — do not weaken):
//  * NEVER decides relief / eligibility, NEVER decides evidence
//    strength, NEVER decides safe-to-leave / safe-to-travel, NEVER
//    gives legal advice, NEVER represents a client, NEVER files
//    anything. Any question needing a legal decision escalates:
//    "This needs a licensed attorney or DOJ-accredited
//    representative — here is Find Attorney / Find DOJ" + the
//    Review $99 / Human Review $199 offers, and the escalation is
//    logged (buildCopilotEscalationLogEntry).
//  * NEVER invents a fee, a processing time, a cutoff date, a case
//    status, or a legal outcome. Unknown = "I do not know — check
//    uscis.gov / ask your preparer / ask an attorney" with the link.
//  * Every answer carries: "Ask NIPTEI — educational information
//    only, not legal advice, not USCIS". The chat is the platform's
//    helper — it NEVER pretends to be USCIS, a government officer,
//    or an attorney.
//
// AI STATUS — NOT LIVE in this build:
//  * No AI provider is connected. Platform default is OpenRouter,
//    env name only: OPENROUTER_API_KEY. No OpenRouter client is
//    installed and no live call is made — POST /api/ask-niptei
//    returns 501 "AI not configured" and this engine's non-AI FAQ
//    answer instead. It NEVER returns a fake AI answer.
//  * Google Translate is NOT connected (GOOGLE_TRANSLATE_API_KEY,
//    env name only — see src/lib/translate.ts / /api/translate).
//    So the English version of a non-English question is NOT
//    machine-translated here: questionEnglish is null and the
//    answer is in English with a translation-not-configured note,
//    and the ORIGINAL question is always shown alongside it.
//    When a professional connects their own chat AI (BYO, see
//    src/lib/copilotByo.ts) that provider answers in the client's
//    language under their own custom instructions.
//  * This engine is pure (no Supabase, no fetch, no secrets) so it
//    is safe to call from the API route and from components.
import {
  FORM_CHECKLIST_TEMPLATES,
  getTemplate,
  govFeeDisplay,
  templateIdForService,
  type FormChecklistTemplate,
} from "./formChecklists";
import {
  HUMAN_REVIEW_CENTS,
  REVIEW_PER_FORM_CENTS,
  formatCents,
  govFeeNoteFor,
} from "./storefront";
import { getLockedPriceByKey } from "./stripePrices";
import {
  CONDUCT_GUIDE,
  NO_GUARANTEE_NOTICE,
  WHAT_TO_BRING,
  interviewQuestionCounts,
} from "./interviewPrep";
import {
  BUNDLE_TEMPLATES,
  FAMILY_ADJUSTMENT_BUNDLE,
} from "./bundles";
import { findGlossaryTerm, GLOSSARY_DISCLAIMER } from "./glossary";
import {
  FEE_WAIVER_CHECKLIST,
  FEE_WAIVER_HOW_TO_USE,
  FEE_WAIVER_ONLY_USCIS_DECIDES,
  FEE_WAIVER_PREP_PRICE_NOTE,
  FEE_WAIVER_SOURCE,
} from "./feeWaiverChecklist";
import { unpricedForm } from "./quotedForms";
import {
  BUILT_IN_NEWS,
  LIVE_NEWS_FEED_STATUS,
  newsForChat,
} from "./immigrationNews";
import { LANGUAGES, type LanguageCode } from "./i18n";
import type { AuditItem } from "./audit";
import { computePacketReadiness } from "./audit";
import type { TimelineGap } from "./validator";

export { LANGUAGES };
export type { LanguageCode };

export const COPILOT_DISCLAIMER =
  "Ask NIPTEI — educational information only, not legal advice, not USCIS";

export const SOURCES = {
  uscis: { label: "uscis.gov", url: "https://www.uscis.gov" },
  uscisFees: { label: "uscis.gov/fees", url: "https://www.uscis.gov/fees" },
  uscisForms: { label: "uscis.gov — forms", url: "https://www.uscis.gov/forms" },
  travelState: {
    label: "travel.state.gov",
    url: "https://travel.state.gov",
  },
  visaBulletin: {
    label: "travel.state.gov — Visa Bulletin",
    url: "https://travel.state.gov/content/travel/en/legal/visa-law0/visa-bulletin.html",
  },
  eoirRoster: {
    label: "justice.gov/eoir — Find a representative (DOJ roster)",
    url: "https://www.justice.gov/eoir/recognition-and-accreditation-program",
  },
  eoir: { label: "justice.gov/eoir", url: "https://www.justice.gov/eoir" },
  platformPrices: {
    label: "Immigration with NIPTEI — locked prices/fees",
    url: "https://immigration.niptei.com",
  },
} as const;

export interface CopilotSource {
  label: string;
  url: string;
}

export type CopilotIntent =
  | "escalation_legal"
  | "unknown_time_status_outcome"
  | "rfe_decoder"
  | "form_finder"
  | "documents_checklist"
  | "fees"
  | "field_help"
  | "next_step"
  | "timeline_gaps"
  | "packet_audit"
  | "filing_help"
  | "interview"
  | "bundles"
  | "diy_fees"
  | "fee_waiver"
  | "glossary"
  | "quoted_form"
  | "news"
  | "general";

export interface CopilotAnswer {
  /** Original question exactly as typed. Always shown. */
  questionOriginal: string;
  /** English version of the question. Null in this build: Google
   *  Translate is NOT connected, so no translation is invented. */
  questionEnglish: string | null;
  language: LanguageCode;
  /** Language the answer is written in ("en" in this build — see note). */
  answerLanguage: LanguageCode;
  translationNote: string;
  intent: CopilotIntent;
  answer: string;
  sources: CopilotSource[];
  disclaimer: string;
  /** True when the question needed a legal decision. */
  escalated: boolean;
  escalationReason: string | null;
  /** Form checklist the answer points to (one-tap load in the UI). */
  checklistTemplateId: string | null;
  checklistTemplate: FormChecklistTemplate | null;
  /** Packet-audit score, only when audit items were supplied. */
  packetScore: number | null;
  packetReady: boolean | null;
  /** Timeline gaps, only when gaps were supplied. */
  timelineGaps: TimelineGap[] | null;
  /** "Was this helpful? / Ask a human" — routes to the assigned
   *  professional's unified thread. */
  askHumanLabel: string;
}

export interface CopilotEscalationLogEntry {
  type: "copilot_escalation";
  at: string;
  question: string;
  language: LanguageCode;
  intent: CopilotIntent;
  reason: string;
  routedTo: string;
  offers: string[];
  /** False in this build: no Supabase in this build, so the entry is
   *  returned in the API response for the professional's unified
   *  thread. Persist to audit_log when Supabase is live. */
  persisted: boolean;
  persistNote: string;
}

export function buildCopilotEscalationLogEntry(
  answer: CopilotAnswer
): CopilotEscalationLogEntry {
  return {
    type: "copilot_escalation",
    at: new Date().toISOString(),
    question: answer.questionOriginal,
    language: answer.language,
    intent: answer.intent,
    reason:
      answer.escalationReason ??
      "Question needs a legal decision — escalated, not answered.",
    routedTo:
      "Find Attorney / Find DOJ (justice.gov/eoir recognition-accreditation roster)",
    offers: [
      `Review — ${formatCents(REVIEW_PER_FORM_CENTS)} per form (locked)`,
      `Human Review — ${formatCents(HUMAN_REVIEW_CENTS)} (locked)`,
    ],
    persisted: false,
    persistNote:
      "Escalation logged in the API response in this build (no Supabase connected). When Supabase is live, persist this entry to audit_log and route it to the assigned professional's unified thread.",
  };
}

const ESCALATION_OFFERS =
  `Review — ${formatCents(REVIEW_PER_FORM_CENTS)} per form (locked price) or ` +
  `Human Review — ${formatCents(HUMAN_REVIEW_CENTS)} (locked price).`;

const ESCALATION_ANSWER =
  "This needs a licensed attorney or DOJ-accredited representative — " +
  "I cannot decide this for you, and I do not give legal advice. " +
  "Here is Find Attorney / Find DOJ: the DOJ recognition and " +
  "accreditation roster at justice.gov/eoir " +
  "https://www.justice.gov/eoir/recognition-and-accreditation-program. " +
  "Ask your assigned professional to route your question to them, or " +
  `book a human review: ${ESCALATION_OFFERS} ` +
  "Your question has been logged as an escalation and sent to your " +
  "assigned professional's unified thread — use “Ask a human” below " +
  "to follow it up. I never decide relief, eligibility, evidence " +
  "strength, or whether it is safe to leave or travel.";

const UNKNOWN_ANSWER =
  "I do not know — I will not guess a fee, a processing time, a " +
  "cutoff date, a case status, or a legal outcome. Check " +
  "uscis.gov (https://www.uscis.gov) for the current information, " +
  "or ask your preparer / ask an attorney. If your question is " +
  "about whether you qualify or what will happen to your case, " +
  "that needs a licensed attorney or DOJ-accredited representative — " +
  `see Find DOJ above, or book ${ESCALATION_OFFERS}`;

// Multilingual escalation triggers (lowercased substring match).
// Kept deliberately broad: when in doubt, escalate rather than answer.
const ESCALATION_PATTERNS: string[] = [
  // English — eligibility / relief / outcome / travel / legal advice
  "eligible", "eligibility", "qualify", "do i qualify", "am i eligible",
  "can i apply", "should i apply", "should i file", "should i travel",
  "can i travel", "can i leave", "safe to travel", "safe to leave",
  "will i be approved", "will my case be approved", "will i get approved",
  "am i safe", "is it safe", "legal advice", "do i need a lawyer",
  "can i work", "am i allowed to work", "deport", "removal", "court",
  "waiver", "i-601", "appeal", "denied", "asylum", "refugee",
  "can i stay", "will i be denied", "what are my chances",
  "is my case strong", "is my evidence strong", "evidence strong",
  "should i lie", "can i lie",
  // Spanish
  "soy elegible", "elegible", "califico", "puedo viajar", "puedo salir",
  "es seguro viajar", "me deport", "deportaci", "puedo trabajar",
  "abogado", "asilo",
  // Haitian Creole
  "mwen kalifye", "kalifye", "mwen ka vwayaje", "eske mwen ka",
  "depotasyon", "avoka",
  // French
  "suis-je éligible", "éligible", "puis-je voyager", "expulsion", "avocat",
  // Portuguese
  "sou elegível", "elegível", "posso viajar", "deporta", "advogado",
  // Chinese
  "我有资格", "我可以旅行", "我会被驱逐", "律师",
  // Arabic
  "هل أنا مؤهل", "هل يمكنني السفر", "محامي",
];

const UNKNOWN_PATTERNS: string[] = [
  "how long", "processing time", "how long will", "when will my case",
  "when will i get", "cutoff date", "cut-off date", "priority date",
  "visa bulletin", "case status", "what is my case status",
  "check my status", "how much time", "cuánto tiempo", "combien de temps",
  "konbyen tan", "处理时间", "需要多长时间", "كم من الوقت",
];

function norm(q: string): string {
  return q.toLowerCase();
}

function includesAny(q: string, patterns: string[]): boolean {
  return patterns.some((p) => q.includes(p));
}

function formCodeIn(q: string): string | null {
  const codes = ["i-130", "i-485", "i-864", "n-400", "i-765", "i-821", "i-589", "i-90", "i-751", "i-730", "ds-260"];
  for (const c of codes) if (q.includes(c)) return c.toUpperCase();
  return null;
}

function templateForFormCode(code: string): FormChecklistTemplate | null {
  const byService: Record<string, string> = {
    "I-130": "i130-nvc",
    "I-485": "i485",
    "I-864": "i864",
    "N-400": "n400",
    "I-765": "i821-i765",
    "I-821": "i821-i765",
    "I-589": "i589",
    "I-90": "i90",
  };
  const id = byService[code];
  return id ? getTemplate(id) : null;
}

function checklistSummary(t: FormChecklistTemplate): string {
  const prep = t.tierPrices
    ? `Locked prep fee — Basic $${t.tierPrices.basic} / Standard $${t.tierPrices.standard} / Premium $${t.tierPrices.premium}.`
    : "No locked prep fee for this form — TO BE CONFIRMED.";
  const gov = t.govFees.map((g) => govFeeDisplay(g)).join("; ");
  const items = t.checklist
    .slice(0, 5)
    .map((i) => `• ${i.title}`)
    .join("\n");
  return (
    `${t.name} — forms: ${t.formsIncluded.join(", ")}. ${prep}\n` +
    `Government fees (separate from the prep fee): ${gov}\n` +
    `${t.govTotalNote}\n` +
    `Checklist — first items:\n${items}\n` +
    `Tap “Load this checklist” below to open the full checklist ` +
    `(${t.checklist.length} items).`
  );
}

export interface AnswerCopilotOptions {
  language?: LanguageCode;
  /** Packet-audit items, when the client has a packet in progress. */
  auditItems?: AuditItem[];
  /** Timeline gaps from src/lib/validator.ts, when supplied. */
  timelineGaps?: TimelineGap[];
  /** Service the client ordered, when known (wires in the Dynamic
   *  Intake Engine / Smart Intake Calculator via templateIdForService). */
  serviceRequested?: Parameters<typeof templateIdForService>[0];
  /** Form codes on the client's case, for case-aware news matching. */
  caseForms?: string[];
}

export function answerCopilot(
  question: string,
  opts: AnswerCopilotOptions = {}
): CopilotAnswer {
  const language: LanguageCode = opts.language ?? "en";
  const q = norm(question.trim());
  const base = {
    questionOriginal: question.trim(),
    questionEnglish: language === "en" ? question.trim() : null,
    language,
    answerLanguage: "en" as LanguageCode,
    translationNote:
      language === "en"
        ? ""
        : "Answer in English for now — automatic translation is NOT connected " +
          "(Google Translate NOT connected, GOOGLE_TRANSLATE_API_KEY env name only). " +
          "Your original question is shown above, untranslated. Ask your preparer " +
          "for a translation, or ask a human below. When your professional connects " +
          "their own chat AI, it can answer in your language.",
    disclaimer: COPILOT_DISCLAIMER,
    askHumanLabel: "Was this helpful? / Ask a human",
    checklistTemplateId: null as string | null,
    checklistTemplate: null as FormChecklistTemplate | null,
    packetScore: null as number | null,
    packetReady: null as boolean | null,
    timelineGaps: opts.timelineGaps ?? null,
  };

  if (!question.trim()) {
    return {
      ...base,
      intent: "general",
      answer:
        "Ask me anything about your immigration forms — which form you need, " +
        "what documents are needed, what to bring to your interview, what a USCIS/NVC notice means, what a fee is, " +
        "what the DIY $25 / $99 covers, what a word means (glossary), what the fee-waiver checklist asks, " +
        "what the Family Adjustment Bundle covers, which forms are quoted individually, or what immigration news is posted. " +
        "I answer from the platform's locked guides and " +
        "uscis.gov / travel.state.gov / justice.gov/eoir only, and I never give " +
        "legal advice. I am Ask NIPTEI, the platform's helper — not USCIS, not a government officer, not an attorney.",
      sources: [SOURCES.uscis, SOURCES.platformPrices],
      escalated: false,
      escalationReason: null,
    };
  }

  // 1. Hard guardrail first: any legal-decision question escalates.
  // Carve-out: a plain INFORMATION question about the fee-waiver
  // checklist (Form I-912 — "what is a fee waiver", "fee waiver
  // checklist") is answered with the checklist, not escalated. Any
  // question that asks whether the asker QUALIFIES still escalates
  // ("do I qualify for a fee waiver" is an eligibility decision).
  const isFeeWaiverInfo =
    (q.includes("i-912") || q.includes("fee waiver")) &&
    !includesAny(q, [
      "qualify",
      "eligible",
      "do i",
      "am i",
      "can i get",
      "will i get",
      "should i apply",
    ]);
  if (includesAny(q, ESCALATION_PATTERNS) && !isFeeWaiverInfo) {
    return {
      ...base,
      intent: "escalation_legal",
      answer: ESCALATION_ANSWER,
      sources: [SOURCES.eoirRoster, SOURCES.eoir, SOURCES.platformPrices],
      escalated: true,
      escalationReason:
        "Question needs a legal decision (relief / eligibility / evidence / safe-to-travel / legal advice) — escalated, not answered.",
    };
  }

  // 2. Never invent times / dates / status / outcomes.
  if (includesAny(q, UNKNOWN_PATTERNS)) {
    return {
      ...base,
      intent: "unknown_time_status_outcome",
      answer: UNKNOWN_ANSWER,
      sources: [SOURCES.uscis, SOURCES.visaBulletin, SOURCES.travelState],
      escalated: false,
      escalationReason: null,
    };
  }

  // 2b. Glossary — "what does RFE mean?" / "what is TPS?".
  // Answered from the plain-language glossary (src/lib/glossary.ts),
  // which is sourced from the codebase + the official site named on
  // each entry. A definition is not legal advice.
  if (
    (q.includes("what does") ||
      q.includes("what is") ||
      q.includes("what do you mean") ||
      q.includes("mean by") ||
      q.includes("meaning of")) &&
    // A question about a LETTER or NOTICE ("what does my RFE letter
    // mean?") belongs to the RFE Decoder below, not the glossary.
    !q.includes("letter") &&
    !q.includes("notice")
  ) {
    const term = findGlossaryTerm(q);
    if (term) {
      return {
        ...base,
        intent: "glossary",
        answer:
          `${term.term}: ${term.definition}\n\n` +
          `Source: ${term.sourceLabel} (${term.sourceUrl}). ` +
          GLOSSARY_DISCLAIMER,
        sources: [
          { label: term.sourceLabel, url: term.sourceUrl },
          SOURCES.platformPrices,
        ],
        escalated: false,
        escalationReason: null,
      };
    }
  }

  // 2c. Quoted forms — I-526E / I-526 / I-829 / I-693 have NO locked
  // price. Never invent one: the answer says "quoted individually"
  // and points to the quote request in the service catalog.
  {
    const quotedCode = ["i-526e", "i-526", "i-829", "i-693"].find((c) =>
      q.includes(c)
    );
    if (quotedCode) {
      const form = unpricedForm(quotedCode.toUpperCase());
      const is693 = quotedCode === "i-693";
      return {
        ...base,
        intent: "quoted_form",
        answer:
          (form ? `${form.name}: ${form.pricingState}\n\n` : "") +
          (is693
            ? "Form I-693 is the medical exam. Booking is free — a USCIS-designated civil surgeon completes the form and seals it, and the doctor's fee ($250–$500) is paid to the doctor, not here. Do not open the sealed envelope; bring it sealed to your interview."
            : "This form is quoted individually. No price is shown here and none has been invented — a professional quotes it for your situation after you request a quote in the service catalog (Master Form & Service Bundle Catalog — “Quoted individually” section).") +
          "\n\nConfirm the current USCIS fee for this form at uscis.gov/fees before you pay anything.",
        sources: [SOURCES.uscisFees, SOURCES.platformPrices],
        escalated: false,
        escalationReason: null,
      };
    }
  }

  // 2d. Bundles — the locked Family Adjustment Bundle + the bundle
  // catalog (src/lib/bundles.ts). Locked prices only; a bundle with
  // no locked combined fee is TO BE CONFIRMED, never invented.
  if (q.includes("bundle")) {
    const b = FAMILY_ADJUSTMENT_BUNDLE;
    const lines = BUNDLE_TEMPLATES.map((t) => {
      const fee = t.serviceFee
        ? "basic" in t.serviceFee
          ? `Basic $${t.serviceFee.basic} / Standard $${t.serviceFee.standard} / Premium $${t.serviceFee.premium} (locked)`
          : `$${t.serviceFee.flat} flat (locked)`
        : "TO BE CONFIRMED — no locked combined fee";
      return `• ${t.formCode} — ${t.name}: ${fee}. ${t.uscisFeeNote}`;
    }).join("\n");
    return {
      ...base,
      intent: "bundles",
      answer:
        `${b.name} (locked): Basic $${b.price.basic} / Standard $${b.price.standard} / Premium $${b.price.premium}. ` +
        `Forms: ${b.forms.join(", ")}. I-130A is included free with I-130.\n\n` +
        `Other bundles in the catalog:\n${lines}\n\n` +
        "Government (USCIS) fees are always separate from the preparation fee — confirm the current fee at uscis.gov/fees before you pay.",
      sources: [SOURCES.uscisFees, SOURCES.platformPrices],
      escalated: false,
      escalationReason: null,
    };
  }

  // 2e. DIY fees — DIY $25/form or DIY Bundle $99 (locked Stripe
  // Prices, src/lib/stripePrices.ts). Answering the questions is
  // free; print / save / email unlock only after the DIY payment is
  // confirmed in the database. USCIS fees are separate.
  if (
    q.includes("diy") ||
    q.includes("do it myself") ||
    q.includes("file it myself") ||
    q.includes("print my form") ||
    q.includes("print the form")
  ) {
    const single = getLockedPriceByKey("diy_form");
    const bundle = getLockedPriceByKey("diy_bundle");
    return {
      ...base,
      intent: "diy_fees",
      answer:
        "Doing it yourself (DIY) on this platform: answering the guided questions is free. " +
        `Print, save and email of your completed application unlock after your DIY payment is confirmed in our records — ` +
        `${single ? `DIY $${single.amountCents / 100} for this form (locked Price ${single.priceId})` : "DIY $25 for this form (locked)"} ` +
        `or ${bundle ? `DIY Bundle $${bundle.amountCents / 100} (locked Price ${bundle.priceId})` : "DIY Bundle $99 (locked)"}, which covers every DIY form for your case. ` +
        "If you already paid, the DIY page says “Already paid” and does not charge you again — access unlocks from the payment record, never from a button. " +
        "USCIS government fees are separate and are never part of the DIY payment — confirm the current USCIS fee at uscis.gov/fees before you pay. " +
        "You review and sign before anything is submitted; the system never files for you.",
      sources: [SOURCES.uscisFees, SOURCES.platformPrices],
      escalated: false,
      escalationReason: null,
    };
  }

  // 2f. Fee-waiver checklist — Form I-912. A CHECKLIST of the
  // questions USCIS asks, not a decision: only USCIS decides.
  if (q.includes("i-912") || q.includes("fee waiver")) {
    return {
      ...base,
      intent: "fee_waiver",
      answer:
        "Form I-912 is the Request for Fee Waiver. This is a checklist of the questions USCIS asks — it is NOT a decision about you. " +
        FEE_WAIVER_ONLY_USCIS_DECIDES +
        "\n\n" +
        FEE_WAIVER_CHECKLIST.map(
          (item, i) => `${i + 1}. ${item.question}\n   What to show: ${item.whatToShow}`
        ).join("\n\n") +
        "\n\nHow to use it:\n" +
        FEE_WAIVER_HOW_TO_USE.map((s) => `• ${s}`).join("\n") +
        `\n\n${FEE_WAIVER_PREP_PRICE_NOTE}\n\nSource: ${FEE_WAIVER_SOURCE.label} (${FEE_WAIVER_SOURCE.url}).`,
      sources: [
        { label: FEE_WAIVER_SOURCE.label, url: FEE_WAIVER_SOURCE.url },
        SOURCES.platformPrices,
      ],
      escalated: false,
      escalationReason: null,
    };
  }

  // 3. RFE Decoder — "The letter is scary. The fix is a checklist."
  if (
    q.includes("rfe") ||
    q.includes("request for evidence") ||
    q.includes("notice") ||
    q.includes("letter from uscis") ||
    q.includes("uscis letter")
  ) {
    const code = formCodeIn(q);
    const template = code ? templateForFormCode(code) : null;
    return {
      ...base,
      intent: "rfe_decoder",
      answer:
        "The letter is scary. The fix is a checklist. A Request for Evidence (RFE) " +
        "from USCIS means USCIS needs more documents or information before it can " +
        "decide — it is not a denial. Read the letter for: (1) which form it is about, " +
        "(2) exactly which documents or facts it asks for, (3) the deadline in the letter — " +
        "never guess the deadline, use the date printed on the letter. Gather only what " +
        "the letter asks for, in the order it asks for it, and send it before that date. " +
        "If the letter asks for something you do not understand, or asks about your " +
        "eligibility, that part needs a licensed attorney or DOJ-accredited representative — " +
        "use “Ask a human” below. I cannot tell you whether your evidence is strong enough. " +
        `Locked RFE Response prep help: Basic ${formatCents(39900)} / Standard ${formatCents(79900)} / Premium ${formatCents(149900)}.`,
      sources: [SOURCES.uscis, SOURCES.eoirRoster, SOURCES.platformPrices],
      escalated: false,
      escalationReason: null,
      checklistTemplateId: template?.id ?? null,
      checklistTemplate: template,
    };
  }

  // 3b. Interview — "what do I bring to my interview?" Answered
  // from src/lib/interviewPrep.ts: the what-to-bring lists (N-400 /
  // I-485 / consular), the conduct guide, and the civics bank (a
  // SAMPLE of 25 of the official 100 — study all 100 on uscis.gov).
  // Never a guarantee: only USCIS / the consulate decides.
  if (
    q.includes("interview") ||
    q.includes("civics") ||
    q.includes("mock interview") ||
    q.includes("what to bring") ||
    q.includes("what do i bring")
  ) {
    const counts = interviewQuestionCounts();
    const bring = WHAT_TO_BRING.map((g) => {
      const items = g.items
        .map((i) => `• ${i.item} — ${i.why}`)
        .join("\n");
      return `${g.interviewType} — what to bring:\n${g.checkFirst ? `${g.checkFirst}\n` : ""}${items}`;
    }).join("\n\n");
    const conduct = CONDUCT_GUIDE.points
      .slice(0, 5)
      .map((p) => `• ${p}`)
      .join("\n");
    return {
      ...base,
      intent: "interview",
      answer:
        `${bring}\n\n` +
        `How to conduct yourself at the interview (first points):\n${conduct}\n` +
        `Full conduct guide, what the officer looks for, and common delay / denial reasons are in Interview Prep on this platform.\n\n` +
        `Civics test: this platform holds a sample of ${counts.officialCivics} of the official 100 USCIS civics questions — study all 100 on uscis.gov, not only this sample. Practice questions here are written by the platform from the topics USCIS lists; they are NOT official USCIS questions, and an officer will not necessarily ask these exact questions.\n\n` +
        `${NO_GUARANTEE_NOTICE}`,
      sources: [
        { label: "USCIS — The Naturalization Interview and Test", url: "https://www.uscis.gov/citizenship/learn-about-citizenship/the-naturalization-interview-and-test" },
        { label: "USCIS — Study for the Test (official 100 civics questions)", url: "https://www.uscis.gov/citizenship/find-study-materials-and-resources/study-for-the-test" },
        { label: "USCIS — Adjustment of Status", url: "https://www.uscis.gov/green-card/green-card-processes-and-procedures/adjustment-of-status" },
      ],
      escalated: false,
      escalationReason: null,
    };
  }

  // 4. Fees — locked prices only, gov fees labelled LOCKED / TO BE CONFIRMED.
  if (
    q.includes("fee") || q.includes("price") || q.includes("cost") ||
    q.includes("how much") || q.includes("cuanto") || q.includes("cuánto") ||
    q.includes("konbyen") || q.includes("combien") || q.includes("quanto") ||
    q.includes("多少钱") || q.includes("كم")
  ) {
    const code = formCodeIn(q);
    const template = code ? templateForFormCode(code) : null;
    const lines: string[] = [];
    if (template) {
      lines.push(checklistSummary(template));
    } else {
      lines.push(
        "Locked prep fees (platform, per form — Basic / Standard / Premium): " +
          FORM_CHECKLIST_TEMPLATES.filter((t) => t.tierPrices)
            .map(
              (t) =>
                `${t.name} $${t.tierPrices!.basic} / $${t.tierPrices!.standard} / $${t.tierPrices!.premium}`
            )
            .join("; ") +
          ". Family Adjustment Bundle $999 / $1,799 / $2,799 (locked)."
      );
      lines.push(
        `Review ${formatCents(REVIEW_PER_FORM_CENTS)} per form (locked). ` +
          `Human Review ${formatCents(HUMAN_REVIEW_CENTS)} (locked). ` +
          "Certified Translation $45 per page (locked)."
      );
    }
    lines.push(
      "Government fees are always a separate line from the prep fee and are " +
        "paid to the U.S. Department of Homeland Security. " +
        (code ? govFeeNoteFor(code) : "Confirm the current fee at uscis.gov/fees before you pay — anything not labelled LOCKED above is TO BE CONFIRMED.")
    );
    return {
      ...base,
      intent: "fees",
      answer: lines.join("\n\n"),
      sources: [SOURCES.uscisFees, SOURCES.platformPrices],
      escalated: false,
      escalationReason: null,
      checklistTemplateId: template?.id ?? null,
      checklistTemplate: template,
    };
  }

  // 5. Packet audit / readiness.
  if (q.includes("audit") || q.includes("packet score") || q.includes("ready to file") || q.includes("readiness")) {
    const readiness = opts.auditItems
      ? computePacketReadiness(opts.auditItems)
      : null;
    return {
      ...base,
      intent: "packet_audit",
      answer:
        (readiness
          ? `Your packet audit score is ${readiness.score}% ` +
            `(${readiness.earnedWeight}/${readiness.totalWeight}). ` +
            (readiness.readyToFile
              ? "Score is 100% and every blocking item is cleared — the packet can be generated as a DRAFT for review (see Filing Help). "
              : `Not ready yet — ${readiness.blockingItems.length} blocking item(s) still open: ` +
                readiness.blockingItems.map((i) => i.label).join("; ") +
                ". Clear every blocking item to reach 100%. ")
          : "The packet audit score is a checklist calculation, not a legal determination. " +
            "It reaches 100% only when every blocking item is cleared (signature, unexpired passport, " +
            "translated foreign documents, all required documents, complete form sections). ") +
        "A DRAFT packet is generated only at 100% via /api/generate-packet, from templates from uscis.gov, " +
        "with field mappings unverified. Nothing is filed by the copilot — you review, E-Sign, and submit it yourself (or via your attorney).",
      sources: [SOURCES.uscisForms, SOURCES.platformPrices],
      escalated: false,
      escalationReason: null,
      packetScore: readiness?.score ?? null,
      packetReady: readiness?.readyToFile ?? null,
    };
  }

  // 6. 5-year timeline gaps.
  if (q.includes("timeline") || q.includes("5-year") || q.includes("5 year") || q.includes("gap") || q.includes("address history") || q.includes("work history")) {
    const gaps = opts.timelineGaps ?? null;
    return {
      ...base,
      intent: "timeline_gaps",
      answer:
        "The 5-year timeline is date arithmetic, not a legal decision: every address " +
        "and every job for the 5 years before filing must be listed with no gaps. " +
        (gaps && gaps.length > 0
          ? `Gaps found: ${gaps.map((g) => g.label).join("; ")}. Close each gap before you submit — the form cannot be submitted with an incomplete timeline.`
          : gaps && gaps.length === 0
            ? "No gaps were supplied with this question — no gaps found in the timeline given."
            : "Open your Smart Forms / questionnaire to check your timeline — any missing months are shown as red alerts. " +
              "Save-and-resume is allowed for drafts; SUBMIT is blocked until every gap is closed.") +
        " If a gap is because you do not remember an address or a date, say so to your preparer — do not guess a date.",
      sources: [SOURCES.uscisForms, SOURCES.platformPrices],
      escalated: false,
      escalationReason: null,
    };
  }

  // 7. Filing help — copilot does NOT file.
  if (
    q.includes("file") || q.includes("submit") || q.includes("e-sign") ||
    q.includes("esign") || q.includes("generate packet") || q.includes("send my case")
  ) {
    return {
      ...base,
      intent: "filing_help",
      answer:
        "I do not file anything, and I will never say “I filed your case” or “your case is submitted.” " +
        "Here is what I can do: explain each field in plain English, check your 5-year timeline for gaps, " +
        "check your packet audit score, and list your missing documents. Then you (or your preparer) generate " +
        "the DRAFT packet via /api/generate-packet — blocked until the audit score is 100%, templates from " +
        "uscis.gov, field mappings unverified — and you review it, E-Sign it, and submit it yourself " +
        "(or via your attorney). Until you do that, your packet is ready for review — nothing has been filed.",
      sources: [SOURCES.uscisForms, SOURCES.platformPrices],
      escalated: false,
      escalationReason: null,
    };
  }

  // 8. Field help.
  if (q.includes("field") || q.includes("how do i fill") || q.includes("how to fill") || q.includes("what do i put") || q.includes("part ") || q.includes("question ")) {
    const code = formCodeIn(q);
    const template = code ? templateForFormCode(code) : null;
    return {
      ...base,
      intent: "field_help",
      answer:
        "Tell me the form and the field (for example: “I-130, Part 2, Question 5”) and I will explain " +
        "what that field is asking for in plain English, and what document it usually comes from. " +
        "I explain fields — I do not decide what answer is correct for your case, and I never fill a field for you. " +
        "If a field asks about your history, your status, or your eligibility, that needs your preparer or a licensed attorney / DOJ-accredited representative. " +
        (template ? `\n\n${checklistSummary(template)}` : ""),
      sources: [SOURCES.uscisForms, SOURCES.platformPrices],
      escalated: false,
      escalationReason: null,
      checklistTemplateId: template?.id ?? null,
      checklistTemplate: template,
    };
  }

  // 8b. News — immigration news and updates inside the chat.
  // From the built-in posts only (src/lib/immigrationNews.ts) —
  // no live feed is connected, and the answer says so. When the
  // client's case forms are supplied, matching items are flagged
  // "This may affect your case".
  if (
    q.includes("news") ||
    q.includes("what changed") ||
    q.includes("has anything changed") ||
    q.includes("immigration update") ||
    q.includes("any updates")
  ) {
    const news = newsForChat(opts.caseForms ?? []);
    const lines = news.flags
      .map(
        (f) =>
          `• ${f.item.title} (${f.item.date}) — ${f.item.summary} Source: ${f.item.sourceLabel} (${f.item.sourceUrl})` +
          (f.affectsYourCase ? `\n  ${f.flagText}` : "")
      )
      .join("\n\n");
    return {
      ...base,
      intent: "news",
      answer:
        (BUILT_IN_NEWS.length > 0
          ? `Immigration news on this platform:\n\n${lines}\n\n`
          : "There are no built-in news posts on this platform right now.\n\n") +
        LIVE_NEWS_FEED_STATUS.note +
        (news.affectingYourCase.length > 0
          ? `\n\n${news.affectingYourCase.length} item(s) above may affect your case — read the flag on each one. A flag means “read this”, not “your case will change”. If a change worries you, ask your preparer or a licensed attorney / DOJ-accredited representative.`
          : ""),
      sources: [
        { label: "travel.state.gov — Visa Bulletin", url: "https://travel.state.gov/content/travel/en/legal/visa-law0/visa-bulletin.html" },
        SOURCES.uscis,
      ],
      escalated: false,
      escalationReason: null,
    };
  }

  // 9. Documents / checklist — wired to the Dynamic Intake Engine +
  // Smart Intake Calculator via templateIdForService / form checklists.
  if (
    q.includes("document") || q.includes("checklist") || q.includes("what do i need") ||
    q.includes("which form") || q.includes("what form") || q.includes("i need form")
  ) {
    const code = formCodeIn(q);
    let template: FormChecklistTemplate | null = code ? templateForFormCode(code) : null;
    if (!template && opts.serviceRequested) {
      const id = templateIdForService(opts.serviceRequested);
      template = id ? getTemplate(id) : null;
    }
    if (template) {
      const fullList = template.checklist
        .map((i) => `• ${i.title}${i.condition ? ` (${i.condition})` : ""}`)
        .join("\n");
      return {
        ...base,
        intent: code ? "documents_checklist" : "form_finder",
        answer:
          `You need ${template.formsIncluded.join(" + ")} — here is the checklist:\n\n` +
          checklistSummary(template) +
          `\n\nFull document list (${template.checklist.length} items):\n${fullList}` +
          "\n\nNext step: gather the items above, then open the Smart Forms / questionnaire to complete them. " +
          "If you are not sure this is the right form for your situation, ask a human — only a licensed attorney or DOJ-accredited representative decides which form fits your case.",
        sources: [SOURCES.uscisForms, SOURCES.platformPrices],
        escalated: false,
        escalationReason: null,
        checklistTemplateId: template.id,
        checklistTemplate: template,
      };
    }
    return {
      ...base,
      intent: "form_finder",
      answer:
        "Tell me what you want to do — for example: “petition for my spouse outside the U.S.” (I-130 + I-864), " +
        "“adjust status inside the U.S.” (I-485), “become a U.S. citizen” (N-400), “work permit” (I-765), " +
        "“TPS” (I-821), “asylum” (I-589 — clerical prep only), or “replace my green card” (I-90) — and I will " +
        "show you the form and its checklist. I can show you which form matches a task and what documents it needs; " +
        "I cannot decide which form is right for your situation — that needs your preparer or a licensed attorney / DOJ-accredited representative.",
      sources: [SOURCES.uscisForms, SOURCES.platformPrices],
      escalated: false,
      escalationReason: null,
    };
  }

  // 10. Next step.
  if (q.includes("next step") || q.includes("what next") || q.includes("what should i do next") || q.includes("what do i do next")) {
    return {
      ...base,
      intent: "next_step",
      answer:
        "Your next step depends on where your case is: (1) If intake is not finished, complete the Smart Forms / questionnaire. " +
        "(2) If documents are missing, upload them from your checklist — the packet audit shows what is still blocking. " +
        "(3) If the audit score is 100%, generate the DRAFT packet for review (see Filing Help — nothing is filed by the copilot). " +
        "(4) If you got a USCIS/NVC letter, ask me to decode it (RFE Decoder). " +
        "If you are unsure, use “Ask a human” below — your assigned professional sees the same checklist and audit score.",
      sources: [SOURCES.uscis, SOURCES.platformPrices],
      escalated: false,
      escalationReason: null,
    };
  }

  // Fallback — honest, sourced, never invented.
  return {
    ...base,
    intent: "general",
    answer:
      "I can help with: which form you need, what documents are needed, what to bring to your interview, " +
      "what a USCIS/NVC notice means (RFE Decoder), how to complete a field on a form, what the fees are (locked prices only), " +
      "the DIY $25 / $99 fee, the Family Adjustment Bundle, which forms are quoted individually (I-526E / I-526 / I-829 / I-693), " +
      "what a word means (glossary), the Form I-912 fee-waiver checklist, immigration news posted here, " +
      "your 5-year timeline gaps, and your packet audit score. " +
      "I do not know the answer to this question from the platform's locked guides — " +
      "I do not know — check uscis.gov (https://www.uscis.gov), ask your preparer, or ask an attorney. " +
      "Use “Ask a human” below to send this question to your assigned professional.",
    sources: [SOURCES.uscis, SOURCES.platformPrices],
    escalated: false,
    escalationReason: null,
  };
}
