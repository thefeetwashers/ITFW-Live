// POST /api/signatures/sign — complete an in-platform e-signature.
// The request flow (POST /api/signatures/request) already existed: it
// creates an UNSIGNED signatures row (0001, signed_at null). This route
// is the other half — the client signs, in-platform, by typing their
// full name and confirming review + intent (see
// src/lib/expertTools.ts completeSignature()).
//
// NEVER auto-signs: the typed name must match the name on the request,
// the intent checkbox and the review confirmation must both be true,
// and packetRef + packetVersion must name exactly what was signed
// (stored as a SHA-256 hash). A request that is already signed is
// refused — a signed record is never re-signed or overwritten. No
// outside e-sign provider is connected (BYO slot "esign"); the response
// always says so. Returns 501 when Supabase is not configured. No
// DOB / A-Number / SSN / passport number is accepted, stored, logged,
// or put in an email subject by this route.
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { completeSignature } from "@/lib/expertTools";
import { ESIGN_PROVIDER_STATUS } from "@/lib/businessTools";
import { writeAuditLog } from "@/lib/auditLog";

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(req: Request) {
  const admin = serviceClient();
  if (!admin) {
    return NextResponse.json(
      {
        error:
          "E-signature not configured — Supabase env vars are not set, so no signature was recorded.",
        providerStatus: ESIGN_PROVIDER_STATUS,
      },
      { status: 501 }
    );
  }
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const signatureId = typeof body.signatureId === "string" ? body.signatureId : "";
  if (!signatureId) {
    return NextResponse.json({ error: "signatureId is required." }, { status: 400 });
  }
  const { data: request, error: readError } = await admin
    .from("signatures")
    .select("id,case_id,client_id,signer_full_name,signed_at,digital_review_confirmed")
    .eq("id", signatureId)
    .single();
  if (readError || !request) {
    return NextResponse.json({ error: "Signature request not found." }, { status: 404 });
  }
  const completed = completeSignature(
    {
      signed_at: (request as { signed_at: string | null }).signed_at,
      signer_full_name: (request as { signer_full_name: string }).signer_full_name,
      digital_review_confirmed: (request as { digital_review_confirmed: boolean }).digital_review_confirmed,
    },
    {
      typedName: typeof body.typedName === "string" ? body.typedName : "",
      intentConfirmed: body.intentConfirmed === true,
      reviewConfirmed: body.reviewConfirmed === true,
      packetRef: typeof body.packetRef === "string" ? body.packetRef : "",
      packetVersion: typeof body.packetVersion === "string" ? body.packetVersion : "",
    }
  );
  if (!completed.ok) {
    return NextResponse.json({ error: completed.error, signed: false }, { status: 400 });
  }
  const { error: updateError } = await admin
    .from("signatures")
    .update(completed.patch)
    .eq("id", signatureId)
    .is("signed_at", null);
  if (updateError) {
    return NextResponse.json(
      { error: `Signature was NOT recorded: ${updateError.message}.`, signed: false },
      { status: 500 }
    );
  }
  // Audit trail, ids only — no names, no money (see src/lib/auditLog.ts).
  await writeAuditLog(admin, {
    actorId: (request as { client_id: string }).client_id,
    action: "signature_completed",
    entityType: "signature",
    entityId: signatureId,
    caseId: (request as { case_id: string }).case_id,
    detail: { provider: "in_platform", status: "completed" },
  });
  return NextResponse.json({
    ok: true,
    signed: true,
    signatureId,
    signedAt: completed.patch.signed_at,
    packetRef: completed.patch.packet_ref,
    packetVersionHash: completed.patch.packet_version_hash,
    providerStatus: ESIGN_PROVIDER_STATUS,
  });
}
