// Immigration-scam guide — plain language, English original always
// shown. Client component: the language picker switches the page
// language; for every language other than English the locked
// "Translation pending — shown in English" note is shown next to the
// English text, because no locked (human-written) translation exists
// for this content yet (src/lib/lockedTranslations.ts). No
// translation is ever invented or machine-translated here.
//
// Accessibility: native <button>/<a>/<select> only (keyboard
// navigable by default); every control labelled; colours use the
// existing design tokens (slate-900 text on white, blue-700 links,
// red-700 Quick Exit) already used across the portal; Arabic renders
// RTL (dir="rtl" lang="ar" on the content wrapper when ar is picked).
"use client";

import { useState } from "react";
import { LANGUAGES, type LanguageCode } from "@/lib/i18n";
import {
  FTC_REPORT_FRAUD_URL,
  SCAM_DISCLAIMER,
  SCAM_RED_FLAGS,
  SCAM_REPORT_STEPS,
  USCIS_AVOID_SCAMS_URL,
  isSafetyRtl,
  safetyTranslationNote,
} from "@/lib/safety";

export default function ScamGuideSection() {
  const [lang, setLang] = useState<LanguageCode>("en");
  const pendingNote = safetyTranslationNote(lang);

  return (
    <div lang={lang} dir={isSafetyRtl(lang) ? "rtl" : "ltr"}>
      <div className="no-print mt-4 flex flex-wrap items-center gap-2">
        <label htmlFor="scam-guide-language" className="text-sm font-semibold text-slate-900">
          Language
        </label>
        <select
          id="scam-guide-language"
          aria-label="Language"
          value={lang}
          onChange={(e) => setLang(e.target.value as LanguageCode)}
          className="rounded border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900"
        >
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.native}
            </option>
          ))}
        </select>
        {pendingNote ? (
          <p className="text-sm text-slate-600" role="note">
            {pendingNote}
          </p>
        ) : null}
      </div>

      <p className="mt-4 text-sm text-slate-600">{SCAM_DISCLAIMER}</p>

      <h2 className="mt-6 text-lg font-semibold text-slate-900">
        Six scams to watch for
      </h2>
      <ul className="mt-2 space-y-4">
        {SCAM_RED_FLAGS.map((flag) => (
          <li key={flag.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-base font-semibold text-slate-900">{flag.title}</h3>
            <p className="mt-2 text-sm text-slate-700">
              <span className="font-semibold">What it looks like: </span>
              {flag.whatItLooksLike}
            </p>
            <p className="mt-2 text-sm text-slate-700">
              <span className="font-semibold">What to do: </span>
              {flag.whatToDo}
            </p>
          </li>
        ))}
      </ul>

      <h2 className="mt-6 text-lg font-semibold text-slate-900">
        If it already happened — what to do
      </h2>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-700">
        {SCAM_REPORT_STEPS.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>

      <h2 className="mt-6 text-lg font-semibold text-slate-900">
        Where to report it
      </h2>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
        <li>
          <a
            href={FTC_REPORT_FRAUD_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-blue-700 underline"
          >
            ReportFraud.ftc.gov ↗
          </a>{" "}
          — report the scam to the Federal Trade Commission (online; no phone number is given here because the FTC takes these reports online).
        </li>
        <li>
          <a
            href={USCIS_AVOID_SCAMS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-blue-700 underline"
          >
            uscis.gov/avoid-scams ↗
          </a>{" "}
          — how USCIS really contacts people, and how to tell USCIS about a scam. No USCIS tip-line phone number is shown here: no such number is locked in this codebase, and inventing one would put a wrong number in front of a vulnerable client.
        </li>
      </ul>
      <p className="mt-3 text-sm text-slate-600">
        No one on this platform can promise you an approval or a faster
        decision, and no payment to a private person makes USCIS decide
        faster. Only USCIS (or the consulate, for a visa abroad) decides
        your case.
      </p>
    </div>
  );
}
