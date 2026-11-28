import type { Metadata } from "next";
import { PUBLIC_PAGE_META } from "@/lib/seo";
import Link from "next/link";
import { EXAMPLE_AUDIT_ITEMS } from "@/lib/audit";
import { runFreePacketAudit } from "@/lib/packetRescue";

export const metadata: Metadata = {
  title: PUBLIC_PAGE_META["/packet-rescue"].title,
  description: PUBLIC_PAGE_META["/packet-rescue"].description,
};

export default function PacketRescuePage() {
  // Free audit, computed from the existing audit engine — not hardcoded.
  const audit = runFreePacketAudit(EXAMPLE_AUDIT_ITEMS);

  return (
    <div className="min-h-screen bg-slate-50 p-4 text-slate-900">
      <div className="mx-auto max-w-3xl">
        <p className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <strong>Example data — not live.</strong> Packet Rescue free check
          for an example packet prepared elsewhere. This is a checklist
          calculation, not a legal determination. Immigration with NIPTEI —
          not a law firm, not affiliated with USCIS. Only a licensed attorney
          or DOJ-Accredited Representative gives legal advice (8 CFR 292.1).
        </p>

        <h1 className="mt-4 text-xl font-bold">
          Packet Rescue — Free Check First
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Upload a packet prepared elsewhere. We audit it <strong>free</strong>{" "}
          and show exactly what is missing or wrong before you file. The paid
          fix is $199 flat — and the free audit never unlocks it.{" "}
          <Link href="/portal/packet-audit" className="underline">
            See the full packet audit →
          </Link>
        </p>

        <section
          aria-labelledby="score-heading"
          className="mt-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
        >
          <h2 id="score-heading" className="text-base font-semibold">
            Free audit: {audit.score}% (computed)
          </h2>
          <div className="mt-2 h-4 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full bg-green-600"
              style={{ width: `${audit.score}%` }}
            />
          </div>
          <p className="mt-2 text-sm">
            {audit.earnedWeight} of {audit.totalWeight} weight passed ·{" "}
            {audit.blockingItems.length} blocking item
            {audit.blockingItems.length === 1 ? "" : "s"} open
          </p>
          <p className="mt-2 rounded border-2 border-red-600 bg-red-50 p-3 text-sm font-semibold text-red-800">
            {audit.verdictText}
          </p>
        </section>

        <section
          aria-labelledby="missing-heading"
          className="mt-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
        >
          <h2 id="missing-heading" className="text-base font-semibold">
            What is missing or wrong
          </h2>
          {audit.failingItems.length === 0 ? (
            <p className="mt-2 text-sm">Nothing failing — every item passed.</p>
          ) : (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
              {audit.failingItems.map((item) => (
                <li key={item.id}>
                  <strong>{item.label}</strong>
                  {item.detail ? ` — ${item.detail}` : ""}
                  {item.blocking ? " (blocking)" : ""}
                </li>
              ))}
            </ul>
          )}
          {audit.warningItems.length > 0 && (
            <div className="mt-3">
              <h3 className="text-sm font-semibold">Open warnings</h3>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                {audit.warningItems.map((item) => (
                  <li key={item.id}>
                    <strong>{item.label}</strong>
                    {item.detail ? ` — ${item.detail}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section
          aria-labelledby="fix-heading"
          className="mt-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
        >
          <h2 id="fix-heading" className="text-base font-semibold">
            The paid fix — {audit.fixOffer.label}
          </h2>
          <p className="mt-2 text-sm">{audit.fixOffer.note}</p>
          <p className="mt-2 text-sm">
            Paid fix unlocked by this free audit:{" "}
            <strong>{audit.paidFixUnlocked ? "Yes" : "No — never"}</strong>
          </p>
          <p className="mt-2 text-xs text-slate-500">
            The checkout for the paid fix is wired through the existing
            Stripe checkout once the server route that reads Packet Rescue
            invoices is built (see docs/standout-five-2026-11-28.md). Until
            then this page offers the free audit only — the fix is not sold
            from here.
          </p>
        </section>
      </div>
    </div>
  );
}
