// GET /api/diy/unlock-status?caseId=<uuid>&formCode=<form>
//
// Server-side DIY pay-gate check: is print / save / email unlocked
// for this caller + case + form? The decision comes from
// src/lib/diy.ts (paid invoices / payment_plans / diy_unlocks in the
// database) — never from a client claim. Also returns the caller's
// account id + email (resolved server-side) so the DIY page can pass
// them to Stripe Checkout — the webhook records no invoice row
// without case_id + account_id in the Checkout Session metadata.
//
// Responses:
//   200 { allowed, reason, unlockedBy, configured, accountId, callerEmail, caseId, formCode }
//   401 no / invalid token — sign in first (access denied)
//   403 no Immigration account for this login, or case belongs to someone else
//   501 Supabase not configured — access denied, fail closed
//   400 missing / invalid caseId or unknown formCode
import { NextResponse } from "next/server";
import { getDiyUnlockForCase, resolveDiyCaller, DIY_FORM_CODES } from "@/lib/diy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const caseId = params.get("caseId") ?? "";
  const formCode = params.get("formCode") ?? "";
  if (!caseId || !UUID_RE.test(caseId)) {
    return NextResponse.json(
      { error: "caseId is required and must be a valid UUID (cases.id)." },
      { status: 400 }
    );
  }
  if (!formCode || !DIY_FORM_CODES.includes(formCode)) {
    return NextResponse.json(
      {
        error: `Unknown formCode "${formCode}". Use one of: ${DIY_FORM_CODES.join(", ")}.`,
      },
      { status: 400 }
    );
  }

  const caller = await resolveDiyCaller(req);
  if (!caller.ok) {
    return NextResponse.json({ error: caller.error, allowed: false }, { status: caller.status });
  }

  const result = await getDiyUnlockForCase(caller.accountId, caseId, formCode);
  return NextResponse.json({
    allowed: result.unlocked,
    reason: result.reason,
    unlockedBy: result.unlockedBy,
    configured: result.configured,
    accountId: result.accountId,
    callerEmail: result.callerEmail,
    caseId: result.caseId,
    formCode: result.formCode,
    prices: {
      diyForm: "DIY $25/form (locked Price price_1UfS5APfd9SRUcvh47Ks9Lw0)",
      diyBundle: "DIY Bundle $99 (locked Price price_1UfS5iPfd9SRUcvhKEQxf0pj)",
    },
  });
}
