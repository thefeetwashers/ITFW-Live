// Professional discovery — landing content, verification steps, and
// the professional-to-client invitation flow. Nov 28, 2026 (twelfth
// addition, part A).
//
// WHAT ALREADY EXISTED (reused, not rebuilt):
//   * Verified directory /professionals — src/lib/verifiedDirectory.ts
//     (verified-only gate from the public_profiles view, migration
//     0013) + /p/[slug] storefronts. This file does NOT rebuild the
//     directory; the landing page links to it.
//   * family_invites magic invite + 6-digit code — src/lib/invites.ts
//     (generateInviteCode, inviteLink) + family_invites (0002,
//     extended 0005/0006/0022, purpose + 'client' role in 0030).
//     A professional inviting their own client reuses EXACTLY this
//     mechanism — no new invite system is invented.
//   * Referral system — src/lib/referrals.ts (referralLink,
//     REFERRAL_REWARD_LABEL) + /api/referrals + /r/<code> (0017).
//     A professional's referral link still lands on their storefront.
//   * Locked flat prices — src/lib/stripePrices.ts (never changed).
//     This file reads the locked prices; it sets none.
//   * Google sign-in + registration — src/lib/googleAuth.ts,
//     /register (6 locked roles, nothing pre-selected), /login.
//
// RULES (locked — do not weaken):
//   * REAL ONLY: no invented professionals, reviews, prices, or
//     "live" claims. When no verified professional matches, the
//     directory shows NO_VERIFIED_MATCHES_EMPTY_STATE — never a
//     made-up listing. Discovery means public content + referrals +
//     invitations, never a bought or scraped list.
//   * Only a licensed attorney or DOJ-accredited representative
//     gives legal advice (8 CFR 292.1). Preparers give clerical
//     help only. The platform is a document-preparation service,
//     NOT a law firm, NOT USCIS affiliated.
//   * Pay-before-access via existing Stripe checkout/webhook —
//     DB-confirmed payment, never a front-end flag. Listing needs
//     is_published AND an active subscription (0013 gate).

import {
  getLockedPriceByKey,
  type LockedStripePrice,
} from "./stripePrices";
import { generateInviteCode, inviteLink } from "./invites";
import { REFERRAL_REWARD_LABEL, referralLink } from "./referrals";

// ---------------------------------------------------------------------------
// Landing page content (public, professional-facing).
// ---------------------------------------------------------------------------

export const PRO_LANDING_HEADLINE = "Join Immigration with NIPTEI as a verified professional";
export const PRO_LANDING_SUBHEAD =
  "A document-preparation platform, not a law firm, not affiliated with USCIS. Flat locked prices, your own tools, your own clients — verified professionals only, listed only when verified.";

export const WHY_JOIN: { title: string; detail: string }[] = [
  {
    title: "Flat locked prices — never a percentage",
    detail:
      "You pay a flat monthly subscription and set flat per-form fees. The platform never takes a percentage of your fees and never charges per lead.",
  },
  {
    title: "Your own storefront",
    detail:
      "A public page at /p/your-name with your bio, languages, practice areas, and flat fees — shown only once you are verified, published, and on an active subscription.",
  },
  {
    title: "Your own tools (BYO)",
    detail:
      "Connect your own Twilio, Resend, AWS SES, Stripe, calendar, and e-signature accounts. The platform never holds your clients' money or messages.",
  },
  {
    title: "Invite your own clients",
    detail:
      "Send a client a magic invite link + 6-digit code, or share your referral link. They register on your storefront — no bought or scraped lists, ever.",
  },
  {
    title: "Google tools, when you connect them",
    detail:
      "Google Calendar, Drive, and Gmail connect to YOUR Google account once the founder finishes the Google Cloud OAuth setup. Until then the dashboard says plainly: not connected.",
  },
];

