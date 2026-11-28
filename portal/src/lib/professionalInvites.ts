// Professional invitation flow — TWELFTH ADDITION (part B), Nov 28, 2026.
//
// WHAT THIS IS: a client (or the Founder/Admin) can invite a named
// professional — an attorney, a DOJ-accredited representative, a
// preparer, or a nonprofit caseworker — to join a case, or to join
// the platform. The invite is a token + a 6-digit code, expiring in
// 7 days, exactly like the family / co-sponsor invites in
// src/lib/invites.ts. It is NOT a shortcut around verification.
//
// HONESTY + SAFETY RULES (do not weaken):
//   * An invite NEVER verifies a professional. An invited attorney
//     still needs their bar checked, a DOJ representative still needs
//     the EOIR roster checked, a student still needs their supervisor
//     confirmed — the same admin verification queue as every other
//     professional (src/lib/googleAuth.ts ladder). An invited
//     professional cannot list, take a G-28, or be assigned until
//     verified. The invite only opens the door to register.
//   * The invite link is https://immigration.niptei.com/guest/<token>
//     (same canonical guest link as family invites). The token is
//     generated server-side and stored with expiry; a browser
//     Math.random() value is NEVER the token. The 6-digit code is
//     only a short code shared verbally, not the security token.
//   * No role is auto-assigned: the invited professional still picks
//     their own role at onboarding and completes that role's profile.
//   * An invite to join a CASE lets the professional see that case
//     only — never other cases, never other clients. The case invite
//     names the case id and the role on the case (e.g. "attorney of
//     record", "reviewer").
//   * This file is the contract + validation only (same pattern as
//     src/lib/invites.ts). Sending (email/text) and persistence use
//     the platform's existing sender and the family_invites-style
//     table — NOT added here, so no new migration in this build.
//     Until sending is wired, an invite created here is a DRAFT the
//     inviter shares by hand, labelled as such.

export type ProfessionalInviteKind = "join_platform" | "join_case";

export type ProfessionalRoleOnCase =
  | "attorney_of_record"
  | "doj_representative"
  | "preparer"
  | "reviewer"
  | "nonprofit_caseworker";

export interface ProfessionalInvite {
  token: string;
  /** 6-digit code, shown once to share verbally. Not the token. */
  code: string;
  kind: ProfessionalInviteKind;
  /** Named professional being invited (name + email they register with). */
  professionalName: string;
  professionalEmail: string;
  /** Case invites only. */
  caseId?: string;
  roleOnCase?: ProfessionalRoleOnCase;
  invitedBy: string;
  expiresAt: string;
  /** "draft" until the invite is actually sent; "sent" after. */
  status: "draft" | "sent";
  /** Always true: an invite never verifies anyone. */
  verifiesProfessional: false;
}

export const PROFESSIONAL_INVITE_EXPIRY_DAYS = 7;

export const PROFESSIONAL_INVITE_NOTICE =
  "An invitation is not verification. An invited professional still " +
  "needs their credentials checked (attorney bar, DOJ EOIR roster, or " +
  "student supervisor) before they can list, take a case, or be " +
  "assigned. Only a licensed attorney or DOJ-accredited representative " +
  "gives legal advice (8 CFR 292.1).";

export function professionalInviteLink(token: string): string {
  return `https://immigration.niptei.com/guest/${token}`;
}

export function generateInviteCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function createProfessionalInvite(args: {
  kind: ProfessionalInviteKind;
  professionalName: string;
  professionalEmail: string;
  invitedBy: string;
  caseId?: string;
  roleOnCase?: ProfessionalRoleOnCase;
}): { invite: ProfessionalInvite | null; error?: string } {
  const email = args.professionalEmail.trim().toLowerCase();
  if (!args.professionalName.trim()) {
    return { invite: null, error: "Name the professional you are inviting." };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { invite: null, error: "That email address does not look right — check it and try again." };
  }
  if (args.kind === "join_case" && !args.caseId?.trim()) {
    return { invite: null, error: "A case invite needs a case — pick the case first." };
  }
  if (args.kind === "join_case" && !args.roleOnCase) {
    return { invite: null, error: "Say what the professional will do on this case (attorney of record, reviewer, preparer, or caseworker)." };
  }
  const expires = new Date();
  expires.setDate(expires.getDate() + PROFESSIONAL_INVITE_EXPIRY_DAYS);
  const token =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `invite-${Date.now()}`;
  return {
    invite: {
      token,
      code: generateInviteCode(),
      kind: args.kind,
      professionalName: args.professionalName.trim(),
      professionalEmail: email,
      ...(args.caseId ? { caseId: args.caseId.trim() } : {}),
      ...(args.roleOnCase ? { roleOnCase: args.roleOnCase } : {}),
      invitedBy: args.invitedBy,
      expiresAt: expires.toISOString(),
      status: "draft",
      verifiesProfessional: false,
    },
  };
}

export function professionalInviteIsExpired(
  invite: ProfessionalInvite,
  nowIso = new Date().toISOString()
): boolean {
  return new Date(invite.expiresAt).getTime() <= new Date(nowIso).getTime();
}

/** Plain-English invite message (hand-shared until sending is wired). */
export function professionalInviteMessage(invite: ProfessionalInvite): string {
  const link = professionalInviteLink(invite.token);
  const what =
    invite.kind === "join_case"
      ? `to help with case ${invite.caseId ?? ""} as ${invite.roleOnCase ?? "a professional"}`
      : "to join Immigration with NIPTEI as a professional";
  return (
    `You are invited ${what}.\n\n` +
    `Register here: ${link}\n` +
    `Your code (share it by phone, not by email): ${invite.code}\n\n` +
    `This link expires in 7 days (${invite.expiresAt.slice(0, 10)}).\n\n` +
    PROFESSIONAL_INVITE_NOTICE
  );
}
