// POST /api/diy/email-packet — email the completed DIY application
// to the client's own email address.
//
// Body: { caseId: string (cases.id, UUID), formCode: string }
//
//   1. The caller is resolved from their Bearer token (never from
//      an account id in the body), and the case must belong to them.
//   2. The DIY pay gate runs FIRST (src/lib/diy.ts): unpaid → 402
//      DIY_NOT_PAID. Email is never sent to an unpaid caller.
//   3. The completed packet is fetched from the EXISTING
//      /api/generate-packet route (same handler). Its gates still
//      apply: audit not 100% → 409, balance due / no service order
//      → 402, missing USCIS template → 404. Those errors are passed
//      through honestly — no email is sent when there is no packet.
//   4. The email goes ONLY to the email on the caller's Immigration
//      account (read server-side from public.accounts), via AWS SES
//      (src/lib/email.ts). The PDF itself is NOT attached — SES
//      SendEmail has no attachment support in this codebase — the
//      email carries the packet's signed download link (valid 24
//      hours), which is what /api/generate-packet returns. When SES
//      is not configured the route returns 501/not_configured and
//      never claims the email was sent.
//
// No DOB, A-Number, SSN or passport number is ever in the subject
// line (or the body). No money amounts in the subject line.
import { NextResponse } from "next/server";
import { POST as generatePacketPost } from "../../generate-packet/route";
import { DIY_FORM_CODES, getDiyUnlockForCase, resolveDiyCaller } from "@/lib/diy";
import { isEmailConfigured, sendEmail } from "@/lib/email";

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
  if (!caller.email) {
    return NextResponse.json(
      { error: "No email address is on file for this account, so the packet cannot be emailed. Add an email to your account first." },
      { status: 400 }
    );
  }

  // Gate 1 — DIY pay gate (server-side, database-backed).
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
          "Email is locked until your DIY payment is confirmed in our records. " +
          unlock.reason,
        code: "diy_not_paid",
        formCode,
      },
      { status: 402 }
    );
  }

  // Gate 2 — the existing packet route. No packet, no email.
  const packetReq = new Request("http://localhost/api/generate-packet", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      caseId,
      formCodes: [formCode],
      actorId: caller.accountId,
      actorRole: "client",
    }),
  });
  const packetRes = await generatePacketPost(packetReq);
  let packetData: Record<string, unknown> | null = null;
  try {
    packetData = (await packetRes.json()) as Record<string, unknown>;
  } catch {
    packetData = null;
  }
  if (!packetRes.ok || !packetData) {
    // Pass the packet route's honest error through — never claim
    // an email was sent when there is no packet.
    return NextResponse.json(
      packetData ?? { error: `Packet could not be generated (HTTP ${packetRes.status}). No email was sent.` },
      { status: packetRes.status }
    );
  }
  const signedUrl =
    typeof packetData.signedUrl === "string" ? packetData.signedUrl : null;
  if (!signedUrl) {
    return NextResponse.json(
      { error: "Packet generation returned no download link. No email was sent." },
      { status: 502 }
    );
  }

  // Gate 3 — SES. Not configured → honest 501, never "sent".
  if (!isEmailConfigured()) {
    return NextResponse.json(
      {
        error:
          "Email sending is not connected (AWS SES not configured), so no email was sent. Your packet is still unlocked — download it from the DIY flow and try email again once SES is connected.",
        code: "not_configured",
        signedUrl,
      },
      { status: 501 }
    );
  }

  const pageCount =
    typeof packetData.pageCount === "number" ? packetData.pageCount : null;
  const result = await sendEmail({
    to: caller.email,
    subject: "Your DIY filing packet — Immigration with NIPTEI",
    text:
      `Your completed DIY filing packet for Form ${formCode} is ready.\n\n` +
      `Download it here (link valid 24 hours):\n${signedUrl}\n\n` +
      `This packet is a DRAFT — review every page and sign the forms before you submit anything. ` +
      `Nothing in this packet has been filed with USCIS, and this email does not file your case.\n\n` +
      `What to do next:\n` +
      `1. Open the packet, review every page, and correct any mistake.\n` +
      `2. Sign the forms where the form asks for a signature.\n` +
      `3. Follow the submission-order guide in the DIY flow: cover letter, fee payment form (G-1450 or G-1650) if filing on paper, then the signed form and supporting documents, one separate packet and one separate USCIS fee payment per form.\n` +
      `4. Confirm the current fee, form edition and filing address at uscis.gov before you pay or send anything.\n\n` +
      `Immigration with NIPTEI — a document-preparation service, not a law firm, and not affiliated with USCIS. ` +
      `Only a licensed attorney or DOJ-accredited representative gives legal advice.\n`,
  });
  if (!result.ok) {
    return NextResponse.json(
      {
        error: result.error,
        code: result.code,
        signedUrl,
      },
      { status: result.code === "email_not_configured" ? 501 : 502 }
    );
  }
  return NextResponse.json({
    ok: true,
    message: `Your DIY packet for Form ${formCode} was emailed to your account email address as a secure download link (valid 24 hours). Review and sign before you submit — nothing has been filed.`,
    sentTo: caller.email,
    formCode,
    pageCount,
    messageId: result.messageId,
  });
}
