// Service-level permissions matrix — SINGLE SOURCE OF TRUTH.
// docs/permissions-matrix.md is generated from this file's data (same
// rows, same wording). Every UI gate in this layer calls canDo() here —
// no dashboard hardcodes a different rule. If the matrix and a UI gate
// ever disagree, the matrix wins and the gate is a bug.
//
// Roles: client, preparer, attorney, doj_standard (DOJ Partial —
// DHS/USCIS & NVC only), doj_full (DOJ Full — USCIS and Court),
// law_student (supervised only), teacher, founder_admin.
// Service levels are in src/lib/serviceTiers.ts; this file covers what
// a ROLE can do. Tier limits (e.g. DIY leaves the Preparer section
// blank; a Basic-tier client cannot get Premium-tier services) are
// enforced by serviceTiers.ts tierFeatures() + the portal's tier gates.
export type MatrixRole =
  | "client"
  | "preparer"
  | "attorney"
  | "doj_standard"
  | "doj_full"
  | "law_student"
  | "teacher"
  | "founder_admin";

export const MATRIX_ROLES: { id: MatrixRole; label: string }[] = [
  { id: "client", label: "Client" },
  { id: "preparer", label: "Preparer" },
  { id: "attorney", label: "Attorney" },
  { id: "doj_standard", label: "DOJ Standard (Partial — DHS/USCIS & NVC only)" },
  { id: "doj_full", label: "DOJ Full (USCIS and Court)" },
  { id: "law_student", label: "Law Student (supervised only)" },
  { id: "teacher", label: "Teacher" },
  { id: "founder_admin", label: "Founder / Admin" },
];

export type CapabilityId =
  | "view_own_cases"
  | "view_assigned_cases"
  | "message_client"
  | "message_client_supervisor_visible"
  | "view_messages"
  | "view_documents"
  | "upload_documents"
  | "review_documents"
  | "request_document"
  | "reject_document_with_reason"
  | "view_invoices"
  | "manage_billing"
  | "send_payment_reminder"
  | "resend_receipt"
  | "view_g28"
  | "sign_g28"
  | "view_eoir28"
  | "give_legal_advice"
  | "esign_packet"
  | "file_packet"
  | "assign_law_student"
  | "view_verification_queue"
  | "view_audit_log"
  | "connect_own_integrations"
  | "write_private_case_notes"
  | "book_appointments";

export interface Capability {
  id: CapabilityId;
  label: string;
  /** allowed: true | false | "conditional" — condition explains the limit. */
  allowed: Record<MatrixRole, boolean | "conditional">;
  condition: Partial<Record<MatrixRole, string>>;
}

