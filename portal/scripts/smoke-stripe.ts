// Code-level smoke test for the Stripe wiring — run with:
//   npx -y tsx scripts/smoke-stripe.ts
// (tsx is NOT a project dependency; it is fetched on demand for this
// test only. No Stripe network call ever succeeds here: the key used
// is FAKE, so every real Stripe call fails with 401 / network error
// and is asserted as a 502 from the route. Nothing is charged, no
// customer/subscription is created, no real key is used.)
import assert from "node:assert/strict";
import {
  LOCKED_STRIPE_PRICE_COUNT,
  LOCKED_PRICE_BY_KEY,
  getLockedPriceById,
  getLockedPriceByKey,
} from "../src/lib/stripePrices";
import { applyMonthlyStop } from "../src/lib/stripeClient";
import { POST as checkoutPost } from "../src/app/api/checkout/route";
import { POST as webhookPost } from "../src/app/api/stripe/webhook/route";

process.env.STRIPE_SECRET_KEY = "";
process.env.STRIPE_WEBHOOK_SECRET = "";

async function main() {
let passed = 0;
function ok(name: string, cond: boolean) {
  assert.equal(cond, true, name);
  passed += 1;
  console.log(`  PASS ${name}`);
}

// 1) Locked price map: 132 Prices, all real-looking, no duplicates.
console.log("price map");
ok("LOCKED_STRIPE_PRICE_COUNT is 132", LOCKED_STRIPE_PRICE_COUNT === 132);
const ids = Object.values(LOCKED_PRICE_BY_KEY).map((p) => p.priceId);
ok("every Price ID starts with price_1Uf", ids.every((id) => id.startsWith("price_1Uf")));
ok("no duplicate Price IDs", new Set(ids).size === ids.length);
ok(
  "bundle monthly prices carry cycles 6/12",
  ["bundle_monthly_basic_6", "bundle_monthly_basic_12", "bundle_monthly_standard_6", "bundle_monthly_standard_12", "bundle_monthly_premium_6", "bundle_monthly_premium_12"].every(
    (k) => getLockedPriceByKey(k)?.cycles === 6 || getLockedPriceByKey(k)?.cycles === 12
  )
);
ok("unknown key returns undefined", getLockedPriceByKey("nope_not_real") === undefined);
ok("unknown Price ID returns undefined", getLockedPriceById("price_1UfNOTREAL") === undefined);

// 2) Checkout without a key → 501.
console.log("checkout — missing key");
{
  const res = await checkoutPost(
    new Request("http://localhost/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priceId: "price_1UfROkPfd9SRUcvhACVlMQdq" }),
    })
  );
  ok("missing key returns 501", res.status === 501);
  const data = (await res.json()) as { error?: string };
  ok("501 message names STRIPE_SECRET_KEY", (data.error ?? "").includes("STRIPE_SECRET_KEY"));
}

// 3) Checkout with a FAKE key: unknown Price ID → 400 (rejected before any Stripe call).
console.log("checkout — fake key, unknown Price ID");
process.env.STRIPE_SECRET_KEY = "sk_test_FAKE_000000000000000000000000";
{
  const res = await checkoutPost(
    new Request("http://localhost/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priceId: "price_1UfNOTREAL" }),
    })
  );
  ok("unknown Price ID returns 400", res.status === 400);
  const data = (await res.json()) as { error?: string };
  ok("400 message says a locked Price is required", (data.error ?? "").includes("locked Price"));
}

// 4) Checkout with a FAKE key: locked one-time Price → 502 (reaches Stripe, fake key rejected).
console.log("checkout — fake key, locked Price");
{
  const res = await checkoutPost(
    new Request("http://localhost/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priceId: "price_1UfROkPfd9SRUcvhACVlMQdq", plan: "full" }),
    })
  );
  ok("locked Price with fake key returns 502 (Stripe call attempted, rejected)", res.status === 502);
}

// 5) Checkout with a FAKE key: Pay in 3 + bundle monthly pass validation (502, not 400).
console.log("checkout — Pay in 3 and bundle monthly plans");
{
  const res = await checkoutPost(
    new Request("http://localhost/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priceId: "price_1UfROkPfd9SRUcvhACVlMQdq", plan: "installments_3" }),
    })
  );
  ok("Pay in 3 passes validation (502 with fake key)", res.status === 502);
  const res2 = await checkoutPost(
    new Request("http://localhost/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priceId: "price_1UfSJfPfd9SRUcvhrjImjfrS", plan: "monthly_6" }),
    })
  );
  ok("bundle monthly 6 passes validation (502 with fake key)", res2.status === 502);
  const res3 = await checkoutPost(
    new Request("http://localhost/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priceId: "price_1UfSJfPfd9SRUcvhrjImjfrS", plan: "monthly_12" }),
    })
  );
  ok("bundle monthly with the WRONG cycle count is rejected (400)", res3.status === 400);
}

// 6) Webhook without a secret → 501; with a bad signature → 400.
console.log("webhook — missing secret / bad signature");
{
  const res = await webhookPost(new Request("http://localhost/api/stripe/webhook", { method: "POST", body: "{}" }));
  ok("missing webhook secret returns 501", res.status === 501);
}
process.env.STRIPE_WEBHOOK_SECRET = "whsec_FAKE_000000000000000000000000";
{
  const res = await webhookPost(
    new Request("http://localhost/api/stripe/webhook", {
      method: "POST",
      headers: { "stripe-signature": "t=1,v1=deadbeef" },
      body: "{}",
    })
  );
  ok("bad signature returns 400", res.status === 400);
  const data = (await res.json()) as { error?: string };
  ok("400 message says signature verification failed", (data.error ?? "").includes("signature verification failed"));
}

// 7) Monthly stop: fake Stripe client records the schedule params.
console.log("monthly stop — Subscription Schedule iterations");
{
  const calls: unknown[] = [];
  const fake = {
    subscriptions: {
      retrieve: async () => ({
        items: { data: [{ price: { id: "price_1UfSJfPfd9SRUcvhrjImjfrS" }, quantity: 1 }] },
        current_period_end: 1790000000,
        customer: "cus_fake",
      }),
    },
    subscriptionSchedules: {
      create: async () => ({ id: "sub_sched_fake" }),
      update: async (_id: string, params: unknown) => {
        calls.push(params);
        return { id: "sub_sched_fake" };
      },
    },
  } as never;
  const r6 = await applyMonthlyStop("sub_fake", 6, fake);
  ok("6-cycle stop returns a schedule id", !("error" in r6) && r6.scheduleId === "sub_sched_fake");
  const p6 = calls[0] as { phases?: { iterations?: number; end_date?: number }[]; end_behavior?: string };
  ok("6-cycle schedule has iterations 6", p6.phases?.[0]?.iterations === 6);
  ok("6-cycle schedule end_behavior is cancel", p6.end_behavior === "cancel");
  const r12 = await applyMonthlyStop("sub_fake", 12, fake);
  ok("12-cycle stop returns a schedule id", !("error" in r12));
  const p12 = calls[1] as { phases?: { iterations?: number }[] };
  ok("12-cycle schedule has iterations 12", p12.phases?.[0]?.iterations === 12);
}

console.log(`\nSMOKE STRIPE: ${passed} assertions passed.`);
}

main().catch((err) => {
  console.error("SMOKE STRIPE FAILED:", err);
  process.exit(1);
});
