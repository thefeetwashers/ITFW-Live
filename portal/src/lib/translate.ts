// Auto-translation — Immigration with NIPTEI (Unified Comms layer, Nov 19, 2026)
//
// LOCKED RULES (founder / task brief — do not weaken):
//  * Exactly 7 languages: en, es, ht (Kreyòl Ayisyen), fr, pt, zh, ar.
//    Arabic is RTL. Language codes match accounts.preferred_language
//    (migration 0001) and src/lib/i18n.ts LANGUAGES.
//  * ALWAYS show the ORIGINAL text alongside the translation.
//  * NEVER alter numbers / dates / prices in a translation. This file
//    checks that every digit sequence in the original survives in the
//    translation (numbersPreserved) — a translation that drops or
//    changes a number is flagged uncertain.
//  * Flag uncertain translations; require HUMAN confirmation before
//    anyone acts on a quote, contract, price, or deadline.
//  * NEVER use translation to decide relief / eligibility / evidence
//    strength / safe-to-leave. Translation is a communication aid only.
//  * Provider: Google Cloud Translation ONLY. Env name ONLY:
//    GOOGLE_TRANSLATE_API_KEY. It is NOT connected in this build and no
//    Google Cloud client library is installed, so translateText()
//    ALWAYS returns { status: "not_configured" } and the UI shows the
//    original untranslated text with a label — NEVER a fake translation.
//    POST /api/translate enforces the same rule server-side (501).
import type { LanguageCode } from "./i18n";

export { LANGUAGES } from "./i18n";
export type { LanguageCode } from "./i18n";

/** Arabic is the only RTL language of the 7. */
export function isRtl(code: LanguageCode): boolean {
  return code === "ar";
}

export const TRANSLATION_WARNING =
  "Translation is automatic — check numbers and dates. Never act on a quote, contract, price, or deadline from a translation alone; ask a human to confirm it.";

export const TRANSLATION_NOT_CONFIGURED_NOTE =
  "Translation not configured — Google Cloud Translation is not connected (GOOGLE_TRANSLATE_API_KEY is not set). Showing the original text, untranslated. No translation was made up.";

export type TranslationStatus = "not_configured" | "translated" | "uncertain";

export interface TranslationResult {
  status: TranslationStatus;
  /** The original text, always returned verbatim. */
  originalText: string;
  originalLanguage: LanguageCode;
  /** Null until a real provider translates it — never a fake translation. */
  translatedText: string | null;
  targetLanguage: LanguageCode;
  /** True when the text contains a number, date, price, quote, contract
   *  or deadline word: a human must confirm before anyone acts on it. */
  needsHumanConfirmation: boolean;
  /** True when a real translation is present but a digit sequence from
   *  the original did not survive into it. */
  numbersPreserved: boolean | null;
  note: string;
}

/** Digit / date / price sequences in a string, in order. Used to prove a
 *  translation did not alter a number, date, or price. */
export function digitSequences(text: string): string[] {
  return text.match(/\d+(?:[.,]\d+)*/g) ?? [];
}

/** True when every digit sequence in `original` also appears in
 *  `translated`, in the same order. Null when there are no digits. */
export function numbersPreserved(
  original: string,
  translated: string
): boolean | null {
  const from = digitSequences(original);
  if (from.length === 0) return null;
  const to = digitSequences(translated);
  return from.every((d, i) => to[i] === d);
}

const HUMAN_CONFIRM_PATTERN =
  /\$|€|£|price|pricing|quote|contract|deadline|due date|pay|payment|fee|\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b|january|february|march|april|may|june|july|august|september|october|november|december/i;

/** True when the text is the kind a human must confirm before anyone
 *  acts on it (quote / contract / price / deadline / any number). */
export function needsHumanConfirmation(text: string): boolean {
  return HUMAN_CONFIRM_PATTERN.test(text) || digitSequences(text).length > 0;
}

/**
 * Translate `text` from `from` to `to`.
 *
 * NOT CONNECTED in this build: there is no Google Cloud Translation
 * client installed and GOOGLE_TRANSLATE_API_KEY is not set, so this
 * always returns status "not_configured" with translatedText null.
 * Callers MUST render originalText with TRANSLATION_NOT_CONFIGURED_NOTE.
 * When the key is set AND a client is installed, a future change may
 * return a real translation — it must still run numbersPreserved() and
 * set needsHumanConfirmation() before rendering.
 */
export function translateText(args: {
  text: string;
  from: LanguageCode;
  to: LanguageCode;
}): TranslationResult {
  const { text, from, to } = args;
  void process.env.GOOGLE_TRANSLATE_API_KEY; // env name only — never logged, never sent anywhere
  return {
    status: "not_configured",
    originalText: text,
    originalLanguage: from,
    translatedText: null,
    targetLanguage: to,
    needsHumanConfirmation: needsHumanConfirmation(text),
    numbersPreserved: null,
    note: TRANSLATION_NOT_CONFIGURED_NOTE,
  };
}

/** Guardrail constant: translation must never decide these. */
export const TRANSLATION_NEVER_DECIDES = [
  "relief",
  "eligibility",
  "evidence strength",
  "safe to leave the United States",
] as const;
