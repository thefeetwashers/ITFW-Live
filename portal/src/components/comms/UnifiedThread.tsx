// Unified Communication Hub — ONE thread per case.
// Used in EVERY professional dashboard (preparer, attorney, DOJ,
// law student supervised view, company back-office) AND in the
// Client & Family Portal, with strict isolation (src/lib/isolation.ts):
// a viewer only ever sees threads for cases they participate in.
// Channels in one thread: Portal Chat, SMS, WhatsApp, Email, plus a
// "text by entering a phone number" composer and an "email them"
// composer. The professional sends from INSIDE their dashboard —
// never from a personal phone/email — and the client replies from
// INSIDE their portal (or by SMS/WhatsApp/email reply, which lands
// back in the same thread).
//
// HONESTY: nothing here is live. Sends go to POST /api/messages/send,
// which returns 501 / delivery_status "not_configured" until Twilio /
// Resend / SES (and Supabase for Portal Chat) are connected. A queued
// message is shown as QUEUED — NOT SENT, never as sent. Every stored
// message (migration 0001 messages + 0014 message_sends) carries
// sender, role, channel, original language + original text + English
// translation, timestamp, and delivery status
// (queued / sent / failed / not_configured).
"use client";

import { useState } from "react";
import type { LanguageCode } from "@/lib/i18n";
import { LANGUAGES } from "@/lib/i18n";
import { TRANSLATION_WARNING, TRANSLATION_NOT_CONFIGURED_NOTE, isRtl } from "@/lib/translate";
import { MESSAGE_TEMPLATES, fillTemplate, type TemplateId } from "@/lib/messageTemplates";
import type { IsolationRole } from "@/lib/isolation";

export type ThreadChannel = "portal_chat" | "sms" | "whatsapp" | "email";
export type DeliveryStatus = "queued" | "sent" | "failed" | "not_configured";

export interface UnifiedMessage {
  id: string;
  sender: string;
  senderRole: string;
  channel: ThreadChannel;
  originalText: string;
  originalLanguage: LanguageCode;
  /** Null until Google Cloud Translation is connected — never faked. */
  translatedText: string | null;
  deliveryStatus: DeliveryStatus;
  time: string;
}

const CHANNEL_LABELS: Record<ThreadChannel, string> = {
  portal_chat: "Portal Chat",
  sms: "SMS",
  whatsapp: "WhatsApp",
  email: "Email",
};

const CHANNELS: ThreadChannel[] = ["portal_chat", "sms", "whatsapp", "email"];

// EXAMPLE thread only — labelled, no real people. Replace with
// messages rows (0001) + message_sends rows (0014) once live.
export const EXAMPLE_THREAD: UnifiedMessage[] = [
  {
    id: "utm-1", sender: "Example Preparer", senderRole: "preparer",
    channel: "portal_chat",
    originalText: "Hello — please re-upload page 2 of your bank statement. The first photo was blurry.",
    originalLanguage: "en", translatedText: null,
    deliveryStatus: "sent", time: "10:14 AM (example)",
  },
  {
    id: "utm-2", sender: "Example Client", senderRole: "client",
    channel: "sms",
    originalText: "Ya lo escaneé con mi teléfono, lo subo ahora.",
    originalLanguage: "es", translatedText: null,
    deliveryStatus: "sent", time: "10:20 AM (example)",
  },
];

