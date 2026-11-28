// Vault expiry API — /api/vault-expiry
// GET  ?caseId=<case id> — that case's vault documents with their
//      derived expiry status (see portal/src/lib/vaultExpiry.ts):
//      expired / expiring_soon / ok / no_expiry_on_file /
//      never_expires (birth certificate translations do not expire).
//      Rows come from public.documents (0001) + migration 0029
//      (expires_on, expiry_kind, expiry_note). A document with no
//      expires_on is never flagged as expiring. No document numbers,
//      A-Numbers, SSNs, or passport numbers are returned — only the
//      file label, kind, and expiry date.
// Until Supabase env vars are set this route returns 501.
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  deriveVaultExpiries,
  type VaultDocumentInput,
  type VaultDocumentKind,
} from "@/lib/vaultExpiry";

export const runtime = "nodejs";

const KINDS: VaultDocumentKind[] = [
  "passport",
  "medical_exam",
  "police_clearance",
  "birth_certificate_translation",
  "other",
];

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function GET(req: Request) {
  const admin = serviceClient();
  if (!admin) {
    return NextResponse.json(
      {
        error:
          "Vault expiry not configured — Supabase env vars are not set, so no vault document was read. Run migration 0029 first.",
        notConfigured: true,
      },
      { status: 501 }
    );
  }
  const caseId = new URL(req.url).searchParams.get("caseId");
  if (!caseId) {
    return NextResponse.json({ error: "caseId is required." }, { status: 400 });
  }
  const { data, error } = await admin
    .from("documents")
    .select("id, case_id, vault_category, file_name, expires_on, expiry_kind")
    .eq("case_id", caseId)
    .order("expires_on", { ascending: true, nullsFirst: false });
  if (error) {
    return NextResponse.json(
      { error: `Could not read vault documents: ${error.message}. Migration 0029 may not have run yet.` },
      { status: 500 }
    );
  }
  const inputs: VaultDocumentInput[] = (data ?? []).map((r) => {
    const kind = (r as { expiry_kind?: string | null }).expiry_kind;
    return {
      id: r.id as string,
      caseId: r.case_id as string,
      kind: (kind && KINDS.includes(kind as VaultDocumentKind)
        ? kind
        : "other") as VaultDocumentKind,
      label: (r as { file_name: string }).file_name,
      expiresOn: (r as { expires_on?: string | null }).expires_on ?? null,
    };
  });
  const derived = deriveVaultExpiries(inputs);
  return NextResponse.json({
    documents: derived,
    flagsNeedingAttention: derived.filter(
      (d) => d.status === "expired" || d.status === "expiring_soon"
    ),
  });
}
