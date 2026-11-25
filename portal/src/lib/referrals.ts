// Refer-a-Family program — migration 0017.
// A client/professional gets a referral link; the referred person
// lands on that professional's storefront; the referral is recorded
// in preparer_leads with referral_source = 'Referral' + referrer.
//
// Honesty rules:
//  * Counts come ONLY from real preparer_leads rows: referred =
//    rows with referral_source 'Referral' and this referrer;
//    became clients = those rows with pipeline_stage 'converted'.
//    With no rows the counts are 0 — never invented.
//  * NO reward amount is invented. The reward is NOT set, so the UI
//    shows "Referral reward: to be announced by the founder" and the
//    founder decision is on the DEPLOY.md checklist. No discount
//    code, no payout, no Stripe — until the founder sets it.
export const REFERRAL_REWARD_LABEL =
  "Referral reward: to be announced by the founder";
export const REFERRAL_SOURCE = "Referral" as const;

export interface ReferralLeadRow {
  referral_source: string | null;
  referrer_account_id: string | null;
  /** The referral code used — identifies the referrer even for an
   *  anonymous visitor (the referrer's account id is unknown until
   *  they sign in, so the code is the attribution key). Optional:
   *  older queries select only referrer_account_id. */
  referral_code?: string | null;
  pipeline_stage: string;
}

export interface ReferralCounts {
  referred: number;
  becameClients: number;
}

/** Accepts either a referrer account id (string) or
 *  { accountId, referralCode } — both callers exist in this repo
 *  (/api/referrals uses the string form; ReferralCard uses the
 *  object form so code-based referrals count too). */
export function referralCounts(
  leads: ReferralLeadRow[],
  referrer: string | { accountId?: string | null; referralCode?: string | null }
): ReferralCounts {
  const accountId = typeof referrer === "string" ? referrer : referrer.accountId;
  const referralCode =
    typeof referrer === "string" ? undefined : referrer.referralCode;
  const mine = leads.filter(
    (l) =>
      l.referral_source === REFERRAL_SOURCE &&
      ((accountId !== null &&
        accountId !== undefined &&
        l.referrer_account_id === accountId) ||
        (referralCode !== null &&
          referralCode !== undefined &&
          l.referral_code === referralCode))
  );
  return {
    referred: mine.length,
    becameClients: mine.filter((l) => l.pipeline_stage === "converted")
      .length,
  };
}

/** immigration.niptei.com/r/<code> — resolves to the professional's storefront. */
export function referralLink(code: string): string {
  return `https://immigration.niptei.com/r/${code}`;
}

export function storefrontLink(slug: string): string {
  return `https://immigration.niptei.com/p/${slug}`;
}
