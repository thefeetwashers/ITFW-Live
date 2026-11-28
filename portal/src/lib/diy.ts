// Guided DIY filing flow — unlock + preview helpers.
//
// Founder addition (Nov 28, 2026): a client filing the application
// themselves gets a guided DIY flow — the system already knows every
// form and its questions, asks the client the questions one by one,
// fills the form with their name, address and all information needed,
// and — for a fee — gives them access to print it, save it and email
// the completed application to them.
//
// HOW THE PAY GATE WORKS (server-side, never a front-end flag):
//   * The DIY questions themselves are FREE. Print / save (download)
//     / email of the completed application stay LOCKED until payment
//     is confirmed in the database.
//   * Payment is DIY $25/form (locked Price price_1UfS5APfd9SRUcvh47Ks9Lw0,
//     key "diy_form") or DIY Bundle $99 (price_1UfS5iPfd9SRUcvhKEQxf0pj,
//     key "diy_bundle") — see src/lib/stripePrices.ts. Prices are
//     never changed here.
//   * `decideDiyUnlock()` is the pure decision, unit-tested by
//     scripts/smoke-diy-flow.ts. `getDiyUnlockForCase()` is the
//     server-only reader (service-role client). Both fail CLOSED:
//     no Supabase config, no case, no payment record = DENIED.
//   * The routes that serve a packet or send it by email
//     (/api/diy/packet, /api/diy/email-packet) call this check FIRST
//     and return 402 before ever touching /api/generate-packet.
//     Hiding the buttons in the UI is NOT the gate — the gate is here.
//
// WHAT THE DATABASE PROVES TODAY (read migrations 0001–0002 + 0024
// + 0037 and the Stripe webhook before assuming otherwise):
//   * public.invoices (0001) has form_code — and since the Nov 28,
//     2026 webhook fix (migration 0037, src/lib/webhookRecords.ts)
//     the Stripe webhook WRITES it (from Checkout Session metadata,
//     else from the locked Price's formCode). A paid diy_form
//     invoice now names its form.
//   * public.diy_unlocks (0024) is the durable per-form record,
//     written by the webhook on checkout.session.completed since
//     the same fix. The reader below checks it AND the invoices
//     fallback; a row in either place unlocks. Nothing here
//     invents a row.
//   * Admin / founder accounts get support access (same rule as
//     src/lib/paywall.ts). No other role shortcut exists: an active
//     professional subscription does NOT unlock DIY print/save/email
//     — DIY is a per-form paid product, not a subscription surface.
//     Teachers are NOT auto-unlocked here either (unlike Smart
//     Forms, where teachers are free because that surface is a
//     teaching tool).
//
// WHAT THIS MODULE DOES NOT DO:
//   * It does not decide eligibility, relief, evidence strength or
//     whether it is safe to travel / safe to file. No AI here decides
//     any of that. Only a licensed attorney or DOJ-accredited
//     representative gives legal advice (8 CFR 292.1).
//   * It does not file anything. The client reviews and signs before
//     anything is submitted. The packet route stays DRAFT.
//   * It does not invent a USCIS form edition. No verified edition
//     is stored anywhere in this codebase (templates live in the
//     vault per edition, named by file), so every form in the flow
//     carries DRAFT_SCHEMA_NOTICE and "confirm the current edition
//     at uscis.gov before filing" — never a guessed edition date.
//   * It never stores SSNs. Sensitive values (DOB, A-Number, SSN,
//     passport number) are masked in the UI, never logged, never in
//     email subjects, and stored only in questionnaire_responses
//     (migration 0005) — see maskSensitiveValue() in
//     src/lib/dynamicIntakeSchemas.ts.
//   * Copy/screenshot protection is a DETERRENT, not a guarantee
//     (see DIY_COPY_DETERRENT_* below). The lock that actually
//     protects the work is the pay gate in this file.

import { createClient } from "@supabase/supabase-js";
import {
  ALL_REGISTRY_FORM_CODES,
  DRAFT_SCHEMA_NOTICE,
  getRegistrySchema,
  maskSensitiveValue,
} from "./dynamicIntakeSchemas";
import { getLockedPriceByKey } from "./stripePrices";

export { DRAFT_SCHEMA_NOTICE, maskSensitiveValue };

