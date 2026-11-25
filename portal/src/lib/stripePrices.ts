// Locked Stripe Prices — Immigration with NIPTEI.
// Created Nov 24, 2026 in Stripe account acct_1UVh7DPfd9SRUcvh
// ("IMMIGRATION WITH THE FEET WASHERS", THE FEET WASHERS INC), LIVE mode,
// USD. Source: the Nov 24, 2026 Stripe completion report (132 Prices).
// These Price IDs are PUBLIC identifiers (they appear in Checkout URLs
// and in the audit report shared with the founder) — they are NOT secrets.
// The secret key is NEVER in this file; it comes from STRIPE_SECRET_KEY
// in Vercel / .env.local only (see src/lib/stripeClient.ts).
//
// Rules:
//   * Never accept a Price ID from a client unless it is in this map
//     (see getLockedPriceById / isLockedPriceId). An unknown Price ID
//     is rejected by /api/checkout with 400.
//   * Never invent a Price ID. If a price is missing from this map,
//     stop and report it — do not guess.
//   * Amounts are integer cents and match the locked site prices.
//   * Monthly bundle totals: Basic and Premium sum exactly to the
//     bundle total. Standard does NOT: 6 x $299.83 = $1,798.98 (2c
//     UNDER $1,799) and 12 x $149.92 = $1,799.04 (4c OVER $1,799).
//     The founder's exact monthly amounts are used as given — the
//     drift is recorded on each Standard monthly entry and surfaced
//     in checkout, not silently corrected.
//   * Pay in 3 has NO Stripe Price: it is the one-time Price paid in
//     3 instalments (first instalment at checkout, see
//     /api/checkout). The 50% missed-payment rule has NO Stripe
//     setting — manual handling only, never a penalty Price.

export type StripePriceKind = "one_time" | "recurring_monthly" | "recurring_yearly";

export interface LockedStripePrice {
  /** Stable key used by portal code, e.g. "bundle_standard". */
  key: string;
  /** Stripe Price ID, e.g. "price_1UfROxPfd9SRUcvhJfRxiU3K". */
  priceId: string;
  /** Human label shown at checkout. */
  label: string;
  /** Amount in integer cents. */
  amountCents: number;
  kind: StripePriceKind;
  /** USCIS form code, for single-form prices (e.g. "I-485"). */
  formCode?: string;
  /** Tier, for single-form / bundle prices. */
  tier?: "basic" | "standard" | "premium";
  /** Fixed billing cycles, for bundle monthly prices (6 or 12). */
  cycles?: 6 | 12;
  /** Total charged over all cycles, for monthly prices. */
  totalCents?: number;
  /** Signed drift vs the bundle total, in cents (Standard monthly only). */
  monthlyDriftCents?: number;
}

