// Stripe webhook record-keeping — what a verified Stripe event
// writes to the database.
//
// FIX (Nov 28, 2026): before this module, /api/stripe/webhook wrote
// NO invoices.form_code and NO diy_unlocks row, and NO subscription
// record for a payer with no case — so a paid DIY form could not
// prove WHICH form was paid for, and a paying Member ($9.80/mo) or
// Law Student ($35/mo) was invisible to the paywall and could be
// denied after paying. This module is the fix, and it is written so
// it can be tested WITHOUT Stripe or Supabase: every function takes
// a minimal admin client (see AdminClient), and
// scripts/smoke-webhook-fix.ts drives it with an in-memory fake.
//
// What is written, per verified event (signature already checked by
// the route — nothing in this file trusts an unverified payload):
//   * checkout.session.completed, paid, with case_id + account_id:
//     an invoices row WITH form_code (from session metadata, else
//     from the locked Price's formCode), service_fee_cents, status
//     'paid', stripe_invoice_id when Stripe supplies one.
//     Idempotent: a paid invoice with the same case + client +
//     description + amount is never written twice (Stripe replays
//     events), and a stripe_invoice_id that already exists is
//     never inserted again (the column is unique).
//   * checkout.session.completed, paid, DIY price (diy_form /
//     diy_bundle): a diy_unlocks row (migration 0024) — client +
//     case + form_code (NULL = case-scoped / bundle) + is_bundle +
//     price_key + price_id + amount + stripe_checkout_session_id,
//     status 'paid'. Idempotent on stripe_checkout_session_id:
//     a replayed event never creates a second unlock.
//   * checkout.session.completed, subscription mode: a
//     subscriptions row (migration 0037) — account + locked price
//     key/id + plan + status 'active' + Stripe subscription /
//     customer / checkout ids. Idempotent on
//     stripe_subscription_id (upsert, never a duplicate row).
//     professional_profiles.subscription_plan + subscription_status
//     are set to 'active' for preparer/attorney/nonprofit/employer
//     prices, and student_profiles.subscription_status to 'active'
//     for the Law Student price. is_published flips to true ONLY
//     when accounts.verification_status is already 'verified' —
//     payment alone never lists anyone.
//   * invoice.paid: the matching invoices row (by stripe_invoice_id)
//     is marked 'paid'. If no row matches, NO row is invented. A
//     matching subscriptions row is also flipped to 'active'.
//
// What is NOT written here: the monthly 6/12 stop (that needs the
// Stripe client and stays in the route), Pay-in-3 instalment
// marking (kept here — it is a database write), translation-order
// payment flips (kept here). No row is ever invented without a
// verified Stripe event behind it. No real Stripe call is made
// here — the Stripe client is never touched.

import { getLockedPriceById, getLockedPriceByKey } from "./stripePrices";
import { DIY_FORM_CODES } from "./diy";

export interface DbResult {
  data: unknown;
  error: { message: string } | null;
}

/** Minimal Supabase client shape this module needs. The real
 *  service-role client satisfies it (the route casts it); the
 *  smoke test passes an in-memory fake with the same shape. */
