import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <p className="text-sm font-semibold text-niptei-blue">
        Immigration with NIPTEI
      </p>
      <h1 className="mt-2 text-3xl font-bold text-niptei-navy">
        Client Portal, Onboarding &amp; Verification
      </h1>
      <p className="mt-3 text-slate-700">
        Immigration with NIPTEI is a document-preparation service, not a law
        firm, and is not affiliated with USCIS or the Department of State. We
        do not guarantee approval. Only a licensed attorney or a
        DOJ-Accredited Representative can give legal advice or represent you.
      </p>
      <p className="mt-3 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm">
        Example data on these screens is labelled EXAMPLE. Live sign-in,
        uploads, chat, payments, and verifications are not live until Supabase
        env vars are set, migration 0004 has run, and Stripe / email are
        connected.
      </p>
      <ul className="mt-6 space-y-3">
        <li>
          <Link
            href="/portal"
            className="block rounded border border-slate-300 bg-white px-4 py-3 font-semibold hover:border-niptei-blue"
          >
            Client Portal — My Case: Form I-130 →
          </Link>
        </li>
        <li>
          <Link
            href="/onboarding"
            className="block rounded border border-slate-300 bg-white px-4 py-3 font-semibold hover:border-niptei-blue"
          >
            Step 1 — Choose your role →
          </Link>
        </li>
        <li>
          <Link
            href="/admin/verifications"
            className="block rounded border border-slate-300 bg-white px-4 py-3 font-semibold hover:border-niptei-blue"
          >
            Admin — Verification queue (Founder / Admin only) →
          </Link>
        </li>
      </ul>
      <p className="mt-6 text-sm text-slate-600">
        Contact: nipteiapp@gmail.com · (772) 971-6129
      </p>
    </main>
  );
}
