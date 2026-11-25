import { NextResponse } from "next/server";
import {
  TRANSLATION_NOT_CONFIGURED_NOTE,
  needsHumanConfirmation,
  type LanguageCode,
} from "@/lib/translate";

// POST /api/translate — Google Cloud Translation, NOT connected.
// Env name only: GOOGLE_TRANSLATE_API_KEY. No Google Cloud client
// library is installed, so this route ALWAYS returns 501 with the
// original text and a "translation not configured" label — it NEVER
// returns a fake translation. When the key is set AND a client is
// installed, a future change may return a real translation; it must
// still run the numbers-preserved check (lib/translate.ts) and flag
// human confirmation for quotes/contracts/prices/deadlines.
export async function POST(req: Request) {
  let body: { text?: unknown; from?: unknown; to?: unknown } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const text = typeof body.text === "string" ? body.text : "";
  const from = (typeof body.from === "string" ? body.from : "en") as LanguageCode;
  const to = (typeof body.to === "string" ? body.to : "en") as LanguageCode;
  if (!text.trim()) {
    return NextResponse.json({ error: "text is required." }, { status: 400 });
  }
  const keySet = Boolean(process.env.GOOGLE_TRANSLATE_API_KEY);
  return NextResponse.json(
    {
      status: "not_configured",
      error: keySet
        ? "Translation not configured — GOOGLE_TRANSLATE_API_KEY is set, but no Google Cloud Translation client is installed, so no translation was made. Showing the original text, untranslated."
        : "translation not configured",
      note: TRANSLATION_NOT_CONFIGURED_NOTE,
      originalText: text,
      originalLanguage: from,
      translatedText: null,
      targetLanguage: to,
      needsHumanConfirmation: needsHumanConfirmation(text),
    },
    { status: 501 }
  );
}

export async function GET() {
  return NextResponse.json({
    status: "not_configured",
    provider: "Google Cloud Translation",
    envVar: "GOOGLE_TRANSLATE_API_KEY",
    configured: Boolean(process.env.GOOGLE_TRANSLATE_API_KEY),
    languages: ["en", "es", "ht", "fr", "pt", "zh", "ar"],
    note: TRANSLATION_NOT_CONFIGURED_NOTE,
  });
}
