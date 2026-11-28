// Paywall gating — server-side paid-access checks.
//
// RULE (founder brief, 2026-11-28): if a client must pay for something,
// they pay BEFORE access is given. Access is decided HERE, on the
// server, against Stripe subscription / invoice records in the
// database — never by a front-end flag alone.
//
// How it works:
//   * `decidePaidAccess()` is the pure decision: given the evidence
//     read from the database (professional_profiles.subscription_status
//     + invoices with status 'paid'), it returns allowed / denied.
//     It is unit-tested by scripts/smoke-paywall-interview.ts.
//   * `getPaidAccessForAccount()` is the server-only reader: it reads
//     public.accounts, public.professional_profiles and public.invoices
//     with the service-role client and returns the decision. It fails
//     CLOSED: when Supabase is not configured, or the account is not
//     found, access is DENIED (never granted by default).
//   * `/api/access` exposes the decision to signed-in callers (Bearer
//     token, verified server-side). `/api/interview-prep` serves the
//     question banks only when the decision allows.
//   * Pages never render gated content from a client-side flag: the
//     interview-prep page fetches its content from /api/interview-prep
//     (403 = locked), and the smart-forms page checks /api/access
//     before mounting the intake engine.
//
// Database facts (migrations 0001–0004, verified 2026-11-28):
//   * professional_profiles.subscription_status ('none' | 'trialing' |
//     'active' | 'past_due' | 'canceled' | 'unpaid') is set to 'active'
//     by /api/stripe/webhook on checkout.session.completed — for
//     preparer / attorney / nonprofit roles only.
//   * invoices.status = 'paid' is written by the same webhook when
//     the Checkout Session carries a case_id + account_id, and by
//     invoice.paid. A paid invoice unlocks access for a client
//     (bundle / DIY / Review purchase).
//   * FIXED (Nov 28, 2026, migration 0037) — law students and
//     Members: the webhook now writes a public.subscriptions row
//     (account + locked price key + status 'active' + Stripe
//     subscription id) on every subscription checkout, and sets
//     student_profiles.subscription_status to 'active' for the Law
//     Student price. getPaidAccessForAccount() reads both, so a
//     paying member/student is recognised even though their
//     checkout carries no case_id and therefore no invoices row.
//     Before this fix a paying member/student was denied after
//     paying — see the old gap notes below, kept for the record.
//   * KNOWN GAP (pre-fix, now closed by the webhook + 0037) — law
//     students: student_profiles had a subscription_plan
//     ('law_student_35') but NO subscription_status column, and the
//     webhook never wrote a student row. A student who paid $35/mo
//     through Checkout with no case_id also got NO invoices row, so
//     their payment was NOT provable from the database and
//     decidePaidAccess() denied them.
//   * KNOWN GAP (pre-fix, now closed by the webhook + 0037) — Member
//     ($9.80/mo) subscriptions: the webhook only recorded an invoice
//     when the session carried a case_id. A member checkout with no
//     case recorded nothing, so a paying member could be denied.
//     Both gaps are closed ONLY once migration 0037 has run live —
//     until then the reader treats a missing subscriptions table
//     as "no rows" and the old denial behaviour stands. Do NOT
//     "fix" it here by trusting a client-side claim.
//   * Teachers are FREE (no fee, register-role route) — a teacher
//     account is allowed without payment.
//   * Admin / founder accounts are allowed (support access), decided
//     server-side from accounts.role — never from a client claim.
//
// Locked prices are NOT changed here. Unlock prices come from
// src/lib/stripePrices.ts (locked Price IDs) via getLockedPriceByKey.

import { createClient } from "@supabase/supabase-js";
import { getLockedPriceByKey } from "./stripePrices";

export type PaywallSurface =
  | "interview_prep"
  | "document_checklists"
  | "document_vault"
  | "smart_forms"
  | "ask_niptei_premium"
  | "packet_rescue_fix";

export const PAYWALL_SURFACES: Record<
  PaywallSurface,
  { label: string; description: string }
