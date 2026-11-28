// Shared Stripe Checkout button — client component.
//
// POSTs to /api/checkout with a LOCKED Price ID (or a list of locked
// Price IDs for Pay in Full). On success it redirects the browser to
// the Stripe Checkout URL. On 501 it shows the honest message:
// "Stripe checkout not connected yet — STRIPE_SECRET_KEY is not set."
// Nothing is charged by this button itself — Stripe Checkout collects
// the payment. Price IDs here are public identifiers, not secrets.
"use client";

import { useState } from "react";

export default function CheckoutButton({
  priceId,
  items,
  plan,
  email,
  accountId,
  caseId,
  formCode,
  label,
  disabled,
}: {
  priceId?: string;
  items?: { priceId: string; quantity?: number }[];
  plan?: "full" | "installments_3" | "monthly_6" | "monthly_12";
  email?: string;
  accountId?: string;
  caseId?: string;
  /** DIY form code, when this checkout is a DIY unlock. Sent so
   *  /api/checkout can refuse a second charge when the unlock is
   *  already paid ("Already paid" — 409, nothing charged). */
  formCode?: string;
  label: string;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const startCheckout = async () => {
    if (busy || disabled) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId, items, plan, email, accountId, caseId, formCode }),
      });
      const data = (await res.json()) as { url?: string; error?: string; note?: string };
      if (!res.ok || !data.url) {
        setMessage(
          res.status === 501
            ? "Stripe checkout not connected yet — STRIPE_SECRET_KEY is not set in Vercel. Nothing was charged."
            : (data.error ?? `Checkout could not start (${res.status}). Nothing was charged.`)
        );
        setBusy(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setMessage("Could not reach the checkout route (network error). Nothing was charged.");
      setBusy(false);
    }
  };

  return (
    <div>
      <button
        type="button"
        disabled={disabled || busy}
        onClick={() => void startCheckout()}
        className="w-full rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "Starting secure checkout…" : label}
      </button>
      {message && (
        <p className="mt-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {message}
        </p>
      )}
    </div>
  );
}
