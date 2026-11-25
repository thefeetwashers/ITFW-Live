// Family / Co-Sponsor Sub-Invites (Founder check #4)
// Builds on family_invites (migration 0002): magic invite + 6-digit code.
// A co-sponsor (e.g. I-864 joint sponsor) uploads their own tax returns
// into the client's vault under their own invite. They never see the
// client's password, and never see other cases. This file is the
// client-side contract; the DB side is in migration 0005.
export function generateInviteCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// CORRECTED invite link (the pasted draft had https://niptei.com{token} —
// missing slash, wrong domain). Canonical guest link:
// https://immigration.niptei.com/guest/<token>
// The token itself must be generated server-side and stored in
// family_invites.invite_token with expiry + allowed_document_types
// (migration 0006); a browser Math.random() value is NEVER the token.
// The 6-digit code below is only a short code shared verbally, not
// the security token.
export function inviteLink(token: string): string {
  return `https://immigration.niptei.com/guest/${token}`;
}

export interface CoSponsorInvite {
  token: string;
  code: string; // 6-digit, shown once to the client to share verbally
  caseId: string;
  role: "joint_sponsor" | "spouse" | "relative_abroad";
  formCode: string; // e.g. "I-864"
  expiresAt: string;
}

export function createCoSponsorInvite(args: {
  caseId: string;
  formCode?: string;
}): CoSponsorInvite {
  const token =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `invite-${Date.now()}`;
  const expires = new Date();
  expires.setDate(expires.getDate() + 7);
  return {
    token,
    code: generateInviteCode(),
    caseId: args.caseId,
    role: "joint_sponsor",
    formCode: args.formCode ?? "I-864",
    expiresAt: expires.toISOString(),
  };
}
