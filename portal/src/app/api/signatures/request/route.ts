// POST /api/signatures/request — record a signature REQUEST in the
// signatures table (0001). The request is UNSIGNED (signed_at null):
// the client signs later, in-platform, by typing their full name and
// confirming they reviewed the document. No e-signature provider is
// connected, so the response always says so — nothing here claims an
// outside provider signed anything. Returns 501 when Supabase is not
// configured. No A-Number / SSN / passport number is accepted or
// stored; the signer name is the only personal field, and it is never
// put in a log or an email subject by this route.
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildSignatureRequest, ESIGN_PROVIDER_STATUS } from "@/lib/businessTools";

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
          "E-signature not configured — Supabase env vars are not set, so no signature request was stored.",
        providerStatus: ESIGN_PROVIDER_STATUS,
      },
      { status: 501 }
    );
  }
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const built = buildSignatureRequest({
    caseId: typeof body.caseId === "string" ? body.caseId : "",
    clientId: typeof body.clientId === "string" ? body.clientId : "",
    formCode: typeof body.formCode === "string" ? body.formCode : "",
    documentId: typeof body.documentId === "string" ? body.documentId : null,
    signerFullName: typeof body.signerFullName === "string" ? body.signerFullName : "",
  });
  if (!built.ok) {
    return NextResponse.json({ error: built.error }, { status: 400 });
  }
  const { providerStatus, ...row } = built.row;
  const { data, error } = await admin.from("signatures").insert(row).select("id").single();
  if (error) {
    return NextResponse.json(
      { error: `Could not record the signature request: ${error.message}. Migration 0001 may not have run yet.` },
      { status: 500 }
    );
  }
  return NextResponse.json(
    {
      signatureId: data?.id ?? null,
      status: "requested — not signed yet",
      providerStatus: ESIGN_PROVIDER_STATUS,
    },
    { status: 201 }
  );
}
