// POST /api/professionals/invite-client — a professional invites
// their own client onto the platform.
//
// REUSES the existing family_invites magic invite + 6-digit code
// system (src/lib/invites.ts, migration 0002/0006, purpose +
// 'client' role in 0030). No new invite mechanism is invented.
// The referral system (0017, /r/<code>) is untouched: a
// professional's referral link still lands on their storefront.
//
// The invite is created BEFORE the client has a case, so case_id
// is null (migration 0030). The client registers with the link +
// code, picks their own role, and completes their own profile —
// the professional never registers for them, and the invite
// promises no case outcome or filing date.
// Until Supabase env vars are set this route returns 501.
import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { buildClientInvite } from "@/lib/proDiscovery";

export async function POST(req: Request) {
  let body: { invitedBy?: unknown; referralCode?: unknown } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const invitedBy = typeof body.invitedBy === "string" ? body.invitedBy : "";
  const referralCode =
    typeof body.referralCode === "string" && body.referralCode.trim()
      ? body.referralCode.trim()
      : null;
  const uuidRe =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!invitedBy || !uuidRe.test(invitedBy)) {
    return NextResponse.json(
      { error: "invitedBy must be the professional's accounts.id UUID." },
      { status: 400 }
    );
  }
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json(
      {
        error:
          "Client invites are not configured — Supabase is not connected, so the invite cannot be stored. Nothing was sent.",
        deliveryStatus: "not_configured",
      },
      { status: 501 }
    );
  }
  const invite = buildClientInvite({ invitedBy, referralCode });
  const { data, error } = await supabase
    .from("family_invites")
    .insert({
      case_id: null,
      invited_by: invitedBy,
      role: "client",
      invite_code: invite.code,
      invite_token: invite.token,
      invite_purpose: "client_onboarding",
      expires_at: invite.expiresAt,
    })
    .select("id")
    .single();
  if (error || !data?.id) {
    return NextResponse.json(
      { error: `Client invite could not be created: ${error?.message ?? "unknown error"}` },
      { status: 502 }
    );
  }
  return NextResponse.json(
    {
      ok: true,
      inviteId: (data as { id: string }).id,
      link: invite.link,
      code: invite.code,
      expiresAt: invite.expiresAt,
      referralUrl: invite.referralUrl,
      note: "Share the link + 6-digit code with your client. They register themselves; the invite promises no case outcome or filing date.",
    },
    { status: 200 }
  );
}