> = {
  interview_prep: {
    label: "Interview Preparation",
    description:
      "Mock question banks (N-400 civics + personal, I-485, consular), what to bring, conduct guide, and video scripts.",
  },
  document_checklists: {
    label: "Document Checklists",
    description:
      "Form checklists from src/lib/formChecklists.ts (packet audit, required documents).",
  },
  document_vault: {
    label: "Document Vault",
    description:
      "Client document uploads, Mail Vault, and the signed-agreement vault.",
  },
  smart_forms: {
    label: "Smart Forms — Dynamic Intake Engine",
    description:
      "The 15-schema Dynamic Intake Engine (src/components/DynamicFormIntakeEngine.tsx).",
  },
  ask_niptei_premium: {
    label: "Ask NIPTEI — Premium",
    description:
      "AI copilot answers (OpenRouter) beyond the free locked FAQ. Not connected yet — see audit.",
  },
  packet_rescue_fix: {
    label: "Packet Rescue — Paid Fix ($199)",
    description:
      "The paid fix for a packet audited free by src/lib/packetRescue.ts. Unlocks only when a paid invoice for the locked Packet Rescue price (addon_packet_rescue, $199) exists in the database. The free audit never unlocks it.",
  },
};

export type PaywallRole =
  | "client"
  | "preparer"
  | "attorney"
  | "nonprofit"
  | "law_student"
  | "teacher"
  | "admin"
  | "founder";

/** Evidence read from the database — never from the client. */
export interface PaidAccessEvidence {
  role: PaywallRole;
  /** professional_profiles.subscription_status, or null when the
   *  account has no professional profile (clients, students). */
  professionalSubscriptionStatus: string | null;
  /** professional_profiles.current_period_end, or null. */
  subscriptionCurrentPeriodEnd: string | null;
  /** public.subscriptions status ('active' when the account has a
   *  paid subscription row written by the webhook, migration
   *  0037), or null when there is no such row. This is how a
   *  paying Member is recognised — members have no invoices row
   *  (no case) and no professional profile. */
  subscriptionStatus?: string | null;
  /** student_profiles.subscription_status, or null when the
   *  account has no student profile. */
  studentSubscriptionStatus?: string | null;
  /** Number of public.invoices rows with status 'paid' for this account. */
  paidInvoiceCount: number;
  accountVerified: boolean;
}

export interface PaidAccessDecision {
  allowed: boolean;
  /** Plain-English reason, shown to the user. */
  reason: string;
  /** Locked Stripe price key that unlocks access, or null when no
   *  payment is needed (teacher / admin / founder) or the role has
   *  no unlock price. */
  unlockPriceKey: string | null;
  unlockLabel: string | null;
  role: PaywallRole;
}

/** Locked unlock price per role. Prices are NOT changed here — they
 *  are the locked Stripe Prices in src/lib/stripePrices.ts. */
export function unlockForRole(role: PaywallRole): {
  priceKey: string;
  label: string;
} | null {
  switch (role) {
    case "client":
      // The monthly fee: Member $9.80/mo. A paid bundle invoice also
      // unlocks (see decidePaidAccess) — the member price is the
      // cheapest pay-first route shown to an unpaid client.
      return { priceKey: "member_monthly", label: "Member — $9.80/mo" };
    case "preparer":
      return { priceKey: "subscription_preparer", label: "Document Preparer — $49/mo" };
    case "attorney":
      return { priceKey: "subscription_attorney", label: "Licensed Attorney — $99/mo" };
    case "nonprofit":
      return {
        priceKey: "subscription_doj_standard",
        label: "DOJ Nonprofit — Standard $24.50/mo (Full $49.50/mo also available)",
      };
    case "law_student":
      return { priceKey: "subscription_law_student", label: "Law Student — $35/mo" };
    case "teacher":
    case "admin":
    case "founder":
      return null; // Free role (teacher) or support access (admin/founder).
    default:
      return { priceKey: "member_monthly", label: "Member — $9.80/mo" };
  }
}

