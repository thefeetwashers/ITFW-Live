// Verified Professionals, Flat Prices — Immigration with NIPTEI
// (Nov 28, 2026). Founder-approved standout feature #5.
//
// WHAT ALREADY EXISTED (reused, not rebuilt):
//   * public_profiles VIEW (migration 0013): the ONLY public-safe
//     projection of professional_profiles. Listing gate —
//     is_published = true AND subscription_status = 'active' AND
//     (role = 'preparer' OR the linked account is_verified). The view
//     NEVER exposes email, phone, bar_number, eoir_number,
//     stripe_customer_id, subscription_plan, or current_period_end.
//   * professional_form_fees (migration 0001): per-profile, per-form
//     flat fees (custom_fee_cents, integer cents).
//   * Locked flat prices (src/lib/stripePrices.ts — never changed):
//     Preparer $49/mo (subscription_preparer), Attorney $99/mo
//     (subscription_attorney), DOJ Standard $24.50/mo
//     (subscription_doj_standard), DOJ Full $49.50/mo
//     (subscription_doj_full), Law Student $35/mo
//     (subscription_law_student); single-form tiers via
//     formTierPriceKey(); DIY $25 (diy_form), Review $99 (review_form).
//   * /p/[slug] storefront pages (already built).
//
// RULES (locked — do not weaken):
//   * ONLY verified professionals are listed. Unverified stay
//     unlisted: isListedProfile() applies the 0013 view gate exactly,
//     and searchVerifiedProfessionals() filters to listed profiles
//     FIRST, before any language / form / price filter. An unverified
//     profile can never appear in results, whatever the filters are.
//   * Flat locked prices ONLY — never a percentage, never a per-lead
//     fee. Every price here is an integer-cents flat amount from the
//     locked map or the profile's own flat form fee. There is no
//     percentage field anywhere in this file, and none is accepted.
//   * Verification status shown is STATUS ONLY: "Bar verified" /
//     "DOJ accredited" / "Preparer — verification not required". Bar
//     numbers and EOIR numbers are never shown on a public listing
//     (migration 0013 forbids them in the view).
//   * REAL ONLY: no invented professionals, reviews, prices, or "live"
//     claims. When nothing matches, the honest empty state is
//     NO_VERIFIED_MATCHES_EMPTY_STATE — never a made-up listing.
//   * Only a licensed attorney or DOJ-accredited representative gives
//     legal advice (8 CFR 292.1). Preparers give clerical help only.
import type { LanguageCode } from "./i18n";
import {
  formTierPriceKey,
  getLockedPriceByKey,
  type LockedStripePrice,
} from "./stripePrices";

/** One row of the public_profiles view (0013) plus the flat form fees
 *  the directory needs for form / price filtering. Mirrors the view's
 *  safe columns only — never email, phone, bar_number, eoir_number,
 *  or stripe_customer_id. */
export interface DirectoryProfile {
  id: string;
  slug: string;
  fullName: string;
  companyName: string | null;
  /** professional_profiles.role: preparer | attorney | nonprofit. */
  role: "preparer" | "attorney" | "nonprofit";
  bio: string | null;
  languagesSpoken: LanguageCode[];
  acceptingNewClients: boolean;
  practiceAreas: string[];
  accreditationLevel: "partial_uscis_only" | "full_uscis_and_court" | null;
  /** Listing-gate fields (0013 view WHERE clause). */
  isPublished: boolean;
  subscriptionStatus: string;
  /** Linked accounts row (0013 join). */
  isVerified: boolean;
  verificationStatus: string;
  /** Flat per-form fees (professional_form_fees, 0001). */
  formFees: { formCode: string; feeCents: number }[];
}

/** Honest empty state — shown when no verified professional matches. */
export const NO_VERIFIED_MATCHES_EMPTY_STATE =
  "No verified professionals match yet — try a different language, form, or price, or check back later. Only verified professionals are listed here; unverified profiles are never shown.";

export const DIRECTORY_NOT_CONNECTED_NOTE =
  "The verified directory is not connected yet (Supabase is not configured in this build), so no professionals can be listed. Nothing is shown instead of real listings.";

/**
 * The listing gate, exactly as migration 0013's public_profiles view:
 * is_published AND subscription_status = 'active' AND (role =
 * 'preparer' OR the linked account is_verified). An unverified
 * attorney / nonprofit fails the gate; an unpublished or unpaid
 * profile fails it too. This is the ONLY listing test — the search
 * below calls it first.
 */
export function isListedProfile(p: DirectoryProfile): boolean {
  return (
    p.isPublished === true &&
    p.subscriptionStatus === "active" &&
    (p.role === "preparer" || p.isVerified === true)
  );
}

/** Verification status shown on a listing — STATUS ONLY, never a bar
 *  or EOIR number. Unverified profiles never reach this label through
 *  the search (they are filtered out first); the "not verified" text
 *  exists so a direct call can never render a false "verified". */
export function verificationLabel(p: DirectoryProfile): string {
  if (!isListedProfile(p)) return "Not verified — not listed";
  if (p.role === "attorney") return "Verified — licensed attorney (bar checked)";
  if (p.role === "nonprofit") {
    return p.accreditationLevel === "full_uscis_and_court"
      ? "Verified — DOJ-accredited representative (USCIS + court)"
      : "Verified — DOJ-accredited representative (USCIS only)";
  }
  return "Document preparer — verification not required for preparers";
}

