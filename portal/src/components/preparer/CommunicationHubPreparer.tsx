// Preparer Communication Hub — unified thread + BYO integrations.
// Local state / queue ONLY. Nothing is ever sent from here: AWS SES,
// AWS SES, and Twilio are NOT connected, no keys exist, and the sender
// email is not verified. Every send attempt queues the message and says
// so. Quick templates are provided in all 7 languages (EN, ES, HT, FR,
// PT, ZH, AR — src/lib/i18n). Auto-translation shows the original +
// English and needs Google Cloud Translation (NOT connected).
"use client";

import { useState } from "react";
import { LANGUAGES, type LanguageCode } from "@/lib/i18n";

type Channel = "Portal Chat" | "SMS" | "WhatsApp" | "Email";

const BYO_STATUS = [
  { provider: "Resend (email)", status: "NOT CONNECTED", note: "No API key. Sender email not verified." },
  { provider: "AWS SES (email)", status: "NOT CONNECTED", note: "No keys, region, or verified sender." },
  { provider: "Twilio (SMS / WhatsApp)", status: "NOT CONNECTED", note: "No account SID / token. WhatsApp needs Business approval." },
  { provider: "Phone number (Twilio number)", status: "NOT CONNECTED", note: "Placeholder until set — never the founder's personal number." },
  { provider: "Sender email", status: "NOT VERIFIED", note: "updates@niptei.com is a placeholder sender, not verified." },
] as const;

const TEMPLATES: Record<string, Record<LanguageCode, string>> = {
  "Request missing document": {
    en: "Hello — we are missing a document for your case. Please upload it in your portal when you can. Thank you.",
    es: "Hola: nos falta un documento para su caso. Por favor, súbalo en su portal cuando pueda. Gracias.",
    ht: "Bonjou — yon dokiman manke pou ka w la. Tanpri telechaje l nan pòtal ou lè ou kapab. Mèsi.",
    fr: "Bonjour — il manque un document pour votre dossier. Veuillez le téléverser dans votre portail quand vous le pouvez. Merci.",
    pt: "Olá — falta um documento para o seu caso. Por favor, envie-o no seu portal quando puder. Obrigado.",
    zh: "您好——您的案件缺少一份文件。请在方便时将其上传到您的门户网站。谢谢。",
    ar: "مرحبًا — ينقصنا مستند لقضيتك. يرجى تحميله في البوابة الخاصة بك عندما تستطيع. شكرًا.",
  },
  "Payment reminder": {
    en: "Reminder: your preparation-fee payment is due soon. Government (USCIS/NVC) fees are separate and paid directly to the government.",
    es: "Recordatorio: su pago de la tarifa de preparación vence pronto. Las tarifas del gobierno (USCIS/NVC) son aparte y se pagan directamente al gobierno.",
    ht: "Rapèl: peman frè preparasyon ou a apati byento. Frè gouvènman an (USCIS/NVC) se apa, ou peye yo dirèkteman bay gouvènman an.",
    fr: "Rappel : votre paiement des frais de préparation arrive bientôt à échéance. Les frais du gouvernement (USCIS/NVC) sont séparés et payés directement au gouvernement.",
    pt: "Lembrete: o pagamento da sua taxa de preparação vence em breve. As taxas do governo (USCIS/NVC) são separadas e pagas diretamente ao governo.",
    zh: "提醒：您的准备费付款即将到期。政府费用（USCIS/NVC）是分开的，直接支付给政府。",
    ar: "تذكير: دفعة رسوم التحضير الخاصة بك مستحقة قريبًا. رسوم الحكومة (USCIS/NVC) منفصلة وتُدفع مباشرة إلى الحكومة.",
  },
  "Appointment request received": {
    en: "Your appointment request was received. We will confirm the time with you — the booking calendar is not connected yet, so no time is auto-booked.",
    es: "Recibimos su solicitud de cita. Le confirmaremos la hora — el calendario de reservas aún no está conectado, así que ninguna hora se reserva automáticamente.",
    ht: "Nou resevwa demann randevou ou a. N ap konfime lè a avè ou — kalandriye rezervasyon an poko konekte, kidonk okenn lè pa rezève otomatikman.",
    fr: "Votre demande de rendez-vous a bien été reçue. Nous confirmerons l'heure avec vous — le calendrier de réservation n'est pas encore connecté, donc aucune heure n'est réservée automatiquement.",
    pt: "Recebemos o seu pedido de consulta. Confirmaremos o horário com você — o calendário de reservas ainda não está conectado, por isso nenhum horário é reservado automaticamente.",
    zh: "我们已收到您的预约请求。我们会与您确认时间——预约日历尚未连接，因此不会自动预订时间。",
    ar: "تم استلام طلب موعدك. سنؤكد الوقت معك — تقويم الحجز غير متصل بعد، لذلك لن يتم حجز أي وقت تلقائيًا.",
  },
};

const EXAMPLE_THREAD = [
  { from: "Example Client A", channel: "Portal Chat", body: "I re-uploaded my bank statement.", original: null as string | null },
  { from: "You (preparer)", channel: "Portal Chat", body: "Thank you — I will review it today.", original: null as string | null },
  { from: "Example Client A", channel: "WhatsApp", body: "Gracias, ¿cuándo estará lista la forma?", original: "Gracias, ¿cuándo estará lista la forma? — English: Thank you, when will the form be ready?" },
] as const;