export interface AdminQuery {
  insert(
    rows: Record<string, unknown> | Record<string, unknown>[]
  ): Promise<DbResult>;
  update(values: Record<string, unknown>): AdminQuery;
  select(columns?: string): AdminQuery;
  eq(column: string, value: unknown): AdminQuery;
  single(): Promise<DbResult>;
  maybeSingle(): Promise<DbResult>;
  limit(n: number): AdminQuery;
  then<TResult1 = DbResult, TResult2 = never>(
    onfulfilled?:
      | ((value: DbResult) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2>;
}

export interface AdminClient {
  from(table: string): AdminQuery;
}

export interface WebhookSession {
  id: string;
  mode?: string;
  payment_status?: string;
  subscription?: string | null;
  invoice?: string | null;
  customer?: string | null;
  metadata?: Record<string, string> | null;
}

export interface WebhookInvoice {
  id: string;
  subscription?: string | null;
}

/** Locked price key → professional_profiles.subscription_plan enum
 *  value. Member has NO enum value (there is no 'member' value in
 *  the subscription_plan enum) — a Member subscription is recorded
 *  in public.subscriptions only, never by forcing a wrong enum
 *  value onto a profile. Law Student maps to 'law_student_35'
 *  (added to the enum by migration 0003). */
export const SUBSCRIPTION_PLAN_BY_PRICE_KEY: Record<string, string> = {
  subscription_preparer: "preparer_pro_49",
  subscription_attorney: "attorney_pro_99",
  subscription_doj_standard: "nonprofit_standard_24_50",
  subscription_doj_full: "nonprofit_full_49_50",
  subscription_employer: "employer_49",
  subscription_law_student: "law_student_35",
};

/**
 * Resolve the USCIS form code a Checkout Session paid for.
 * Order: (1) metadata.form_code — written by /api/checkout from
 * the caller's formCode when it is a real DIY registry code, or
 * from the single Price's formCode; accepted only when it is a
 * real form code (a DIY registry code or a locked Price's
 * formCode), never a client-invented string. (2) The locked
 * Price's formCode for the first price_key / price_id in the
 * session (single-form tier prices carry formCode, e.g. I-485).
 * (3) null — bundle / DIY-bundle / subscription purchases have
 * no single form; a null form_code means case-scoped (DIY) or
 * not-a-form (subscription), never a guessed form.
 */
export function resolveCheckoutFormCode(
  meta: Record<string, string>,
  priceKeys: string[],
  priceIds: string[]
): string | null {
  const claimed = (meta.form_code ?? "").trim();
  if (claimed) {
    const isDiyForm = DIY_FORM_CODES.includes(claimed);
    const isLockedForm = priceKeys
      .map((k) => getLockedPriceByKey(k)?.formCode)
      .includes(claimed);
    const isLockedFormById = priceIds
      .map((id) => getLockedPriceById(id)?.formCode)
      .includes(claimed);
    if (isDiyForm || isLockedForm || isLockedFormById) return claimed;
    // A claimed form_code that matches nothing locked is ignored,
    // not trusted — fall through to the locked Price.
  }
  for (const key of priceKeys) {
    const formCode = getLockedPriceByKey(key)?.formCode;
    if (formCode) return formCode;
  }
  for (const id of priceIds) {
    const formCode = getLockedPriceById(id)?.formCode;
    if (formCode) return formCode;
  }
  return null;
}

export interface CheckoutRecordResult {
  warnings: string[];
  wroteInvoice: boolean;
  wroteDiyUnlock: boolean;
  wroteSubscription: boolean;
  formCode: string | null;
}

/**
 * Record a verified checkout.session.completed in the database.
 * Best-effort per write: a failed write adds a warning and is
 * logged by the caller, but never throws — the route still
 * returns 200 so Stripe does not retry the event forever.
 * When admin is null (Supabase not configured) nothing is
 * written and the warning says so.
 */
export async function recordCheckoutCompleted(
  admin: AdminClient | null,
  session: WebhookSession
): Promise<CheckoutRecordResult> {
  const result: CheckoutRecordResult = {
    warnings: [],
    wroteInvoice: false,
    wroteDiyUnlock: false,
    wroteSubscription: false,
    formCode: null,
  };
  if (!admin) {
    result.warnings.push(
      "Supabase is not configured — no invoice, unlock or subscription was recorded in the database."
    );
    return result;
  }

  const meta = session.metadata ?? {};
  const priceKeys = (meta.price_key ?? "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
  const priceIds = (meta.price_id ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  const firstPrice =
    getLockedPriceByKey(priceKeys[0] ?? "") ??
    getLockedPriceById(priceIds[0] ?? "") ??
    null;
  const formCode = resolveCheckoutFormCode(meta, priceKeys, priceIds);
  result.formCode = formCode;

  const plan = meta.plan ?? "";
  const caseId = meta.case_id ?? "";
  const accountId = meta.account_id ?? "";
  const totalCents = Number(meta.total_cents ?? "0") || 0;
  const paid = session.payment_status === "paid";
  const isDiy = priceKeys.includes("diy_form") || priceKeys.includes("diy_bundle");
  const isBundle = priceKeys.includes("diy_bundle");
  const diyPriceKey = isBundle ? "diy_bundle" : "diy_form";
  const diyPrice = getLockedPriceByKey(diyPriceKey);
  // The DIY amount is the locked Price amount, never the session
  // total (a session total can include other items).
  const diyAmountCents = diyPrice?.amountCents ?? totalCents;

  // --- 1) Invoice (only with a real case + account) -------------------
  // invoices.case_id is NOT NULL, so a purchase with no case (a
  // Member / Law Student subscription checkout) records NO invoice
  // row — the subscriptions row in step 3 is its record instead.
  if (caseId && accountId) {
    const description = `${priceKeys.join(",") || "service"} — ${plan}`;
    let alreadyRecorded = false;
    try {
      const { data: existing } = await admin
        .from("invoices")
        .select("id")
        .eq("case_id", caseId)
        .eq("client_id", accountId)
        .eq("description", description)
        .eq("status", "paid")
        .limit(1);
      alreadyRecorded = Array.isArray(existing) && existing.length > 0;
      if (!alreadyRecorded && session.invoice) {
        const { data: byStripeId } = await admin
          .from("invoices")
          .select("id")
          .eq("stripe_invoice_id", session.invoice)
          .limit(1);
        alreadyRecorded = Array.isArray(byStripeId) && byStripeId.length > 0;
      }
    } catch {
      alreadyRecorded = false;
    }
    if (alreadyRecorded) {
      result.warnings.push(
        "Invoice was already recorded for this checkout — the replayed event wrote nothing twice."
      );
    } else {
      const { error } = await admin.from("invoices").insert({
        case_id: caseId,
        client_id: accountId,
        provider_id: null,
        description,
        // FIX (Nov 28, 2026): form_code was never written before.
        form_code: formCode,
        service_fee_cents: totalCents,
        uscis_fee_cents: 0,
        status: paid ? "paid" : "open",
        stripe_invoice_id: session.invoice ?? null,
        stripe_checkout_url: null,
        paid_at: paid ? new Date().toISOString() : null,
      });
      if (error) {
        result.warnings.push(`Invoice could not be recorded: ${error.message}.`);
      } else {
        result.wroteInvoice = true;
      }
    }

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
      if (planError) {
        result.warnings.push(`Instalment 1 could not be marked paid: ${planError.message}.`);
      }
    }
  } else if (!caseId) {
    result.warnings.push(
      "No case_id in the Checkout Session metadata — no invoice row was recorded (a subscription purchase without a case is recorded as a subscriptions row instead)."
    );
  }

  // --- 2) Translation order payment (migration 0033) ------------------
  if (meta.translation_order_id && paid) {
    const { error: trError } = await admin
      .from("translation_orders")
      .update({ payment_status: "paid", stripe_checkout_session_id: session.id })
      .eq("id", meta.translation_order_id);
    if (trError) {
      result.warnings.push(
        `Translation order ${meta.translation_order_id} could not be marked paid: ${trError.message}.`
      );
    }
  }

  // --- 3) DIY unlock (migration 0024) — FIX (Nov 28, 2026) -----------
  // Written for the first time here: before this fix the webhook
  // never wrote diy_unlocks, so a paid DIY form relied on the
  // case-scoped invoices fallback and could not prove its form.
  if (paid && isDiy && caseId && accountId) {
    let alreadyUnlocked = false;
    try {
      const { data: existing } = await admin
        .from("diy_unlocks")
        .select("id")
        .eq("stripe_checkout_session_id", session.id)
        .limit(1);
      alreadyUnlocked = Array.isArray(existing) && existing.length > 0;
    } catch {
      alreadyUnlocked = false;
    }
    if (alreadyUnlocked) {
      result.warnings.push(
        "DIY unlock was already recorded for this checkout — the replayed event wrote nothing twice."
      );
    } else {
      const { error } = await admin.from("diy_unlocks").insert({
        case_id: caseId,
        client_id: accountId,
        // diy_bundle unlocks every form: form_code NULL, is_bundle
        // true. diy_form unlocks one form — the resolved form_code,
        // or NULL (case-scoped) when no form could be resolved.
        form_code: isBundle ? null : formCode,
        is_bundle: isBundle,
        price_key: diyPriceKey,
        price_id: firstPrice?.priceId ?? diyPrice?.priceId ?? "",
        amount_cents: diyAmountCents,
        stripe_checkout_session_id: session.id,
        status: "paid",
        paid_at: new Date().toISOString(),
      });
      if (error) {
        result.warnings.push(`DIY unlock could not be recorded: ${error.message}.`);
      } else {
        result.wroteDiyUnlock = true;
      }
    }
  }

  // --- 4) Subscription record — FIX (Nov 28, 2026) --------------------
  // A subscription checkout (Member / Law Student / Preparer /
  // Attorney / DOJ / Employer) carries no case_id, so step 1 wrote
  // no invoice. The subscriptions row (migration 0037) is the
  // durable record the paywall reads — without it a paying
  // member/student was denied after paying.
  if (accountId && session.mode === "subscription" && session.subscription) {
    const subscriptionPriceKey = priceKeys[0] ?? "";
    const subscriptionPrice =
      getLockedPriceByKey(subscriptionPriceKey) ?? firstPrice;
    let alreadyRecorded = false;
    try {
      const { data: existing } = await admin
        .from("subscriptions")
        .select("id")
        .eq("stripe_subscription_id", session.subscription)
        .limit(1);
      alreadyRecorded = Array.isArray(existing) && existing.length > 0;
    } catch {
      alreadyRecorded = false;
    }
    if (alreadyRecorded) {
      const { error: updateError } = await admin
        .from("subscriptions")
        .update({
          status: "active",
          price_key: subscriptionPriceKey,
          price_id: subscriptionPrice?.priceId ?? "",
          stripe_checkout_session_id: session.id,
          paid_at: new Date().toISOString(),
        })
        .eq("stripe_subscription_id", session.subscription);
      if (updateError) {
        result.warnings.push(
          `Subscription could not be re-confirmed: ${updateError.message}.`
        );
      } else {
        result.wroteSubscription = true;
      }
    } else {
      const { error } = await admin.from("subscriptions").insert({
        account_id: accountId,
        price_key: subscriptionPriceKey,
        price_id: subscriptionPrice?.priceId ?? "",
        plan: subscriptionPriceKey,
        status: "active",
        stripe_subscription_id: session.subscription,
        stripe_customer_id: session.customer ?? null,
        stripe_checkout_session_id: session.id,
        current_period_end: null,
        paid_at: new Date().toISOString(),
      });
      if (error) {
        result.warnings.push(`Subscription could not be recorded: ${error.message}.`);
      } else {
        result.wroteSubscription = true;
      }
    }

    // Professional profile: plan + status. is_published flips to
    // true ONLY when the account is already verified — payment
    // alone never lists anyone. Law Students have no
    // professional_profiles row, so this block is skipped for
    // them (their status is written to student_profiles below).
    const planEnum = SUBSCRIPTION_PLAN_BY_PRICE_KEY[subscriptionPriceKey];
    if (planEnum && subscriptionPriceKey !== "subscription_law_student") {
      const { data: account } = await admin
        .from("accounts")
        .select("verification_status, role")
        .eq("id", accountId)
        .maybeSingle();
      const verified =
        (account as { verification_status?: string } | null)
          ?.verification_status === "verified";
      const { error } = await admin
        .from("professional_profiles")
        .update({
          subscription_plan: planEnum,
          subscription_status: "active",
          ...(verified ? { is_published: true } : {}),
        })
        .eq("account_id", accountId);
      if (error) {
        result.warnings.push(
          `Subscription status could not be recorded: ${error.message}.`
        );
      } else if (!verified) {
        result.warnings.push(
          "Subscription is active, but the directory listing stays OFF until verification is approved."
        );
      }
    }

    // Law Student: student_profiles has no professional_profiles
    // row, so the step above is a no-op for students. Their status
    // lives on student_profiles.subscription_status (migration
    // 0037) — the column the paywall gap note said was missing.
    if (subscriptionPriceKey === "subscription_law_student") {
      const { error: studentError } = await admin
        .from("student_profiles")
        .update({ subscription_status: "active" })
        .eq("account_id", accountId);
      if (studentError) {
        result.warnings.push(
          `Law Student subscription status could not be recorded: ${studentError.message}.`
        );
      }
    }
  }

  return result;
}

/**
 * Record a verified invoice.paid event. Marks the matching
 * invoices row (by stripe_invoice_id) 'paid'. If no row matches,
 * NO row is invented. A matching subscriptions row is also
 * flipped to 'active' (a renewal payment on an existing
 * subscription). Returns warnings only — never throws.
 */
export async function recordInvoicePaid(
  admin: AdminClient | null,
  invoice: WebhookInvoice
): Promise<{ warnings: string[]; markedPaid: boolean }> {
  const warnings: string[] = [];
  if (!admin) {
    warnings.push(
      "Supabase is not configured — no invoice was marked paid in the database."
    );
    return { warnings, markedPaid: false };
  }
  const { data, error } = await admin
    .from("invoices")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("stripe_invoice_id", invoice.id)
    .select("id");
  if (error) {
    warnings.push(`Invoice ${invoice.id} could not be marked paid: ${error.message}.`);
    return { warnings, markedPaid: false };
  }
  if (!data || (Array.isArray(data) && data.length === 0)) {
    warnings.push(
      `Invoice ${invoice.id} was paid in Stripe but has no matching public.invoices row — no row was invented.`
    );
    return { warnings, markedPaid: false };
  }
  if (invoice.subscription) {
    const { error: subError } = await admin
      .from("subscriptions")
      .update({ status: "active" })
      .eq("stripe_subscription_id", invoice.subscription);
    if (subError) {
      warnings.push(
        `Subscription ${invoice.subscription} could not be re-confirmed: ${subError.message}.`
      );
    }
  }
  return { warnings, markedPaid: true };
}
