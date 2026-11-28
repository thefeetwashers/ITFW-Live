// POST /api/diy/health-check — Free Packet Health Check.
//
// FREE. No paywall, no login, no database, nothing stored, nothing
// logged beyond counts. The client posts their draft answers and the
// checklist items they have cleared; the response is the packet-audit
// score and the fix list (src/lib/diyHealthCheck.ts). The result
// ALWAYS carries unlocksPrint: false — this check never unlocks
// print / save / email. Payment is still required (see
// /api/diy/unlock-status).
//
// Answers are NOT logged and NOT stored: they exist only for the
// duration of this request. Sensitive identifiers (SSN, A-Number,
// passport number) must not be sent here at all — the health check
// does not need them, and the route strips any answer key matching
// the forbidden list (src/lib/diyDrafts.ts) before scoring, so a
// stray sensitive key can never reach a log line.
import { NextResponse } from "next/server";
import { runDiyHealthCheck } from "@/lib/diyHealthCheck";
import { DIY_FORM_CODES } from "@/lib/diy";

function isDiyFormCode(value: string): boolean {
  return DIY_FORM_CODES.includes(value);
}
import { sanitizeDraftAnswers } from "@/lib/diyDrafts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    route: "POST /api/diy/health-check",
    status: "free",
    description:
      "Free Packet Health Check: run the packet audit on a DIY draft BEFORE paying, so the client sees what is wrong or missing first. The check itself is free; print / save / email still require payment.",
    requires: {
      formCode: "DIY form code, e.g. I-130",
      answers: "Draft answers so far: { [questionKey]: value }. Sensitive identifiers (SSN, A-Number, passport number) must NOT be sent — they are stripped before scoring.",
      clearedItemIds: "Optional checklist item ids the client has cleared.",
    },
    guarantees: [
      "unlocksPrint is always false — this check never unlocks print, save or email.",
      "Answers are not stored and not logged.",
      "The score is a checklist score, not legal advice — it does not decide eligibility, relief, evidence strength, or whether it is safe to file.",
    ],
  });
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const formCode = typeof body.formCode === "string" ? body.formCode : "";
  if (!formCode || !isDiyFormCode(formCode)) {
    return NextResponse.json(
      { error: "formCode is required and must be a DIY form code (e.g. I-130, I-485, N-400)." },
      { status: 400 }
    );
  }
  const rawAnswers =
    body.answers && typeof body.answers === "object" && !Array.isArray(body.answers)
      ? (body.answers as Record<string, unknown>)
      : {};
  const stringAnswers: Record<string, string> = {};
  for (const [key, value] of Object.entries(rawAnswers)) {
    if (typeof value === "string") stringAnswers[key] = value;
  }
  // Strip sensitive-identifier keys before scoring. Never logged.
  const sanitized = sanitizeDraftAnswers(stringAnswers);
  const clearedItemIds = Array.isArray(body.clearedItemIds)
    ? (body.clearedItemIds as unknown[]).filter((v): v is string => typeof v === "string")
    : [];

  const result = runDiyHealthCheck({
    formCode,
    answers: sanitized.answers,
    clearedItemIds,
  });
  return NextResponse.json({
    ...result,
    sensitiveKeysStripped: sanitized.strippedKeys.length,
    // Never echo answers back — the client already has them.
  });
}