/** Every form the guided DIY flow covers — the 15-schema registry. */
export const DIY_FORM_CODES: string[] = [...ALL_REGISTRY_FORM_CODES];

/** Locked DIY prices (keys into src/lib/stripePrices.ts — never changed here). */
export const DIY_SINGLE_PRICE_KEY = "diy_form";
export const DIY_BUNDLE_PRICE_KEY = "diy_bundle";

export function diySinglePrice(): { priceId: string; label: string; amountCents: number } {
  const p = getLockedPriceByKey(DIY_SINGLE_PRICE_KEY);
  if (!p) throw new Error("Locked DIY price diy_form is missing from src/lib/stripePrices.ts — do not guess a Price ID.");
  return { priceId: p.priceId, label: p.label, amountCents: p.amountCents };
}

export function diyBundlePrice(): { priceId: string; label: string; amountCents: number } {
  const p = getLockedPriceByKey(DIY_BUNDLE_PRICE_KEY);
  if (!p) throw new Error("Locked DIY price diy_bundle is missing from src/lib/stripePrices.ts — do not guess a Price ID.");
  return { priceId: p.priceId, label: p.label, amountCents: p.amountCents };
}

// ---------------------------------------------------------------------------
// Copy / screenshot deterrent — honest labelling, in code and in UI.
// ---------------------------------------------------------------------------

/** Watermark drawn across the unpaid preview. */
export const DIY_PREVIEW_WATERMARK =
  "DRAFT — Immigration with NIPTEI — not for filing until reviewed and signed";

/**
 * The honest deterrent label, shown on the preview and in the docs.
 * Never claim screenshots are impossible: a phone camera or the
 * browser's own print can still capture a screen. The pay gate —
 * not the copy deterrent — is what protects the work.
 */
export const DIY_COPY_DETERRENT_LABEL =
  "Copy protection is a deterrent, not a guarantee: text selection, right-click copy and copy/print shortcuts are disabled in this preview, but a phone camera or the browser's own print function can still capture a screen. What actually protects this work is the pay gate — print, save and email stay locked until your DIY payment is confirmed in our records.";

export const DIY_PAY_FIRST_TEXT =
  "Pay first to print, save or email your completed application. Answering the questions is free — the completed packet unlocks when your DIY payment ($25 for this form, or $99 for the DIY Bundle covering every form) is confirmed in our records.";

// ---------------------------------------------------------------------------
// Unlock decision (pure — unit-tested, no Supabase, no secrets)
// ---------------------------------------------------------------------------

export type DiyUnlockRole = "client" | "preparer" | "attorney" | "nonprofit" | "admin" | "founder" | "teacher" | "law_student";

/** Evidence read from the database — never from the client. */
export interface DiyUnlockEvidence {
  role: DiyUnlockRole;
  /** Forms listed on the case (cases.forms). */
  caseForms: string[];
  /** True when a paid diy_bundle invoice (or diy_unlocks bundle row) exists for this case. */
  hasPaidDiyBundle: boolean;
  /** True when a paid diy_form invoice exists for this case. */
  hasPaidDiyForm: boolean;
  /** True when a paid per-form diy_unlocks row exists for this exact formCode. */
  hasPaidDiyUnlockRow: boolean;
  /** True when a paid order_invoices row with unlocks_stage 'esign_and_download' exists for the case. */
  hasPaidFinalStageInvoice: boolean;
  /** True when a payment_plans row for the case is fully paid. */
  hasFullyPaidPaymentPlan: boolean;
}

export interface DiyUnlockDecision {
  unlocked: boolean;
  reason: string;
  /** Which evidence unlocked it, or null when locked. */
  unlockedBy:
    | "diy_bundle_invoice"
    | "diy_form_invoice_for_case"
    | "diy_unlock_row"
    | "final_stage_invoice"
    | "fully_paid_payment_plan"
    | "admin_founder_support"
    | null;
  formCode: string;
}

