// Shared vault link — /vault/shared/<token>.
// Resolves a single-document share token created by a professional's
// vault_link resend (document_resends, migration 0030). The token
// grants read access to ONE document only, for 7 days, and never to
// the whole vault. No DOB, A-Number, SSN, or passport number is
// shown or logged here. When Supabase is not connected, or the token
// is unknown / expired, the page says so honestly — it never
// invents a document.
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";

type ResendRow = {
  document_id: string;
  case_id: string;
  share_expires_at: string;
  status: string;
};

type DocumentRow = {
  file_name: string;
  vault_category: string;
  storage_bucket: string;
  storage_path: string;
};

export default async function VaultSharedPage({
  params,
}: {
  params: { token: string };
}) {
  const token = params.token;
  const supabase = getSupabase();
  if (!supabase) {
    return (
      <main className="mx-auto max-w-xl px-4 py-10">
        <h1 className="text-2xl font-bold text-slate-900">Shared document</h1>
        <p className="mt-4 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          This shared link cannot be opened right now — the vault is not
          connected in this build. Ask your professional to resend the
          document another way.
        </p>
      </main>
    );
  }
  const { data: resendData, error: resendError } = await supabase
    .from("document_resends")
    .select("document_id, case_id, share_expires_at, status")
    .eq("share_token", token)
    .eq("channel", "vault_link")
    .maybeSingle();
  if (resendError || !resendData) {
    return (
      <main className="mx-auto max-w-xl px-4 py-10">
        <h1 className="text-2xl font-bold text-slate-900">Shared document</h1>
        <p className="mt-4 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          This shared link is not recognised. It may have been mistyped —
          ask your professional to send a fresh link.
        </p>
      </main>
    );
  }
  const resend = resendData as unknown as ResendRow;
  if (new Date(resend.share_expires_at).getTime() < Date.now()) {
    return (
      <main className="mx-auto max-w-xl px-4 py-10">
        <h1 className="text-2xl font-bold text-slate-900">Shared document</h1>
        <p className="mt-4 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          This shared link has expired (share links last 7 days). Ask your
          professional to send a fresh link.
        </p>
      </main>
    );
  }
  const { data: docData, error: docError } = await supabase
    .from("documents")
    .select("file_name, vault_category, storage_bucket, storage_path")
    .eq("id", resend.document_id)
    .maybeSingle();
  if (docError || !docData) {
    return (
      <main className="mx-auto max-w-xl px-4 py-10">
        <h1 className="text-2xl font-bold text-slate-900">Shared document</h1>
        <p className="mt-4 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          The shared document could not be found. Ask your professional to
          send a fresh link.
        </p>
      </main>
    );
  }
  const doc = docData as unknown as DocumentRow;
  const { data: signed } = await supabase.storage
    .from(doc.storage_bucket)
    .createSignedUrl(doc.storage_path, 3600);
  return (
    <main className="mx-auto max-w-xl px-4 py-10">
      <h1 className="text-2xl font-bold text-slate-900">Shared document</h1>
      <p className="mt-4 text-sm text-slate-700">
        Your professional shared one document with you. This link opens
        only this document, and it expires on{" "}
        {new Date(resend.share_expires_at).toLocaleString()}.
      </p>
      <div className="mt-4 rounded border border-slate-200 bg-white p-4 shadow-sm">
        <p className="font-medium">{doc.file_name}</p>
        <p className="mt-1 text-sm text-slate-600">
          Category: {doc.vault_category}
        </p>
        {signed?.signedUrl ? (
          <a
            href={signed.signedUrl}
            className="mt-3 inline-block rounded bg-blue-700 px-4 py-2 text-sm font-medium text-white"
          >
            Download this document →
          </a>
        ) : (
          <p className="mt-3 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            The download link could not be created right now. Sign in to
            your portal vault, or ask your professional to resend the
            document.
          </p>
        )}
      </div>
      <p className="mt-4 text-sm">
        <Link href="/portal" className="text-blue-600 underline">
          Open your portal vault →
        </Link>
      </p>
      <p className="mt-2 text-xs text-slate-500">
        Immigration with NIPTEI — a document-preparation service, not a law
        firm, not affiliated with USCIS.
      </p>
    </main>
  );
}
