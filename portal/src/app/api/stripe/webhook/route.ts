// POST /api/stripe/webhook — real Stripe webhook handler.
//
// Verifies the Stripe signature with STRIPE_WEBHOOK_SECRET before
// trusting ANYTHING in the payload. An unverified payload is rejected
// with 400 and changes nothing. Returns 501 when the secret is not set
// (no key, no verification, no unlock).
//
// Events handled:
//   * checkout.session.completed —
//       - Bundle Monthly (metadata plan monthly_6 / monthly_12):
//         applies the 6/12-payment stop via a Subscription Schedule
//         (iterations = cycles, end_behavior cancel) using
//         src/lib/stripeClient.ts applyMonthlyStop(). Until this runs,
//         a monthly subscription would run forever by default.
//       - Records the paid invoice in public.invoices (migration 0001:
//         case_id, client_id, description, service_fee_cents, status,
//         stripe_invoice_id) when the session metadata carries a
//         case_id + account_id. Without them, no invoice row is invented.
//       - For a professional subscription (metadata account_id + a
//         subscription price): sets professional_profiles
//         .subscription_status = 'active', and flips is_published = true
//         ONLY when accounts.verification_status is already 'verified'.
//         Listing never turns on from payment alone.
//   * invoice.paid — marks the matching public.invoices row (by
//     stripe_invoice_id) 'paid' with paid_at. If no row matches, the
//     event is acknowledged with a warning — no row is invented.
//   * Everything else: acknowledged, ignored.
//
// The 50% missed-payment rule has NO Stripe setting and is NOT enforced
// here — it is displayed to the client and handled manually.
// Database writes are best-effort: a DB failure is recorded in the
// warnings array and logged, but the route still returns 200 so Stripe
// does not retry the event forever. Signature failures return 400.
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { applyMonthlyStop, getStripe } from "@/lib/stripeClient";

export const runtime = "nodejs";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      {
        error:
          "Stripe webhook not configured — STRIPE_WEBHOOK_SECRET is not set. No invoice was updated and nothing was unlocked.",
      },
      { status: 501 }
    );
  }
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      { error: "Stripe not configured — STRIPE_SECRET_KEY is not set." },
      { status: 501 }
    );
  }
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe signature header." }, { status: 400 });
  }

  let event: ReturnType<typeof stripe.webhooks.constructEvent>;
  try {
    const rawBody = await req.text();
    event = stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch (err) {
    return NextResponse.json(
      {
        error: `Webhook signature verification failed — payload not trusted, nothing was changed: ${err instanceof Error ? err.message : "unknown error"}`,
      },
      { status: 400 }
    );
  }

  const warnings: string[] = [];
  const admin = getServiceClient();
  if (!admin) {
    warnings.push("Supabase is not configured — no invoice or listing was recorded in the database.");
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as {
      id: string;
      mode?: string;
      payment_status?: string;
      subscription?: string | null;
      invoice?: string | null;
      customer_details?: { email?: string | null } | null;
      metadata?: Record<string, string> | null;
    };
    const meta = session.metadata ?? {};
    const plan = meta.plan ?? "";
    const caseId = meta.case_id ?? "";
    const accountId = meta.account_id ?? "";
    const totalCents = Number(meta.total_cents ?? "0") || 0;
    const priceKey = meta.price_key ?? "";

    // 1) Bundle Monthly: apply the 6/12-payment stop.
    if ((plan === "monthly_6" || plan === "monthly_12") && session.subscription) {
      const cycles = plan === "monthly_6" ? 6 : 12;
      const result = await applyMonthlyStop(session.subscription, cycles as 6 | 12);
      if ("error" in result) {
        warnings.push(
          `Monthly stop NOT applied for subscription ${session.subscription}: ${result.error}. The subscription will keep billing until the stop is applied manually (Stripe Dashboard → Subscriptions → Duration → ${cycles} cycles).`
        );
      } else {
        warnings.push(
          `Monthly stop applied: subscription ${session.subscription} now ends after ${cycles} payments (schedule ${result.scheduleId}).`
        );
      }
    }

    // 2) Record the paid invoice (only with a real case + account).
    if (admin && caseId && accountId) {
      const paid = session.payment_status === "paid";
      const { error } = await admin.from("invoices").insert({
        case_id: caseId,
        client_id: accountId,
        provider_id: null,
        description: `${priceKey || "service"} — ${plan}`,
        service_fee_cents: totalCents,
        uscis_fee_cents: 0,
        status: paid ? "paid" : "open",
        stripe_invoice_id: session.invoice ?? null,
        stripe_checkout_url: null,
        paid_at: paid ? new Date().toISOString() : null,
      });
      if (error) warnings.push(`Invoice could not be recorded: ${error.message}.`);
      // Pay in 3: mark Instalment 1 as paid on the payment_plans row
      // the checkout route created (paid_cents was 0 at session
      // creation — nothing is paid until Stripe confirms it here).
      if (paid && meta.installment === "1_of_3") {
        const firstCents = Number(meta.installment_amount_cents ?? "0") || 0;
        const { error: planError } = await admin
          .from("payment_plans")
          .update({ paid_cents: firstCents })
          .eq("case_id", caseId)
          .eq("pay_choice", "installments_3")
          .eq("status", "active");
        if (planError) warnings.push(`Instalment 1 could not be marked paid: ${planError.message}.`);
      }
    } else if (admin && !caseId) {
      warnings.push("No case_id in the Checkout Session metadata — no invoice row was recorded.");
    }

    // 3) Professional subscription: mark active; publish ONLY if verified.
    if (admin && accountId && session.mode === "subscription" && session.subscription) {
      const { data: account } = await admin
        .from("accounts")
        .select("verification_status, role")
        .eq("id", accountId)
        .single();
      const verified = (account as { verification_status?: string } | null)?.verification_status === "verified";
      const { error } = await admin
        .from("professional_profiles")
        .update({
          subscription_status: "active",
          ...(verified ? { is_published: true } : {}),
        })
        .eq("account_id", accountId);
      if (error) {
        warnings.push(`Subscription status could not be recorded: ${error.message}.`);
      } else if (!verified) {
        warnings.push("Subscription is active, but the directory listing stays OFF until verification is approved.");
      }
    }
    return NextResponse.json({ received: true, event: event.type, warnings });
  }

  if (event.type === "invoice.paid") {
    const invoice = event.data.object as { id: string; subscription?: string | null };
    if (admin) {
      const { data, error } = await admin
        .from("invoices")
        .update({ status: "paid", paid_at: new Date().toISOString() })
        .eq("stripe_invoice_id", invoice.id)
        .select("id");
      if (error) {
        warnings.push(`Invoice ${invoice.id} could not be marked paid: ${error.message}.`);
      } else if (!data || data.length === 0) {
        warnings.push(`Invoice ${invoice.id} was paid in Stripe but has no matching public.invoices row — no row was invented.`);
      }
    }
    return NextResponse.json({ received: true, event: event.type, warnings });
  }

  return NextResponse.json({ received: true, event: event.type, ignored: true, warnings });
}
