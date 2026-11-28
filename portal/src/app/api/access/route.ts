// GET /api/access?surface=<surface> — server-side paid-access check.
//
// The caller is identified by their Supabase Auth access token
// (Authorization: Bearer <token>) — never by an account id in the
// request. The token is verified with the anon client, the account is
// read with the service-role client, and the decision comes from
// src/lib/paywall.ts (professional_profiles.subscription_status +
// paid invoices). This route never grants access from a client claim.
//
// Responses:
//   200 { allowed, role, reason, unlockPriceKey, unlockLabel, configured }
//   401 no / invalid token — sign in first (access denied)
//   501 Supabase not configured — access denied, fail closed
//   400 unknown surface
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  PAYWALL_SURFACES,
  getPaidAccessForAccount,
  type PaywallSurface,
} from "@/lib/paywall";

export const runtime = "nodejs";

function clients() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceKey) return null;
  return {
    anon: createClient(url, anonKey, { auth: { persistSession: false } }),
    admin: createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
  };
}

export async function GET(req: Request) {
  const cs = clients();
  if (!cs) {
    return NextResponse.json(
      {
        allowed: false,
        configured: false,
        role: "client",
        reason:
          "Payment records are not connected yet (Supabase is not configured), so access cannot be verified. Nothing is unlocked.",
        unlockPriceKey: "member_monthly",
        unlockLabel: "Member — $9.80/mo",
      },
      { status: 501 }
    );
  }

  const surface = new URL(req.url).searchParams.get("surface") ?? "";
  if (!(surface in PAYWALL_SURFACES)) {
    return NextResponse.json(
      {
        error: `Unknown surface "${surface}". Use one of: ${Object.keys(PAYWALL_SURFACES).join(", ")}.`,
      },
      { status: 400 }
    );
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) {
    return NextResponse.json(
      { error: "Sign in first — no access token was sent.", allowed: false },
      { status: 401 }
    );
  }
  const { data: userData, error: userError } = await cs.anon.auth.getUser(token);
  if (userError || !userData.user) {
    return NextResponse.json(
      { error: "Your login could not be verified. Sign in again.", allowed: false },
      { status: 401 }
    );
  }
  const { data: account, error: accountError } = await cs.admin
    .from("accounts")
    .select("id")
    .eq("auth_user_id", userData.user.id)
    .maybeSingle();
  if (accountError || !account) {
    return NextResponse.json(
      { error: "No Immigration account exists for this login.", allowed: false },
      { status: 403 }
    );
  }

  const decision = await getPaidAccessForAccount(
    (account as { id: string }).id,
    surface as PaywallSurface
  );
  return NextResponse.json({
    allowed: decision.allowed,
    configured: decision.configured,
    role: decision.role,
    reason: decision.reason,
    unlockPriceKey: decision.unlockPriceKey,
    unlockLabel: decision.unlockLabel,
    surface,
    surfaceLabel: PAYWALL_SURFACES[surface as PaywallSurface].label,
  });
}
