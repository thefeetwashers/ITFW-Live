// Compliance, Security & Audit Trail (Layer 4)
// REUSE, do not duplicate: audit_log (0001) + admin_audit_log (0002) +
// the audit trigger in 0003 already log changes. This file adds the
// CLIENT-VISIBLE activity-log contract + the new action types, and the
// escalation flow. The DB side is a view over audit_log in 0006.
export type ActivityAction =
  | "signed_upl_notice"
  | "approved_draft"
  | "uploaded_document"
  | "paid_invoice"
  | "escalated_to_attorney"
  | "signed_agreement"
  | "requested_translation";

export interface ActivityEntry {
  id: string;
  action: ActivityAction;
  label: string;
  actor: string;
  ipAddress: string; // example / redacted in the UI — never a real IP in example data
  at: string;
}

// Example entries only.
export const EXAMPLE_ACTIVITY: ActivityEntry[] = [
  { id: "act-1", action: "signed_upl_notice", label: "Signed UPL disclaimer (preparer — clerical help only)", actor: "Example Client", ipAddress: "— (example)", at: "2026-11-10 09:14 ET" },
  { id: "act-2", action: "uploaded_document", label: "Uploaded Petitioner Passport", actor: "Example Client", ipAddress: "— (example)", at: "2026-11-12 15:02 ET" },
  { id: "act-3", action: "approved_draft", label: "Approved Form I-130 draft", actor: "Example Client", ipAddress: "— (example)", at: "2026-11-17 11:40 ET" },
  { id: "act-4", action: "paid_invoice", label: "Paid invoice INV-2049-2 (example)", actor: "Example Client", ipAddress: "— (example)", at: "2026-11-17 11:41 ET" },
];

// Escalation: "Upgrade / Refer to Licensed Attorney".
// Rules: explicit client consent + attorney acceptance required.
// Documents move only within the case (RLS participant-only). The
// preparer loses access once transferred UNLESS the attorney
// re-assigns them. NEVER auto-transfer without consent.
export interface EscalationRequest {
  caseId: string;
  fromProviderRole: "preparer";
  toAttorneyId: string | null;
  clientConsented: boolean;
  attorneyAccepted: boolean;
  status: "not_requested" | "awaiting_attorney" | "transferred" | "declined";
}

export function canTransfer(req: EscalationRequest): boolean {
  return req.clientConsented && req.attorneyAccepted && req.toAttorneyId !== null;
}
