// Refer-a-Family — counts from REAL preparer_leads rows only
// (referral_source = 'Referral', pipeline_stage 'converted' for
// became-clients). Starts at 0 / 0 with an honest empty state.
// NO reward amount is invented: "Referral reward: to be announced
// by the founder". No discount code, no payout, no Stripe.
"use client";

import {
  REFERRAL_REWARD_LABEL,
  referralCounts,
  referralLink,
  storefrontLink,
  type ReferralLeadRow,
} from "@/lib/referrals";

export default function ReferralCard({
  leads,
  referrerAccountId,
  referralCode,
  storefrontSlug,
}: {
  leads: ReferralLeadRow[];
  referrerAccountId: string | null;
  referralCode: string | null;
  storefrontSlug: string | null;
}) {
  const counts =
    referrerAccountId !== null || referralCode !== null
      ? referralCounts(leads, {
          accountId: referrerAccountId,
          referralCode,
        })
      : { referred: 0, becameClients: 0 };

  return (
    <section
      aria-labelledby="refer-a-family-heading"
      className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
    >
      <h2 id="refer-a-family-heading" className="text-base font-semibold">
        Refer a Family
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Share your link with a family who needs immigration help. They land
        on your professional&apos;s storefront, and the referral is recorded
        with referral source “Referral”.
      </p>
      {referralCode ? (
        <p className="mt-2 text-sm">
          Your referral link:{" "}
          <a
            href={referralLink(referralCode)}
            className="font-semibold text-blue-700 underline break-all"
          >
            {referralLink(referralCode)}
          </a>
        </p>
      ) : (
        <p className="mt-2 text-sm text-slate-600">
          Your referral code is not set yet — it is set when your profile is
          published. Ask the founder for your code.
        </p>
      )}
      {storefrontSlug && (
        <p className="mt-1 text-sm">
          Your storefront link:{" "}
          <a
            href={storefrontLink(storefrontSlug)}
            className="font-semibold text-blue-700 underline break-all"
          >
            {storefrontLink(storefrontSlug)}
          </a>
        </p>
      )}
      <p className="mt-2 text-sm">
        <strong>{counts.referred}</strong> famil
        {counts.referred === 1 ? "y" : "ies"} you referred ·{" "}
        <strong>{counts.becameClients}</strong> became clients
        {counts.referred === 0 &&
          " — no referrals recorded yet (counts come only from real referral rows)."}
      </p>
      <p className="mt-1 text-sm font-semibold text-amber-700">
        {REFERRAL_REWARD_LABEL}
      </p>
      <p className="mt-1 text-xs text-slate-500">
        No discount code, no payout, and no payment is set up for referrals
        until the founder announces the reward.
      </p>
    </section>
  );
}
