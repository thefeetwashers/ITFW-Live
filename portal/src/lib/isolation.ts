// Role isolation — pure, testable enforcement used by every dashboard.
// This is the UI / app-layer mirror of the database rule in migration
// 0001 is_case_participant() (client OR assigned provider) + 0011
// is_assigned_student(). The database (RLS) is the real enforcement;
// these helpers make the UI hide what the database already refuses,
// so a user never sees a button for something they cannot do.
//
// KNOWN CONFLICT (do not hide it): migration 0003 §7a grants
// Founder/Admin a SELECT policy on every case-scoped table, so in the
// database today a founder CAN read a client's documents. The task
// rule is stricter — Founder/Admin sees the verification queue +
// audit log ONLY, never a client's documents unless they are the
// assigned provider. The UI in this layer enforces the stricter rule
// (canViewCase() returns false for founder_admin on case content).
// Closing the database gap needs a founder decision + a follow-up
// migration (drop/replace the 0003 select_founder_admin_* policies);
// it is NOT silently fixed here, and docs/permissions-matrix.md flags it.
export type IsolationRole =
  | "client"
  | "preparer"
  | "attorney"
  | "doj_standard"
  | "doj_full"
  | "law_student"
  | "teacher"
  | "family"
  | "founder_admin";

export interface CaseRef {
  id: string;
  clientId: string;
  assignedProviderId: string | null;
  /** Account ids of law students explicitly assigned by the supervisor. */
  studentIds?: string[];
}

export interface Viewer {
  accountId: string;
  role: IsolationRole;
  /** Cases this student was explicitly assigned to (supervisor-assigned). */
  assignedCaseIds?: string[];
  /** Family invite: the ONE case this family member was invited to. */
  familyCaseId?: string | null;
  canViewInvoices?: boolean;
  canViewMessages?: boolean;
}

/** Can this viewer see this case AT ALL (its existence, status, thread)? */
export function canViewCase(viewer: Viewer, c: CaseRef): boolean {
  if (viewer.role === "founder_admin") return false; // verification queue + audit log only (UI rule; see header conflict note)
  if (viewer.role === "teacher") return false; // teaching only — no cases
  if (viewer.role === "client") return c.clientId === viewer.accountId;
  if (viewer.role === "family") {
    return viewer.familyCaseId != null && c.id === viewer.familyCaseId;
  }
  if (viewer.role === "law_student") {
    return (viewer.assignedCaseIds ?? []).includes(c.id);
  }
  // preparer / attorney / doj_standard / doj_full: assigned provider only.
  return c.assignedProviderId === viewer.accountId;
}

/** Family members see ONLY their invited case, ONLY the slots they were
 *  given: never messages, never invoices unless allowed, never other cases. */
export function familyCanViewMessages(viewer: Viewer): boolean {
  return viewer.role === "family" && viewer.canViewMessages === true;
}
export function familyCanViewInvoices(viewer: Viewer): boolean {
  return viewer.role === "family" && viewer.canViewInvoices === true;
}

/** Filter a case list to exactly what this viewer may see. This is the
 *  function the two-professional isolation test exercises (see report):
 *  two professionals with different accountIds, each assigned different
 *  cases, must each receive only their own cases — never the other's,
 *  never unassigned cases. */
export function filterCasesForViewer<T extends CaseRef>(
  viewer: Viewer,
  cases: T[]
): T[] {
  return cases.filter((c) => canViewCase(viewer, c));
}

/** A professional sends from INSIDE their own dashboard, never from a
 *  personal phone/email. A client replies from INSIDE their portal (or
 *  by SMS/WhatsApp/email reply, which lands back in the same thread). */
export const SEND_FROM_RULE =
  "Send only from inside your dashboard / portal, through your own connected provider account. Never from a personal phone or personal email.";