/** Verification process, in order. Nothing here auto-verifies anyone. */
export const VERIFICATION_STEPS: { step: number; title: string; detail: string }[] = [
  {
    step: 1,
    title: "Register and pick ONE role",
    detail:
      "Document Preparer, Licensed Attorney, DOJ-Accredited Nonprofit, or Law Student (supervised only). Nothing is pre-selected; email registration stays, and Google sign-in is offered too.",
  },
  {
    step: 2,
    title: "Complete your profile",
    detail:
      "Bio, languages, practice areas, service area, and your flat per-form fees. Attorneys add bar number + jurisdiction; nonprofits add EOIR number + accreditation tier.",
  },
  {
    step: 3,
    title: "Pay your flat subscription",
    detail:
      "Preparer $49/mo, Attorney $99/mo, DOJ Standard $24.50/mo, DOJ Full $49.50/mo, Law Student $35/mo — through Stripe checkout. Access is confirmed from the database, never from a front-end flag.",
  },
  {
    step: 4,
    title: "Founder/admin verification",
    detail:
      "Attorneys: bar checked. Nonprofits: DOJ accreditation checked. Preparers: UPL agreement + verification not required for listing, but the profile must still be published and the subscription active.",
  },
  {
    step: 5,
    title: "Listed in the verified directory",
    detail:
      "Only then do you appear at /professionals and on your storefront. Unverified, unpublished, or unpaid profiles are never shown.",
  },
];

/** Locked monthly subscription prices for the landing page, read from
 *  the locked map — never typed here, so they cannot drift. */
export function proSubscriptionPrices(): {
  role: string;
  price: LockedStripePrice | undefined;
}[] {
  return [
    { role: "Document Preparer", price: getLockedPriceByKey("subscription_preparer") },
    { role: "Licensed Attorney", price: getLockedPriceByKey("subscription_attorney") },
    { role: "DOJ Nonprofit — Standard", price: getLockedPriceByKey("subscription_doj_standard") },
    { role: "DOJ Nonprofit — Full", price: getLockedPriceByKey("subscription_doj_full") },
    { role: "Law Student (supervised only)", price: getLockedPriceByKey("subscription_law_student") },
  ];
}

export function formatFlatPrice(price: LockedStripePrice | undefined): string {
  if (!price) return "Price not set — ask the founder";
  return `$${(price.amountCents / 100).toFixed(2)}/mo`;
}

// ---------------------------------------------------------------------------
// Professional invites their own client (reuses family_invites).
// ---------------------------------------------------------------------------

export type ClientInvitePurpose = "client_onboarding";

export interface ProfessionalClientInvite {
  /** Server-generated magic token (stored in family_invites.invite_token). */
  token: string;
  /** 6-digit code, shown once to the professional to share verbally. */
  code: string;
  /** family_invites.invite_purpose. */
  purpose: ClientInvitePurpose;
  /** family_invites.role. */
  role: "client";
  /** The professional who invited (accounts.id). */
  invitedBy: string;
  /** Canonical guest link — same shape as family invites. */
  link: string;
  expiresAt: string;
  /** Referral link for the same professional (0017, unchanged). */
  referralUrl: string | null;
}

/**
 * Build a client invite for a professional to send to their own
 * client. The TOKEN must be generated server-side and stored in
 * family_invites.invite_token with expiry (migration 0006) — the
 * crypto.randomUUID() here is the client-side shape only; the API
 * route (/api/professionals/invite-client) generates and stores the
 * real one. The 6-digit code is only a short code shared verbally,
 * not the security token. Invite expires in 7 days.
 */
export function buildClientInvite(args: {
  invitedBy: string;
  referralCode?: string | null;
  token?: string;
}): ProfessionalClientInvite {
  const token =
    args.token ??
    (typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `invite-${Date.now()}`);
  const expires = new Date();
  expires.setDate(expires.getDate() + 7);
  return {
    token,
    code: generateInviteCode(),
    purpose: "client_onboarding",
    role: "client",
    invitedBy: args.invitedBy,
    link: inviteLink(token),
    expiresAt: expires.toISOString(),
    referralUrl: args.referralCode ? referralLink(args.referralCode) : null,
  };
}

export const CLIENT_INVITE_HONEST_NOTE =
  "Your client registers with this invite link + 6-digit code. They pick their own role (client) and complete their own profile — you never register for them, and the invite does not promise them a case outcome or a filing date.";

export { REFERRAL_REWARD_LABEL };
