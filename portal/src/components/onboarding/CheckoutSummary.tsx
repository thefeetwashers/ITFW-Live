"use client";

import { useState } from "react";
import Link from "next/link";
import { STRIPE_ENV_VARS } from "@/lib/stripe";
import { LOCKED_PRICE_BY_KEY } from "@/lib/stripePrices";
import CheckoutButton from "@/components/CheckoutButton";
import type { RoleId } from "./RoleForms";

// Subscription Price for each paid role (locked Stripe Prices, Nov 24,
// 2026). Nonprofits pick Standard or Full in the form above — the
// register route returns the exact Price ID; this summary uses Standard
// as the starting point and the form's choice wins at checkout.
const ROLE_PRICE_KEY: Record<string, string> = {
  preparer: "subscription_preparer",
  attorney: "subscription_attorney",
  nonprofit: "subscription_doj_standard",
  student: "subscription_law_student",
};

interface PlanLine {
  label: string;
  amount: string;
}

// LOCKED tiers, shown verbatim. No per-lead or percentage fees anywhere.
const PLANS: Record<RoleId, { lines: PlanLine[]; dueToday: string; note: string }> = {
  client: {
    lines: [{ label: "Client plan", amount: "$0" }],
    dueToday: "$0",
    note: "Free — $0. No payment, no checkout. After email verification, go to the Client Portal.",
  },
  preparer: {
    lines: [
      { label: "Free profile claim", amount: "$0" },
      { label: "Back Office & directory listing", amount: "$49/mo" },
    ],
    dueToday: "$49/mo",
    note: "Billed monthly once Stripe is connected. No per-lead or percentage fees.",
  },
  attorney: {
    lines: [{ label: "Licensed Attorney plan", amount: "$99/mo" }],
    dueToday: "$0 today",
    note: "$99/mo is triggered AFTER verification — nothing is charged until an admin approves you. No per-lead or percentage fees.",
  },
  nonprofit: {
    lines: [
      { label: "Standard (50% off)", amount: "$24.50/mo" },
      { label: "Full (50% off)", amount: "$49.50/mo" },
    ],
    dueToday: "$24.50/mo or $49.50/mo",
    note: "DOJ tiers are 50% off. Pick Standard or Full in the form above. Multi-staff seats are set with the admin after approval. No per-lead or percentage fees.",
  },
  student: {
    lines: [{ label: "Law Student plan (supervised-only)", amount: "$35/mo" }],
    dueToday: "$35/mo",
    note: "Supervised-only workspace: no solo cases, no legal advice, no G-28 signature, no representation. No per-lead or percentage fees.",
  },
  teacher: {
    lines: [{ label: "Teacher / Clinic Director", amount: "No fee listed" }],
    dueToday: "—",
    note: "No subscription for this role in this build. Teachers confirm their law students.",
  },
  admin: {
    lines: [{ label: "Founder / Admin", amount: "Login only" }],
    dueToday: "—",
    note: "No self-registration and no checkout. Founder password is set by the founder, never in code.",
  },
};

const CHECKOUT_MESSAGE =
  "Stripe checkout is wired to /api/checkout with the locked Price IDs — but STRIPE_SECRET_KEY is not set in Vercel / .env.local yet, so checkout returns 501 and nothing is charged. " +
  "Set STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY, and STRIPE_WEBHOOK_SECRET in Vercel first — no keys are in this build. Your directory listing flips on only via the Stripe webhook, once the subscription is active AND verification is approved.";

export default function CheckoutSummary({
  role,
  formSubmitted,
}: {
  role: RoleId;
  formSubmitted: boolean;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const plan = PLANS[role];
  const isPaid = role === "preparer" || role === "attorney" || role === "nonprofit" || role === "student";

  return (
    <aside
      aria-label="Checkout summary"
      className="rounded-lg border border-slate-300 bg-slate-50 p-4"
    >
      <h3 className="text-base font-semibold text-slate-900">
        Checkout summary
      </h3>
      <dl className="mt-3 space-y-1 text-sm text-slate-700">
        {plan.lines.map((line) => (
          <div key={line.label} className="flex justify-between gap-2">
            <dt>{line.label}</dt>
            <dd className="font-semibold">{line.amount}</dd>
          </div>
        ))}
        <div className="flex justify-between gap-2 border-t border-slate-300 pt-2 font-semibold text-slate-900">
          <dt>Due today</dt>
          <dd>{plan.dueToday}</dd>
        </div>
      </dl>
      <p className="mt-3 text-xs text-slate-600">{plan.note}</p>

      {role === "client" && formSubmitted && (
        <Link
          href="/portal"
          className="mt-4 inline-block rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Go to Client Portal →
        </Link>
      )}

      {isPaid && (
        <div className="mt-4 space-y-2">
          {(() => {
            const price = LOCKED_PRICE_BY_KEY[ROLE_PRICE_KEY[role] ?? ""];
            return price ? (
              <CheckoutButton
                priceId={price.priceId}
                label={`Pay ${price.label} — secure Stripe checkout`}
                disabled={!formSubmitted}
              />
            ) : null;
          })()}
          <button
            type="button"
            onClick={() => setMessage(CHECKOUT_MESSAGE)}
            className="w-full rounded border border-slate-400 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            How checkout works
          </button>
          {!formSubmitted && (
            <p className="text-xs text-slate-500">
              Complete the registration form above first — checkout unlocks
              after you submit it (example only; nothing is charged).
            </p>
          )}
          {message && (
            <p className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {message}
            </p>
          )}
        </div>
      )}

      <p className="mt-4 text-xs text-slate-500">
        Stripe checkout is wired to <code>/api/checkout</code> with the
        locked Price IDs — it returns 501 until STRIPE_SECRET_KEY is set
        in Vercel / .env.local (env vars: {STRIPE_ENV_VARS.join(", ")}).
        No keys, no live charges in this build. Professionals also
        connect their own Stripe (BYO) — the platform never holds money
        or splits legal fees.
      </p>
    </aside>
  );
}
