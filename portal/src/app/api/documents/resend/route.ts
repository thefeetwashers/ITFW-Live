// POST /api/documents/resend — a professional resends a client
// document by email, SMS, in-app message, or shareable vault link.
//
// Channels:
//   * email — platform AWS SES sender (src/lib/email.ts) with a
//     vault signed URL in the body. NEVER a raw file attachment.
//     SES not configured → 501, logged not_configured, never "sent".
//   * sms — the professional's OWN Twilio (BYO). Twilio is NOT
//     connected, so this ALWAYS returns 501 / not_configured.
//   * portal_chat — in-app copy in the unified thread (messages +
//     message_sends) via insertCaseThreadMessage().
//   * vault_link — a single-document share token
//     (/vault/shared/<token>, 7-day expiry, document_resends).
//
// Every attempt is logged in document_resends (0030) with delivery
// status; email + SMS attempts are also logged in notification_logs
// (0010, email/sms channels only); the in-app copy is logged in
// message_sends (0014). No message body is stored in any log table.
// DOB / A-Number / SSN / passport numbers are rejected (400) —
// never in a subject, never in a log, never in a share link.
// Only a professional (preparer / attorney / nonprofit / admin)
// resends a client document. The platform is a document-preparation
// service, not a law firm, not USCIS affiliated.
import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import { insertCaseThreadMessage } from "@/lib/caseStatusSync";
import { safeDbError } from "@/lib/apiErrors";
import { writeAuditLog } from "@/lib/auditLog";
import {
  buildResendEmailBody,
  buildResendEmailSubject,
  buildResendLogRow,
  buildResendThreadBody,
  resendChannelAvailability,
  shareLinkExpiry,
  validateResendRequest,
  vaultDocumentLink,
  vaultShareLink,
  type ResendChannel,
  type ResendRequestInput,
  type ResendStatus,
} from "@/lib/docResend";

type DocumentRow = {
  id: string;
  case_id: string;
  file_name: string;
  vault_category: string;
  storage_bucket: string;
  storage_path: string;
};

type CaseRow = { id: string; client_id: string; forms: string[] | null };

function formLabelFor(c: CaseRow): string {
  const first = (c.forms ?? [])[0];
  return first ? `${first} form` : "your case";
}

