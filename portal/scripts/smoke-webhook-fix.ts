// Smoke test for the Stripe webhook fix (Nov 28, 2026) — run with:
//   npx -y tsx scripts/smoke-webhook-fix.ts
// (tsx is NOT a project dependency; it is fetched on demand for this
// test only.)
//
// What it proves, with FAKE data only — no Stripe network call ever
// succeeds, no Supabase call is made, nothing is charged, no real
// key is used:
//   1. A paid DIY checkout writes the invoice WITH form_code AND a
//      diy_unlocks row for that form; replaying the same event
//      writes NOTHING twice (idempotent).
//   2. A paid DIY Bundle writes a bundle unlock (is_bundle true,
//      form_code NULL) and an invoice with form_code NULL.
//   3. A paid single-form tier price writes invoices.form_code from
//      the locked Price (no metadata form_code needed).
//   4. A Law Student subscription checkout with NO case writes a
//      subscriptions row (status 'active') AND sets
//      student_profiles.subscription_status to 'active' — and
//      invents NO invoice row. Replay writes no duplicate.
//   5. A Member subscription checkout with NO case writes a
//      subscriptions row, and the paywall then ALLOWS that member
//      (decidePaidAccess with the new subscription evidence).
//   6. A Preparer subscription sets professional_profiles plan +
//      status 'active'; is_published flips ONLY when the account
//      is already verified.
//   7. invoice.paid marks the matching invoice paid by
//      stripe_invoice_id and flips a matching subscriptions row
//      to 'active'; an unknown invoice id invents NO row.
//   8. Route level (real signature check, fake keys, no Supabase):
//      a correctly signed event returns 200; a bad signature
//      returns 400 and changes nothing.
//   9. The locked price map is still 132 Prices — no price or
//      Price ID was changed by this fix.
import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  LOCKED_STRIPE_PRICE_COUNT,
  getLockedPriceByKey,
} from "../src/lib/stripePrices";
import {
  recordCheckoutCompleted,
  recordInvoicePaid,
  resolveCheckoutFormCode,
  type AdminClient,
  type DbResult,
  type WebhookSession,
} from "../src/lib/webhookRecords";
import { decidePaidAccess, type PaidAccessEvidence } from "../src/lib/paywall";
import { POST as webhookPost } from "../src/app/api/stripe/webhook/route";

// ---------------------------------------------------------------------------
// In-memory fake Supabase admin client (same shape as the minimal
// AdminClient the webhook-records module needs).
// ---------------------------------------------------------------------------
type Row = Record<string, unknown>;
let idCounter = 0;

class FakeQuery {
  private op: "insert" | "update" | "select" | null = null;
  private insertRows: Row[] = [];
  private updateValues: Row = {};
  private filters: [string, unknown][] = [];
  private singleMode: "single" | "maybeSingle" | null = null;
  private limitN: number | null = null;

  constructor(
    private store: Record<string, Row[]>,
    private table: string
  ) {}

