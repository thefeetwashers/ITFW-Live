import type { Metadata } from "next";
import FamilyPortalView from "@/components/family/FamilyPortalView";

export const metadata: Metadata = {
  title: "Family Portal — Immigration with NIPTEI",
  description:
    "Token-gated family member and joint sponsor view: USCIS & NVC numbers, missing items, and upload slots only. Clerical help only — not a law firm.",
};

// Valid example token. Any other token shows the denied screen.
// Real validation against family_invites.invite_token + expiry happens
// server-side once wired (Supabase + migration 0009).
const EXAMPLE_TOKEN = "example-token";

export default function FamilyPortalPage({
  params,
}: {
  params: { token: string };
}) {
  const token = params.token;
  const valid = token === EXAMPLE_TOKEN;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <header>
        <h1 className="text-2xl font-bold">
          Family Member &amp; Joint Sponsor Portal
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Immigration with NIPTEI · nipteiapp@gmail.com · (772) 971-6129 —
          clerical / educational help only; not a law firm, not affiliated
          with USCIS, no approval guarantee.
        </p>
      </header>

      <p
        role="status"
        className="mt-4 rounded border border-amber-400 bg-amber-50 p-3 text-sm font-medium text-amber-900"
      >
        Example — family portal is not live until Supabase + migration 0009
        are connected.
      </p>

      {!valid ? (
        <section
          aria-labelledby="denied-heading"
          className="mt-6 rounded-lg border border-red-300 bg-red-50 p-4 shadow-sm"
        >
          <h2 id="denied-heading" className="text-lg font-semibold">
            Invalid or expired invite — ask the primary client for a new
            link.
          </h2>
          <p className="mt-2 text-sm text-slate-700">
            This invite link is not recognised. Real validation checks the
            token against family_invites.invite_token and its expiry
            server-side once Supabase + migration 0009 are connected.
          </p>
          <p className="mt-4 text-sm">
            <a
              href="https://immigration.niptei.com"
              className="font-medium text-blue-700 underline"
            >
              Back to Immigration with NIPTEI
            </a>
          </p>
        </section>
      ) : (
        <div className="mt-6">
          <FamilyPortalView token={token} />
        </div>
      )}

      <footer className="mt-8 text-xs text-slate-500">
        <a
          href="https://immigration.niptei.com"
          className="text-blue-700 underline"
        >
          Back to Immigration with NIPTEI
        </a>
      </footer>
    </main>
  );
}
