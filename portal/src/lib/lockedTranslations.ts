// Seven Languages, Start To Finish — Immigration with NIPTEI
// (Nov 28, 2026). Founder-approved standout feature #2.
//
// WHAT ALREADY EXISTED (reused, not rebuilt):
//   * src/lib/i18n.ts — LANGUAGES: exactly 7 codes (en, es, ht, fr,
//     pt, zh, ar), Arabic RTL. Matches accounts.preferred_language.
//   * src/lib/translate.ts — translateText() (Google Cloud Translation
//     ONLY, NOT connected: always returns { status: "not_configured" }),
//     numbersPreserved(), needsHumanConfirmation(),
//     TRANSLATION_WARNING, TRANSLATION_NOT_CONFIGURED_NOTE.
//   * src/lib/storefront.ts — STOREFRONT_STRINGS: human-written locked
//     template strings in all 7 languages for the storefront UI, plus
//     SPOKEN_LABEL ("I speak …" in each language).
//
// RULES (locked — do not weaken):
//   * Every question, checklist item and letter is shown in the
//     client's own language WITH the English original ALWAYS next to
//     it. The English original is never hidden.
//   * A translation is shown ONLY when it comes from a LOCKED template
//     string already in this codebase (the storefront strings above).
//     There is NO live machine translation in this build — Google
//     Cloud Translation is NOT connected — so no translation is ever
//     made up. Where no locked translation exists for a string, the
//     UI shows English with the note "Translation pending — shown in
//     English" (TRANSLATION_PENDING_NOTE below).
//   * A translation is NEVER presented as verified. Uncertain
//     translations are flagged, and a human must confirm before anyone
//     acts on a quote, contract, price, or deadline (see
//     translate.ts needsHumanConfirmation + TRANSLATION_WARNING).
//   * Numbers / dates / prices are NEVER altered by a translation.
//     A locked translation that drops a digit sequence from the
//     original is flagged uncertain (numbersPreserved()).
//   * Arabic renders RTL (dir="rtl", lang="ar").
//   * Translation never decides relief / eligibility / evidence
//     strength / safe-to-leave (translate.ts TRANSLATION_NEVER_DECIDES).
import { LANGUAGES, type LanguageCode } from "./i18n";
import {
  isRtl,
  needsHumanConfirmation,
  numbersPreserved,
  translateText,
  TRANSLATION_NOT_CONFIGURED_NOTE,
  TRANSLATION_WARNING,
} from "./translate";
import { STOREFRONT_STRINGS, type StorefrontStringKey } from "./storefront";

export { LANGUAGES, isRtl, TRANSLATION_NOT_CONFIGURED_NOTE, TRANSLATION_WARNING };
export type { LanguageCode };

/** The 7 supported languages, in the same order as src/lib/i18n.ts. */
export const SEVEN_LANGUAGES = LANGUAGES;

/** Shown (in English) whenever a string has no locked translation in
 *  the client's language. The English text is shown next to it. */
export const TRANSLATION_PENDING_NOTE =
  "Translation pending — shown in English";

/** A locked translation is one of the human-written template strings
 *  already in this codebase. New keys may ONLY be added here with a
 *  human-written translation in every language — never a machine
 *  translation pasted in as if it were verified. */
export type LockedStringKey = StorefrontStringKey;

/** Look up a locked translation. Returns null when the key has no
 *  locked string in that language (every key in STOREFRONT_STRINGS
 *  has all 7 — null only ever means "unknown key"). */
export function lockedTranslation(
  key: LockedStringKey,
  lang: LanguageCode
): string | null {
  const row = STOREFRONT_STRINGS[key];
  if (!row) return null;
  return row[lang] ?? null;
}

export type BilingualStatus = "locked" | "pending";

/** One piece of text rendered bilingually: the English original is
 *  ALWAYS present, next to the client's language where a locked
 *  translation exists. */
