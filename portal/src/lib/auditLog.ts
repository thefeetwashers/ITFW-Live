// Audit-log writer for sensitive writes (full-stack expert sweep, Nov 28, 2026).
//
// audit_log (migration 0001) columns: actor_id, actor_role, action,
// entity_type, entity_id (uuid, NOT NULL), case_id, detail (jsonb),
// created_at. It is the platform's record of WHO did WHAT to WHICH
// case — money/payment decisions and sensitive writes must land here
// instead of happening silently.
//
// HARD RULES enforced by this helper:
//   * NO PII in the detail: no names, emails, phones, DOBs, A-Numbers,
//     SSNs, passport numbers, addresses, or document contents.
//   * NO MONEY in the detail: no amounts, prices, thresholds, or fees.
//     A money decision is logged as the DECISION (e.g. "quote saved",
//     "draft saved") with ids only — the amount lives in its own
//     table, never in the log body.
//   * Best-effort only: a failed audit insert must NEVER fail the
//     user's request. It returns false and the route carries on.
//     (The audit log is a record, not a gate.)
//   * Detail keys are allow-listed by the caller AND scrubbed here:
//     any key matching a sensitive pattern is dropped even if the
//     caller passed it by mistake.
//
// Callers pass a Supabase client (service-role in API routes — the
// anon key normally cannot INSERT into audit_log, see
// /api/notify-stage). With an anon client the insert fails quietly
// and returns false; the route still succeeds.

import type { SupabaseClient } from "@supabase/supabase-js";

const SENSITIVE_KEY_RE =
  /(ssn|social_security|a_number|alien|passport|green_card|dob|date_of_birth|birth_date|income|amount|price|fee|cents|threshold|email|phone|name|address|password|token|secret|card|bank|account_number)/i;

export type AuditAction =
  | "quote_request_saved"
  | "lead_saved"
  | "diy_draft_saved"
  | "diy_draft_deleted"
  | "fee_waiver_check_saved"
  | "document_resent"
  | "google_connection_updated"
  | "diy_unlock_recorded"
  | "signature_completed"
  | "translation_order_placed"
  | "invoice_receipt_viewed"
  | "case_exported"
  | "case_status_synced";

export interface AuditLogInput {
  actorId?: string | null;
  action: AuditAction;
  entityType: string;
  /** uuid of the row acted on (required — audit_log.entity_id is NOT NULL). */
  entityId: string;
  caseId?: string | null;
  /** Ids / codes / statuses only. Never PII, never money. Scrubbed here. */
  detail?: Record<string, string | number | boolean | null>;
}

export function scrubAuditDetail(
  detail: Record<string, string | number | boolean | null> | undefined
): Record<string, string | number | boolean | null> {
  if (!detail) return {};
  const clean: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(detail)) {
    if (SENSITIVE_KEY_RE.test(key)) continue;
    if (typeof value === "string" && value.length > 200) continue;
    clean[key] = value;
  }
  return clean;
}

export async function writeAuditLog(
  client: SupabaseClient,
  input: AuditLogInput
): Promise<boolean> {
  try {
    const { error } = await client.from("audit_log").insert({
      actor_id: input.actorId ?? null,
      action: input.action,
      entity_type: input.entityType,
      entity_id: input.entityId,
      case_id: input.caseId ?? null,
      detail: scrubAuditDetail(input.detail),
    });
    return !error;
  } catch {
    return false;
  }
}