export const LOCKED_STRIPE_PRICES: LockedStripePrice[] = [
  // --- Green Card Bundle, one-time (Pay in Full) -------------------------
  { key: "bundle_basic", priceId: "price_1UfROkPfd9SRUcvhACVlMQdq", label: "Green Card Bundle — Basic", amountCents: 99900, kind: "one_time", tier: "basic" },
  { key: "bundle_standard", priceId: "price_1UfROxPfd9SRUcvhJfRxiU3K", label: "Green Card Bundle — Standard", amountCents: 179900, kind: "one_time", tier: "standard" },
  { key: "bundle_premium", priceId: "price_1UfRPMPfd9SRUcvhGvhp8R8A", label: "Green Card Bundle — Premium", amountCents: 279900, kind: "one_time", tier: "premium" },

  // --- Green Card Bundle, Monthly Payment Plan (recurring, fixed cycles) -
  // The 6/12-payment stop is NOT a property of these Prices. It is applied
  // where the subscription is created: /api/checkout creates the Checkout
  // Session in subscription mode, and /api/stripe/webhook applies a
  // Subscription Schedule with iterations = cycles on
  // checkout.session.completed. Until the webhook runs, a monthly
  // subscription would run forever by default — never claim the stop is
  // set until the webhook has applied it.
  { key: "bundle_monthly_basic_6", priceId: "price_1UfSIdPfd9SRUcvhRo1G91LK", label: "Green Card Bundle — Basic, monthly (6 payments)", amountCents: 16650, kind: "recurring_monthly", tier: "basic", cycles: 6, totalCents: 99900 },
  { key: "bundle_monthly_basic_12", priceId: "price_1UfSJLPfd9SRUcvhPFNuTBRs", label: "Green Card Bundle — Basic, monthly (12 payments)", amountCents: 8325, kind: "recurring_monthly", tier: "basic", cycles: 12, totalCents: 99900 },
  { key: "bundle_monthly_standard_6", priceId: "price_1UfSJfPfd9SRUcvhrjImjfrS", label: "Green Card Bundle — Standard, monthly (6 payments)", amountCents: 29983, kind: "recurring_monthly", tier: "standard", cycles: 6, totalCents: 179898, monthlyDriftCents: -2 },
  { key: "bundle_monthly_standard_12", priceId: "price_1UfSJzPfd9SRUcvh9bSrccEn", label: "Green Card Bundle — Standard, monthly (12 payments)", amountCents: 14992, kind: "recurring_monthly", tier: "standard", cycles: 12, totalCents: 179904, monthlyDriftCents: 4 },
  { key: "bundle_monthly_premium_6", priceId: "price_1UfSKJPfd9SRUcvhc9WcxsR2", label: "Green Card Bundle — Premium, monthly (6 payments)", amountCents: 46650, kind: "recurring_monthly", tier: "premium", cycles: 6, totalCents: 279900 },
  { key: "bundle_monthly_premium_12", priceId: "price_1UfSKePfd9SRUcvhniZEJ96i", label: "Green Card Bundle — Premium, monthly (12 payments)", amountCents: 23325, kind: "recurring_monthly", tier: "premium", cycles: 12, totalCents: 279900 },

  // --- Subscriptions (recurring, open-ended — NOT the bundle monthly plan) --
  { key: "member_monthly", priceId: "price_1UfRQ2Pfd9SRUcvhHPVve9is", label: "Member — $9.80/mo", amountCents: 980, kind: "recurring_monthly" },
  { key: "member_yearly", priceId: "price_1UfRQPPfd9SRUcvhkEpDlpvv", label: "Member — $98/yr", amountCents: 9800, kind: "recurring_yearly" },
  { key: "subscription_preparer", priceId: "price_1UfRQoPfd9SRUcvhJCKYrmoX", label: "Document Preparer — $49/mo", amountCents: 4900, kind: "recurring_monthly" },
  { key: "subscription_attorney", priceId: "price_1UfRRDPfd9SRUcvht0rw2pqX", label: "Licensed Attorney — $99/mo", amountCents: 9900, kind: "recurring_monthly" },
  { key: "subscription_doj_standard", priceId: "price_1UfRRfPfd9SRUcvhWLMUae83", label: "DOJ Nonprofit — Standard $24.50/mo", amountCents: 2450, kind: "recurring_monthly" },
  { key: "subscription_doj_full", priceId: "price_1UfRRuPfd9SRUcvhni5Povvs", label: "DOJ Nonprofit — Full $49.50/mo", amountCents: 4950, kind: "recurring_monthly" },
  { key: "subscription_law_student", priceId: "price_1UfRSVPfd9SRUcvhcC89fIoB", label: "Law Student — $35/mo", amountCents: 3500, kind: "recurring_monthly" },
  { key: "subscription_employer", priceId: "price_1UfRT7Pfd9SRUcvhLo1yrnrx", label: "Employer — $49/mo", amountCents: 4900, kind: "recurring_monthly" },

  // --- Single-form tiers, one-time (92 Prices) ---------------------------
  // I-821 covers I-821 and I-821D (one product, no duplicate).
  // I-134A is a separate product from I-134. I-864A (form) is distinct
  // from the I-864A add-on ($150, see add-ons below).
  { key: "i-485_basic", priceId: "price_1UfRYiPfd9SRUcvhDmLumyYP", label: "I-485 — Basic", amountCents: 75000, kind: "one_time", formCode: "I-485", tier: "basic" },
  { key: "i-485_standard", priceId: "price_1UfRYzPfd9SRUcvhdsrA9rFR", label: "I-485 — Standard", amountCents: 120000, kind: "one_time", formCode: "I-485", tier: "standard" },
  { key: "i-485_premium", priceId: "price_1UfRZJPfd9SRUcvhkBcjTvEe", label: "I-485 — Premium", amountCents: 150000, kind: "one_time", formCode: "I-485", tier: "premium" },
  { key: "i-130_basic", priceId: "price_1UfRZnPfd9SRUcvh0ZOoIHNw", label: "I-130 — Basic", amountCents: 29900, kind: "one_time", formCode: "I-130", tier: "basic" },
  { key: "i-130_standard", priceId: "price_1UfRa7Pfd9SRUcvhmHHkHZkM", label: "I-130 — Standard", amountCents: 49900, kind: "one_time", formCode: "I-130", tier: "standard" },
  { key: "i-130_premium", priceId: "price_1UfS3kPfd9SRUcvh6MWxfWp3", label: "I-130 — Premium", amountCents: 75000, kind: "one_time", formCode: "I-130", tier: "premium" },
  { key: "i-765_basic", priceId: "price_1UfRaaPfd9SRUcvhzH3Stvuu", label: "I-765 — Basic", amountCents: 12900, kind: "one_time", formCode: "I-765", tier: "basic" },
  { key: "i-765_standard", priceId: "price_1UfRaqPfd9SRUcvhXlf7EERW", label: "I-765 — Standard", amountCents: 24900, kind: "one_time", formCode: "I-765", tier: "standard" },
  { key: "i-765_premium", priceId: "price_1UfS48Pfd9SRUcvh2IzGlPUH", label: "I-765 — Premium", amountCents: 35000, kind: "one_time", formCode: "I-765", tier: "premium" },
  { key: "i-131_basic", priceId: "price_1UfRbSPfd9SRUcvhwDe7Kxv3", label: "I-131 — Basic", amountCents: 25000, kind: "one_time", formCode: "I-131", tier: "basic" },
  { key: "i-131_standard", priceId: "price_1UfRbgPfd9SRUcvhoT18r6BD", label: "I-131 — Standard", amountCents: 32500, kind: "one_time", formCode: "I-131", tier: "standard" },
  { key: "i-131_premium", priceId: "price_1UfRbvPfd9SRUcvht9rSoXft", label: "I-131 — Premium", amountCents: 40000, kind: "one_time", formCode: "I-131", tier: "premium" },
  { key: "i-864_basic", priceId: "price_1UfRcRPfd9SRUcvhJLn5yKoQ", label: "I-864 — Basic", amountCents: 9900, kind: "one_time", formCode: "I-864", tier: "basic" },
  { key: "i-864_standard", priceId: "price_1UfRciPfd9SRUcvhesjs5a8a", label: "I-864 — Standard", amountCents: 17500, kind: "one_time", formCode: "I-864", tier: "standard" },
  { key: "i-864_premium", priceId: "price_1UfS4ZPfd9SRUcvhUZ9rJzLl", label: "I-864 — Premium", amountCents: 25000, kind: "one_time", formCode: "I-864", tier: "premium" },
  { key: "i-90_basic", priceId: "price_1UfRdTPfd9SRUcvh180ErEMy", label: "I-90 — Basic", amountCents: 12900, kind: "one_time", formCode: "I-90", tier: "basic" },
  { key: "i-90_standard", priceId: "price_1UfRe5Pfd9SRUcvh3iNDr", label: "I-90 — Standard", amountCents: 24000, kind: "one_time", formCode: "I-90", tier: "standard" },
  { key: "i-90_premium", priceId: "price_1UfReRPfd9SRUcvhpO3vXF9N", label: "I-90 — Premium", amountCents: 35000, kind: "one_time", formCode: "I-90", tier: "premium" },
  { key: "i-539_basic", priceId: "price_1UfRf5Pfd9SRUcvhuPHk31sz", label: "I-539 — Basic", amountCents: 25000, kind: "one_time", formCode: "I-539", tier: "basic" },
  { key: "i-539_standard", priceId: "price_1UfRfJPfd9SRUcvhT1AcoZY1", label: "I-539 — Standard", amountCents: 37500, kind: "one_time", formCode: "I-539", tier: "standard" },
  { key: "i-539_premium", priceId: "price_1UfRfYPfd9SRUcvh7y7W0yJw", label: "I-539 — Premium", amountCents: 50000, kind: "one_time", formCode: "I-539", tier: "premium" },
  { key: "n-400_basic", priceId: "price_1UfRg0Pfd9SRUcvhUmfsAID8", label: "N-400 — Basic", amountCents: 19900, kind: "one_time", formCode: "N-400", tier: "basic" },
  { key: "n-400_standard", priceId: "price_1UfRgLPfd9SRUcvhfvsCMHtI", label: "N-400 — Standard", amountCents: 40000, kind: "one_time", formCode: "N-400", tier: "standard" },
  { key: "n-400_premium", priceId: "price_1UfRgbPfd9SRUcvhl74bTQT9", label: "N-400 — Premium", amountCents: 60000, kind: "one_time", formCode: "N-400", tier: "premium" },
  { key: "i-751_basic", priceId: "price_1UfRh4Pfd9SRUcvhupmib8wm", label: "I-751 — Basic", amountCents: 13900, kind: "one_time", formCode: "I-751", tier: "basic" },
  { key: "i-751_standard", priceId: "price_1UfRhNPfd9SRUcvh2LjK3PVB", label: "I-751 — Standard", amountCents: 29500, kind: "one_time", formCode: "I-751", tier: "standard" },
  { key: "i-751_premium", priceId: "price_1UfRhbPfd9SRUcvhNk8ukJge", label: "I-751 — Premium", amountCents: 44900, kind: "one_time", formCode: "I-751", tier: "premium" },
  { key: "i-129f_basic", priceId: "price_1UfRi5Pfd9SRUcvh6oaAq0SN", label: "I-129F — Basic", amountCents: 75000, kind: "one_time", formCode: "I-129F", tier: "basic" },
  { key: "i-129f_standard", priceId: "price_1UfRiIPfd9SRUcvhFittnSaG", label: "I-129F — Standard", amountCents: 92500, kind: "one_time", formCode: "I-129F", tier: "standard" },
  { key: "i-129f_premium", priceId: "price_1UfRiXPfd9SRUcvhlTvhnj7D", label: "I-129F — Premium", amountCents: 109500, kind: "one_time", formCode: "I-129F", tier: "premium" },
  { key: "i-821_basic", priceId: "price_1UfRj0Pfd9SRUcvhCnQi3rl2", label: "I-821 — Basic", amountCents: 18900, kind: "one_time", formCode: "I-821", tier: "basic" },
  { key: "i-821_standard", priceId: "price_1UfRjFPfd9SRUcvh7YewnXTy", label: "I-821 — Standard", amountCents: 29500, kind: "one_time", formCode: "I-821", tier: "standard" },
  { key: "i-821_premium", priceId: "price_1UfRjTPfd9SRUcvhKogYeCHQ", label: "I-821 — Premium", amountCents: 40000, kind: "one_time", formCode: "I-821", tier: "premium" },
  { key: "i-589_basic", priceId: "price_1UfRjrPfd9SRUcvhqMK1IEFw", label: "I-589 — Basic", amountCents: 90000, kind: "one_time", formCode: "I-589", tier: "basic" },
  { key: "i-589_standard", priceId: "price_1UfRk5Pfd9SRUcvhclMCdGUd", label: "I-589 — Standard", amountCents: 105000, kind: "one_time", formCode: "I-589", tier: "standard" },
  { key: "i-589_premium", priceId: "price_1UfRkLPfd9SRUcvhkIn5IagD", label: "I-589 — Premium", amountCents: 120000, kind: "one_time", formCode: "I-589", tier: "premium" },
  { key: "ar-11_basic", priceId: "price_1UfRlJPfd9SRUcvhjluEjR4o", label: "AR-11 — Basic", amountCents: 2500, kind: "one_time", formCode: "AR-11", tier: "basic" },
  { key: "ar-11_standard", priceId: "price_1UfRknPfd9SRUcvhmZRGwNzA", label: "AR-11 — Standard", amountCents: 4000, kind: "one_time", formCode: "AR-11", tier: "standard" },
  { key: "ar-11_premium", priceId: "price_1UfRl4Pfd9SRUcvhZrepsbtk", label: "AR-11 — Premium", amountCents: 6000, kind: "one_time", formCode: "AR-11", tier: "premium" },
  { key: "g-639_basic", priceId: "price_1UfRmFPfd9SRUcvhxzW5AGeS", label: "G-639 — Basic", amountCents: 9900, kind: "one_time", formCode: "G-639", tier: "basic" },
  { key: "g-639_standard", priceId: "price_1UfRlkPfd9SRUcvhOdy3RcyR", label: "G-639 — Standard", amountCents: 14900, kind: "one_time", formCode: "G-639", tier: "standard" },
  { key: "g-639_premium", priceId: "price_1UfRlzPfd9SRUcvhUkxWRONp", label: "G-639 — Premium", amountCents: 19900, kind: "one_time", formCode: "G-639", tier: "premium" },
  { key: "i-134_basic", priceId: "price_1UfRmgPfd9SRUcvhHTkhjIZg", label: "I-134 — Basic", amountCents: 15000, kind: "one_time", formCode: "I-134", tier: "basic" },
  { key: "i-134_standard", priceId: "price_1UfRmvPfd9SRUcvhU2XOqos3", label: "I-134 — Standard", amountCents: 25000, kind: "one_time", formCode: "I-134", tier: "standard" },
  { key: "i-134_premium", priceId: "price_1UfRn8Pfd9SRUcvhdXQjMUh4", label: "I-134 — Premium", amountCents: 35000, kind: "one_time", formCode: "I-134", tier: "premium" },
  { key: "i-134a_basic", priceId: "price_1UfRncPfd9SRUcvh2bNEjNQ2", label: "I-134A — Basic", amountCents: 15000, kind: "one_time", formCode: "I-134A", tier: "basic" },
  { key: "i-134a_standard", priceId: "price_1UfRnsPfd9SRUcvhgLrkFMFh", label: "I-134A — Standard", amountCents: 25000, kind: "one_time", formCode: "I-134A", tier: "standard" },
  { key: "i-134a_premium", priceId: "price_1UfRo8Pfd9SRUcvhEnMnGGCl", label: "I-134A — Premium", amountCents: 35000, kind: "one_time", formCode: "I-134A", tier: "premium" },
  { key: "n-565_basic", priceId: "price_1UfRoZPfd9SRUcvh58qgTEpv", label: "N-565 — Basic", amountCents: 25000, kind: "one_time", formCode: "N-565", tier: "basic" },
  { key: "n-565_standard", priceId: "price_1UfRoqPfd9SRUcvhUxrEYa8z", label: "N-565 — Standard", amountCents: 42500, kind: "one_time", formCode: "N-565", tier: "standard" },
  { key: "n-565_premium", priceId: "price_1UfRp4Pfd9SRUcvhxEmNRzZy", label: "N-565 — Premium", amountCents: 59900, kind: "one_time", formCode: "N-565", tier: "premium" },
  { key: "i-129_basic", priceId: "price_1UfRphPfd9SRUcvhnxWxxVbR", label: "I-129 — Basic", amountCents: 75000, kind: "one_time", formCode: "I-129", tier: "basic" },
  { key: "i-129_standard", priceId: "price_1UfRq3Pfd9SRUcvhtH845KDx", label: "I-129 — Standard", amountCents: 100000, kind: "one_time", formCode: "I-129", tier: "standard" },
  { key: "i-129_premium", priceId: "price_1UfRqOPfd9SRUcvhV6QhKMH9", label: "I-129 — Premium", amountCents: 125000, kind: "one_time", formCode: "I-129", tier: "premium" },
  { key: "i-140_basic", priceId: "price_1UfRqtPfd9SRUcvhBBY2NLp4", label: "I-140 — Basic", amountCents: 75000, kind: "one_time", formCode: "I-140", tier: "basic" },
  { key: "i-140_standard", priceId: "price_1UfRr8Pfd9SRUcvhd0nA8G4I", label: "I-140 — Standard", amountCents: 110000, kind: "one_time", formCode: "I-140", tier: "standard" },
  { key: "i-140_premium", priceId: "price_1UfRrPPfd9SRUcvhptxt0UJq", label: "I-140 — Premium", amountCents: 145900, kind: "one_time", formCode: "I-140", tier: "premium" },
  { key: "i-360_basic", priceId: "price_1UfRsOPfd9SRUcvhRDghYAxy", label: "I-360 — Basic", amountCents: 59900, kind: "one_time", formCode: "I-360", tier: "basic" },
  { key: "i-360_standard", priceId: "price_1UfRrqPfd9SRUcvhAdrqbX5e", label: "I-360 — Standard", amountCents: 75000, kind: "one_time", formCode: "I-360", tier: "standard" },
  { key: "i-360_premium", priceId: "price_1UfRs8Pfd9SRUcvhz7Yk72Ym", label: "I-360 — Premium", amountCents: 90000, kind: "one_time", formCode: "I-360", tier: "premium" },
  { key: "i-601_basic", priceId: "price_1UfRu3Pfd9SRUcvhZ3V6Pdow", label: "I-601 — Basic", amountCents: 79900, kind: "one_time", formCode: "I-601", tier: "basic" },
  { key: "i-601_standard", priceId: "price_1UfRstPfd9SRUcvhyryKV5Pt", label: "I-601 — Standard", amountCents: 100000, kind: "one_time", formCode: "I-601", tier: "standard" },
  { key: "i-601_premium", priceId: "price_1UfRtoPfd9SRUcvhWRw0tWUk", label: "I-601 — Premium", amountCents: 120000, kind: "one_time", formCode: "I-601", tier: "premium" },
  { key: "i-601a_basic", priceId: "price_1UfRusPfd9SRUcvhUP7d4rKI", label: "I-601A — Basic", amountCents: 79900, kind: "one_time", formCode: "I-601A", tier: "basic" },
  { key: "i-601a_standard", priceId: "price_1UfRuSPfd9SRUcvhjjHJZnXH", label: "I-601A — Standard", amountCents: 100000, kind: "one_time", formCode: "I-601A", tier: "standard" },
  { key: "i-601a_premium", priceId: "price_1UfRufPfd9SRUcvhRsq3e2fq", label: "I-601A — Premium", amountCents: 120000, kind: "one_time", formCode: "I-601A", tier: "premium" },
  { key: "i-212_basic", priceId: "price_1UfRvnPfd9SRUcvhUBfnsgpL", label: "I-212 — Basic", amountCents: 79900, kind: "one_time", formCode: "I-212", tier: "basic" },
  { key: "i-212_standard", priceId: "price_1UfRvJPfd9SRUcvh7WrFPYAc", label: "I-212 — Standard", amountCents: 100000, kind: "one_time", formCode: "I-212", tier: "standard" },
  { key: "i-212_premium", priceId: "price_1UfRvaPfd9SRUcvhdi0UcihM", label: "I-212 — Premium", amountCents: 120000, kind: "one_time", formCode: "I-212", tier: "premium" },
  { key: "i-290b_basic", priceId: "price_1UfRwHPfd9SRUcvheXckEt2l", label: "I-290B — Basic", amountCents: 59900, kind: "one_time", formCode: "I-290B", tier: "basic" },
  { key: "i-290b_standard", priceId: "price_1UfRwWPfd9SRUcvhBQO0yOTZ", label: "I-290B — Standard", amountCents: 75000, kind: "one_time", formCode: "I-290B", tier: "standard" },
  { key: "i-290b_premium", priceId: "price_1UfRwjPfd9SRUcvhnNAUMaDD", label: "I-290B — Premium", amountCents: 89900, kind: "one_time", formCode: "I-290B", tier: "premium" },
  { key: "i-824_basic", priceId: "price_1UfRx9Pfd9SRUcvhR87z2ugM", label: "I-824 — Basic", amountCents: 19900, kind: "one_time", formCode: "I-824", tier: "basic" },
  { key: "i-824_standard", priceId: "price_1UfRxLPfd9SRUcvhmLCzvmtu", label: "I-824 — Standard", amountCents: 27500, kind: "one_time", formCode: "I-824", tier: "standard" },
  { key: "i-824_premium", priceId: "price_1UfRxXPfd9SRUcvhpsIsgHGR", label: "I-824 — Premium", amountCents: 35000, kind: "one_time", formCode: "I-824", tier: "premium" },
  { key: "i-102_basic", priceId: "price_1UfRxxPfd9SRUcvhqg7fC5kC", label: "I-102 — Basic", amountCents: 9900, kind: "one_time", formCode: "I-102", tier: "basic" },
  { key: "i-102_standard", priceId: "price_1UfRyOPfd9SRUcvhQ7CPUu6n", label: "I-102 — Standard", amountCents: 14900, kind: "one_time", formCode: "I-102", tier: "standard" },
  { key: "i-102_premium", priceId: "price_1UfRyAPfd9SRUcvhDvbjjCGX", label: "I-102 — Premium", amountCents: 19900, kind: "one_time", formCode: "I-102", tier: "premium" },
  { key: "i-912_basic", priceId: "price_1UfRynPfd9SRUcvhTTlv9hcP", label: "I-912 — Basic", amountCents: 3900, kind: "one_time", formCode: "I-912", tier: "basic" },
  { key: "i-912_standard", priceId: "price_1UfRz0Pfd9SRUcvhAd0FYJCv", label: "I-912 — Standard", amountCents: 6900, kind: "one_time", formCode: "I-912", tier: "standard" },
  { key: "i-912_premium", priceId: "price_1UfRzDPfd9SRUcvhtFuAuypc", label: "I-912 — Premium", amountCents: 9900, kind: "one_time", formCode: "I-912", tier: "premium" },
  { key: "n-600_basic", priceId: "price_1UfRzfPfd9SRUcvh5SgsMl37", label: "N-600 — Basic", amountCents: 35000, kind: "one_time", formCode: "N-600", tier: "basic" },
  { key: "n-600_standard", priceId: "price_1UfRzsPfd9SRUcvhwky0bTwF", label: "N-600 — Standard", amountCents: 47500, kind: "one_time", formCode: "N-600", tier: "standard" },
  { key: "n-600_premium", priceId: "price_1UfS08Pfd9SRUcvhPcwLgwlC", label: "N-600 — Premium", amountCents: 59900, kind: "one_time", formCode: "N-600", tier: "premium" },
  { key: "g-325r_basic", priceId: "price_1UfS0YPfd9SRUcvhX2BX5Srs", label: "G-325R — Basic", amountCents: 6000, kind: "one_time", formCode: "G-325R", tier: "basic" },
  { key: "g-325r_standard", priceId: "price_1UfS0sPfd9SRUcvhCiszzza6", label: "G-325R — Standard", amountCents: 9000, kind: "one_time", formCode: "G-325R", tier: "standard" },
  { key: "g-325r_premium", priceId: "price_1UfS16Pfd9SRUcvhngeyB90d", label: "G-325R — Premium", amountCents: 12000, kind: "one_time", formCode: "G-325R", tier: "premium" },
  { key: "i-864a_basic", priceId: "price_1UfS1VPfd9SRUcvhqfMoLUIi", label: "I-864A — Basic", amountCents: 9900, kind: "one_time", formCode: "I-864A", tier: "basic" },
  { key: "i-864a_standard", priceId: "price_1UfS1tPfd9SRUcvh6FmYQ0nY", label: "I-864A — Standard", amountCents: 12500, kind: "one_time", formCode: "I-864A", tier: "standard" },
  { key: "i-864a_premium", priceId: "price_1UfS27Pfd9SRUcvhq80kor5G", label: "I-864A — Premium", amountCents: 15000, kind: "one_time", formCode: "I-864A", tier: "premium" },
  { key: "i-140g_flat", priceId: "price_1UfS2YPfd9SRUcvh8vpV4LMS", label: "I-140G — flat", amountCents: 149900, kind: "one_time", formCode: "I-140G" },
  { key: "i-730_flat", priceId: "price_1UfS3BPfd9SRUcvhzsMyFvt4", label: "I-730 — flat $299", amountCents: 29900, kind: "one_time", formCode: "I-730" },

  // --- DIY + Review ladder, one-time ----------------------------------------
  { key: "diy_form", priceId: "price_1UfS5APfd9SRUcvh47Ks9Lw0", label: "DIY — per form", amountCents: 2500, kind: "one_time" },
  { key: "diy_bundle", priceId: "price_1UfS5iPfd9SRUcvhKEQxf0pj", label: "DIY Bundle", amountCents: 9900, kind: "one_time" },
  { key: "review_form", priceId: "price_1UfS6TPfd9SRUcvhBTRVKrvQ", label: "Review — per form", amountCents: 9900, kind: "one_time" },
  { key: "review_bundle", priceId: "price_1UfS71Pfd9SRUcvhCNJTdWVJ", label: "Review Bundle", amountCents: 39900, kind: "one_time" },
  { key: "review_human", priceId: "price_1UfS7bPfd9SRUcvhY0CRdMUf", label: "Review + Human Review", amountCents: 19900, kind: "one_time" },

  // --- Add-ons, one-time ------------------------------------------------------
  // RFE and Criminal Disposition are three separate products each in
  // Stripe (Basic / Standard / Premium; Basic / Complex / Deep Search),
  // each with its own fresh Nov 24 Price — not one consolidated product.
  { key: "addon_packet_rescue", priceId: "price_1UfS8YPfd9SRUcvhDBkEUJW2", label: "Packet Rescue", amountCents: 19900, kind: "one_time" },
  { key: "addon_consultation", priceId: "price_1UfS95Pfd9SRUcvhDN18s6S4", label: "Consultation — 30 min", amountCents: 9900, kind: "one_time" },
  { key: "addon_rfe_basic", priceId: "price_1UfS9lPfd9SRUcvhJxUaaIpO", label: "RFE Response — Basic", amountCents: 39900, kind: "one_time" },
  { key: "addon_rfe_standard", priceId: "price_1UfSAGPfd9SRUcvhfisAL0eF", label: "RFE Response — Standard", amountCents: 79900, kind: "one_time" },
  { key: "addon_rfe_premium", priceId: "price_1UfSAkPfd9SRUcvhTKgcaJzA", label: "RFE Response — Premium", amountCents: 149900, kind: "one_time" },
  { key: "addon_fbi_prep", priceId: "price_1UfSBNPfd9SRUcvhVIm1woPd", label: "FBI Rap Sheet Preparation", amountCents: 14900, kind: "one_time" },
  { key: "addon_foia_prep", priceId: "price_1UfSBvPfd9SRUcvhVUgJesrz", label: "FOIA Request Preparation", amountCents: 14900, kind: "one_time" },
  { key: "addon_disposition_basic", priceId: "price_1UfSCRPfd9SRUcvhcbEwU041", label: "Disposition Retrieval — Basic", amountCents: 19900, kind: "one_time" },
  { key: "addon_disposition_complex", priceId: "price_1UfSD2Pfd9SRUcvhklP6GAvD", label: "Disposition Retrieval — Complex", amountCents: 59900, kind: "one_time" },
  { key: "addon_disposition_deep", priceId: "price_1UfSDfPfd9SRUcvhNQSMLDXV", label: "Disposition Retrieval — Deep Search and Archival", amountCents: 105000, kind: "one_time" },
  { key: "addon_police_clearance", priceId: "price_1UfSEHPfd9SRUcvhSOyyTb8Q", label: "Foreign Police Clearance", amountCents: 17900, kind: "one_time" },
  { key: "addon_mock_interview", priceId: "price_1UfSExPfd9SRUcvh9AjOo2bV", label: "Mock Interview", amountCents: 19900, kind: "one_time" },
  { key: "addon_i864a", priceId: "price_1UfSFVPfd9SRUcvhSHuNjxLm", label: "I-864A Add-on", amountCents: 15000, kind: "one_time" },
  { key: "addon_household_member", priceId: "price_1UfSG0Pfd9SRUcvh6w7IvdTh", label: "I-864 Household Member Add-on", amountCents: 35000, kind: "one_time" },
  { key: "addon_letter", priceId: "price_1UfSGRPfd9SRUcvhVF7yDK3c", label: "Letter Writing — per letter", amountCents: 12000, kind: "one_time" },
  { key: "addon_translation_page", priceId: "price_1UfSGvPfd9SRUcvhAoxvGCt0", label: "Certified Translation — per page", amountCents: 4500, kind: "one_time" },

  // --- Speed fees, one-time (on top of the form price) ------------------------
  // Standard +$0 has NO Price (never create a $0 Price).
  { key: "speed_rush", priceId: "price_1UfSHTPfd9SRUcvhYC3naZZh", label: "Speed — Rush (7 days)", amountCents: 19900, kind: "one_time" },
  { key: "speed_express", priceId: "price_1UfSHyPfd9SRUcvhyFYabxJR", label: "Speed — 24-Hour Express", amountCents: 39900, kind: "one_time" },
];

