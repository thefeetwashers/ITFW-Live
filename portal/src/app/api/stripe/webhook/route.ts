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
//         FIX (Nov 28, 2026, migration 0037): the invoice row now
//         carries form_code (from session metadata, else from the
//         locked Price's formCode) — before this fix it was never
//         written, so a paid single-form payment could not prove
//         WHICH form was paid for.
//       - DIY purchase (diy_form / diy_bundle): writes a diy_unlocks
//         row (migration 0024) — client + case + form_code (NULL =
//         case-scoped / bundle) + is_bundle + price + Stripe
//         checkout session id, status 'paid'. Idempotent on the
//         checkout session id: a replayed event never creates a
//         second unlock.
//       - Subscription purchase (Member / Law Student / Preparer /
//         Attorney / DOJ / Employer): writes a subscriptions row
//         (migration 0037) — account + locked price key/id + plan +
//         status 'active' + Stripe subscription / customer /
//         checkout ids. Idempotent on stripe_subscription_id. This
//         is the record the paywall reads for a payer with no case
//         (a Member / Law Student checkout carries no case_id, so
//         no invoices row can exist for them). professional_profiles
//         .subscription_plan + subscription_status are set to
//         'active' for professional prices, and
//         student_profiles.subscription_status to 'active' for the
//         Law Student price. is_published flips to true ONLY when
//         accounts.verification_status is already 'verified'.
//         Listing never turns on from payment alone.
//       - Pay in 3: marks Instalment 1 as paid on the payment_plans
//         row the checkout route created.
//   * checkout.session.completed with metadata.translation_order_id —
//     flips that translation_orders row (migration 0033)
//     payment_status to 'paid'. Order status stays 'pending' until a
//     real translation is delivered — payment is not delivery.
//   * invoice.paid — marks the matching public.invoices row (by
//     stripe_invoice_id) 'paid' with paid_at. If no row matches, the
//     event is acknowledged with a warning — no row is invented. A
//     matching subscriptions row is also flipped to 'active'.
//   * Everything else: acknowledged, ignored.
//
// The database writes live in src/lib/webhookRecords.ts so they can
// be tested without Stripe or Supabase (see
// scripts/smoke-webhook-fix.ts — an in-memory fake admin client).
// This route only verifies the signature, applies the monthly stop
// (which needs the Stripe client), and delegates the writes.
//
// The 50% missed-payment rule has NO Stripe setting and is NOT enforced
// here — it is displayed to the client and handled manually.
// Database writes are best-effort: a DB failure is recorded in the
// warnings array and logged, but the route still returns 200 so Stripe
// does not retry the event forever. Signature failures return 400.
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { applyMonthlyStop, getStripe } from "@/lib/stripeClient";
import {
  recordCheckoutCompleted,
  recordInvoicePaid,
  type AdminClient,
} from "@/lib/webhookRecords";

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

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as {
      id: string;
      mode?: string;
      payment_status?: string;
      subscription?: string | null;
      invoice?: string | null;
      customer?: string | null;
      metadata?: Record<string, string> | null;
    };
    const meta = session.metadata ?? {};
    const plan = meta.plan ?? "";

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

    // 2) Database records — invoice (with form_code), Pay-in-3,
    //    translation order, DIY unlock, subscription record.
    //    See src/lib/webhookRecords.ts. When Supabase is not
    //    configured the helper records a warning and writes nothing.
    const recorded = await recordCheckoutCompleted(
      admin as unknown as AdminClient | null,
      session
    );
    warnings.push(...recorded.warnings);
    return NextResponse.json({ received: true, event: event.type, warnings });
  }

  if (event.type === "invoice.paid") {
    const invoice = event.data.object as { id: string; subscription?: string | null };
    const recorded = await recordInvoicePaid(
      admin as unknown as AdminClient | null,
      invoice
    );
    warnings.push(...recorded.warnings);
    return NextResponse.json({ received: true, event: event.type, warnings });
  }

  return NextResponse.json({ received: true, event: event.type, ignored: true, warnings });
}