export function decideDiyUnlock(
  evidence: DiyUnlockEvidence,
  formCode: string
): DiyUnlockDecision {
  // Admin / founder: support access, decided server-side from
  // accounts.role — never from a client claim.
  if (evidence.role === "admin" || evidence.role === "founder") {
    return {
      unlocked: true,
      reason: "Platform admin / founder access (support).",
      unlockedBy: "admin_founder_support",
      formCode,
    };
  }

  // Durable per-form record (migration 0024, written by the webhook
  // since the Nov 28, 2026 fix).
  if (evidence.hasPaidDiyUnlockRow) {
    return {
      unlocked: true,
      reason: `DIY payment confirmed for Form ${formCode} (paid DIY unlock record on file).`,
      unlockedBy: "diy_unlock_row",
      formCode,
    };
  }

  // DIY Bundle $99 — unlocks every DIY form for this case.
  if (evidence.hasPaidDiyBundle) {
    return {
      unlocked: true,
      reason: "DIY Bundle payment confirmed — every DIY form for this case is unlocked.",
      unlockedBy: "diy_bundle_invoice",
      formCode,
    };
  }

  // DIY $25/form — the webhook writes invoices.form_code (and the
  // diy_unlocks row) since the Nov 28, 2026 fix, so a per-form
  // invoice now proves its form directly. The case-scoped read
  // below stays as a fallback for invoices written before the fix.
  if (evidence.hasPaidDiyForm && evidence.caseForms.includes(formCode)) {
    return {
      unlocked: true,
      reason: `DIY payment ($25/form) confirmed for this case, and Form ${formCode} is listed on the case.`,
      unlockedBy: "diy_form_invoice_for_case",
      formCode,
    };
  }
  if (evidence.hasPaidDiyForm && !evidence.caseForms.includes(formCode)) {
    return {
      unlocked: false,
      reason:
        `A DIY payment is confirmed for this case, but Form ${formCode} is not listed on the case ` +
        `(cases.forms). Pay the DIY $25 for a case that lists Form ${formCode}, or the $99 DIY Bundle.`,
      unlockedBy: null,
      formCode,
    };
  }

  // Same gate /api/generate-packet enforces for the final download.
  if (evidence.hasPaidFinalStageInvoice) {
    return {
      unlocked: true,
      reason: "Final-stage invoice paid (esign_and_download) — print, save and email are unlocked.",
      unlockedBy: "final_stage_invoice",
      formCode,
    };
  }

  if (evidence.hasFullyPaidPaymentPlan) {
    return {
      unlocked: true,
      reason: "Payment plan for this case is fully paid — print, save and email are unlocked.",
      unlockedBy: "fully_paid_payment_plan",
      formCode,
    };
  }

  return {
    unlocked: false,
    reason: DIY_PAY_FIRST_TEXT,
    unlockedBy: null,
    formCode,
  };
}

// ---------------------------------------------------------------------------
// Already-paid notice — never charge twice for the same unlock.
// ---------------------------------------------------------------------------

/**
 * The text shown instead of a pay button when the unlock is already
 * paid for this case + form. Callers (the DIY flow, /api/checkout)
 * use this so a client who already paid is never charged again:
 * the pay gate recognises the paid record and says "already paid".
 * Returns null when the decision is locked (nothing paid yet).
 */
export function diyAlreadyPaidNotice(
  decision: DiyUnlockDecision
): string | null {
  if (!decision.unlocked || !decision.unlockedBy) return null;
  return (
    `Already paid — print, save and email for Form ${decision.formCode} are already unlocked. ` +
    `${decision.reason} You will not be charged again for this unlock.`
  );
}

// ---------------------------------------------------------------------------
// Server-only reader (service-role client). Call ONLY from API routes —
// never from a client component.
// ---------------------------------------------------------------------------

export interface DiyUnlockResult extends DiyUnlockDecision {
  configured: boolean;
  accountId: string;
  caseId: string;
  /** Caller account id + email, resolved server-side (for checkout). */
  callerEmail: string | null;
}

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Read the DIY unlock decision for one account + case + form from the
 * database. Fails CLOSED: unconfigured Supabase, unknown account,
 * unknown case, or a case that belongs to someone else = DENIED.
 *
 * Evidence sources (see header — the webhook writes form_code
 * since the Nov 28, 2026 fix; invoices written before the fix are
 * still read case-scoped via cases.forms):
 *   - public.diy_unlocks (0024) — per-form / bundle rows, status 'paid'
 *   - public.invoices (0001) — status 'paid', description starting
 *     with "diy_form" / "diy_bundle" (what the webhook writes today)
 *   - public.order_invoices (0006) — status 'paid' +
 *     unlocks_stage 'esign_and_download', via the case's service_orders
 *   - public.payment_plans (0002) — paid_cents >= total for the case
 */