function denied(
  role: PaywallRole,
  reason: string
): PaidAccessDecision {
  const unlock = unlockForRole(role);
  return {
    allowed: false,
    reason,
    unlockPriceKey: unlock?.priceKey ?? null,
    unlockLabel: unlock?.label ?? null,
    role,
  };
}

/**
 * Pure paid-access decision. Only 'active' subscriptions and paid
 * invoices unlock. 'trialing', 'past_due', 'canceled', 'unpaid' and
 * 'none' never unlock. A subscription whose current_period_end is in
 * the past does not unlock.
 */
export function decidePaidAccess(
  evidence: PaidAccessEvidence,
  _surface: PaywallSurface
): PaidAccessDecision {
  const { role } = evidence;

  // Teachers are free — no fee, no payment needed.
  if (role === "teacher") {
    return {
      allowed: true,
      reason: "Teacher accounts are free — no subscription is required.",
      unlockPriceKey: null,
      unlockLabel: null,
      role,
    };
  }

  // Admin / founder: support access, decided server-side from
  // accounts.role. Never granted from a client-side claim.
  if (role === "admin" || role === "founder") {
    return {
      allowed: true,
      reason: "Platform admin / founder access (support).",
      unlockPriceKey: null,
      unlockLabel: null,
      role,
    };
  }

  // Active professional subscription (preparer / attorney / nonprofit).
  // Law students have no professional_profiles row, so this branch
  // never fires for them — the subscription-record branch below
  // covers them via student_profiles.subscription_status.
  if (evidence.professionalSubscriptionStatus === "active") {
    const end = evidence.subscriptionCurrentPeriodEnd
      ? Date.parse(evidence.subscriptionCurrentPeriodEnd)
      : NaN;
    if (!Number.isNaN(end) && end < Date.now()) {
      return denied(
        role,
        "Your subscription ended on " +
          new Date(end).toLocaleDateString("en-US") +
          ". Renew it to unlock this content."
      );
    }
    return {
      allowed: true,
      reason: "Active subscription on file.",
      unlockPriceKey: null,
      unlockLabel: null,
      role,
    };
  }

  // Active subscription record (migration 0037) — Member, Law
  // Student, or any payer whose checkout carried no case and
  // therefore no invoices row. The webhook writes this row from a
  // verified Stripe event only; a client claim never creates it.
  if (
    evidence.subscriptionStatus === "active" ||
    evidence.studentSubscriptionStatus === "active"
  ) {
    const end = evidence.subscriptionCurrentPeriodEnd
      ? Date.parse(evidence.subscriptionCurrentPeriodEnd)
      : NaN;
    if (!Number.isNaN(end) && end < Date.now()) {
      return denied(
        role,
        "Your subscription ended on " +
          new Date(end).toLocaleDateString("en-US") +
          ". Renew it to unlock this content."
      );
    }
    return {
      allowed: true,
      reason: "Active subscription on file.",
      unlockPriceKey: null,
      unlockLabel: null,
      role,
    };
  }

  // Paid invoice (client bundle / DIY / Review purchase, or any paid
  // invoice recorded by the Stripe webhook).
  if (evidence.paidInvoiceCount > 0) {
    return {
      allowed: true,
      reason: `Paid invoice on file (${evidence.paidInvoiceCount} paid).`,
      unlockPriceKey: null,
      unlockLabel: null,
      role,
    };
  }

  const unlock = unlockForRole(role);
  return denied(
    role,
    unlock
      ? `Pay first to unlock this content — ${unlock.label}. Nothing is shown until payment is confirmed in our records.`
      : "Pay first to unlock this content. Nothing is shown until payment is confirmed in our records."
  );
}

// ---------------------------------------------------------------------------
// Server-only reader (service-role client). Call ONLY from API routes /
// server components — never from a client component.
// ---------------------------------------------------------------------------

