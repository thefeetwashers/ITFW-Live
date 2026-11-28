// Whole Family In One Case — Immigration with NIPTEI (Nov 28, 2026)
// Founder-approved standout feature #1.
//
// WHAT ALREADY EXISTED (reused, not rebuilt):
//   * case_family_members (migration 0009): one row per family member,
//     relationship in ('Spouse','Beneficiary','Petitioner','Joint
//     Sponsor','Child'), can_view_status / can_upload_docs /
//     can_view_invoices (default false), invite_token, accepted_at.
//   * family_invites (migration 0002, extended 0005/0006): magic invite
//     + 6-digit code (src/lib/invites.ts, src/lib/loginCodes.ts).
//   * Role isolation (src/lib/isolation.ts): Viewer role "family" sees
//     ONLY their invited case, never messages/invoices unless allowed.
//   * FamilyPortalView already hides invoices + messages for an invitee
//     whose flags are false.
//
// WHAT WAS GENUINELY MISSING (migration 0022 adds it — see that file):
//   * case_family_members had NO account_id: a family member had no link
//     to their own accounts row, so there was no "own login" to give
//     them, and is_case_participant() (0001/0008) only recognised the
//     case client_id / assigned provider — a family member passed NO
//     RLS gate at all. 0022 adds account_id + can_view_messages and
//     extends is_case_participant() to family members.
//   * family_invites.role only allowed ('spouse','joint_sponsor',
//     'relative_abroad') — no petitioner / beneficiary / child. 0022
//     widens the CHECK to the four family roles.
//
// LOGIN (no second account system is invented):
//   A family member logs in exactly like any other client: their own
//   accounts row (role 'client', their own email), the normal /login
//   flow, and the 6-digit email code (migration 0020, src/lib/
//   loginCodes.ts) as second factor. Accepting a family_invites invite
//   links that accounts row to the case_family_members row (account_id
//   + accepted_at). The magic invite link is only how they are
//   INVITED; the login itself is the existing login.
//
// ROLE ISOLATION (enforced here in the app layer, on top of RLS):
//   Every member shares ONE checklist and ONE timeline for the case.
//   What differs is what each member may SEE: payment/invoice detail
//   is shown ONLY when can_view_invoices is true (default false — a
//   child never sees the petitioner's payment details); messages only
//   when can_view_messages is true (default false); uploads only when
//   can_upload_docs is true. scopeFamilyCaseView() returns a redacted
//   copy — it never returns the hidden data for the caller to filter
//   later. A member who asks for another member's payment details gets
//   the redaction notice, not the numbers.
//
// SENSITIVE IDENTIFIERS: DOB, A-Number, SSN and passport numbers are
// masked in the UI (maskANumber / maskDob / maskPassport), never
// logged, never in email subjects. They live only in the tables
// migrations already provide (accounts.date_of_birth,
// accounts.alien_registration_number, 0009). No SSN column exists
// anywhere and none is added.
import {
  canViewCase,
  familyCanViewInvoices,
  familyCanViewMessages,
  type CaseRef,
  type Viewer,
} from "./isolation";

/** The four family roles in one case. Maps to the
 *  case_family_members.relationship CHECK (migration 0009):
 *  'Petitioner' | 'Beneficiary' | 'Child' | 'Joint Sponsor'. */
export type FamilyRole =
  | "petitioner"
  | "beneficiary"
  | "child"
  | "joint_sponsor";

export const FAMILY_ROLES: FamilyRole[] = [
  "petitioner",
  "beneficiary",
  "child",
  "joint_sponsor",
];

export const FAMILY_ROLE_LABEL: Record<FamilyRole, string> = {
  petitioner: "Petitioner",
  beneficiary: "Beneficiary",
  child: "Child",
  joint_sponsor: "Joint Sponsor",
};

export const FAMILY_ROLE_RELATIONSHIP: Record<FamilyRole, string> = {
  petitioner: "Petitioner",
  beneficiary: "Beneficiary",
  child: "Child",
  joint_sponsor: "Joint Sponsor",
};

/** One row of case_family_members (0009 + 0022 account_id /
 *  can_view_messages). `accountId` is the member's OWN accounts row —
 *  their own login. Null until they accept the invite. */
export interface FamilyMember {
  id: string;
  caseId: string;
  /** Own accounts row (role 'client'). Null = invited, not yet logged in. */
  accountId: string | null;
  inviteId: string | null;
  fullName: string;
  role: FamilyRole;
  email: string | null;
  phone: string | null;
  canViewStatus: boolean;
  canUploadDocs: boolean;
  canViewInvoices: boolean;
  canViewMessages: boolean;
  inviteToken: string;
  acceptedAt: string | null;
}

/** Default scope per role, for the invite form. These are the values
 *  an inviter SHOULD pick; the database defaults (invoices false,
 *  messages false) are the enforcement, and scopeFamilyCaseView()
 *  reads the stored flags — never these defaults — at view time. */
export const FAMILY_ROLE_DEFAULT_SCOPE: Record<
  FamilyRole,
  { canViewStatus: boolean; canUploadDocs: boolean; canViewInvoices: boolean; canViewMessages: boolean }
> = {
  // Petitioner: usually the primary client themself; status + uploads.
  // Invoices only if the inviter explicitly grants them.
  petitioner: { canViewStatus: true, canUploadDocs: true, canViewInvoices: false, canViewMessages: false },
  beneficiary: { canViewStatus: true, canUploadDocs: true, canViewInvoices: false, canViewMessages: false },
  // A child sees the shared checklist + timeline and their own status
  // only — never payments, never messages, never uploads.
  child: { canViewStatus: true, canUploadDocs: false, canViewInvoices: false, canViewMessages: false },
  // Joint sponsor (I-864): uploads their own tax documents only.
  joint_sponsor: { canViewStatus: true, canUploadDocs: true, canViewInvoices: false, canViewMessages: false },
};

