// GET /api/diy/fee-breakdown — DIY fee calculator, shown BEFORE pay.
//
// Free, no login, no database. Our fee and USCIS government fees are
// shown on SEPARATE lines and are never combined into one total (see
// src/lib/diyFees.ts — the result has no combined-total field).
// ?formCode=I-130&bundle=true prices the DIY Bundle ($99) instead of
// the per-form DIY price ($25).
import { NextResponse } from "next/server";
import { diyBundleComparison, diyFeeBreakdown } from "@/lib/diyFees";
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
  const bundle = params.get("bundle") === "true";
  const breakdown = diyFeeBreakdown(formCode, { bundle });
  const formCount = Math.max(1, Number(params.get("formCount") ?? "1") || 1);
  return NextResponse.json({
    ...breakdown,
    bundleComparison: diyBundleComparison(formCount),
  });
}
