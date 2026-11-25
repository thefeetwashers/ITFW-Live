// Refer-a-Family landing — immigration.niptei.com/r/<code>.
// Resolves the referral code via /api/referrals?code=<code> (the ONE
// resolution path — the API resolves a professional's
// professional_profiles.referral_code AND a client's
// accounts.referral_code, migration 0017) and sends the visitor to
// that professional's storefront with ?ref=<code>, so their quote /
// booking / order is recorded in preparer_leads with referral_source
// = 'Referral'. No reward is promised here — the reward is to be
// announced by the founder.
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { REFERRAL_REWARD_LABEL } from "@/lib/referrals";

export default function ReferralLandingPage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const code = params.code;
  const [message, setMessage] = useState(
    "Looking up this referral link…"
  );

  useEffect(() => {
    const run = async () => {
      try {
        const res = await fetch(
          `/api/referrals?code=${encodeURIComponent(code)}`
        );
        const data = (await res.json().catch(() => ({}))) as {
          slug?: string;
          error?: string;
        };
        if (!res.ok || !data.slug) {
          setMessage(
            data.error ||
              `No professional was found for referral code “${code}” (migration 0017 may not have run yet, or the code is not set). No referral was recorded. Please ask the person who shared the link for their storefront address.`
          );
          return;
        }
        router.replace(`/p/${data.slug}?ref=${code}`);
      } catch {
        setMessage(
          "This referral link could not be verified — the referrals service is not reachable, so the professional behind this code cannot be looked up. No referral was recorded. Please ask the person who shared the link for their storefront address, or visit the main site below."
        );
      }
    };
    run();
  }, [code, router]);

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-bold">You were referred to Immigration with NIPTEI</h1>
      <p className="mt-2 text-sm text-slate-600">
        Referral code: <strong>{code}</strong>
      </p>
      <p className="mt-3 rounded border border-slate-300 bg-white px-3 py-2 text-sm">
        {message}
      </p>
      <p className="mt-3 text-sm font-semibold text-amber-700">
        {REFERRAL_REWARD_LABEL}
      </p>
      <p className="mt-4 text-sm">
        <Link href="/" className="font-semibold text-blue-700 underline">
          ← Immigration with NIPTEI
        </Link>
      </p>
    </main>
  );
}
