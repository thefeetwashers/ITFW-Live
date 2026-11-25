// CommsComposer — email + text from inside the dashboard.
// REUSES the existing UnifiedThread (src/components/comms/UnifiedThread.tsx):
// one unified thread per case, with "enter a phone number to text" and
// "enter an email to email" composers, original + English side by side.
// This file adds NOTHING new to send with — it only wraps the thread with
// the queue-only labelling for this engine. BYO Twilio / Resend / AWS SES
// are NOT connected: every send queues only and never claims a send.
"use client";

import UnifiedThread from "@/components/comms/UnifiedThread";
import type { IsolationRole } from "@/lib/isolation";
import type { LanguageCode } from "@/lib/i18n";

export default function CommsComposer(props: {
  caseId: string;
  caseLabel: string;
  viewerRole: IsolationRole;
  viewerName: string;
  clientLanguage?: LanguageCode;
  canSend?: boolean;
  sendDisabledReason?: string;
}) {
  return (
    <div>
      <UnifiedThread
        caseId={props.caseId}
        caseLabel={props.caseLabel}
        viewerRole={props.viewerRole}
        viewerName={props.viewerName}
        clientLanguage={props.clientLanguage ?? "es"}
        canSend={props.canSend}
        sendDisabledReason={props.sendDisabledReason}
      />
      <p className="mt-1 text-xs text-slate-500">
        Email + text from inside this dashboard: pick SMS / WhatsApp / Email
        above, enter a phone number to text or an email to email, and the
        message queues in this thread. Twilio / Resend / AWS SES are NOT
        connected — nothing is sent until your own provider account is
        connected and tested. Original text is always shown next to the
        English translation; auto-translate needs Google Cloud Translation,
        which is NOT connected.
      </p>
    </div>
  );
}
