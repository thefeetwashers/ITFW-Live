// Stripe client — SERVER ONLY. Never import this file from client code.
// The secret key comes from STRIPE_SECRET_KEY (Vercel / .env.local) and
// is never hardcoded, never logged, never sent to the browser.
// When the key is missing, getStripe() returns null and every caller
// must answer 501 "Stripe not configured" (the portal's existing
// 501 pattern) — never a fake checkout, never a fake charge.
import Stripe from "stripe";

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (!stripeClient) {
    stripeClient = new Stripe(key, { apiVersion: "2024-12-18.acacia" });
  }
  return stripeClient;
}

export const STRIPE_CONFIGURED = Boolean(process.env.STRIPE_SECRET_KEY);

/** The 50% missed-payment rule has NO Stripe setting. Stripe Billing
 *  offers retries, then cancel / pause / mark unpaid / leave past-due
 *  only. The rule is displayed to the client (see lib/order.ts
 *  Payment Centre) and enforced manually — never as a Stripe Price. */
export const MISSED_PAYMENT_RULE_NOTE =
  "If you miss a payment, 50% is added to the total amount. Stripe cannot enforce this automatically — it is handled manually by the platform.";

/**
 * Apply the bundle Monthly stop: convert a just-created subscription
 * into a Subscription Schedule that ends after `cycles` billing cycles
 * (6 or 12), then cancels. Stripe Prices carry no cycle limit — the
 * stop only exists if this runs. Call from the webhook on
 * checkout.session.completed when the session metadata says
 * plan=bundle_monthly and cycles=6|12.
 * Returns the schedule id, or an error string (caller records it as a
 * webhook warning — it must NOT fail the webhook acknowledgement, or
 * Stripe will retry the event forever). The optional `client`
 * parameter is for tests only — production callers omit it.
 */
export async function applyMonthlyStop(
  subscriptionId: string,
  cycles: 6 | 12,
  client?: Stripe
): Promise<{ scheduleId: string } | { error: string }> {
  const stripe = client ?? getStripe();
  if (!stripe) return { error: "Stripe not configured — STRIPE_SECRET_KEY is not set." };
  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const firstItem = subscription.items.data[0];
    if (!firstItem) return { error: `Subscription ${subscriptionId} has no items.` };
    const priceId = firstItem.price.id;
    const schedule = await stripe.subscriptionSchedules.create({
      from_subscription: subscriptionId,
    });
    await stripe.subscriptionSchedules.update(schedule.id, {
      end_behavior: "cancel",
      phases: [
        {
          items: [{ price: priceId, quantity: firstItem.quantity ?? 1 }],
          iterations: cycles,
        },
      ],
    });
    return { scheduleId: schedule.id };
  } catch (err) {
    return {
      error: `Could not apply the ${cycles}-payment stop to subscription ${subscriptionId}: ${
        err instanceof Error ? err.message : "unknown error"
      }`,
    };
  }
}