export interface ServerAccessResult extends PaidAccessDecision {
  /** False when Supabase is not configured — access is denied. */
  configured: boolean;
  accountId: string;
}

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function getPaidAccessForAccount(
  accountId: string,
  surface: PaywallSurface
): Promise<ServerAccessResult> {
  const base: Omit<ServerAccessResult, "allowed" | "reason" | "unlockPriceKey" | "unlockLabel" | "role"> = {
    configured: false,
    accountId,
  };
  const admin = serviceClient();
  if (!admin) {
    return {
      ...base,
      allowed: false,
      reason:
        "Payment records are not connected yet (Supabase is not configured), so access cannot be verified. Nothing is unlocked until the payment records are connected and your payment is confirmed.",
      unlockPriceKey: "member_monthly",
      unlockLabel: "Member — $9.80/mo",
      role: "client",
    };
  }

  const { data: account, error: accountError } = await admin
    .from("accounts")
    .select("id, role, is_verified")
    .eq("id", accountId)
    .maybeSingle();
  if (accountError || !account) {
    return {
      ...base,
      configured: true,
      allowed: false,
      reason: "No Immigration account was found for this login. Sign in again.",
      unlockPriceKey: "member_monthly",
      unlockLabel: "Member — $9.80/mo",
      role: "client",
    };
  }
  const row = account as {
    id: string;
    role: string;
    is_verified: boolean;
  };
  const role = (row.role ?? "client") as PaywallRole;

  let professionalSubscriptionStatus: string | null = null;
  let subscriptionCurrentPeriodEnd: string | null = null;
  const { data: profile } = await admin
    .from("professional_profiles")
    .select("subscription_status, current_period_end")
    .eq("account_id", accountId)
    .maybeSingle();
  if (profile) {
    const p = profile as {
      subscription_status?: string | null;
      current_period_end?: string | null;
    };
    professionalSubscriptionStatus = p.subscription_status ?? null;
    subscriptionCurrentPeriodEnd = p.current_period_end ?? null;
  }

  // Subscription record (migration 0037) — the webhook writes one
  // row per paid Stripe subscription. A missing table (migration
  // not run yet) returns an error here, treated as "no rows" —
  // access stays denied until 0037 is live, never granted.
  let subscriptionStatus: string | null = null;
  try {
    const { data: subRows, error: subError } = await admin
      .from("subscriptions")
      .select("status, current_period_end")
      .eq("account_id", accountId)
      .eq("status", "active")
      .limit(1);
    if (!subError && Array.isArray(subRows) && subRows.length > 0) {
      const s = subRows[0] as {
        status?: string | null;
        current_period_end?: string | null;
      };
      subscriptionStatus = s.status ?? null;
      if (!subscriptionCurrentPeriodEnd) {
        subscriptionCurrentPeriodEnd = s.current_period_end ?? null;
      }
    }
  } catch {
    subscriptionStatus = null;
  }

  // Law Student status (migration 0037 added the column).
  let studentSubscriptionStatus: string | null = null;
  try {
    const { data: student, error: studentError } = await admin
      .from("student_profiles")
      .select("subscription_status")
      .eq("account_id", accountId)
      .maybeSingle();
    if (!studentError && student) {
      studentSubscriptionStatus =
        (student as { subscription_status?: string | null })
          .subscription_status ?? null;
    }
  } catch {
    studentSubscriptionStatus = null;
  }

  const { data: invoices } = await admin
    .from("invoices")
    .select("id")
    .eq("client_id", accountId)
    .eq("status", "paid")
    .limit(1);
  const paidInvoiceCount = (invoices ?? []).length;

  const decision = decidePaidAccess(
    {
      role,
      professionalSubscriptionStatus,
      subscriptionCurrentPeriodEnd,
      subscriptionStatus,
      studentSubscriptionStatus,
      paidInvoiceCount,
      accountVerified: row.is_verified,
    },
    surface
  );
  return { ...base, configured: true, ...decision };
}