  insert(rows: Row | Row[]): this {
    this.op = "insert";
    this.insertRows = Array.isArray(rows) ? rows : [rows];
    return this;
  }
  update(values: Row): this {
    this.op = "update";
    this.updateValues = values;
    return this;
  }
  select(_columns?: string): this {
    if (this.op !== "update") this.op = "select";
    return this;
  }
  eq(column: string, value: unknown): this {
    this.filters.push([column, value]);
    return this;
  }
  single(): this {
    this.singleMode = "single";
    return this;
  }
  maybeSingle(): this {
    this.singleMode = "maybeSingle";
    return this;
  }
  limit(n: number): this {
    this.limitN = n;
    return this;
  }
  then<TResult1 = DbResult, TResult2 = never>(
    onfulfilled?: ((value: DbResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.run()).then(onfulfilled, onrejected);
  }

  private run(): DbResult {
    const rows = this.store[this.table] ?? (this.store[this.table] = []);
    const match = (r: Row) =>
      this.filters.every(([c, v]) => r[c] === v);
    if (this.op === "insert") {
      if (this.table === "invoices") {
        for (const nr of this.insertRows) {
          if (
            nr.stripe_invoice_id &&
            rows.some((r) => r.stripe_invoice_id === nr.stripe_invoice_id)
          ) {
            return {
              data: null,
              error: {
                message:
                  'duplicate key value violates unique constraint "invoices_stripe_invoice_id_key"',
              },
            };
          }
        }
      }
      const inserted = this.insertRows.map((r) => ({
        ...r,
        id: r.id ?? `fake-${++idCounter}`,
      }));
      rows.push(...inserted);
      return { data: inserted, error: null };
    }
    if (this.op === "update") {
      const targets = rows.filter(match);
      for (const t of targets) Object.assign(t, this.updateValues);
      return { data: targets, error: null };
    }
    let out = rows.filter(match);
    if (this.limitN !== null) out = out.slice(0, this.limitN);
    if (this.singleMode === "single") {
      return out.length === 1
        ? { data: out[0], error: null }
        : { data: null, error: { message: "single row expected" } };
    }
    if (this.singleMode === "maybeSingle") {
      return { data: out[0] ?? null, error: null };
    }
    return { data: out, error: null };
  }
}

function fakeAdmin(store: Record<string, Row[]>): AdminClient {
  return {
    from: (table: string) => new FakeQuery(store, table) as never,
  };
}

const CASE_ID = "11111111-1111-1111-1111-111111111111";
const CLIENT_ID = "22222222-2222-2222-2222-222222222222";
const STUDENT_ID = "33333333-3333-3333-3333-333333333333";
const MEMBER_ID = "44444444-4444-4444-4444-444444444444";
const PREPARER_ID = "55555555-5555-5555-5555-555555555555";
const PREPARER_VERIFIED_ID = "66666666-6666-6666-6666-666666666666";

function baseStore(): Record<string, Row[]> {
  return {
    accounts: [
      { id: CLIENT_ID, verification_status: "not_required", role: "client" },
      { id: STUDENT_ID, verification_status: "not_required", role: "law_student" },
      { id: MEMBER_ID, verification_status: "not_required", role: "client" },
      { id: PREPARER_ID, verification_status: "not_required", role: "preparer" },
      { id: PREPARER_VERIFIED_ID, verification_status: "verified", role: "preparer" },
    ],
    professional_profiles: [
      { account_id: PREPARER_ID, subscription_plan: "free_draft", subscription_status: "none", is_published: false },
      { account_id: PREPARER_VERIFIED_ID, subscription_plan: "free_draft", subscription_status: "none", is_published: false },
    ],
    student_profiles: [
      { account_id: STUDENT_ID, subscription_plan: "law_student_35", subscription_status: "none" },
    ],
    invoices: [],
    diy_unlocks: [],
    subscriptions: [],
    payment_plans: [],
    translation_orders: [],
  };
}

function diySession(overrides: Partial<WebhookSession> = {}): WebhookSession {
  return {
    id: "cs_diy_1",
    mode: "payment",
    payment_status: "paid",
    subscription: null,
    invoice: null,
    customer: "cus_fake",
    metadata: {
      price_id: "price_1UfS5APfd9SRUcvh47Ks9Lw0",
      price_key: "diy_form",
      plan: "full",
      total_cents: "2500",
      case_id: CASE_ID,
      account_id: CLIENT_ID,
      form_code: "I-485",
    },
    ...overrides,
  };
}

async function main() {
  let passed = 0;
  function ok(name: string, cond: boolean) {
    assert.equal(cond, true, name);
    passed += 1;
    console.log(`  PASS ${name}`);
  }

  // 0) Locked prices unchanged by this fix.
  console.log("locked prices");
  ok("LOCKED_STRIPE_PRICE_COUNT is still 132", LOCKED_STRIPE_PRICE_COUNT === 132);
  ok(
    "diy_form is still $25 / diy_bundle is still $99",
    getLockedPriceByKey("diy_form")?.amountCents === 2500 &&
      getLockedPriceByKey("diy_bundle")?.amountCents === 9900
  );

  // 1) resolveCheckoutFormCode.
  console.log("form_code resolution");
  ok(
    "metadata form_code wins when it is a real DIY code",
    resolveCheckoutFormCode({ form_code: "I-485" }, ["diy_form"], ["price_1UfS5APfd9SRUcvh47Ks9Lw0"]) === "I-485"
  );
  ok(
    "locked Price formCode is the fallback when metadata has none",
    resolveCheckoutFormCode({}, ["i-485_basic"], ["price_1UfRYiPfd9SRUcvhDmLumyYP"]) === "I-485"
  );
  ok(
    "an invented metadata form_code is ignored, locked Price wins",
    resolveCheckoutFormCode({ form_code: "I-999" }, ["i-130_basic"], ["price_1UfRZnPfd9SRUcvh0ZOoIHNw"]) === "I-130"
  );
  ok(
    "no form anywhere resolves to null, never a guess",
    resolveCheckoutFormCode({}, ["diy_bundle"], ["price_1UfS5iPfd9SRUcvhKEQxf0pj"]) === null
  );

  // 2) DIY form checkout writes invoice + unlock; replay writes nothing twice.
  console.log("DIY form checkout");
  {
    const store = baseStore();
    const admin = fakeAdmin(store);
    const r1 = await recordCheckoutCompleted(admin, diySession());
    ok("DIY checkout writes the invoice", r1.wroteInvoice);
    ok("DIY checkout writes the unlock", r1.wroteDiyUnlock);
    ok("DIY checkout resolves form_code I-485", r1.formCode === "I-485");
    const invoice = store.invoices[0] as Row;
    ok("invoice carries form_code I-485", invoice.form_code === "I-485");
    ok("invoice is paid for $25", invoice.service_fee_cents === 2500 && invoice.status === "paid");
    const unlock = store.diy_unlocks[0] as Row;
    ok(
      "unlock names the form, price and session",
      unlock.form_code === "I-485" &&
        unlock.price_key === "diy_form" &&
        unlock.stripe_checkout_session_id === "cs_diy_1" &&
        unlock.status === "paid" &&
        unlock.is_bundle === false
    );
    const r2 = await recordCheckoutCompleted(admin, diySession());
    ok("replay writes no second invoice", store.invoices.length === 1);
    ok("replay writes no second unlock", store.diy_unlocks.length === 1);
    ok("replay warns it was already recorded", r2.warnings.some((w) => w.includes("already recorded")));
  }

  // 3) DIY Bundle: bundle unlock, form_code NULL everywhere.
  console.log("DIY bundle checkout");
  {
    const store = baseStore();
    const admin = fakeAdmin(store);
    const r = await recordCheckoutCompleted(
      admin,
      diySession({
        id: "cs_bundle_1",
        metadata: {
          price_id: "price_1UfS5iPfd9SRUcvhKEQxf0pj",
          price_key: "diy_bundle",
          plan: "full",
          total_cents: "9900",
          case_id: CASE_ID,
          account_id: CLIENT_ID,
        },
      })
    );
    ok("bundle writes invoice + unlock", r.wroteInvoice && r.wroteDiyUnlock);
    const unlock = store.diy_unlocks[0] as Row;
    ok(
      "bundle unlock is_bundle true and form_code null",
      unlock.is_bundle === true && unlock.form_code === null
    );
    ok("bundle invoice form_code is null", (store.invoices[0] as Row).form_code === null);
  }

  // 4) Single-form tier price: form_code from the locked Price.
  console.log("single-form tier checkout");
  {
    const store = baseStore();
    const admin = fakeAdmin(store);
    const r = await recordCheckoutCompleted(admin, {
      id: "cs_form_1",
      mode: "payment",
      payment_status: "paid",
      subscription: null,
      invoice: "in_form_1",
      customer: "cus_fake",
      metadata: {
        price_id: "price_1UfRYiPfd9SRUcvhDmLumyYP",
        price_key: "i-485_basic",
        plan: "full",
        total_cents: "75000",
        case_id: CASE_ID,
        account_id: CLIENT_ID,
      },
    });
    ok("tier checkout writes the invoice", r.wroteInvoice);
    ok("tier invoice form_code is I-485 from the locked Price", (store.invoices[0] as Row).form_code === "I-485");
    ok("tier checkout writes no DIY unlock", r.wroteDiyUnlock === false && store.diy_unlocks.length === 0);
  }

  // 5) Law Student subscription with NO case.
  console.log("law student subscription (no case)");
  {
    const store = baseStore();
    const admin = fakeAdmin(store);
    const session: WebhookSession = {
      id: "cs_stu_1",
      mode: "subscription",
      payment_status: "paid",
      subscription: "sub_stu_1",
      invoice: "in_stu_1",
      customer: "cus_stu",
      metadata: {
        price_id: "price_1UfRSVPfd9SRUcvhcC89fIoB",
        price_key: "subscription_law_student",
        plan: "full",
        total_cents: "3500",
        account_id: STUDENT_ID,
      },
    };
    const r1 = await recordCheckoutCompleted(admin, session);
    ok("student checkout writes the subscriptions row", r1.wroteSubscription);
    const sub = store.subscriptions[0] as Row;
    ok(
      "subscriptions row is active with the Stripe ids",
      sub.status === "active" &&
        sub.price_key === "subscription_law_student" &&
        sub.stripe_subscription_id === "sub_stu_1" &&
        sub.account_id === STUDENT_ID
    );
    ok(
      "student_profiles.subscription_status is now active",
      (store.student_profiles[0] as Row).subscription_status === "active"
    );
    ok("no invoice is invented without a case", store.invoices.length === 0);
    const r2 = await recordCheckoutCompleted(admin, session);
    ok("replay writes no duplicate subscriptions row", store.subscriptions.length === 1);
    ok("replay still reports the subscription", r2.wroteSubscription === true);
  }

  // 6) Member subscription with NO case + paywall recognition.
  console.log("member subscription (no case) + paywall");
  {
    const store = baseStore();
    const admin = fakeAdmin(store);
    const r = await recordCheckoutCompleted(admin, {
      id: "cs_mem_1",
      mode: "subscription",
      payment_status: "paid",
      subscription: "sub_mem_1",
      invoice: "in_mem_1",
      customer: "cus_mem",
      metadata: {
        price_id: "price_1UfRQ2Pfd9SRUcvhHPVve9is",
        price_key: "member_monthly",
        plan: "full",
        total_cents: "980",
        account_id: MEMBER_ID,
      },
    });
    ok("member checkout writes the subscriptions row", r.wroteSubscription);
    ok(
      "member subscriptions row is active",
      (store.subscriptions[0] as Row).status === "active" &&
        (store.subscriptions[0] as Row).price_key === "member_monthly"
    );
    const evidence: PaidAccessEvidence = {
      role: "client",
      professionalSubscriptionStatus: null,
      subscriptionCurrentPeriodEnd: null,
      subscriptionStatus: "active",
      studentSubscriptionStatus: null,
      paidInvoiceCount: 0,
      accountVerified: false,
    };
    ok(
      "paywall ALLOWS a member with an active subscriptions row and no invoices",
      decidePaidAccess(evidence, "interview_prep").allowed === true
    );
    const unpaid: PaidAccessEvidence = { ...evidence, subscriptionStatus: null };
    ok(
      "paywall still DENIES the same member with no subscription record",
      decidePaidAccess(unpaid, "interview_prep").allowed === false
    );
    const studentEvidence: PaidAccessEvidence = {
      role: "law_student",
      professionalSubscriptionStatus: null,
      subscriptionCurrentPeriodEnd: null,
      subscriptionStatus: null,
      studentSubscriptionStatus: "active",
      paidInvoiceCount: 0,
      accountVerified: false,
    };
    ok(
      "paywall ALLOWS a law student with an active student subscription status",
      decidePaidAccess(studentEvidence, "interview_prep").allowed === true
    );
  }

  // 7) Preparer subscription: plan + status, is_published only when verified.
  console.log("preparer subscription");
  {
    const store = baseStore();
    const admin = fakeAdmin(store);
    const sessionFor = (accountId: string, subId: string): WebhookSession => ({
      id: `cs_prep_${subId}`,
      mode: "subscription",
      payment_status: "paid",
      subscription: subId,
      invoice: `in_${subId}`,
      customer: "cus_prep",
      metadata: {
        price_id: "price_1UfRQoPfd9SRUcvhJCKYrmoX",
        price_key: "subscription_preparer",
        plan: "full",
        total_cents: "4900",
        account_id: accountId,
      },
    });
    await recordCheckoutCompleted(admin, sessionFor(PREPARER_ID, "sub_prep_1"));
    const unverified = store.professional_profiles[0] as Row;
    ok(
      "unverified preparer: plan + status active, listing stays OFF",
      unverified.subscription_plan === "preparer_pro_49" &&
        unverified.subscription_status === "active" &&
        unverified.is_published === false
    );
    await recordCheckoutCompleted(admin, sessionFor(PREPARER_VERIFIED_ID, "sub_prep_2"));
    const verified = store.professional_profiles[1] as Row;
    ok(
      "verified preparer: plan + status active, listing turns ON",
      verified.subscription_plan === "preparer_pro_49" &&
        verified.subscription_status === "active" &&
        verified.is_published === true
    );
    ok("both preparer subscriptions recorded", store.subscriptions.length === 2);
  }

  // 8) invoice.paid.
  console.log("invoice.paid");
  {
    const store = baseStore();
    store.invoices.push({
      id: "inv-1",
      stripe_invoice_id: "in_123",
      status: "open",
      paid_at: null,
    });
    store.subscriptions.push({
      id: "sub-row-1",
      account_id: MEMBER_ID,
      price_key: "member_monthly",
      stripe_subscription_id: "sub_9",
      status: "past_due",
    });
    const admin = fakeAdmin(store);
    const r1 = await recordInvoicePaid(admin, { id: "in_123", subscription: "sub_9" });
    ok("matching invoice is marked paid", r1.markedPaid === true);
    ok(
      "invoice row now paid with paid_at",
      (store.invoices[0] as Row).status === "paid" &&
        typeof (store.invoices[0] as Row).paid_at === "string"
    );
    ok(
      "matching subscriptions row flips back to active",
      (store.subscriptions[0] as Row).status === "active"
    );
    const before = store.invoices.length;
    const r2 = await recordInvoicePaid(admin, { id: "in_unknown" });
    ok("unknown invoice id invents no row", r2.markedPaid === false && store.invoices.length === before);
    ok(
      "unknown invoice id warns honestly",
      r2.warnings.some((w) => w.includes("no matching public.invoices row"))
    );
  }

  // 9) Route level: real signature check, fake keys, no Supabase.
  console.log("webhook route — signature verification");
  process.env.STRIPE_SECRET_KEY = "sk_test_FAKE_000000000000000000000000";
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_FAKE_000000000000000000000000";
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  {
    const payload = JSON.stringify({
      id: "evt_fake",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_route_1",
          mode: "payment",
          payment_status: "paid",
          metadata: { price_key: "diy_form", plan: "full", total_cents: "2500" },
        },
      },
    });
    const t = Math.floor(Date.now() / 1000);
    const v1 = crypto
      .createHmac("sha256", process.env.STRIPE_WEBHOOK_SECRET as string)
      .update(`${t}.${payload}`)
      .digest("hex");
    const res = await webhookPost(
      new Request("http://localhost/api/stripe/webhook", {
        method: "POST",
        headers: { "stripe-signature": `t=${t},v1=${v1}` },
        body: payload,
      })
    );
    ok("correctly signed event returns 200", res.status === 200);
    const data = (await res.json()) as { warnings?: string[] };
    ok(
      "200 carries the Supabase-not-configured warning (no writes possible)",
      (data.warnings ?? []).some((w) => w.includes("Supabase is not configured"))
    );
    const bad = await webhookPost(
      new Request("http://localhost/api/stripe/webhook", {
        method: "POST",
        headers: { "stripe-signature": "t=1,v1=deadbeef" },
        body: payload,
      })
    );
    ok("bad signature returns 400", bad.status === 400);
    const badData = (await bad.json()) as { error?: string };
    ok(
      "400 message says signature verification failed",
      (badData.error ?? "").includes("signature verification failed")
    );
  }

  console.log(`\nSMOKE WEBHOOK FIX: ${passed} assertions passed.`);
}

main().catch((err) => {
  console.error("SMOKE WEBHOOK FIX FAILED:", err);
  process.exit(1);
});
