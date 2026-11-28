// /safety/privacy — plain-language privacy page for clients.
// Client component: the language picker switches the page language;
// for every language other than English the locked "Translation
// pending — shown in English" note is shown, because no locked
// (human-written) translation exists for this content yet
// (src/lib/lockedTranslations.ts). English original always shown.
// Arabic renders RTL. Sensitive page: Quick Exit pinned top-right.
"use client";

import { useState } from "react";
import Link from "next/link";
import { LANGUAGES, type LanguageCode } from "@/lib/i18n";
import {
  PLATFORM_CONTACT_EMAIL,
  PLATFORM_CONTACT_PHONE,
  PRIVACY_DISCLAIMER,
  PRIVACY_SECTIONS,
  isSafetyRtl,
  safetyTranslationNote,
} from "@/lib/safety";
import QuickExitButton from "@/components/safety/QuickExitButton";

export default function PrivacyPage() {
  const [lang, setLang] = useState<LanguageCode>("en");
  const pendingNote = safetyTranslationNote(lang);

  return (
    <main className="mx-auto max-w-4xl px-4 py-8" lang={lang} dir={isSafetyRtl(lang) ? "rtl" : "ltr"}>
      <QuickExitButton variant="fixed" />
      <header>
        <h1 className="text-2xl font-bold">Your privacy — in plain language</h1>
        <p className="mt-1 text-sm text-slate-600">{PRIVACY_DISCLAIMER}</p>
        <p className="mt-2 text-sm text-slate-600">
          If someone is watching your screen, use Quick Exit (top right,
          or press Escape) to leave this page at once.
        </p>
      </header>

      <div className="no-print mt-4 flex flex-wrap items-center gap-2">
        <label htmlFor="privacy-language" className="text-sm font-semibold text-slate-900">
          Language
        </label>
        <select
          id="privacy-language"
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

      {PRIVACY_SECTIONS.map((section) => (
        <section
          key={section.id}
          aria-labelledby={`privacy-${section.id}`}
          className="mt-6 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
        >
          <h2 id={`privacy-${section.id}`} className="text-lg font-semibold text-slate-900">
            {section.heading}
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
            {section.body.map((line) => (
              <li key={line.slice(0, 40)}>{line}</li>
            ))}
          </ul>
        </section>
      ))}

      <p className="mt-6 text-sm text-slate-600">
        Questions about your data? Write to{" "}
        <a href={`mailto:${PLATFORM_CONTACT_EMAIL}`} className="font-semibold text-blue-700 underline">
          {PLATFORM_CONTACT_EMAIL}
        </a>{" "}
        or call {PLATFORM_CONTACT_PHONE}.
      </p>

      <footer className="no-print mt-8 text-xs text-slate-500">
        <Link href="/safety" className="text-blue-600 underline">
          ← Back to the Safety hub
        </Link>
      </footer>
    </main>
  );
}
