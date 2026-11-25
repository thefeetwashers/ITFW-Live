// POST /api/checkout — create a Stripe Checkout Session.
//
// Wired to the 132 LOCKED Stripe Prices (src/lib/stripePrices.ts, created
// Nov 24, 2026, account acct_1UVh7DPfd9SRUcvh, LIVE mode). The Price ID
// (or every Price ID in `items`) MUST be in the locked map — an unknown
// Price ID is rejected with 400. Never accept an arbitrary price from
// the client, never invent a Price ID, never charge without a session.
//
// Plans:
//   * "full" (default for one-time Prices): one Checkout payment for the
//     full locked amount. `items` (several one-time Prices, e.g. a form
//     tier + speed fee) is allowed only with plan "full".
//   * "installments_3" (one-time Prices only): Stripe Checkout has NO
//     native Pay-in-3. Checkout charges Instalment 1 only, as a custom
//     one-time amount (price_data — the locked Price is NOT charged in
//     full). Instalments 2–3 are recorded in public.payment_plans
//     (migration 0002, widened by 0003) when caseId + accountId are
//     supplied, and must be collected before filing — they are NOT
//     auto-charged. The response says this in plain text.
//   * "monthly_6" / "monthly_12" (bundle monthly Prices only): Checkout
//     in subscription mode with the locked monthly Price. The 6/12
//     payment STOP is not a property of the Price — the webhook
//     (/api/stripe/webhook) applies a Subscription Schedule with
//     iterations = cycles on checkout.session.completed. Until the
//     webhook runs, the subscription would run forever by default.
//   * Subscriptions (Member / Preparer / Attorney / DOJ / Law Student /
//     Employer): Checkout in subscription mode, open-ended (no cycle
//     stop — these are real monthly/annual memberships).
//
// The 50% missed-payment rule is NOT enforced here and has no Stripe
// setting — it is displayed to the client and handled manually.
//
// Returns 501 "Stripe not configured" when STRIPE_SECRET_KEY is not set.
// Nothing is charged by this route itself — Stripe Checkout collects the
// payment; the webhook records the result.
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getStripe } from "@/lib/stripeClient";
import {
  getLockedPriceById,
  getLockedPriceByKey,
  type LockedStripePrice,
} from "@/lib/stripePrices";
import { splitInvoices } from "@/lib/stripe";

export const runtime = "nodejs";

type Plan = "full" | "installments_3" | "monthly_6" | "monthly_12";

const PLANS: Plan[] = ["full", "installments_3", "monthly_6", "monthly_12"];

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || "https://immigration.niptei.com";