export async function getDiyUnlockForCase(
  accountId: string,
  caseId: string,
  formCode: string
): Promise<DiyUnlockResult> {
  const locked = (reason: string): DiyUnlockResult => ({
    unlocked: false,
    reason,
    unlockedBy: null,
    formCode,
    configured: false,
    accountId,
    caseId,
    callerEmail: null,
  });
  if (!UUID_RE.test(accountId) || !UUID_RE.test(caseId)) {
    return locked("A real account id and case id are required to check DIY payment status.");
  }
  const admin = serviceClient();
  if (!admin) {
    return {
      ...locked(
        "Payment records are not connected yet (Supabase is not configured), so DIY payment cannot be verified. Nothing is unlocked until the payment records are connected and your payment is confirmed."
      ),
      configured: false,
    };
  }

  const { data: account, error: accountError } = await admin
    .from("accounts")
    .select("id, role, email")
    .eq("id", accountId)
    .maybeSingle();
  if (accountError || !account) {
    return {
      ...locked("No Immigration account was found for this login. Sign in again."),
      configured: true,
    };
  }
  const acct = account as { id: string; role: string; email?: string | null };
  const role = (acct.role ?? "client") as DiyUnlockRole;

  const { data: caseRow, error: caseError } = await admin
    .from("cases")
    .select("id, client_id, forms")
    .eq("id", caseId)
    .maybeSingle();
  if (caseError || !caseRow) {
    return {
      ...locked("No case was found for this case id."),
      configured: true,
      callerEmail: acct.email ?? null,
    };
  }
  const crow = caseRow as { id: string; client_id: string; forms?: unknown };
  if (crow.client_id !== accountId && role !== "admin" && role !== "founder") {
    return {
      ...locked("This case belongs to a different account."),
      configured: true,
      callerEmail: acct.email ?? null,
    };
  }
  const caseForms = Array.isArray(crow.forms)
    ? (crow.forms as unknown[]).map(String).filter(Boolean)
    : [];

  // Durable per-form record (migration 0024). Absent table = no rows;
  // a missing table must NOT fail the whole check, so errors here
  // are treated as "no rows" (the invoices fallback below still runs).
  let hasPaidDiyUnlockRow = false;
  let hasPaidDiyBundle = false;
  try {
    const { data: unlockRows } = await admin
      .from("diy_unlocks")
      .select("form_code, is_bundle")
      .eq("case_id", caseId)
      .eq("status", "paid");
    for (const r of ((unlockRows ?? []) as Record<string, unknown>[])) {
      if (r.is_bundle === true) hasPaidDiyBundle = true;
      if (typeof r.form_code === "string" && r.form_code === formCode) {
        hasPaidDiyUnlockRow = true;
      }
    }
  } catch {
    hasPaidDiyUnlockRow = false;
  }

  // What the webhook writes today: invoices.description =
  // "<price_key> — <plan>", status 'paid'. Case-scoped (see header).
  let hasPaidDiyForm = false;
  const { data: invoiceRows } = await admin
    .from("invoices")
    .select("description, service_fee_cents, status")
    .eq("case_id", caseId)
    .eq("status", "paid");
  for (const r of ((invoiceRows ?? []) as Record<string, unknown>[])) {
    const description = String(r.description ?? "");
    if (description.startsWith("diy_bundle")) hasPaidDiyBundle = true;
    if (description.startsWith("diy_form")) hasPaidDiyForm = true;
    // A diy_unlocks row is the durable record; an invoices row whose
    // form_code names this form also counts (written by nothing today
    // — the webhook omits it — but read it if it ever appears).
    if (
      typeof (r as Record<string, unknown>).form_code === "string" &&
      (r as Record<string, unknown>).form_code === formCode
    ) {
      hasPaidDiyUnlockRow = true;
    }
  }

  // Final-stage invoice (the generate-packet download gate).
  let hasPaidFinalStageInvoice = false;
  const { data: orderRows } = await admin
    .from("service_orders")
    .select("id")
    .eq("case_id", caseId);
  const orderIds = ((orderRows ?? []) as Record<string, unknown>[]).map((o) => String(o.id));
  if (orderIds.length > 0) {
    const { data: finalRows } = await admin
      .from("order_invoices")
      .select("id")
      .in("order_id", orderIds)
      .eq("status", "paid")
      .eq("unlocks_stage", "esign_and_download")
      .limit(1);
    hasPaidFinalStageInvoice = ((finalRows ?? []) as unknown[]).length > 0;
  }

  // Fully-paid payment plan for the case.
  let hasFullyPaidPaymentPlan = false;
  const { data: planRows } = await admin
    .from("payment_plans")
    .select("total_service_fee_cents, paid_cents, status")
    .eq("case_id", caseId);
  for (const r of ((planRows ?? []) as Record<string, unknown>[])) {
    const total = Number(r.total_service_fee_cents ?? 0);
    const paid = Number(r.paid_cents ?? 0);
    if (total > 0 && paid >= total) hasFullyPaidPaymentPlan = true;
  }

  const decision = decideDiyUnlock(
    {
      role,
      caseForms,
      hasPaidDiyBundle,
      hasPaidDiyForm,
      hasPaidDiyUnlockRow,
      hasPaidFinalStageInvoice,
      hasFullyPaidPaymentPlan,
    },
    formCode
  );
  return {
    ...decision,
    configured: true,
    accountId,
    caseId,
    callerEmail: acct.email ?? null,
  };
}

