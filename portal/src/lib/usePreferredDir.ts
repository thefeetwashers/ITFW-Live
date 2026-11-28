// Preferred-language direction (full-stack expert sweep, Nov 28, 2026).
//
// Gap found: LanguagePicker kept its choice in local component state
// only — picking Arabic changed nothing on the page, and no new page
// (DIY flow, pipeline, /today, Journey Map) set dir="rtl" for Arabic.
// Arabic is the only RTL language of the 7 (src/lib/translate.ts
// isRtl). This hook + storage key is the single source of truth:
//   * LanguagePicker writes the choice here and applies it to
//     document.documentElement (dir + lang) immediately.
//   * Any client page reads it with usePreferredDir() and sets dir on
//     its own root element, so RTL is respected per page without a
//     global restyle (the root layout stays lang="en" until the
//     founder asks for a full i18n pass).
//   * The choice persists in localStorage; a "storage" event keeps
//     other tabs in sync. Server components cannot read localStorage,
//     so pages that are server-rendered (Journey) use the <DirRoot>
//     client wrapper instead.

"use client";

import { useEffect, useState } from "react";
import { isRtl, type LanguageCode } from "@/lib/translate";

export const LANGUAGE_STORAGE_KEY = "niptei-language";

export function readStoredLanguage(): LanguageCode {
  if (typeof window === "undefined") return "en";
  try {
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (
      stored === "en" ||
      stored === "es" ||
      stored === "fr" ||
      stored === "ht" ||
      stored === "pt" ||
      stored === "ar" ||
      stored === "zh"
    ) {
      return stored;
    }
  } catch {
    // Storage unavailable (private mode) — fall back to English.
  }
  return "en";
}

export function applyLanguageToDocument(lang: LanguageCode): void {
  if (typeof document === "undefined") return;
  document.documentElement.lang = lang;
  document.documentElement.dir = isRtl(lang) ? "rtl" : "ltr";
}

export function usePreferredDir(): "rtl" | "ltr" {
  const [dir, setDir] = useState<"rtl" | "ltr">("ltr");
  useEffect(() => {
    const update = () => setDir(isRtl(readStoredLanguage()) ? "rtl" : "ltr");
    update();
    window.addEventListener("storage", update);
    window.addEventListener("niptei-language-change", update);
    return () => {
      window.removeEventListener("storage", update);
      window.removeEventListener("niptei-language-change", update);
    };
  }, []);
  return dir;
}
