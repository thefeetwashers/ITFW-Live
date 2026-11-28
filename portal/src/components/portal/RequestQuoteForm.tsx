// Request a pricing quote — for a form with no locked price.
// ---------------------------------------------------------------------------
// Used in the service catalog ("Quoted individually" section) for
// I-526E / I-526 / I-829 (quoted individually) and I-693 (free
// booking). The form shows the honest state — "quoted individually
// — no price invented" — and posts to /api/quote-requests, which
// saves the request to public.quote_requests and attempts one SES
// notification email (honest 501/not_configured when SES is not
// configured — never claims sent).
//
// No DOB, A-Number, SSN or passport number is asked for here, and
// none is ever sent. Client component (it posts from the browser).
"use client";

import { useState } from "react";
import { UNPRICED_FORMS } from "@/lib/quotedForms";

export default function RequestQuoteForm(props: {
  accountId?: string;
  caseId?: string;
}) {
  const [formCode, setFormCode] = useState("I-526E");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const selected =
    UNPRICED_FORMS.find((f) => f.formCode === formCode) ?? UNPRICED_FORMS[0];

  async function submit() {
    if (busy || sent) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/quote-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          phone: phone || undefined,
          formCode,
          description,
          accountId: props.accountId,
          caseId: props.caseId,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        message?: string;
        error?: string;
        email?: { sent?: boolean; note?: string };
      };
      if (!res.ok || !data.ok) {
        setMessage(
          data.error ?? `Your request could not be saved (${res.status}). Nothing was sent.`
        );
        setBusy(false);
        return;
      }
      setSent(true);
      setMessage(
        `${data.message ?? "Your pricing-quote request was saved."}` +
          (data.email && !data.email.sent
            ? ` Note: ${data.email.note ?? "The notification email was not sent."}`
            : "")
      );
    } catch {
      setMessage("Could not reach the server. Nothing was saved.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 rounded border border-slate-200 p-3">
      <h3 className="text-sm font-semibold">
        Quoted individually — no price invented
      </h3>
      <p className="mt-1 text-sm text-slate-600">
        These forms have no locked price on this platform. No price is
        shown here and none has been invented — a professional quotes
        the form for your situation after you ask below.
      </p>
      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Unpriced forms">
        {UNPRICED_FORMS.map((f) => (
          <button
            key={f.formCode}
            type="button"
            onClick={() => setFormCode(f.formCode)}
            aria-pressed={formCode === f.formCode}
            className={`rounded px-3 py-1.5 text-sm font-semibold ${
              formCode === f.formCode
                ? "bg-slate-900 text-white"
                : "border border-slate-300 bg-white text-slate-700"
            }`}
          >
            {f.formCode}
          </button>
        ))}
      </div>
      <p className="mt-3 text-sm">
        <strong>
          {selected.formCode} — {selected.name}
        </strong>
        <span className="block text-slate-600">{selected.pricingState}</span>
        <span className="block text-slate-600">{selected.nextStep}</span>
      </p>

      {sent ? (
        <p className="mt-3 rounded border border-green-600 bg-green-50 px-3 py-2 text-sm text-green-900">
          {message}
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          <label className="block text-sm">
            Your name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
              placeholder="Your full name"
            />
          </label>
          <label className="block text-sm">
            Email
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
              placeholder="you@example.com"
            />
          </label>
          <label className="block text-sm">
            Phone (optional)
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              type="tel"
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
              placeholder="Phone number"
            />
          </label>
          <label className="block text-sm">
            What do you need quoted? (optional)
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              maxLength={2000}
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
              placeholder="For example: I am an investor and need Form I-526E prepared."
            />
          </label>
          <button
            type="button"
            disabled={busy || !name.trim() || !email.trim()}
            onClick={() => void submit()}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Saving…" : `Request a pricing quote — Form ${formCode}`}
          </button>
          {message && (
            <p className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {message}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