export async function POST(req: Request) {
  let body: Partial<ResendRequestInput> = {};
  try {
    body = (await req.json()) as Partial<ResendRequestInput>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const problem = validateResendRequest(body);
  if (problem) {
    return NextResponse.json({ error: problem }, { status: 400 });
  }
  const input = body as ResendRequestInput;
  const channel = input.channel as ResendChannel;

  const supabase = getSupabase();
  if (!supabase) {
    // Without Supabase the document cannot be looked up, so nothing
    // can be resent honestly — except SMS, which is not_configured
    // either way. Report the honest state per channel.
    const availability = resendChannelAvailability(channel, {
      emailConfigured: isEmailConfigured(),
      supabaseConfigured: false,
    });
    return NextResponse.json(
      {
        error: `Document resend not configured — Supabase is not connected, so the document cannot be looked up. ${availability.detail}`,
        deliveryStatus: "not_configured",
        channel,
      },
      { status: 501 }
    );
  }

  // Look the document up — the file name and vault path come from
  // the stored row, never from the caller's payload.
  const { data: docData, error: docError } = await supabase
    .from("documents")
    .select("id, case_id, file_name, vault_category, storage_bucket, storage_path")
    .eq("id", input.documentId)
    .single();
  if (docError || !docData) {
    return NextResponse.json(
      { error: safeDbError("Document not found.", undefined, docError ?? undefined) },
      { status: 404 }
    );
  }
  const doc = docData as unknown as DocumentRow;
  if (doc.case_id !== input.caseId) {
    return NextResponse.json(
      { error: "That document does not belong to that case." },
      { status: 400 }
    );
  }
  const { data: caseData, error: caseError } = await supabase
    .from("cases")
    .select("id, client_id, forms")
    .eq("id", input.caseId)
    .single();
  if (caseError || !caseData) {
    return NextResponse.json(
      { error: safeDbError("Case not found.", undefined, caseError ?? undefined) },
      { status: 404 }
    );
  }
  const caseRow = caseData as unknown as CaseRow;
  const formLabel = (input.formLabel ?? "").trim() || formLabelFor(caseRow);

  // Best-effort log writer: the response always carries the status,
  // even if a log insert fails.
  const logResend = async (row: ReturnType<typeof buildResendLogRow>) => {
    const { error } = await supabase.from("document_resends").insert(row);
    return error?.message ?? null;
  };
  const logNotification = async (status: ResendStatus, errorMessage: string | null) => {
    if (channel !== "email" && channel !== "sms") return;
    await supabase.from("notification_logs").insert({
      case_id: input.caseId,
      recipient_account_id: caseRow.client_id,
      channel,
      stage_key: "document_resend",
      language: "en",
      status,
      sent_at: status === "sent" ? new Date().toISOString() : null,
    });
    void errorMessage;
  };

  // --- SMS: the professional's own Twilio is NOT connected. --------
  if (channel === "sms") {
    const availability = resendChannelAvailability("sms", {
      emailConfigured: isEmailConfigured(),
      supabaseConfigured: true,
    });
    const logError = await logResend(
      buildResendLogRow({
        input,
        status: "not_configured",
        provider: "twilio_byo",
        errorMessage: availability.detail,
      })
    );
    await logNotification("not_configured", availability.detail);
    return NextResponse.json(
      {
        error: availability.detail,
        deliveryStatus: "not_configured",
        channel,
        logWarning: logError,
      },
      { status: 501 }
    );
  }

  // --- Vault link: single-document share token, 7-day expiry. ------
  if (channel === "vault_link") {
    const shareToken = crypto.randomUUID();
    const shareExpiresAt = shareLinkExpiry();
    const logError = await logResend(
      buildResendLogRow({
        input,
        status: "sent",
        provider: "vault_share",
        shareToken,
        shareExpiresAt,
      })
    );
    if (logError) {
      return NextResponse.json(
        { error: `Vault link could not be created: ${logError}`, deliveryStatus: "failed", channel },
        { status: 502 }
      );
    }
    // Audit: a document was shared out of the vault. Log channel +
    // status only — never the file name, recipient, or link.
    await writeAuditLog(supabase, {
      actorId: input.senderId,
      action: "document_resent",
      entityType: "documents",
      entityId: doc.id,
      caseId: input.caseId,
      detail: { channel, status: "sent" },
    });
    return NextResponse.json(
      {
        ok: true,
        deliveryStatus: "sent",
        channel,
        shareUrl: vaultShareLink(shareToken),
        shareExpiresAt,
        fileName: doc.file_name,
      },
      { status: 200 }
    );
  }

  // --- In-app copy: unified thread (messages + message_sends). ------
  if (channel === "portal_chat") {
    const stored = await insertCaseThreadMessage(supabase, {
      caseId: input.caseId,
      senderId: input.senderId,
      senderRole: input.senderRole as "preparer" | "attorney" | "nonprofit" | "admin",
      recipientId: caseRow.client_id,
      recipientRole: "client",
      body: buildResendThreadBody({
        fileName: doc.file_name,
        formLabel,
        vaultUrl: vaultDocumentLink(doc.id),
      }),
    });
    if (!stored.ok) {
      await logResend(
        buildResendLogRow({
          input,
          status: "failed",
          provider: "portal",
          errorMessage: stored.error ?? "Message could not be stored.",
        })
      );
      return NextResponse.json(
        { error: `In-app message could not be stored: ${stored.error ?? "unknown error"}`, deliveryStatus: "failed", channel },
        { status: 502 }
      );
    }
    await logResend(
      buildResendLogRow({
        input,
        status: "sent",
        provider: "portal",
        messageId: stored.messageId,
      })
    );
    await writeAuditLog(supabase, {
      actorId: input.senderId,
      action: "document_resent",
      entityType: "documents",
      entityId: doc.id,
      caseId: input.caseId,
      detail: { channel, status: "sent" },
    });
    return NextResponse.json(
      { ok: true, deliveryStatus: "sent", channel, messageId: stored.messageId, fileName: doc.file_name },
      { status: 200 }
    );
  }

  // --- Email: platform AWS SES sender, vault link in the body. -----
  if (!isEmailConfigured()) {
    const availability = resendChannelAvailability("email", {
      emailConfigured: false,
      supabaseConfigured: true,
    });
    await logResend(
      buildResendLogRow({
        input,
        status: "not_configured",
        provider: "aws_ses",
        errorMessage: availability.detail,
      })
    );
    await logNotification("not_configured", availability.detail);
    return NextResponse.json(
      { error: availability.detail, deliveryStatus: "not_configured", channel },
      { status: 501 }
    );
  }

  // Signed vault URL when Storage can make one (1-hour expiry);
  // otherwise the portal vault link. Never a raw attachment.
  let vaultUrl = vaultDocumentLink(doc.id);
  try {
    const { data: signed } = await supabase.storage
      .from(doc.storage_bucket)
      .createSignedUrl(doc.storage_path, 3600);
    if (signed?.signedUrl) vaultUrl = signed.signedUrl;
  } catch {
    // Fall through to the portal vault link.
  }

  const result = await sendEmail({
    to: input.recipientEmail as string,
    subject: buildResendEmailSubject(formLabel),
    text: buildResendEmailBody({ fileName: doc.file_name, formLabel, vaultUrl }),
  });
  if (!result.ok) {
    await logResend(
      buildResendLogRow({
        input,
        status: "failed",
        provider: "aws_ses",
        errorMessage: result.error,
      })
    );
    await logNotification("failed", result.error);
    return NextResponse.json(
      { error: `Email could not be sent. ${result.error}`, deliveryStatus: "failed", channel, code: result.code },
      { status: 502 }
    );
  }
  await logResend(
    buildResendLogRow({
      input,
      status: "sent",
      provider: "aws_ses",
      providerMessageId: result.messageId,
    })
  );
  await logNotification("sent", null);
  await writeAuditLog(supabase, {
    actorId: input.senderId,
    action: "document_resent",
    entityType: "documents",
    entityId: doc.id,
    caseId: input.caseId,
    detail: { channel, status: "sent" },
  });
  return NextResponse.json(
    { ok: true, deliveryStatus: "sent", channel, messageId: result.messageId, fileName: doc.file_name },
    { status: 200 }
  );
}