/** Build the isolation.ts Viewer for a family member, from their
 *  stored row. `familyCaseId` is the ONE case they were invited to. */
export function viewerForFamilyMember(member: FamilyMember): Viewer {
  return {
    accountId: member.accountId ?? `family-member-${member.id}`,
    role: "family",
    familyCaseId: member.caseId,
    canViewInvoices: member.canViewInvoices,
    canViewMessages: member.canViewMessages,
  };
}

/** May this member see this case at all? (Delegates to isolation.ts —
 *  family members see ONLY their invited case.) */
export function familyMemberCanViewCase(
  member: FamilyMember,
  c: CaseRef
): boolean {
  return canViewCase(viewerForFamilyMember(member), c);
}

// ---------------------------------------------------------------------------
// Sensitive-identifier masking. Masked in the UI, never logged, never
// in email subjects. Only the last few characters are ever shown.
// ---------------------------------------------------------------------------

/** A-Number: "A-***-***-123" — last 3 digits only. */
export function maskANumber(aNumber: string | null | undefined): string {
  if (!aNumber) return "Not on file";
  const digits = aNumber.replace(/\D/g, "");
  if (digits.length === 0) return "A-***-***-***";
  return `A-***-***-${digits.slice(-3)}`;
}

/** Date of birth: year only, month and day hidden. */
export function maskDob(dob: string | null | undefined): string {
  if (!dob) return "Not on file";
  const year = dob.slice(0, 4);
  return /^\d{4}$/.test(year) ? `**/**/${year}` : "**/**/****";
}

/** Passport number: last 2 characters only. */
export function maskPassport(passport: string | null | undefined): string {
  if (!passport) return "Not on file";
  const trimmed = passport.trim();
  if (trimmed.length <= 2) return "***";
  return `${"*".repeat(Math.min(trimmed.length - 2, 6))}${trimmed.slice(-2)}`;
}

/** Strip every sensitive identifier from an object before logging it.
 *  Callers must never log a member row, a case row, or an invite raw. */
export function redactSensitiveForLog<T extends Record<string, unknown>>(
  row: T
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...row };
  for (const key of [
    "date_of_birth",
    "dateOfBirth",
    "alien_registration_number",
    "aNumber",
    "ssn",
    "social_security_number",
    "passport_number",
    "passportNumber",
    "invite_token",
    "inviteToken",
    "invite_code",
    "inviteCode",
  ]) {
    if (key in out) out[key] = "[REDACTED]";
  }
  return out;
}

// ---------------------------------------------------------------------------
// Shared case view — one checklist, one timeline, redacted per member.
// ---------------------------------------------------------------------------

export interface SharedCaseContent {
  checklist: string[];
  timeline: string[];
  /** Payment / invoice detail. Shown ONLY when can_view_invoices. */
  invoices: { label: string; amountCents: number }[];
  /** Message thread. Shown ONLY when can_view_messages. */
  messages: { from: string; text: string }[];
}

export type HiddenSection = {
  hidden: true;
  reason: string;
};

export interface FamilyCaseView {
  member: FamilyMember;
  caseId: string;
  /** The SAME checklist every member of the case shares. */
  checklist: string[];
  /** The SAME timeline every member of the case shares. */
  timeline: string[];
  canViewInvoices: boolean;
  canViewMessages: boolean;
  canUploadDocs: boolean;
  invoices: SharedCaseContent["invoices"] | HiddenSection;
  messages: SharedCaseContent["messages"] | HiddenSection;
}

export const INVOICES_HIDDEN_REASON =
  "Payment details are hidden for your role in this case. Only the primary client — or a family member the primary client explicitly gave invoice access to — can see invoices.";
export const MESSAGES_HIDDEN_REASON =
  "Messages are hidden for your role in this case. Only the primary client — or a family member the primary client explicitly gave message access to — can see the message thread.";

/**
 * Scope the shared case content to what this member may see. The
 * checklist and timeline are shared by the whole family; invoices and
 * messages are replaced by a redaction notice unless the member's
 * stored flags allow them. The hidden data is NOT included in the
 * returned object at all.
 */
export function scopeFamilyCaseView(
  member: FamilyMember,
  shared: SharedCaseContent
): FamilyCaseView {
  const viewer = viewerForFamilyMember(member);
  const invoicesAllowed = familyCanViewInvoices(viewer);
  const messagesAllowed = familyCanViewMessages(viewer);
  return {
    member,
    caseId: member.caseId,
    checklist: shared.checklist,
    timeline: shared.timeline,
    canViewInvoices: invoicesAllowed,
    canViewMessages: messagesAllowed,
    canUploadDocs: member.canUploadDocs,
    invoices: invoicesAllowed
      ? shared.invoices
      : { hidden: true, reason: INVOICES_HIDDEN_REASON },
    messages: messagesAllowed
      ? shared.messages
      : { hidden: true, reason: MESSAGES_HIDDEN_REASON },
  };
}

/** Type guard: is this section the redaction notice, not real data? */
export function isHiddenSection(
  section: unknown
): section is HiddenSection {
  return (
    typeof section === "object" &&
    section !== null &&
    (section as HiddenSection).hidden === true
  );
}
