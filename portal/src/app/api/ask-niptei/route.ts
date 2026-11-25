// POST /api/ask-niptei — Ask NIPTEI Copilot.
// GET  /api/ask-niptei — AI configuration status.
//
// AI STATUS — NOT CONNECTED in this build:
//  * Platform default is OpenRouter, env name only:
//    OPENROUTER_API_KEY. No OpenRouter client is installed and no
//    live call is made, so this route ALWAYS returns 501
//    "AI not configured" — even if the env var happens to be set.
//  * The 501 body still carries a helpful NON-AI answer from the
//    locked FAQ / form guides (src/lib/askNiptei.ts), with a source
//    cited and the not-legal-advice label on it. It NEVER returns
//    a fake AI answer.
//  * Google Translate is NOT connected either — the English version
//    of a non-English question is null (original shown as typed).
//  * Escalations (legal-decision questions) are logged in the
//    response as a copilot_escalation entry (persisted: false in
//    this build — no Supabase; persist to audit_log when live).
//  * No key or secret is ever read, logged, or returned here —
//    only Boolean(process.env.OPENROUTER_API_KEY).
import { NextResponse } from "next/server";
import {
  answerCopilot,
  buildCopilotEscalationLogEntry,
  type LanguageCode,
} from "@/lib/askNiptei";
import type { AuditItem } from "@/lib/audit";
import type { TimelineGap } from "@/lib/validator";
import { PLATFORM_COPILOT_ENV_VAR } from "@/lib/copilotByo";
import { LANGUAGES } from "@/lib/i18n";

const LANG_CODES: Set<string> = new Set(LANGUAGES.map((l) => l.code));

export async function GET() {
  return NextResponse.json(
    {
      status: "not_configured",
      provider: "OpenRouter",
      envVar: PLATFORM_COPILOT_ENV_VAR,
      configured: false,
      envKeyPresent: Boolean(process.env.OPENROUTER_API_KEY),
      model: null,
      note: "AI not configured — OpenRouter is NOT connected (env name only: OPENROUTER_API_KEY, no client installed, no live call made). The copilot answers from the locked FAQ / form guides instead and never returns a fake AI answer. Google Translate is NOT connected either.",
      languages: Array.from(LANG_CODES),
    },
    { status: 501 }
  );
}

export async function POST(req: Request) {
  let body: {
    question?: unknown;
    language?: unknown;
    serviceRequested?: unknown;
    auditItems?: unknown;
    timelineGaps?: unknown;
  } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const question = typeof body.question === "string" ? body.question.trim() : "";
  if (!question) {
    return NextResponse.json({ error: "question is required." }, { status: 400 });
  }
  const language = (
    typeof body.language === "string" && LANG_CODES.has(body.language)
      ? body.language
      : "en"
  ) as LanguageCode;

  const answer = answerCopilot(question, {
    language,
    auditItems: Array.isArray(body.auditItems)
      ? (body.auditItems as AuditItem[])
      : undefined,
    timelineGaps: Array.isArray(body.timelineGaps)
      ? (body.timelineGaps as TimelineGap[])
      : undefined,
    serviceRequested:
      typeof body.serviceRequested === "string"
        ? (body.serviceRequested as NonNullable<Parameters<typeof answerCopilot>[1]>["serviceRequested"])
        : undefined,
  });
  const escalation = answer.escalated
    ? buildCopilotEscalationLogEntry(answer)
    : null;

  // 501 by design: AI is not configured. The body still carries the
  // non-AI FAQ answer, its sources, the disclaimer, and (when
  // applicable) the escalation log entry. Clients treat 501 + body
  // as a normal answer, not an error.
  return NextResponse.json(
    {
      status: "not_configured",
      error: "AI not configured",
      provider: "OpenRouter",
      envVar: PLATFORM_COPILOT_ENV_VAR,
      configured: false,
      envKeyPresent: Boolean(process.env.OPENROUTER_API_KEY),
      model: null,
      note: "AI not configured — this is a non-AI answer from the locked FAQ / form guides, not a generated AI answer. No AI provider was called.",
      answer,
      escalationLogged: escalation,
    },
    { status: 501 }
  );
}
