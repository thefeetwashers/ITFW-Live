// Referral link after a successful DIY print.
//
// WHY THIS FILE EXISTS: after a client prints their packet, the
// natural next step is "tell someone else who needs this". The
// referral system already exists — /r/[code] resolves a code to a
// storefront (src/lib/referrals.ts, migration 0017,
// accounts.referral_code / professional_profiles.referral_code) and
// counts real referrals from preparer_leads rows. This module reuses
// it: given the client's referral code (read from their account row),
// it returns the link to show after a successful print.
//
// HONESTY RULES (from src/lib/referrals.ts, not weakened):
//   * No reward amount is invented. The reward is NOT set, so the
//     link card always shows "Referral reward: to be announced by
//     the founder" (REFERRAL_REWARD_LABEL).
//   * When the client has NO referral code, the result is an honest
//     empty state — "referrals are not set up for your account yet" —
//     never a made-up link.
//   * Counts come only from real preparer_leads rows (referralCounts
//     in src/lib/referrals.ts). This module does not count anything.

import {
  REFERRAL_REWARD_LABEL,
  referralCounts,
  referralLink,
  type ReferralLeadRow,
} from "./referrals";

export { REFERRAL_REWARD_LABEL };

export interface DiyReferralAfterPrint {
  /** True when the client has a referral code and a real link exists. */
  configured: boolean;
  referralCode: string | null;
  referralUrl: string | null;
  rewardLabel: string;
  /** Shown when configured is false — honest empty state. */
  emptyState: string | null;
  referred: number;
  becameClients: number;
}

export const DIY_REFERRAL_EMPTY_STATE =
  "Referrals are not set up for your account yet — no referral link exists for you. " +
  "Ask your provider to set up your referral code, and this box will show your link.";

export function referralAfterPrint(args: {
  /** accounts.referral_code for this client, or null. */
  referralCode: string | null;
  /** Real preparer_leads rows for counting (referralCounts). Omit
   *  when the caller has no rows — counts are then 0, never invented. */
  leadRows?: ReferralLeadRow[];
  /** The referrer account id, for counting this client's referrals. */
  referrerAccountId?: string | null;
}): DiyReferralAfterPrint {
  const code = (args.referralCode ?? "").trim() || null;
  if (!code) {
    return {
      configured: false,
      referralCode: null,
      referralUrl: null,
      rewardLabel: REFERRAL_REWARD_LABEL,
      emptyState: DIY_REFERRAL_EMPTY_STATE,
      referred: 0,
      becameClients: 0,
    };
  }
  const counts = referralCounts(args.leadRows ?? [], {
    accountId: args.referrerAccountId ?? null,
    referralCode: code,
  });
  return {
    configured: true,
    referralCode: code,
    referralUrl: referralLink(code),
    rewardLabel: REFERRAL_REWARD_LABEL,
    emptyState: null,
    referred: counts.referred,
    becameClients: counts.becameClients,
  };
}
