// GET /api/diy/after-filing — "What happens after you file" timeline.
//
// Free, no login, no database. Per-form typical process steps from
// the codebase (src/lib/diyAfterFiling.ts). Every step is labelled as
// the typical process — never a promised date or outcome.
// ?formCode=I-130
import { NextResponse } from "next/server";
import { diyAfterFilingTimeline } from "@/lib/diyAfterFiling";
import { DIY_FORM_CODES } from "@/lib/diy";

function isDiyFormCode(value: string): boolean {
  return DIY_FORM_CODES.includes(value);
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const formCode = params.get("formCode") ?? "";
  if (!formCode || !isDiyFormCode(formCode)) {
    return NextResponse.json(
      { error: "formCode query param is required and must be a DIY form code (e.g. I-130, I-485, N-400)." },
      { status: 400 }
    );
  }
  return NextResponse.json(diyAfterFilingTimeline(formCode));
}
