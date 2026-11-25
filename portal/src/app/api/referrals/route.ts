// Refer-a-Family API — /api/referrals
// GET ?code=<referral code> — resolve a referral link to the
//     professional's storefront (slug). Used by /r/<code> and by the
//     storefront (/p/[slug]) when ?ref=<code> is present. Resolves a
//     professional's professional_profiles.referral_code first, then
//     a client's accounts.referral_code (via that client's latest
//     case's assigned provider — the referrer stays the client).
//     Returns 404 with an honest message when no code matches.
// GET ?referrer=<account id> — real referral counts from preparer_leads
//     rows (referral_source = 'Referral', referrer_account_id = you;
//     became-clients = pipeline_stage 'converted'). 0 / 0 when no rows.
// The referral itself is recorded when the referred person submits a
// quote/order on the storefront (see src/app/p/[slug]/page.tsx —
// insertLead carries referral_source 'Referral' + referrer_account_id
// + referral_code when ?ref=<code> is present). No reward, discount
// code, payout, or Stripe here — the reward is NOT set.
// Until Supabase env vars are set this route returns 501.
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { referralCounts, storefrontLink } from "@/lib/referrals";

function notConfigured() {
  return NextResponse.json(
    {
      error:
        "Referrals not configured — Supabase env vars are not set, so no referral was resolved or counted. Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY, and run migration 0017 first.",
    },
    { status: 501 }
  );
}

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const code = params.get("code");
  const referrer = params.get("referrer");

  if (code) {
    const admin = serviceClient();
    if (!admin) return notConfigured();
    // 1. Professional's own code (professional_profiles.referral_code).
    const { data, error } = await admin
      .from("professional_profiles")
      .select("slug, account_id")
      .eq("referral_code", code)
      .limit(1);
    if (error) {
      return NextResponse.json(
        { error: `Could not resolve the referral code: ${error.message}. Migration 0017 may not have run yet.` },
        { status: 500 }
      );
    }
    const profile = data?.[0];
    if (profile) {
      return NextResponse.json({
        code,
        slug: profile.slug,
        storefrontUrl: storefrontLink(profile.slug as string),
        referrerAccountId: profile.account_id,
      });
    }
    // 2. Client's account-level code (accounts.referral_code, migration
    //    0017): a client refers to the professional they used, so resolve
    //    the code to the client, then to that client's latest case and
    //    its assigned provider's storefront. The referrer stays the
    //    client (referrer_account_id = the client's account id).
    const { data: accounts, error: accountError } = await admin
      .from("accounts")
      .select("id")
      .eq("referral_code", code)
      .limit(1);
    if (accountError) {
      return NextResponse.json(
        { error: `Could not resolve the referral code: ${accountError.message}. Migration 0017 may not have run yet.` },
        { status: 500 }
      );
    }
    const referrer = accounts?.[0];
    if (!referrer) {
      return NextResponse.json(
        { error: "No professional or client uses that referral code." },
        { status: 404 }
      );
    }
    const { data: cases, error: caseError } = await admin
      .from("cases")
      .select("assigned_provider_id")
      .eq("client_id", (referrer as { id: string }).id)
      .not("assigned_provider_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1);
    if (caseError) {
      return NextResponse.json(
        { error: `Could not resolve the referral code: ${caseError.message}.` },
        { status: 500 }
      );
    }
    const providerId = (cases?.[0] as { assigned_provider_id: string } | undefined)?.assigned_provider_id;
    if (!providerId) {
      return NextResponse.json(
        { error: "That referral code belongs to a client with no assigned professional yet, so there is no storefront to land on. Ask the person who shared the link for their professional's storefront address." },
        { status: 404 }
      );
    }
    const { data: providerProfiles, error: profileError } = await admin
      .from("professional_profiles")
      .select("slug")
      .eq("account_id", providerId)
      .limit(1);
    if (profileError) {
      return NextResponse.json(
        { error: `Could not resolve the referral code: ${profileError.message}.` },
        { status: 500 }
      );
    }
    const providerProfile = providerProfiles?.[0];
    if (!providerProfile) {
      return NextResponse.json(
        { error: "That referral code belongs to a client whose professional has no storefront yet. Ask the person who shared the link for their professional's storefront address." },
        { status: 404 }
      );
    }
    return NextResponse.json({
      code,
      slug: (providerProfile as { slug: string }).slug,
      storefrontUrl: storefrontLink((providerProfile as { slug: string }).slug),
      referrerAccountId: (referrer as { id: string }).id,
    });
  }

  if (referrer) {
    const admin = serviceClient();
    if (!admin) return notConfigured();
    const { data, error } = await admin
      .from("preparer_leads")
      .select("referral_source, referrer_account_id, pipeline_stage")
      .eq("referrer_account_id", referrer);
    if (error) {
      return NextResponse.json(
        { error: `Could not count referrals: ${error.message}. Migration 0017 may not have run yet.` },
        { status: 500 }
      );
    }
    const counts = referralCounts(
      (data ?? []).map((r) => ({
        referral_source: (r as { referral_source: string | null }).referral_source,
        referrer_account_id: (r as { referrer_account_id: string | null }).referrer_account_id,
        pipeline_stage: (r as { pipeline_stage: string }).pipeline_stage,
      })),
      referrer
    );
    return NextResponse.json({ referrer, ...counts });
  }

  return NextResponse.json(
    { error: "Pass ?code=<referral code> to resolve a link, or ?referrer=<account id> for real referral counts." },
    { status: 400 }
  );
}