// ---------------------------------------------------------------------------
// Flat locked prices only. Every price is an integer-cents flat amount.
// ---------------------------------------------------------------------------

/** Locked monthly subscription price for a professional role. */
export function subscriptionPriceForRole(
  role: "preparer" | "attorney" | "nonprofit",
  accreditationLevel?: DirectoryProfile["accreditationLevel"]
): LockedStripePrice | undefined {
  if (role === "preparer") return getLockedPriceByKey("subscription_preparer");
  if (role === "attorney") return getLockedPriceByKey("subscription_attorney");
  return getLockedPriceByKey(
    accreditationLevel === "full_uscis_and_court"
      ? "subscription_doj_full"
      : "subscription_doj_standard"
  );
}

/** Law Student $35/mo (locked). Law students have no storefront
 *  profile — this is listed here so the flat-price table is complete. */
export function lawStudentPrice(): LockedStripePrice | undefined {
  return getLockedPriceByKey("subscription_law_student");
}

/** Locked single-form tier price (flat), e.g. ("I-485","standard"). */
export function flatPriceForForm(
  formCode: string,
  tier: "basic" | "standard" | "premium"
): LockedStripePrice | undefined {
  return getLockedPriceByKey(formTierPriceKey(formCode, tier));
}

/** DIY $25 / Review $99 flat prices (locked). */
export function diyPrice(): LockedStripePrice | undefined {
  return getLockedPriceByKey("diy_form");
}
export function reviewPrice(): LockedStripePrice | undefined {
  return getLockedPriceByKey("review_form");
}

/** The profile's own flat fee for a form, from professional_form_fees.
 *  Null = this professional does not offer that form. A flat amount
 *  only — the table has no percentage column and none is read. */
export function profileFlatFeeForForm(
  p: DirectoryProfile,
  formCode: string
): number | null {
  const row = p.formFees.find((f) => f.formCode === formCode);
  return row ? row.feeCents : null;
}

/** Storefront link for a listed professional. */
export function storefrontUrl(p: DirectoryProfile): string {
  return `/p/${p.slug}`;
}

// ---------------------------------------------------------------------------
// Search / filter — verified only, always.
// ---------------------------------------------------------------------------

export interface DirectoryFilters {
  language?: LanguageCode;
  formCode?: string;
  /** Maximum flat price in cents (form fee or locked tier price). */
  maxPriceCents?: number;
  role?: "preparer" | "attorney" | "nonprofit";
  acceptingNewClientsOnly?: boolean;
}

export interface DirectorySearchResult {
  /** Listed profiles that match every filter. Never unverified. */
  results: DirectoryProfile[];
  /** How many listed profiles existed before filtering. */
  totalListed: number;
  /** How many input profiles the listing gate removed (unverified /
   *  unpublished / unpaid). Reported so the gate is auditable. */
  excludedUnverifiedCount: number;
  /** Honest empty state when results is empty. */
  emptyState: string | null;
}

/**
 * Find a preparer / attorney by language, form and price.
 * Order of operations is the rule: (1) keep ONLY listed (verified)
 * profiles — unverified stay unlisted no matter the filters; (2)
 * apply language / form / price / role filters; (3) sort by flat
 * form fee ascending when a form was asked for (cheapest flat fee
 * first — never a bid, never a per-lead fee).
 */
export function searchVerifiedProfessionals(
  profiles: DirectoryProfile[],
  filters: DirectoryFilters = {}
): DirectorySearchResult {
  const listed = profiles.filter(isListedProfile);
  const excludedUnverifiedCount = profiles.length - listed.length;
  let results = listed;
  if (filters.role) {
    results = results.filter((p) => p.role === filters.role);
  }
  if (filters.language) {
    results = results.filter((p) =>
      p.languagesSpoken.includes(filters.language as LanguageCode)
    );
  }
  if (filters.acceptingNewClientsOnly) {
    results = results.filter((p) => p.acceptingNewClients);
  }
  if (filters.formCode) {
    const formCode = filters.formCode;
    results = results.filter(
      (p) => profileFlatFeeForForm(p, formCode) !== null
    );
    if (filters.maxPriceCents !== undefined) {
      const maxPriceCents: number = filters.maxPriceCents;
      results = results.filter(
        (p) => (profileFlatFeeForForm(p, formCode) ?? Infinity) <= maxPriceCents
      );
    }
    results = [...results].sort(
      (a, b) =>
        (profileFlatFeeForForm(a, formCode) ?? Infinity) -
        (profileFlatFeeForForm(b, formCode) ?? Infinity)
    );
  } else if (filters.maxPriceCents !== undefined) {
    // No form asked: cap by the cheapest flat form fee the profile
    // offers (a profile with no form fees has no price to compare).
    const maxPriceCents: number = filters.maxPriceCents;
    results = results.filter((p) => {
      if (p.formFees.length === 0) return false;
      return Math.min(...p.formFees.map((f) => f.feeCents)) <= maxPriceCents;
    });
  }
  return {
    results,
    totalListed: listed.length,
    excludedUnverifiedCount,
    emptyState: results.length === 0 ? NO_VERIFIED_MATCHES_EMPTY_STATE : null,
  };
}
