"use client";

import { useEffect, useState } from "react";
import { LANGUAGES, type LanguageCode } from "@/lib/i18n";
import {
  LANGUAGE_STORAGE_KEY,
  applyLanguageToDocument,
  readStoredLanguage,
} from "@/lib/usePreferredDir";

export default function LanguagePicker() {
  const [lang, setLang] = useState<LanguageCode>("en");
  useEffect(() => {
    const stored = readStoredLanguage();
    setLang(stored);
    applyLanguageToDocument(stored);
  }, []);
  const pick = (next: LanguageCode) => {
    setLang(next);
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
    } catch {
      // Storage unavailable — the in-memory choice still applies.
    }
    applyLanguageToDocument(next);
    window.dispatchEvent(new Event("niptei-language-change"));
  };
  return (
    <label className="flex items-center gap-1 text-xs">
      <span className="sr-only">Language</span>
      <select
        id="language-picker"
        aria-label="Language"
        value={lang}
        onChange={(e) => pick(e.target.value as LanguageCode)}
        className="max-w-[7rem] truncate rounded border border-slate-300 bg-white px-2 py-1 text-xs sm:max-w-none"
      >
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.native}
          </option>
        ))}
      </select>
    </label>
  );
}