function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function safePath(v: unknown, fallback: string): string {
  const s = asString(v);
  // Only relative paths on our own site — never an open redirect.
  return s.startsWith("/") && !s.startsWith("//") ? s : fallback;
}

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function POST(req: Request) {
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      {
        error:
          "Stripe checkout not configured — STRIPE_SECRET_KEY is not set in Vercel / .env.local. No checkout session was created and nothing was charged.",
      },
      { status: 501 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const email = asString(body.email);
  const accountId = asString(body.accountId);
  const caseId = asString(body.caseId);
  const plan = asString(body.plan) as Plan;

  // --- Resolve the Price(s) against the locked map -----------------------
  let prices: LockedStripePrice[] = [];
  if (Array.isArray(body.items)) {
    if (body.items.length === 0 || body.items.length > 10) {
      return NextResponse.json(
        { error: "items must list 1–10 locked Prices." },
        { status: 400 }
      );
    }
    for (const item of body.items as Record<string, unknown>[]) {
      const price = getLockedPriceById(asString(item?.priceId));
      if (!price) {
        return NextResponse.json(
          {
            error: `Unknown Price ID "${asString(item?.priceId)}" — not one of the 132 locked Stripe Prices. No checkout session was created.`,
          },
          { status: 400 }
        );
      }
      const qty =
        typeof item?.quantity === "number" && item.quantity > 0
          ? Math.floor(item.quantity)
          : 1;
      prices.push({ ...price, quantity: qty } as LockedStripePrice & { quantity: number });
    }
  } else {
    const price =
      getLockedPriceById(asString(body.priceId)) ??
      getLockedPriceByKey(asString(body.priceKey));
    if (!price) {
      return NextResponse.json(
        {
          error:
            "A locked Price ID (or priceKey) is required — it must be one of the 132 locked Stripe Prices. No checkout session was created.",
        },
        { status: 400 }
      );
    }
    prices = [price];
  }
  const single = prices.length === 1 ? prices[0] : null;

  // --- Validate the plan against the Price kind ---------------------------
  const requestedPlan: Plan =
    plan && PLANS.includes(plan) ? plan : single?.cycles ? `monthly_${single.cycles}` as Plan : "full";
  // A bundle monthly Price is always a fixed-cycle plan, even if the
  // caller passed "full" — otherwise the webhook would never know to
  // apply the 6/12-payment stop.
  const effectivePlan: Plan =
    single?.cycles && requestedPlan === "full"
      ? (`monthly_${single.cycles}` as Plan)
      : requestedPlan;
  if (prices.length > 1 && effectivePlan !== "full") {
    return NextResponse.json(
      { error: "Pay in 3 and Monthly plans apply to one Price at a time — multi-item checkout is Pay in Full only." },
      { status: 400 }
    );
  }
  if (single?.kind === "one_time" && effectivePlan !== "full" && effectivePlan !== "installments_3") {
    return NextResponse.json(
      { error: `Plan "${effectivePlan}" does not apply to one-time Price ${single.priceId}. Use "full" or "installments_3".` },
      { status: 400 }
    );
  }
  if (single?.kind !== "one_time" && effectivePlan !== "full") {
    // Recurring Prices: "full" means "start the subscription".
    // monthly_6/12 is only valid on a bundle monthly Price with cycles.
    if (!(single?.cycles && effectivePlan === `monthly_${single.cycles}`)) {
      return NextResponse.json(
        { error: `Plan "${effectivePlan}" does not apply to recurring Price ${single?.priceId}.` },
        { status: 400 }
      );
    }
  }
  if (single?.cycles && effectivePlan !== `monthly_${single.cycles}`) {
    return NextResponse.json(
      {
        error: `Bundle monthly Price ${single.priceId} is a ${single.cycles}-payment plan — use plan "monthly_${single.cycles}", not "${effectivePlan}".`,
      },
      { status: 400 }
    );
  }

  const isSubscription =
    (single && single.kind !== "one_time") || effectivePlan === "monthly_6" || effectivePlan === "monthly_12";
  const totalCents = prices.reduce(
    (sum, p) => sum + p.amountCents * ((p as LockedStripePrice & { quantity?: number }).quantity ?? 1),
    0
  );

  const successUrl = `${APP_URL}${safePath(body.successPath, "/portal?checkout=success")}${
    safePath(body.successPath, "/portal?checkout=success").includes("?") ? "&" : "?"
  }session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${APP_URL}${safePath(body.cancelPath, "/portal?checkout=cancelled")}`;

  const metadata: Record<string, string> = {
    price_id: prices.map((p) => p.priceId).join(","),
    price_key: prices.map((p) => p.key).join(","),
    plan: effectivePlan,
    total_cents: String(totalCents),
  };
  if (accountId) metadata.account_id = accountId;
  if (caseId) metadata.case_id = caseId;
  if (single?.cycles) {
    metadata.cycles = String(single.cycles);
    metadata.bundle_total_cents = String(single.totalCents ?? single.amountCents * single.cycles);
    if (single.monthlyDriftCents !== undefined && single.monthlyDriftCents !== 0) {
      metadata.monthly_drift_cents = String(single.monthlyDriftCents);
    }
  }

  try {
    // --- Pay in 3: charge Instalment 1 only, as a custom amount ---------
    // Stripe has no native Pay-in-3. The locked Price is NOT charged in
    // full here; the first split instalment (see lib/stripe.ts
    // splitInvoices — $1,799 splits $599.67 / $599.67 / $599.66) is
    // charged now, and instalments 2–3 are recorded below and collected
    // before filing. They are NOT auto-charged.
    if (effectivePlan === "installments_3" && single) {
      const splits = splitInvoices(single.amountCents, "installments_3");
      const first = splits[0];
      const warnings: string[] = [];
      if (caseId && accountId) {
        const admin = getServiceClient();
        if (admin) {
          const { error } = await admin.from("payment_plans").insert({
            case_id: caseId,
            client_id: accountId,
            provider_id: null,
            total_service_fee_cents: single.amountCents,
            pay_choice: "installments_3",
            installment_amounts_cents: splits.map((s) => s.amountCents),
            paid_cents: 0,
            status: "active",
          });
          if (error) warnings.push(`Payment plan could not be recorded in the database: ${error.message}. Instalments 2–3 are still owed before filing.`);
        } else {
          warnings.push("Supabase is not configured, so the Pay-in-3 plan was not recorded in the database — instalments 2–3 must be tracked manually.");
        }
      } else {
        warnings.push("No case/account was supplied, so the Pay-in-3 plan was not recorded in the database — instalments 2–3 must be tracked manually.");
      }
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        customer_email: email || undefined,
        line_items: [
          {
            price_data: {
              currency: "usd",
              unit_amount: first.amountCents,
              product_data: { name: `${single.label} — Instalment 1 of 3` },
            },
            quantity: 1,
          },
        ],
        metadata: { ...metadata, installment: "1_of_3", installment_amount_cents: String(first.amountCents) },
        success_url: successUrl,
        cancel_url: cancelUrl,
      });
      return NextResponse.json({
        ok: true,
        url: session.url,
        sessionId: session.id,
        mode: "payment",
        plan: "installments_3",
        priceId: single.priceId,
        chargedNowCents: first.amountCents,
        totalCents: single.amountCents,
        remainingInstalments: splits.slice(1).map((s) => ({ label: s.label, amountCents: s.amountCents, dueDate: s.dueDate })),
        note: "Pay in 3: only Instalment 1 is charged at checkout. Instalments 2 and 3 are NOT auto-charged — they are due before filing and must be collected (invoice / checkout link). The 50% missed-payment rule is handled manually; Stripe cannot enforce it.",
        warnings,
      });
    }

    // --- Pay in Full (one or several one-time Prices) / Subscription -----
    const session = await stripe.checkout.sessions.create({
      mode: isSubscription ? "subscription" : "payment",
      customer_email: email || undefined,
      line_items: prices.map((p) => ({
        price: p.priceId,
        quantity: (p as LockedStripePrice & { quantity?: number }).quantity ?? 1,
      })),
      metadata,
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    const note =
      isSubscription && single?.cycles
        ? `Monthly plan: $${(single.amountCents / 100).toFixed(2)}/mo for ${single.cycles} payments, total $${((single.totalCents ?? single.amountCents * single.cycles) / 100).toFixed(2)}${single.monthlyDriftCents ? ` — Standard monthly totals drift ${single.monthlyDriftCents > 0 ? "+" : ""}${single.monthlyDriftCents}c vs the $1,799 bundle total (founder's exact monthly amounts, not changed).` : ""} The ${single.cycles}-payment stop is applied by the webhook (Subscription Schedule, ${single.cycles} iterations) when checkout completes — until then the subscription would run forever by default.`
        : isSubscription
          ? "Recurring subscription — open-ended (no cycle stop). Cancel anytime."
          : "Pay in Full — one payment for the full locked amount. USCIS government fees are separate and are never part of this payment.";

    return NextResponse.json({
      ok: true,
      url: session.url,
      sessionId: session.id,
      mode: isSubscription ? "subscription" : "payment",
      plan: effectivePlan,
      priceId: single?.priceId ?? prices.map((p) => p.priceId).join(","),
      totalCents,
      note,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: `Stripe could not create a Checkout Session: ${err instanceof Error ? err.message : "unknown error"}. Nothing was charged.`,
      },
      { status: 502 }
    );
  }
}