// ---------------------------------------------------------------------------
// Caller resolution for the /api/diy/* routes (server-only use).
// Same pattern as /api/access: the caller is identified by their
// Supabase Auth access token (Authorization: Bearer <token>) — never
// by an account id in the request body. The token is verified with
// the anon client, the account is read with the service-role client.
// ---------------------------------------------------------------------------

export type DiyCaller =
  | { ok: true; accountId: string; email: string | null }
  | { ok: false; status: number; error: string };

export async function resolveDiyCaller(req: Request): Promise<DiyCaller> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceKey) {
    return {
      ok: false,
      status: 501,
      error:
        "Payment records are not connected yet (Supabase is not configured), so your login and payment cannot be verified. Nothing is unlocked.",
    };
  }
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) {
    return { ok: false, status: 401, error: "Sign in first — no access token was sent." };
  }
  const anon = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data: userData, error: userError } = await anon.auth.getUser(token);
  if (userError || !userData.user) {
    return { ok: false, status: 401, error: "Your login could not be verified. Sign in again." };
  }
  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: account, error: accountError } = await admin
    .from("accounts")
    .select("id, email")
    .eq("auth_user_id", userData.user.id)
    .maybeSingle();
  if (accountError || !account) {
    return { ok: false, status: 403, error: "No Immigration account exists for this login." };
  }
  const row = account as { id: string; email?: string | null };
  return { ok: true, accountId: row.id, email: row.email ?? userData.user.email ?? null };
}

// ---------------------------------------------------------------------------
// Form metadata for the DIY flow (from the registry — never invented)
// ---------------------------------------------------------------------------

export interface DiyFormMeta {
  formCode: string;
  title: string;
  draftNotice: string;
  /** "No verified edition is stored — confirm at uscis.gov." Never a guessed date. */
  editionNote: string;
  redFlag: boolean;
  sectionCount: number;
  sectionHeadings: string[];
}

export function diyFormMeta(formCode: string): DiyFormMeta | null {
  const schema = getRegistrySchema(formCode);
  if (!schema) return null;
  return {
    formCode: schema.formCode,
    title: schema.title,
    draftNotice: schema.draftNotice,
    editionNote:
      "No USCIS form edition is printed here — no verified edition is stored in this codebase. " +
      "Check the current edition for Form " +
      schema.formCode +
      " at uscis.gov before filing.",
    redFlag: schema.redFlag,
    sectionCount: schema.sections.length,
    sectionHeadings: schema.sections.map((s) => s.heading),
  };
}

/** True when every DIY form carries its draft/edition notice. */
export function allDiyFormsCarryEditionNotice(): boolean {
  return DIY_FORM_CODES.every((code) => {
    const meta = diyFormMeta(code);
    return (
      meta !== null &&
      meta.draftNotice === DRAFT_SCHEMA_NOTICE &&
      meta.editionNote.includes("uscis.gov")
    );
  });
}
