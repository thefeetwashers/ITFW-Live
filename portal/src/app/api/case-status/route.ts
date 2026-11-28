import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import {
  PORTAL_URL,
  stageKeyForNumber,
  type NotificationStageKey,
} from "@/lib/notificationTemplates";
import {
  CASE_STATUSES,
  UUID_RE,
  buildStatusEmailBody,
  buildStatusSubject,
  containsSensitiveIdentifier,
  firstNameOf,
  insertCaseThreadMessage,
  lifecycleStageForCaseStatus,
  recordEmailSend,
  resolveStatusPair,
  type Agency,
  type CaseStatusEnum,
  type CaseStatusSyncResponse,
  type ChannelDelivery,
  type DeliveryStatus,
} from "@/lib/caseStatusSync";
import type { Stage5SubStage } from "@/lib/lifecycle";

// POST /api/case-status — Case-status sync (founder brief, Nov 28 2026).
// The professional enters a case status ONCE; this route writes it to
// the case + case_lifecycle + notification_logs tables, links it to the
// client account (cases.client_id) so it appears in the client portal,
// and sends it to the client automatically (SES email + in-app thread).
//
// WRITES (existing columns only — migrations 0001–0020, no 0021 needed):
//   * cases.status (0001 case_status enum)
//   * case_lifecycle (0010): old current row flipped to false, new row
//   * case_watch (0001) + case_agency_numbers (0009) when a receipt
//     number is given — receipt is MANUALLY ENTERED, labelled as such,
//     never a live USCIS lookup (no Production USCIS key exists)
//   * messages + message_sends (0001/0014): in-app copy, portal_chat
//   * notification_logs (0010): EMAIL channel only — its CHECK allows
//     only sms/whatsapp/email and status sent/failed/not_configured, so
//     the in-app copy is recorded in message_sends, never here
//   * audit_log (0001): fallback record of the sync
//
// DELIVERY (per channel, honest — never claimed when not sent):
//   * SES not configured → email "not_configured", in-app copy still
//     lands. Supabase not configured → 501, nothing stored, nothing sent.
//   * No DOB / A-Number / SSN / passport number in subjects or logs:
//     the subject is built from the form label only, and payloads
//     containing an A-Number / SSN pattern (or an explicit aNumber /
//     ssn / dateOfBirth / passportNumber field) are rejected with 400.
//   * The professional's free-text status is never used to infer a
//     case status — no AI decides relief / eligibility / evidence
//     strength / safe-to-leave. Explicit caseStatus wins; otherwise the
//     lifecycle-stage mapping applies.
const SENSITIVE_FIELDS = ["aNumber", "a_number", "alienRegistrationNumber", "ssn", "dateOfBirth", "dob", "passportNumber", "passport_number"];

