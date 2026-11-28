// Document Resend — professional panel (client component).
// Resends one client document by email, SMS, in-app message, or
// shareable vault link (POST /api/documents/resend). Every attempt
// is logged with delivery status. Email goes through AWS SES with a
// vault link — never a raw attachment. SMS needs the professional's
// own Twilio, which is not connected, so it honestly returns
// 501 / not_configured. No DOB, A-Number, SSN, or passport number
// may be typed here — the panel has no field for them.
"use client";

import { useState } from "react";
import {
  RESEND_CHANNEL_LABELS,
  maskRecipient,
  type ResendChannel,
} from "@/lib/docResend";

export default function DocumentResendPanel({
  documentId,
  caseId,
  senderId,
  senderRole,
  fileName,
  recipientEmail,
  recipientPhone,
}: {
  documentId: string;
  caseId: string;
  senderId: string;
  senderRole: "preparer" | "attorney" | "nonprofit" | "admin";
  fileName: string;
  recipientEmail: string;
  recipientPhone: string;
}) {
  const [result, setResult] = useState<string | null>(null);
  const [busyChannel, setBusyChannel] = useState<ResendChannel | null>(null);

  const resend = async (channel: ResendChannel) => {
    setBusyChannel(channel);
    setResult(null);
    try {
      const res = await fetch("/api/documents/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId,
          caseId,
          channel,
          senderId,
          senderRole,
          recipientEmail,
          recipientPhone,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        deliveryStatus?: string;
        shareUrl?: string;
        messageId?: string;
      };
      if (!res.ok) {
        setResult(
          `${RESEND_CHANNEL_LABELS[channel]}: not sent — ${data.error ?? "unknown error"} (status: ${data.deliveryStatus ?? "failed"})`
        );
        return;
      }
      setResult(
        data.shareUrl
          ? `${RESEND_CHANNEL_LABELS[channel]}: link created — ${data.shareUrl} (status: ${data.deliveryStatus ?? "sent"})`
          : `${RESEND_CHANNEL_LABELS[channel]}: sent (status: ${data.deliveryStatus ?? "sent"})`
      );
    } catch {
      setResult(`${RESEND_CHANNEL_LABELS[channel]}: could not reach the server. Nothing was sent.`);
    } finally {
      setBusyChannel(null);
    }
  };

  const channels: ResendChannel[] = ["email", "sms", "portal_chat", "vault_link"];
  return (
    <section
      aria-labelledby="document-resend-heading"
      className="rounded-lg border border-slate-300 bg-white p-4 shadow-sm"
    >
      <h2 id="document-resend-heading" className="text-lg font-semibold">
        Resend this document
      </h2>
      <p className="mt-1 text-sm text-slate-700">
        {fileName} — to {recipientEmail ? maskRecipient(recipientEmail) : "no email on file"}
        {recipientPhone ? ` / ${maskRecipient(recipientPhone)}` : ""}. Email
        sends through AWS SES with a vault link (never an attachment).
        SMS needs your own Twilio account, which is not connected, so it
        will honestly report “not configured”. Every attempt is logged.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {channels.map((c) => (
          <button
            key={c}
            type="button"
            disabled={busyChannel !== null}
            onClick={() => void resend(c)}
            className="rounded bg-blue-700 px-3 py-1 text-sm font-medium text-white disabled:opacity-50"
          >
            Resend by {RESEND_CHANNEL_LABELS[c]}
          </button>
        ))}
      </div>
      {result ? (
        <p className="mt-3 rounded border border-slate-200 bg-slate-50 p-3 text-sm break-all">
          {result}
        </p>
      ) : null}
    </section>
  );
}