export const CAPABILITIES: Capability[] = [
  {
    id: "view_own_cases", label: "See own cases (client portal)",
    allowed: { client: true, preparer: false, attorney: false, doj_standard: false, doj_full: false, law_student: false, teacher: false, founder_admin: false },
    condition: {},
  },
  {
    id: "view_assigned_cases", label: "See cases assigned to you (professional dashboard)",
    allowed: { client: false, preparer: true, attorney: true, doj_standard: true, doj_full: true, law_student: "conditional", teacher: false, founder_admin: false },
    condition: { law_student: "Only cases explicitly assigned by the verified supervisor, with a confirmed student profile (migration 0011 is_assigned_student)." },
  },
  {
    id: "message_client", label: "Message a client in the unified thread",
    allowed: { client: true, preparer: true, attorney: true, doj_standard: true, doj_full: true, law_student: "conditional", teacher: false, founder_admin: false },
    condition: { client: "Only in your own cases, from inside your portal.", law_student: "Only with supervisor visibility — the supervisor sees the message. Never message a client alone." },
  },
  {
    id: "view_messages", label: "Read case messages",
    allowed: { client: true, preparer: true, attorney: true, doj_standard: true, doj_full: true, law_student: "conditional", teacher: false, founder_admin: false },
    condition: { law_student: "Only on assigned cases, and the supervisor sees the same thread." },
  },
  {
    id: "view_documents", label: "See case documents",
    allowed: { client: true, preparer: true, attorney: true, doj_standard: true, doj_full: true, law_student: "conditional", teacher: false, founder_admin: false },
    condition: { client: "Only your own cases.", law_student: "Only assigned cases (0011 documents_select_assigned_student).", founder_admin: "LOCKED in the UI — verification queue + audit log only. NOTE: migration 0003 §7a still grants founder SELECT in the database; closing that needs a founder decision + follow-up migration." },
  },
  {
    id: "upload_documents", label: "Upload documents to a case",
    allowed: { client: true, preparer: true, attorney: true, doj_standard: true, doj_full: true, law_student: "conditional", teacher: false, founder_admin: false },
    condition: { law_student: "Only on assigned cases (0011 documents_insert_assigned_student)." },
  },
  {
    id: "review_documents", label: "Accept / review documents",
    allowed: { client: false, preparer: true, attorney: true, doj_standard: true, doj_full: true, law_student: false, teacher: false, founder_admin: false },
    condition: { law_student: "LOCKED — document review stays provider-only (0011)." },
  },
  {
    id: "request_document", label: "Request a document from the client",
    allowed: { client: false, preparer: true, attorney: true, doj_standard: true, doj_full: true, law_student: false, teacher: false, founder_admin: false },
    condition: {},
  },
  {
    id: "reject_document_with_reason", label: "Reject a document with a reason",
    allowed: { client: false, preparer: true, attorney: true, doj_standard: true, doj_full: true, law_student: false, teacher: false, founder_admin: false },
    condition: {},
  },
  {
    id: "view_invoices", label: "See invoices",
    allowed: { client: true, preparer: true, attorney: true, doj_standard: true, doj_full: true, law_student: false, teacher: false, founder_admin: false },
    condition: { client: "Only your own cases.", law_student: "LOCKED — billing is locked for law students at every tier." },
  },
  {
    id: "manage_billing", label: "Manage billing / retainer-trust tools",
    allowed: { client: false, preparer: true, attorney: true, doj_standard: true, doj_full: true, law_student: false, teacher: false, founder_admin: false },
    condition: { preparer: "Preparers manage their own prep-fee billing only — never a retainer-trust account, never legal fees. The platform never holds money, never splits legal fees, never takes a percentage — flat subscription only." },
  },
  {
    id: "send_payment_reminder", label: "Send a payment reminder",
    allowed: { client: false, preparer: true, attorney: true, doj_standard: true, doj_full: true, law_student: false, teacher: false, founder_admin: false },
    condition: {},
  },
  {
    id: "resend_receipt", label: "Resend a payment receipt",
    allowed: { client: false, preparer: true, attorney: true, doj_standard: true, doj_full: true, law_student: false, teacher: false, founder_admin: false },
    condition: {},
  },
  {
    id: "view_g28", label: "See G-28 / EOIR-28 tools",
    allowed: { client: false, preparer: false, attorney: true, doj_standard: true, doj_full: true, law_student: false, teacher: false, founder_admin: false },
    condition: { preparer: "LOCKED at every tier — a preparer NEVER sees G-28 / EOIR-28, legal strategy, or retainer-trust tools.", law_student: "LOCKED at every tier." },
  },
  {
    id: "sign_g28", label: "Sign / file a G-28",
    allowed: { client: false, preparer: false, attorney: "conditional", doj_standard: "conditional", doj_full: "conditional", law_student: false, teacher: false, founder_admin: false },
    condition: { attorney: "Only once verified (bar check) — never before verification.", doj_standard: "G-28 (DHS/USCIS & NVC) only, once verified. EOIR-28 stays LOCKED.", doj_full: "G-28 and EOIR-28, once verified." },
  },
  {
    id: "view_eoir28", label: "See EOIR-28 (Immigration Court)",
    allowed: { client: false, preparer: false, attorney: true, doj_standard: false, doj_full: "conditional", teacher: false, founder_admin: false, law_student: false },
    condition: { doj_standard: "LOCKED — a partial DOJ representative NEVER sees EOIR-28 (Partial = DHS/USCIS & NVC only).", doj_full: "Only with Full accreditation AND verification." },
  },
  {
    id: "give_legal_advice", label: "Give legal advice / legal strategy",
    allowed: { client: false, preparer: false, attorney: true, doj_standard: true, doj_full: true, law_student: false, teacher: false, founder_admin: false },
    condition: { preparer: "LOCKED at every tier — a preparer cannot give legal advice or sign G-28 at any tier. Clerical help only (8 CFR 292.1).", doj_standard: "Only as a DOJ-accredited representative, within the accreditation.", doj_full: "Only as a DOJ-accredited representative, within the accreditation." },
  },
  {
    id: "esign_packet", label: "E-Sign a packet",
    allowed: { client: "conditional", preparer: false, attorney: "conditional", doj_standard: "conditional", doj_full: "conditional", law_student: false, teacher: false, founder_admin: false },
    condition: { client: "Only your own packet, only after the balance is paid in full and the packet audit is 100%.", attorney: "Client e-signs; the professional prepares. A student draft unlocks for client E-Sign only after supervisor approval.", doj_standard: "Client e-signs; the professional prepares.", doj_full: "Client e-signs; the professional prepares.", law_student: "LOCKED — a student draft unlocks for client E-Sign / G-28 filing only after supervisor approval." },
  },
  {
    id: "file_packet", label: "File a packet with USCIS",
    allowed: { client: false, preparer: false, attorney: "conditional", doj_standard: "conditional", doj_full: "conditional", law_student: false, teacher: false, founder_admin: false },
    condition: { attorney: "Only a verified attorney / DOJ representative files; preparers never file.", doj_standard: "Only a verified accredited representative files, within the accreditation.", doj_full: "Only a verified accredited representative files, within the accreditation.", law_student: "LOCKED at every tier." },
  },
  {
    id: "assign_law_student", label: "Assign / supervise a law student",
    allowed: { client: false, preparer: false, attorney: true, doj_standard: true, doj_full: true, law_student: false, teacher: false, founder_admin: false },
    condition: {},
  },
  {
    id: "view_verification_queue", label: "See the verification queue (bar / EOIR)",
    allowed: { client: false, preparer: false, attorney: false, doj_standard: false, doj_full: false, law_student: false, teacher: false, founder_admin: true },
    condition: {},
  },
  {
    id: "view_audit_log", label: "See the audit log",
    allowed: { client: "conditional", preparer: "conditional", attorney: "conditional", doj_standard: "conditional", doj_full: "conditional", law_student: false, teacher: false, founder_admin: true },
    condition: { client: "Only the client-visible activity log for your own cases.", preparer: "Only your own cases.", attorney: "Only your own cases.", doj_standard: "Only your own cases.", doj_full: "Only your own cases." },
  },
  {
    id: "connect_own_integrations", label: "Connect your own integrations (BYO: Twilio, Resend, SES, Translate, video, calendar, e-sign, storage)",
    allowed: { client: false, preparer: true, attorney: true, doj_standard: true, doj_full: true, law_student: false, teacher: false, founder_admin: false },
    condition: { law_student: "LOCKED — students use the supervisor's connected accounts, never their own." },
  },
  {
    id: "write_private_case_notes", label: "Write private case notes (provider-only, never shown to the client)",
    allowed: { client: false, preparer: true, attorney: true, doj_standard: true, doj_full: true, law_student: false, teacher: false, founder_admin: false },
    condition: { law_student: "LOCKED — student notes go through the supervisor, never private." },
  },
  {
    id: "book_appointments", label: "Book / reschedule / cancel appointments",
    allowed: { client: true, preparer: true, attorney: true, doj_standard: true, doj_full: true, law_student: "conditional", teacher: false, founder_admin: false },
    condition: { client: "Only your own cases.", law_student: "Only on assigned cases, with supervisor visibility." },
  },
];

