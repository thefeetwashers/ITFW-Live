import Link from "next/link";
import { computePacketReadiness, EXAMPLE_AUDIT_ITEMS } from "@/lib/audit";

export default function PacketAuditPage() {
  // Computed, not hardcoded — score derives from the audit items' weights.
  const readiness = computePacketReadiness(EXAMPLE_AUDIT_ITEMS);

  return (
    <div className="min-h-screen bg-slate-50 p-4 text-slate-900">
      <div className="mx-auto max-w-3xl">
        <p className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <strong>Example data — not live.</strong> Pre-filing packet audit
          for the example Form I-130 case. This is a checklist calculation,
          not a legal determination. Immigration with NIPTEI — not a law
          firm, not affiliated with USCIS. Only a licensed attorney or
          DOJ-Accredited Representative gives legal advice (8 CFR 292.1).
        </p>

        <h1 className="mt-4 text-xl font-bold">
          Pre-Filing Packet Audit — Form I-130
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          <Link href="/portal" className="underline">
            ← Back to Portal
          </Link>
        </p>

        {/* Score meter */}
        <section
          aria-labelledby="score-heading"
          className="mt-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
        >
          <h2 id="score-heading" className="text-base font-semibold">
            Packet Readiness: {readiness.score}% (computed)
          </h2>
          <div className="mt-2 h-4 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full bg-green-600"
              style={{ width: `${readiness.score}%` }}
            />
          </div>
          <p className="mt-2 text-sm">
            {readiness.earnedWeight} of {readiness.totalWeight} weight passed
            · {readiness.blockingItems.length} blocking item
            {readiness.blockingItems.length === 1 ? "" : "s"} open · Ready to
            file: <strong>{readiness.readyToFile ? "Yes" : "No"}</strong>
          </p>
          <p className="mt-2 rounded border-2 border-red-600 bg-red-50 p-3 text-sm font-semibold text-red-800">
            Rule: Filing cannot be marked ready until score = 100% and all
            blocking items are cleared. In this example, readyToFile is false.
          </p>
        </section>

        {/* Packet generation gate — POST /api/generate-packet */}
        <section
          aria-labelledby="generate-heading"
          className="mt-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
        >
          <h2 id="generate-heading" className="text-base font-semibold">
            Generate the Packet (POST /api/generate-packet)
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Packet generation is <strong>blocked until the audit is 100% and
            all blocking items are cleared</strong>. The route returns 409
            (audit not ready) until then, and 402 while any balance is due —
            the final packet download stays locked until the balance is
            paid/current. A generated packet is always a DRAFT for review
            before filing — never auto-filed, never called submission-ready
            as filed. No E-Sign provider is connected yet.
          </p>
          <button
            type="button"
            disabled={!readiness.readyToFile}
            title={
              readiness.readyToFile
                ? "Audit is 100% — generation is allowed (still needs Supabase + official USCIS templates in the vault)"
                : `Blocked — audit is ${readiness.score}%, not 100%. Clear the ${readiness.blockingItems.length} blocking item(s) first.`
            }
            className="mt-3 w-full cursor-not-allowed rounded bg-slate-300 px-3 py-2 text-sm font-semibold text-slate-600 disabled:cursor-not-allowed"
          >
            {readiness.readyToFile
              ? "Generate draft packet (POST /api/generate-packet)"
              : `🔒 Generate packet — blocked at ${readiness.score}% (needs 100%)`}
          </button>
          <p className="mt-1 text-xs text-slate-500">
            In this example the button is disabled because the audit is{" "}
            {readiness.score}% with {readiness.blockingItems.length} blocking
            item(s) open. The route also needs Supabase connected, the
            official USCIS templates in the private vault bucket, and the
            balance paid — none of which is live in this example build.
          </p>
        </section>

        {/* Blocking items */}
        <section
          aria-labelledby="blocking-heading"
          className="mt-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
        >
          <h2 id="blocking-heading" className="text-base font-semibold">
            Blocking Items [!] — {readiness.blockingItems.length}
          </h2>
          {readiness.blockingItems.length === 0 ? (
            <p className="mt-2 text-sm text-green-700">
              ✓ No blocking items.
            </p>
          ) : (
            <ul className="mt-2 space-y-2 text-sm">
              {readiness.blockingItems.map((item) => (
                <li
                  key={item.id}
                  className="rounded border-2 border-red-600 bg-red-50 px-3 py-2"
                >
                  <strong>[!] {item.label}</strong> — rule: {item.rule} ·
                  weight {item.weight} · status: {item.status}
                  {item.detail ? ` — ${item.detail}` : ""}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Every audit item */}
        <section
          aria-labelledby="items-heading"
          className="mt-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
        >
          <h2 id="items-heading" className="text-base font-semibold">
            Every Audit Item ({EXAMPLE_AUDIT_ITEMS.length})
          </h2>
          <ul className="mt-2 space-y-2 text-sm">
            {EXAMPLE_AUDIT_ITEMS.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-200 px-3 py-2"
              >
                <span>
                  <strong>{item.label}</strong>
                  <span className="block text-xs text-slate-500">
                    Rule: {item.rule} · weight {item.weight} ·{" "}
                    {item.blocking ? "blocking" : "non-blocking"}
                    {item.detail ? ` — ${item.detail}` : ""}
                  </span>
                </span>
                <span
                  className={
                    item.status === "pass"
                      ? "font-semibold text-green-700"
                      : item.status === "fail"
                        ? "font-semibold text-red-700"
                        : "font-semibold text-amber-700"
                  }
                >
                  {item.status === "pass"
                    ? "Pass ✓"
                    : item.status === "fail"
                      ? "Fail [!]"
                      : "Warning"}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <p className="mt-4 text-sm">
          <Link href="/portal" className="underline">
            ← Back to Portal
          </Link>{" "}
          ·{" "}
          <Link href="/portal/questionnaire" className="underline">
            Fix the address gap in the Questionnaire →
          </Link>
        </p>
      </div>
    </div>
  );
}
