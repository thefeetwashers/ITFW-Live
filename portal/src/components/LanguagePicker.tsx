"use client";

import { useState } from "react";
import { LANGUAGES, type LanguageCode } from "@/lib/i18n";

export default function LanguagePicker() {
  const [lang, setLang] = useState<LanguageCode>("en");
  return (
    <label className="flex items-center gap-1 text-xs">
      <span className="sr-only">Language</span>
      <select
        id="language-picker"
        aria-label="Language"
        value={lang}
        onChange={(e) => setLang(e.target.value as LanguageCode)}
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