export interface GateContext {
  verified?: boolean;
  dojLevel?: "partial" | "full";
  supervisorConfirmed?: boolean;
}

/** The single gate every UI component in this layer must call.
 *  Returns { allowed, reason } — reason is shown in the UI when locked. */
export function canDo(
  role: MatrixRole,
  capabilityId: CapabilityId,
  ctx: GateContext = {}
): { allowed: boolean; reason: string } {
  const cap = CAPABILITIES.find((c) => c.id === capabilityId);
  if (!cap) return { allowed: false, reason: "Unknown capability — locked by default." };
  const base = cap.allowed[role];
  const condition = cap.condition[role];
  if (base === false) {
    return { allowed: false, reason: condition ?? `Locked for ${role}.` };
  }
  if (base === true) {
    // Verification gates on the legal tools.
    if (
      (capabilityId === "sign_g28" || capabilityId === "file_packet") &&
      (role === "attorney" || role === "doj_standard" || role === "doj_full") &&
      ctx.verified === false
    ) {
      return { allowed: false, reason: "Locked until verification is approved (bar / EOIR roster check)." };
    }
    if (capabilityId === "view_eoir28" && role === "doj_full" && (ctx.dojLevel === "partial" || ctx.verified === false)) {
      return { allowed: false, reason: "EOIR-28 unlocks only with Full accreditation AND verification." };
    }
    return { allowed: true, reason: condition ?? "" };
  }
  // conditional — allowed only when the stated condition is met.
  if (capabilityId === "view_eoir28" && role === "doj_full") {
    const ok = ctx.dojLevel === "full" && ctx.verified === true;
    return {
      allowed: ok,
      reason: ok
        ? "Full accreditation AND verification confirmed."
        : "EOIR-28 unlocks only with Full accreditation AND verification.",
    };
  }
  if (
    (capabilityId === "sign_g28" || capabilityId === "file_packet") &&
    (role === "attorney" || role === "doj_standard" || role === "doj_full")
  ) {
    return {
      allowed: ctx.verified === true,
      reason:
        ctx.verified === true
          ? "Verified — bar / EOIR roster check approved."
          : "Locked until verification is approved (bar / EOIR roster check).",
    };
  }
  if (capabilityId === "view_assigned_cases" && role === "law_student") {
    return {
      allowed: ctx.supervisorConfirmed === true,
      reason: ctx.supervisorConfirmed === true ? (condition ?? "") : "Locked — your supervisor must confirm you and assign the case first.",
    };
  }
  if (
    role === "law_student" &&
    (capabilityId === "message_client" ||
      capabilityId === "view_messages" ||
      capabilityId === "upload_documents" ||
      capabilityId === "book_appointments")
  ) {
    // Supervisor visibility: allowed only once the supervisor has
    // confirmed the student; the supervisor sees the same thread.
    return {
      allowed: ctx.supervisorConfirmed === true,
      reason:
        ctx.supervisorConfirmed === true
          ? (condition ?? "")
          : "Locked — your supervisor must confirm you and assign the case first. You cannot message a client without supervisor visibility.",
    };
  }
  if (capabilityId === "esign_packet" && role === "client") {
    return { allowed: false, reason: condition ?? "E-Sign unlocks only after the balance is paid in full and the packet audit is 100%." };
  }
  if (capabilityId === "view_audit_log") {
    // Conditional = own cases only — allowed within that scope.
    return { allowed: true, reason: condition ?? "" };
  }
  if (capabilityId === "esign_packet" && (role === "attorney" || role === "doj_standard" || role === "doj_full")) {
    // The client signs; the professional prepares.
    return { allowed: true, reason: condition ?? "" };
  }
  return { allowed: false, reason: condition ?? "Conditional — locked until the condition is met." };
}

/** Rows for the "What you can do" panel: allowed + locked for one role. */
export function panelForRole(role: MatrixRole, ctx: GateContext = {}): {
  allowed: { label: string; note: string }[];
  locked: { label: string; note: string }[];
} {
  const allowed: { label: string; note: string }[] = [];
  const locked: { label: string; note: string }[] = [];
  for (const cap of CAPABILITIES) {
    const r = canDo(role, cap.id, ctx);
    (r.allowed ? allowed : locked).push({ label: cap.label, note: r.reason });
  }
  return { allowed, locked };
}