export default function CommunicationHubPreparer() {
  const [channel, setChannel] = useState<Channel>("Portal Chat");
  const [language, setLanguage] = useState<LanguageCode>("en");
  const [draft, setDraft] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [queue, setQueue] = useState<{ channel: Channel; to: string; body: string }[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  const queueMessage = (to: string) => {
    const body = draft.trim();
    if (!body) return;
    setQueue((q) => [...q, { channel, to: to || "Example Client A", body }]);
    setDraft("");
    setNotice(
      `${channel}: NOT CONFIGURED — Twilio / AWS SES are not connected, so nothing was sent. The message is queued only. Messages go through the Twilio number (placeholder until set), never the founder's personal number.`
    );
  };

  return (
    <section
      aria-labelledby="comm-hub-heading"
      className="rounded-lg border border-slate-300 bg-white p-4 shadow-sm"
    >
      <h2 id="comm-hub-heading" className="text-lg font-semibold">
        Communication Hub — Unified Thread
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Portal Chat, SMS, WhatsApp, and Email in one thread. Queue only —
        nothing is sent. Auto-translation shows the original + English and
        needs Google Cloud Translation (NOT connected).
      </p>

      <h3 className="mt-4 text-sm font-semibold">BYO integrations — connection status</h3>
      <ul className="mt-2 space-y-1">
        {BYO_STATUS.map((b) => (
          <li key={b.provider} className="flex flex-wrap justify-between gap-2 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
            <span><strong>{b.provider}</strong> — {b.note}</span>
            <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">{b.status}</span>
          </li>
        ))}
      </ul>

      <h3 className="mt-4 text-sm font-semibold">Unified thread — Example Client A (example)</h3>
      <ul className="mt-2 space-y-2">
        {EXAMPLE_THREAD.map((m, i) => (
          <li key={i} className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
            <strong>{m.from}</strong> <span className="text-xs text-slate-500">({m.channel})</span>
            <p className="mt-1">{m.body}</p>
            {m.original && <p className="mt-1 text-xs text-slate-600">Original + English: {m.original}</p>}
          </li>
        ))}
      </ul>

      <div className="mt-4 flex flex-wrap gap-1" role="tablist" aria-label="Channel">
        {(["Portal Chat", "SMS", "WhatsApp", "Email"] as Channel[]).map((c) => (
          <button
            key={c}
            type="button"
            role="tab"
            aria-selected={channel === c}
            onClick={() => setChannel(c)}
            className={
              "rounded-full border px-3 py-1 text-sm font-medium " +
              (channel === c ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300 bg-white hover:bg-slate-100")
            }
          >
            {c}
          </button>
        ))}
      </div>

      {(channel === "SMS" || channel === "WhatsApp") && (
        <label className="mt-3 block text-sm">
          <span className="font-medium">Text by entering a phone number</span>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+1 (772) 555-0100 — example format, no message is sent"
            className="mt-1 w-full max-w-sm rounded border border-slate-300 px-2 py-1 text-sm"
          />
        </label>
      )}
      {channel === "Email" && (
        <label className="mt-3 block text-sm">
          <span className="font-medium">Email them — enter an email address</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="client@example.com — no email is sent (AWS SES not connected)"
            className="mt-1 w-full max-w-sm rounded border border-slate-300 px-2 py-1 text-sm"
          />
        </label>
      )}

      <label className="mt-3 block text-sm">
        <span className="font-medium">Quick templates — 7 languages</span>
        <span className="mt-1 flex flex-wrap gap-2">
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as LanguageCode)}
            className="rounded border border-slate-300 bg-white px-2 py-1 text-sm"
            aria-label="Template language"
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>{l.label} ({l.native})</option>
            ))}
          </select>
          {Object.keys(TEMPLATES).map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => setDraft(TEMPLATES[name][language])}
              className="rounded-full border border-slate-300 bg-slate-50 px-2 py-1 text-xs font-medium hover:bg-slate-100"
            >
              {name}
            </button>
          ))}
        </span>
      </label>

      <label className="mt-3 block text-sm">
        <span className="font-medium">Message ({channel}) — Example Client A</span>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={4}
          placeholder="Type a message… (it will queue only — nothing is sent)"
          className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
        />
      </label>
      <button
        type="button"
        onClick={() => queueMessage(channel === "Email" ? email : phone)}
        className="mt-2 rounded bg-blue-700 px-3 py-2 text-sm font-semibold text-white"
      >
        Queue message (NOT sent — not configured)
      </button>
      {notice && (
        <p role="status" className="mt-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
          {notice}
        </p>
      )}

      <h3 className="mt-4 text-sm font-semibold">Message queue (queued — NOT sent)</h3>
      {queue.length === 0 ? (
        <p className="mt-1 text-xs text-slate-500">No messages queued yet.</p>
      ) : (
        <ul className="mt-2 space-y-1 text-xs">
          {queue.map((m, i) => (
            <li key={i} className="rounded border border-slate-200 bg-slate-50 px-2 py-1">
              <strong>{m.channel} → {m.to} — queued, NOT sent:</strong> {m.body}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
