// Tool follow-up capture — OFFERED after a free tool is used, never
// forced (Nov 28, 2026).
//
// The visitor just used a free tool. This form offers — in plain
// language — to have someone follow up once about their enquiry.
// It is optional: the tool result is already shown above it, the
// form is collapsed behind a clear heading, and closing it loses
// nothing. TOOL_LEAD_CAPTURE_NOTE states what happens next (one
// follow-up email or call, never spam, details never sold).
//
// Storage: the EXISTING /api/leads route, with toolUsed +
// arrivalChannel from src/lib/freeTools.ts. That route deliberately
// refuses when no professional is identified (no ?provider=<slug>
// or ?ref=<code>) — toolLeadCaptureTarget() is the gate, and this
// component shows that reason honestly with links to pick a
// professional instead of pretending the enquiry was saved.
// No DOB, A-Number, SSN, or passport number is asked for here.
"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { SERVICE_REQUESTED_LABELS, type ServiceRequested } from "@/lib/lifecycle";
import {
  TOOL_LEAD_CAPTURE_NOTE,
  freeToolById,
  toolLeadCaptureTarget,
} from "@/lib/freeTools";

const SERVICE_OPTIONS = (
  Object.keys(SERVICE_REQUESTED_LABELS) as ServiceRequested[]
).map((id) => ({ id, label: SERVICE_REQUESTED_LABELS[id] }));

export default function ToolLeadCapture({ toolId }: { toolId: string }) {
  const params = useSearchParams();
  const referralCode = params.get("ref");
  const providerSlug = params.get("provider");
  const tool = freeToolById(toolId);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [service, setService] = useState<ServiceRequested>("family_bundle");
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const target = toolLeadCaptureTarget({ referralCode, providerSlug });

  async function submit() {
    setNotice(null);
    if (target.postTo === null) {
      setNotice(target.reason);
      return;
    }
    if (!fullName.trim() || !phone.trim() || !email.trim()) {
      setNotice("Name, phone and email are all required — nothing is submitted without them.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(target.postTo, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fullName,
          phone,
          email,
          preferredLanguage: "en",
          serviceRequested: service,
          serviceTier: "standard",
          beneficiaryLocation: null,
          documentsReady: false,
          interviewDate: "",
          urgency: null,
          referralCode: target.referralCode,
          providerSlug: target.providerSlug,
          toolUsed: toolId,
          arrivalChannel: tool?.arrivalChannel ?? "other",
        }),
      });
      const data = (await res.json()) as { error?: string; ok?: boolean };
      if (!res.ok) {
        setNotice(
          data.error ??
            "Your enquiry could not be saved. Nothing was created — please try again."
        );
        return;
      }
      setSubmitted(true);
      setNotice(
        "Thank you — your enquiry was saved. We will contact you once about it, in English unless you tell us otherwise. Nothing has been filed and no fee is due yet."
      );
    } catch {
      setNotice("Could not reach the server. Nothing was submitted — please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section
      aria-label="Follow-up (optional)"
      className="mt-6 rounded-lg border border-slate-300 bg-white p-4 shadow-sm"
    >
      <h2 className="text-base font-semibold">
        Want someone to follow up? (Optional — the tool above is already free)
      </h2>
      <p className="mt-1 text-sm text-slate-600">{TOOL_LEAD_CAPTURE_NOTE}</p>
      <p className="mt-1 text-sm text-slate-600">
        Clerical help only — not a law firm, no approval guarantee. Only a
        licensed attorney or a DOJ-Accredited Representative gives legal
        advice or represents you (8 CFR 292.1).
      </p>

      {target.postTo === null && (
        <p className="mt-3 rounded border border-amber-400 bg-amber-50 p-3 text-sm font-medium text-amber-900">
          {target.reason}{" "}
          <Link href="/professionals" className="text-blue-700 underline">
            Find a verified professional →
          </Link>{" "}
          or{" "}
          <Link href="/leads" className="text-blue-700 underline">
            use the main enquiry form →
          </Link>
        </p>
      )}

      {submitted ? (
        <p role="status" className="mt-4 rounded border border-green-400 bg-green-50 p-3 text-sm font-medium text-green-900">
          {notice}
        </p>
      ) : (
        target.postTo !== null && (
          <form
            className="mt-4 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="font-medium">Full name *</span>
                <input
                  className="mt-1 w-full rounded border border-slate-300 p-2"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  autoComplete="name"
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium">Phone / WhatsApp *</span>
                <input
                  className="mt-1 w-full rounded border border-slate-300 p-2"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  autoComplete="tel"
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium">Email *</span>
                <input
                  type="email"
                  className="mt-1 w-full rounded border border-slate-300 p-2"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium">Service needed</span>
                <select
                  className="mt-1 w-full rounded border border-slate-300 p-2"
                  value={service}
                  onChange={(e) => setService(e.target.value as ServiceRequested)}
                >
                  {SERVICE_OPTIONS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {notice && (
              <p role="status" className="rounded border border-amber-400 bg-amber-50 p-3 text-sm font-medium text-amber-900">
                {notice}
              </p>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="rounded bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {submitting ? "Sending…" : "Yes — contact me once about this"}
            </button>
            <p className="text-xs text-slate-500">
              No thanks? Just close this page — your tool result above is
              yours to keep, and nothing is saved about you.
            </p>
          </form>
        )
      )}
    </section>
  );
}