function bad(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return bad("Invalid JSON body.");
  }

  // Sensitive identifiers are never accepted, sent, or logged.
  for (const f of SENSITIVE_FIELDS) {
    if (body[f] !== undefined) {
      return bad(
        `Field "${f}" must never be sent to this endpoint. Remove it and retry — DOB, A-Numbers, SSNs and passport numbers are never put in subjects or logs.`
      );
    }
  }
  const caseId = typeof body.caseId === "string" ? body.caseId : "";
  const statusText = typeof body.statusText === "string" ? body.statusText : "";
  if (!caseId) return bad("caseId is required.");
  if (!statusText.trim()) return bad("statusText is required — write the update in plain English.");
  if (statusText.length > 2000) return bad("statusText is too long — keep it under 2000 characters.");
  if (containsSensitiveIdentifier(statusText)) {
    return bad(
      "statusText contains an A-Number or SSN pattern. Remove it and retry — those identifiers are never sent in messages or stored in logs."
    );
  }
  const lifecycleStage =
    typeof body.lifecycleStage === "number" ? body.lifecycleStage : undefined;
  if (lifecycleStage !== undefined && (lifecycleStage < 1 || lifecycleStage > 6)) {
    return bad("lifecycleStage must be 1–6.");
  }
  const stage5SubStage =
    body.stage5SubStage === "5A" || body.stage5SubStage === "5B"
      ? (body.stage5SubStage as Stage5SubStage)
      : null;
  if (stage5SubStage && lifecycleStage !== 5) {
    return bad("stage5SubStage 5A/5B is only meaningful at lifecycle stage 5.");
  }
  const caseStatus =
    typeof body.caseStatus === "string" &&
    (CASE_STATUSES as readonly string[]).includes(body.caseStatus)
      ? (body.caseStatus as CaseStatusEnum)
      : undefined;
  if (typeof body.caseStatus === "string" && !caseStatus) {
    return bad(`Unknown caseStatus "${body.caseStatus}" — must be one of: ${CASE_STATUSES.join(", ")}.`);
  }
  const receiptNumber =
    typeof body.receiptNumber === "string" && body.receiptNumber.trim()
      ? body.receiptNumber.trim()
      : undefined;
  if (receiptNumber && receiptNumber.length > 32) {
    return bad("receiptNumber is too long — 32 characters max.");
  }
  if (receiptNumber && containsSensitiveIdentifier(receiptNumber)) {
    return bad("receiptNumber looks like an A-Number or SSN, not a receipt number. Remove it and retry.");
  }
  const agency =
    typeof body.agency === "string" &&
    ["USCIS", "NVC", "EOIR", "DOL"].includes(body.agency)
      ? (body.agency as Agency)
      : ("USCIS" as Agency);
  const formCode = typeof body.formCode === "string" ? body.formCode : undefined;
  const changedBy =
    typeof body.changedBy === "string" && UUID_RE.test(body.changedBy)
      ? body.changedBy
      : undefined;

  const { caseStatus: resolvedStatus, lifecycleStage: resolvedStage } =
    resolveStatusPair({ lifecycleStage, caseStatus });
  const warnings: string[] = [];
  if (!resolvedStatus && !resolvedStage) {
    warnings.push(
      "No stage or case status was given, so the case status was left unchanged — only the message was sent."
    );
  }

  const supabase = getSupabase();
  if (!supabase) {
    const deliveries: ChannelDelivery[] = [
      { channel: "portal_chat", status: "not_configured", detail: "Portal Chat not configured — Supabase is not connected, so the update cannot be stored or shown in the client portal. Nothing was sent." },
      { channel: "email", status: "not_configured", detail: "Email not configured — Supabase is not connected, so the client could not be loaded. Nothing was sent." },
    ];
    return NextResponse.json(
      {
        ok: false,
        caseId,
        clientId: null,
        caseStatus: resolvedStatus,
        lifecycleStage: resolvedStage,
        stage5SubStage,
        deliveries,
        stored: { caseUpdated: false, lifecycleRow: false, receiptRecorded: false, inAppMessage: false, emailLog: false },
        warnings,
        error: "Case-status sync not configured — Supabase is not connected. Nothing was stored and nothing was sent.",
      } satisfies CaseStatusSyncResponse,
      { status: 501 }
    );
  }

  // Load the case — this is what links the update to the client account.
  const { data: caseRow, error: caseError } = await supabase
    .from("cases")
    .select("id, client_id, forms, status")
    .eq("id", caseId)
    .single();
  if (caseError || !caseRow) {
    return NextResponse.json(
      { ok: false, error: `Case not found: ${caseError?.message ?? caseId}` },
      { status: 404 }
    );
  }
  const clientId = caseRow.client_id as string;
  const forms = (caseRow.forms as string[] | null) ?? [];
  const formLabel = formCode ?? forms[0] ?? "Immigration with NIPTEI";

  // Load the client account for the email + greeting (first name only).
  const { data: client } = await supabase
    .from("accounts")
    .select("full_name, email, preferred_language, notification_preference")
    .eq("id", clientId)
    .single();
  const clientFirstName = client?.full_name ? firstNameOf(client.full_name as string) : "";
  const clientEmail = (client?.email as string | undefined) ?? undefined;
  const clientPreference = (client?.notification_preference as string | undefined) ?? "all";
  const emailAllowed = clientPreference === "email" || clientPreference === "all";
  const language = (client?.preferred_language as string | undefined) ?? "en";

  const stored = {
    caseUpdated: false,
    lifecycleRow: false,
    receiptRecorded: false,
    inAppMessage: false,
    emailLog: false,
  };
  const deliveries: ChannelDelivery[] = [];

  // (i) cases.status — explicit status wins, else the stage mapping.
  const nextStatus = resolvedStatus ?? (caseRow.status as CaseStatusEnum);
  if (resolvedStatus) {
    const { error } = await supabase
      .from("cases")
      .update({ status: resolvedStatus })
      .eq("id", caseId);
    if (error) warnings.push(`Case status could not be updated: ${error.message}`);
    else stored.caseUpdated = true;
  }

  // (i) case_lifecycle — flip the old current row, insert the new one.
  const stageForLifecycle =
    resolvedStage ?? lifecycleStageForCaseStatus(nextStatus);
  const { error: flipError } = await supabase
    .from("case_lifecycle")
    .update({ is_current: false })
    .eq("case_id", caseId)
    .eq("is_current", true);
  if (flipError) warnings.push(`Previous lifecycle row could not be closed: ${flipError.message}`);
  const { error: lifecycleError } = await supabase.from("case_lifecycle").insert({
    case_id: caseId,
    stage: stageForLifecycle,
    sub_stage: stageForLifecycle === 5 ? stage5SubStage : null,
    stage_changed_by: changedBy ?? null,
  });
  if (lifecycleError) warnings.push(`Lifecycle history could not be written: ${lifecycleError.message}`);
  else stored.lifecycleRow = true;

  // (i) Receipt number — manual entry, labelled as such everywhere it
  // is shown. case_watch (0001) + case_agency_numbers (0009).
  if (receiptNumber) {
    const { error: watchError } = await supabase.from("case_watch").upsert(
      {
        case_id: caseId,
        client_id: clientId,
        receipt_number: receiptNumber,
        form_code: formLabel,
        uscis_status: statusText.slice(0, 500),
        uscis_status_at: new Date().toISOString(),
      },
      { onConflict: "case_id,receipt_number" }
    );
    if (watchError) warnings.push(`Receipt could not be saved to case_watch: ${watchError.message}`);
    else stored.receiptRecorded = true;
    const { data: existing } = await supabase
      .from("case_agency_numbers")
      .select("id")
      .eq("case_id", caseId)
      .eq("agency", agency)
      .eq("case_number", receiptNumber)
      .limit(1);
    if (existing && existing.length > 0) {
      await supabase
        .from("case_agency_numbers")
        .update({ agency_status: statusText.slice(0, 500) })
        .eq("id", (existing[0] as { id: string }).id);
    } else {
      const { error: agencyError } = await supabase.from("case_agency_numbers").insert({
        case_id: caseId,
        agency,
        form_or_stage: formLabel,
        case_number: receiptNumber,
        agency_status: statusText.slice(0, 500),
      });
      if (agencyError) warnings.push(`Receipt could not be saved to case_agency_numbers: ${agencyError.message}`);
    }
  }

  // (iii) In-app copy — always attempted first, so the client sees the
  // update in their portal even when email is not configured.
  const emailBody = buildStatusEmailBody({
    firstName: clientFirstName,
    formLabel,
    statusText,
    receiptNumber,
  });
  const emailSubject = buildStatusSubject(formLabel);
  let messageId: string | null = null;
  if (changedBy) {
    const inApp = await insertCaseThreadMessage(supabase, {
      caseId,
      senderId: changedBy,
      senderRole: "preparer",
      recipientId: clientId,
      recipientRole: "client",
      body: emailBody,
      language,
    });
    messageId = inApp.messageId;
    if (inApp.ok) {
      stored.inAppMessage = true;
      deliveries.push({ channel: "portal_chat", status: "sent", detail: "Update is in the client's portal thread." });
    } else {
      deliveries.push({ channel: "portal_chat", status: "failed", detail: `In-app message could not be stored: ${inApp.error ?? "unknown error"}` });
    }
    if (inApp.error) warnings.push(inApp.error);
  } else {
    deliveries.push({
      channel: "portal_chat",
      status: "not_configured",
      detail: "No professional account id (changedBy) was given, so the in-app copy could not be stored — the messages table needs a real sender. The email below was still attempted.",
    });
  }

  // (iii) Email via SES — honours the client's notification preference.
  // The notification_logs row records the attempt (email channel only).
  const notificationStage: NotificationStageKey | null =
    resolvedStage !== null && resolvedStage !== undefined
      ? stageKeyForNumber(resolvedStage)
      : null;
  let emailStatus: DeliveryStatus = "not_configured";
  let emailDetail = "";
  let sesMessageId: string | null = null;
  if (!clientEmail) {
    emailDetail = "No email address on file for the client. Nothing was sent.";
    warnings.push(emailDetail);
  } else if (!emailAllowed) {
    emailDetail = `Client chose ${clientPreference} notifications, so no email was sent. The in-app copy above is how they see this update.`;
  } else if (!isEmailConfigured()) {
    emailDetail = "Email not configured — AWS SES is not connected. Nothing was sent by email; the in-app copy above still landed.";
  } else {
    const result = await sendEmail({ to: clientEmail, subject: emailSubject, text: emailBody });
    if (result.ok) {
      emailStatus = "sent";
      sesMessageId = result.messageId;
      emailDetail = "Email sent via AWS SES.";
    } else {
      emailStatus = "failed";
      emailDetail = result.error;
    }
  }
  deliveries.push({ channel: "email", status: emailStatus, detail: emailDetail });
  if (messageId) {
    // Per-channel delivery row for the email (message_sends, 0014).
    await recordEmailSend(supabase, {
      messageId,
      status: emailStatus,
      providerMessageId: sesMessageId,
      errorMessage: emailStatus === "sent" ? null : emailDetail,
    });
  }
  // notification_logs (0010): email only, status sent/failed/not_configured.
  const { error: logError } = await supabase.from("notification_logs").insert({
    case_id: caseId,
    recipient_account_id: clientId,
    channel: "email",
    stage_key: notificationStage ?? "case_status_update",
    language,
    status: emailStatus,
    sent_at: emailStatus === "sent" ? new Date().toISOString() : null,
  });
  if (!logError) stored.emailLog = true;
  else warnings.push(`Email delivery could not be logged to notification_logs: ${logError.message}`);

  // Audit trail (best-effort; never contains identifiers — the payload
  // was already rejected above if it held an A-Number / SSN).
  try {
    await supabase.from("audit_log").insert({
      actor_id: changedBy ?? null,
      actor_role: "preparer",
      action: "case_status_synced",
      entity_type: "case",
      entity_id: caseId,
      case_id: caseId,
      detail: {
        case_status: nextStatus,
        lifecycle_stage: stageForLifecycle,
        stage_5_sub_stage: stageForLifecycle === 5 ? stage5SubStage : null,
        form: formLabel,
        receipt_number_given: Boolean(receiptNumber),
        receipt_source: receiptNumber ? "manual_entry" : null,
        email: emailStatus,
        portal_chat: deliveries.find((d) => d.channel === "portal_chat")?.status ?? "not_configured",
        portal_url: PORTAL_URL,
      },
    });
  } catch {
    // Audit logging is best-effort.
  }

  const sent = deliveries.some((d) => d.status === "sent");
  return NextResponse.json(
    {
      ok: true,
      caseId,
      clientId,
      caseStatus: nextStatus,
      lifecycleStage: stageForLifecycle,
      stage5SubStage: stageForLifecycle === 5 ? stage5SubStage : null,
      deliveries,
      stored,
      warnings,
      ...(sent ? {} : { error: "Nothing was delivered — see deliveries for the per-channel reason." }),
    } satisfies CaseStatusSyncResponse,
    { status: 200 }
  );
}
