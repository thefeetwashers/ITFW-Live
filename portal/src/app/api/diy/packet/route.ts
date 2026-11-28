// POST /api/diy/packet — the server-side gate for DIY print / save.
//
// Body: { caseId: string (cases.id, UUID), formCode: string,
//         editions?: { [formCode]: string } }
//
//   1. The caller is resolved from their Bearer token (never from
//      an account id in the body).
//   2. The DIY pay gate runs FIRST (src/lib/diy.ts): unpaid → 402
//      DIY_NOT_PAID, before /api/generate-packet is ever called.
//      Hiding the download button in the UI is NOT the gate —
//      this check is.
//   3. Only then is the EXISTING /api/generate-packet route called
//      (same handler, same request shape the intake engine uses).
//      Its own gates still apply and are passed through honestly:
//      audit not 100% → 409, balance due / no service order → 402,
//      missing USCIS template → 404 (never silently skipped, never
//      an invented template). A DIY-only payment does NOT create a
//      service order, so a DIY case with no service order still gets
//      generate-packet's honest 402 — see portal/docs/diy-flow.md
//      §"Known gaps". The DIY gate and the packet gate are two
//      separate gates and both must pass.
//
// Response (200): the generate-packet JSON — status "draft",
// signedUrl (24h), pageCount, unfilledFields, audit score.
// Nothing here files anything with USCIS.
import { NextResponse } from "next/server";
import { POST as generatePacketPost } from "../../generate-packet/route";
import { DIY_FORM_CODES, getDiyUnlockForCase, resolveDiyCaller } from "@/lib/diy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const caseId = typeof body.caseId === "string" ? body.caseId : "";
  const formCode = typeof body.formCode === "string" ? body.formCode : "";
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
    return NextResponse.json({ error: caller.error }, { status: caller.status });
  }

  // Gate 1 — DIY pay gate (server-side, database-backed). Unpaid
  // callers never reach the packet route.
  const unlock = await getDiyUnlockForCase(caller.accountId, caseId, formCode);
  if (!unlock.configured) {
    return NextResponse.json(
      { error: unlock.reason, code: "diy_not_configured" },
      { status: 501 }
    );
  }
  if (!unlock.unlocked) {
    return NextResponse.json(
      {
        error:
          "Print, save and email are locked until your DIY payment is confirmed in our records. " +
          unlock.reason,
        code: "diy_not_paid",
        formCode,
      },
      { status: 402 }
    );
  }

  // Gate 2 — the existing packet route (audit 100%, balance paid,
  // official USCIS template present). Its result/error passes
  // through unchanged — never rewritten into a success.
  const editions =
    body.editions && typeof body.editions === "object" && !Array.isArray(body.editions)
      ? (body.editions as Record<string, unknown>)
      : {};
  const packetReq = new Request("http://localhost/api/generate-packet", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      caseId,
      formCodes: [formCode],
      editions,
      actorId: caller.accountId,
      actorRole: "client",
    }),
  });
  return generatePacketPost(packetReq);
}