export interface BilingualText {
  /** The English original — always shown. */
  english: string;
  /** The locked translation, or null when none exists yet. */
  translated: string | null;
  /** Client's language. */
  language: LanguageCode;
  /** "locked" = a human-written template string; "pending" = English
   *  shown with TRANSLATION_PENDING_NOTE. Never "machine". */
  status: BilingualStatus;
  /** True for Arabic — render with dir="rtl". */
  rtl: boolean;
  /** True when the text is a quote / contract / price / deadline or
   *  contains a number: a human must confirm before anyone acts on it. */
  needsHumanConfirmation: boolean;
  /** True when a locked translation exists but a digit sequence from
   *  the original did not survive into it — flagged uncertain. Null
   *  when there is no translation or no digits to check. */
  numbersPreserved: boolean | null;
  /** Note shown under the text: the pending note, or the human-
   *  confirmation warning, or null. */
  note: string | null;
}

/**
 * Render one string bilingually.
 *
 *   - lang "en": the original, status "locked".
 *   - lockedKey given AND a locked string exists in `lang`: that
 *     string, status "locked", with numbersPreserved() checked.
 *   - otherwise: English + TRANSLATION_PENDING_NOTE, status "pending".
 *
 * Live translation is NOT attempted here: translateText() returns
 * "not_configured" in this build, and this function never substitutes
 * a machine result for a locked string.
 */
export function toBilingual(args: {
  english: string;
  lockedKey?: LockedStringKey;
  lang: LanguageCode;
}): BilingualText {
  const { english, lockedKey, lang } = args;
  const human = needsHumanConfirmation(english);
  if (lang === "en") {
    return {
      english,
      translated: english,
      language: lang,
      status: "locked",
      rtl: false,
      needsHumanConfirmation: human,
      numbersPreserved: null,
      note: human ? TRANSLATION_WARNING : null,
    };
  }
  const translated =
    lockedKey !== undefined ? lockedTranslation(lockedKey, lang) : null;
  if (translated !== null) {
    const preserved = numbersPreserved(english, translated);
    return {
      english,
      translated,
      language: lang,
      status: "locked",
      rtl: isRtl(lang),
      needsHumanConfirmation: human,
      numbersPreserved: preserved,
      note:
        preserved === false
          ? "Uncertain translation — a number from the English original does not appear in the translation. Ask a human to confirm it before you act on it."
          : human
            ? TRANSLATION_WARNING
            : null,
    };
  }
  return {
    english,
    translated: null,
    language: lang,
    status: "pending",
    rtl: isRtl(lang),
    needsHumanConfirmation: human,
    numbersPreserved: null,
    note: TRANSLATION_PENDING_NOTE,
  };
}

/** One checklist / question / letter line, rendered bilingually. */
export interface BilingualLine {
  id: string;
  text: BilingualText;
}

export function bilingualLine(
  id: string,
  english: string,
  lockedKey: LockedStringKey | undefined,
  lang: LanguageCode
): BilingualLine {
  return { id, text: toBilingual({ english, lockedKey, lang }) };
}

/** Render a whole list (checklist, questions, letter paragraphs) in
 *  the client's language. Items without a lockedKey are English +
 *  pending note — never silently left untranslated, never faked. */
export function bilingualList(
  items: { id: string; english: string; lockedKey?: LockedStringKey }[],
  lang: LanguageCode
): BilingualLine[] {
  return items.map((item) =>
    bilingualLine(item.id, item.english, item.lockedKey, lang)
  );
}

/** True when every line in the list has a locked translation (none
 *  pending). A page can show this as "Fully translated" only when this
 *  is true; otherwise it must say how many lines are still pending. */
export function countPendingTranslations(lines: BilingualLine[]): number {
  return lines.filter((l) => l.text.status === "pending").length;
}

/**
 * Live translation is NOT available in this build. This is the honest
 * check pages use before offering a "translate" button: it always
 * reports not_configured, so the UI shows the original with the
 * not-configured note instead of a fake translation.
 */
export function liveTranslationStatus(): {
  status: "not_configured";
  note: string;
} {
  const probe = translateText({ text: "probe", from: "en", to: "es" });
  void probe;
  return { status: "not_configured", note: TRANSLATION_NOT_CONFIGURED_NOTE };
}