/** Locked price (label + cents) for an unlock key, or null. */
export function unlockPrice(
  priceKey: string | null
): { priceId: string; label: string; amountCents: number } | null {
  if (!priceKey) return null;
  const price = getLockedPriceByKey(priceKey);
  if (!price) return null;
  return { priceId: price.priceId, label: price.label, amountCents: price.amountCents };
}

// ---------------------------------------------------------------------------
// Gating audit — every gated surface, where it is enforced, and what is
// still missing. Kept in code so the audit travels with the gate.
// ---------------------------------------------------------------------------

export interface PaywallAuditRow {
  surface: PaywallSurface;
  where: string;
  enforcedBy: string;
  status: "enforced" | "partial" | "not_enforced";
  note: string;
}

export const PAYWALL_AUDIT: PaywallAuditRow[] = [
  {
    surface: "interview_prep",
    where: "/interview-prep (new page) + /api/interview-prep",
    enforcedBy: "Server: /api/interview-prep checks getPaidAccessForAccount() and returns 403 when unpaid. The page never imports the question banks — it fetches them from the API.",
    status: "enforced",
    note: "Previously the only interview content was 7 unsourced example questions in src/components/portal/CaseChat.tsx (InterviewPrep) — those are still there and are NOT the new banks; they should be replaced by a link to /interview-prep (left untouched: outside this build's files).",
  },
  {
    surface: "smart_forms",
    where: "/portal/smart-forms (new page) mounts the 15-schema Dynamic Intake Engine",
    enforcedBy: "Server: /api/access checks getPaidAccessForAccount() before the engine mounts. Unpaid visitors see PaywallLocked, never the engine.",
    status: "enforced",
    note: "The engine code itself is a client component (its schemas are static data). The gate is the server-side access check that decides whether it mounts at all. Full server-component gating (hiding the code itself) needs Supabase cookie auth, which this portal does not have yet — see report.",
  },
  {
    surface: "document_checklists",
    where: "/portal §6 Smart Forms & Checklists + /portal/packet-audit",
    enforcedBy: "Not yet server-enforced: both pages show EXAMPLE checklist data only, not real paid content. The gate must be added when real checklists are served from the database.",
    status: "partial",
    note: "No real checklist content is exposed today — only example rows. Do not claim this surface is locked until the real data path is gated with /api/access.",
  },
  {
    surface: "document_vault",
    where: "/portal #document-vault (GuestInviteCard) + Mail Vault",
    enforcedBy: "Not yet server-enforced: guest upload invites and Mail Vault are example / invite-only surfaces. Real vault reads must go through /api/access once the vault API exists.",
    status: "partial",
    note: "Vault uploads already require a guest invite token (migration 0006 guest_upload_scope). That is an invite gate, not a paywall — a paying client and an unpaid guest are not distinguished there yet.",
  },
  {
    surface: "ask_niptei_premium",
    where: "/api/ask-niptei (Ask NIPTEI copilot)",
    enforcedBy: "Not yet enforced: the route returns 501 'AI not configured' (OpenRouter is not connected), so no premium answers exist to gate. The free locked-FAQ answers it returns today are free content.",
    status: "not_enforced",
    note: "When OpenRouter is connected, the POST route must call getPaidAccessForAccount() for ask_niptei_premium BEFORE calling the model. Until then, do not sell premium copilot access.",
  },
  {
    surface: "packet_rescue_fix",
    where: "/packet-rescue (new page) + src/lib/packetRescue.ts decidePacketRescueFixAccess()",
    enforcedBy: "Pure decision: allowed ONLY when a paid invoice for the locked Packet Rescue price (addon_packet_rescue, $199) exists in the database. The free audit result always carries paidFixUnlocked: false.",
    status: "partial",
    note: "No server API route reads the Packet Rescue invoices yet — the decision function is ready and unit-tested (scripts/smoke-standout-five.ts), but the route that feeds it real invoice rows still needs building. Until then the page shows the locked offer and the free audit only; do not claim the fix is purchasable end-to-end.",
  },
];