// NOT created, by design (do not add them here): I-130A (free with I-130),
// I-526E / I-526 / I-829 (quoted individually), I-693 (free booking;
// doctor $250–500 paid to the doctor), any $0 price.

/** Total locked Prices. Must be 132 (11 bundles/subs + 92 single-form
 *  + 5 DIY/Review + 16 add-ons + 2 speed + 6 bundle monthly). */
export const LOCKED_STRIPE_PRICE_COUNT = LOCKED_STRIPE_PRICES.length;

export const LOCKED_PRICE_BY_ID: Record<string, LockedStripePrice> =
  Object.fromEntries(LOCKED_STRIPE_PRICES.map((p) => [p.priceId, p]));

export const LOCKED_PRICE_BY_KEY: Record<string, LockedStripePrice> =
  Object.fromEntries(LOCKED_STRIPE_PRICES.map((p) => [p.key, p]));

/** Look up a locked Price by its Stripe Price ID. Returns undefined for
 *  any ID that is not in the locked map — callers must reject it. */
export function getLockedPriceById(priceId: string): LockedStripePrice | undefined {
  return LOCKED_PRICE_BY_ID[priceId];
}

export function getLockedPriceByKey(key: string): LockedStripePrice | undefined {
  return LOCKED_PRICE_BY_KEY[key];
}

export function isLockedPriceId(priceId: string): boolean {
  return priceId in LOCKED_PRICE_BY_ID;
}

/** Single-form tier Price key from a form code + tier, e.g.
 *  ("I-485", "standard") -> "i-485_standard". Returns undefined when
 *  the form has no locked tier price (flat forms: use "i-140g_flat" /
 *  "i-730_flat" directly). */
export function formTierPriceKey(
  formCode: string,
  tier: "basic" | "standard" | "premium"
): string {
  return `${formCode.toLowerCase()}_${tier}`;
}