export default function UnifiedThread(props: {
  caseId: string;
  caseLabel: string;
  viewerRole: IsolationRole;
  viewerName: string;
  clientLanguage?: LanguageCode;
  /** Family invites and law students have restricted send rights. */
  canSend?: boolean;
  sendDisabledReason?: string;
}) {
  const { caseId, caseLabel, viewerRole, viewerName } = props;
  const clientLanguage = props.clientLanguage ?? "es";
  const canSend = props.canSend ?? true;
  const [messages, setMessages] = useState<UnifiedMessage[]>(EXAMPLE_THREAD);
  const [channel, setChannel] = useState<ThreadChannel>("portal_chat");
  const [draft, setDraft] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [templateId, setTemplateId] = useState<TemplateId | "">("");
  const [templateLang, setTemplateLang] = useState<LanguageCode>("en");
  const [notice, setNotice] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const isStudent = viewerRole === "law_student";

  function applyTemplate(id: TemplateId) {
    const t = MESSAGE_TEMPLATES.find((x) => x.id === id);
    if (!t) return;
    setTemplateId(id);
    setDraft(fillTemplate(t, templateLang, { document: "[document name]", amount: "[amount — confirm before sending]", date: "[date — confirm before sending]", deadline: "[deadline — confirm before sending]", link: "[link]" }));
    if (t.needsHumanConfirmation) {
      setNotice("This template carries a price, date, or deadline placeholder — a human must confirm the real values before sending. Placeholders in [brackets] are not real values.");
    }
  }

  async function send() {
    const text = draft.trim();
    if (!text || !canSend || sending) return;
    if ((channel === "sms" || channel === "whatsapp") && !phone.trim()) {
      setNotice("Enter a phone number first — this composer texts a phone number you type, through your own Twilio account. Never from your personal phone.");
      return;
    }
    if (channel === "email" && !email.trim()) {
      setNotice("Enter an email address first — this composer emails through your own Resend / AWS SES account. Never from your personal email.");
      return;
    }
    setSending(true);
    setNotice(null);
    let status: DeliveryStatus = "not_configured";
    let detail = "Not configured — nothing was sent.";
    try {
      const res = await fetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId, channel, body: text, phone: phone.trim() || undefined, email: email.trim() || undefined, senderRole: viewerRole }),
      });
      const data = (await res.json().catch(() => ({}))) as { deliveryStatus?: DeliveryStatus; error?: string };
      status = data.deliveryStatus ?? "not_configured";
      detail = data.error ?? `Delivery status: ${status}. Nothing was sent.`;
    } catch {
      detail = "Send failed — the message route could not be reached. Nothing was sent.";
      status = "failed";
    }
    setMessages((m) => [
      ...m,
      {
        id: `utm-local-${Date.now()}`, sender: viewerName, senderRole: viewerRole,
        channel, originalText: text, originalLanguage: "en",
        translatedText: null, deliveryStatus: status,
        time: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
      },
    ]);
    setNotice(detail);
    setDraft("");
    setSending(false);
  }

  return (
    <section aria-label={`Unified message thread — ${caseLabel}`} className="rounded-lg border border-slate-300 bg-white p-4 shadow-sm">
      <h3 className="text-base font-semibold">Unified Message Thread — {caseLabel}</h3>
      <p className="mt-1 text-xs text-slate-600">
        One thread per case. Channels: Portal Chat, SMS, WhatsApp, Email. Case: <span className="font-mono">{caseId}</span> (example).
        Only participants in this case can see this thread — no message, document, invoice, or case is visible to anyone who is not a participant.
      </p>
      {isStudent && (
        <p className="mt-2 rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">
          Law student view: your supervisor sees every message in this thread. You cannot message a client without supervisor visibility.
        </p>
      )}

      <div className="mt-3 space-y-2">
        {messages.map((m) => (
          <div key={m.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
            <p className="text-xs font-semibold">
              {m.sender} · {m.senderRole} · {CHANNEL_LABELS[m.channel]} · {m.time} ·{" "}
              <span className={m.deliveryStatus === "sent" ? "text-green-700" : "text-amber-700"}>
                {m.deliveryStatus === "sent" ? "Sent" : m.deliveryStatus === "queued" ? "Queued — not sent" : m.deliveryStatus === "failed" ? "Failed — not sent" : "Not configured — not sent"}
              </span>
            </p>
            <div className="mt-1 grid gap-2 md:grid-cols-2">
              <div dir={isRtl(m.originalLanguage) ? "rtl" : "ltr"}>
                <p className="text-xs font-medium text-slate-500">Original ({m.originalLanguage.toUpperCase()})</p>
                <p>{m.originalText}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500">English translation</p>
                {m.translatedText ? (
                  <p>{m.translatedText}</p>
                ) : (
                  <p className="text-slate-500 italic">{TRANSLATION_NOT_CONFIGURED_NOTE}</p>
                )}
              </div>
            </div>
            <p className="mt-1 text-xs text-slate-500">{TRANSLATION_WARNING}</p>
          </div>
        ))}
      </div>

      {!canSend ? (
        <p className="mt-3 rounded border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-semibold">
          🔒 Sending is locked for you here: {props.sendDisabledReason ?? "you do not have send rights on this case."}
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          <div className="flex flex-wrap gap-1" role="tablist" aria-label="Channel">
            {CHANNELS.map((c) => (
              <button key={c} type="button" role="tab" aria-selected={channel === c} onClick={() => setChannel(c)}
                className={"rounded-full border px-2 py-1 text-xs font-medium " + (channel === c ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300 bg-white hover:bg-slate-100")}>
                {CHANNEL_LABELS[c]}
              </button>
            ))}
          </div>
          {(channel === "sms" || channel === "whatsapp") && (
            <p className="rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">
              {CHANNEL_LABELS[channel]} NOT configured — Twilio is not connected. This composer texts a phone number you enter, through your own Twilio account, never from your personal phone. The message will queue only.
            </p>
          )}
          {channel === "email" && (
            <p className="rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">
              Email NOT configured — Resend / AWS SES is not connected. This composer emails an address you enter, through your own email account, never from your personal email. The message will queue only.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <label className="text-xs font-medium">Quick template:
              <select value={templateId} onChange={(e) => { const v = e.target.value as TemplateId | ""; if (v) applyTemplate(v); else setTemplateId(""); }}
                className="ml-1 rounded border border-slate-300 px-1 py-1 text-xs">
                <option value="">— Choose —</option>
                {MESSAGE_TEMPLATES.map((t) => (<option key={t.id} value={t.id}>{t.label}</option>))}
              </select>
            </label>
            <label className="text-xs font-medium">Template language:
              <select value={templateLang} onChange={(e) => setTemplateLang(e.target.value as LanguageCode)}
                className="ml-1 rounded border border-slate-300 px-1 py-1 text-xs">
                {LANGUAGES.map((l) => (<option key={l.code} value={l.code}>{l.native}</option>))}
              </select>
            </label>
            <span className="text-xs text-slate-500">Client&apos;s language: {clientLanguage.toUpperCase()} · Original is always shown next to the translation.</span>
          </div>
          {(channel === "sms" || channel === "whatsapp") && (
            <label className="block text-sm">
              <span className="font-medium">Text this phone number</span>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 …"
                className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm" />
            </label>
          )}
          {channel === "email" && (
            <label className="block text-sm">
              <span className="font-medium">Email them at</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com"
                className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm" />
            </label>
          )}
          <label className="block text-sm">
            <span className="font-medium">Message ({CHANNEL_LABELS[channel]})</span>
            <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={3}
              placeholder="Type a message… (it will queue only — nothing is sent until your own provider is connected and tested)"
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm" />
          </label>
          <button type="button" onClick={send} disabled={sending}
            className="rounded bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {sending ? "Sending…" : "Send (queues only — not sent until connected)"}
          </button>
          {notice && (
            <p role="status" className="rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">{notice}</p>
          )}
          <p className="text-xs text-slate-500">
            Sends from inside this dashboard only, through your own connected account. The platform never holds your messages or money.
          </p>
        </div>
      )}
    </section>
  );
}
