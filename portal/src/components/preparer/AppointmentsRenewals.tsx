// Appointments + renewal reminders — preparer dashboard.
// Booking calendar is NOT connected: consultation requests are
// collected, not auto-booked — the preparer confirms the time by
// message. The professional answers each request here: Accept /
// Propose another time / Decline (POST/PATCH /api/bookings; 501 until
// Supabase + migrations 0012/0017 are live). Renewal reminders are
// example rows, local only, until case_renewals is connected.
"use client";

import { useState } from "react";
import Link from "next/link";
import InterviewMedicalCard from "@/components/portal/InterviewMedicalCard";
import {
  CONSULTATION_30_MIN_LABEL,
  CONSULTATION_MODE_LABEL,
  TIME_PREFERENCE_LABEL,
  type BookingDecision,
  type ConsultationMode,
  type TimePreference,
} from "@/lib/booking";
import {
  deriveRenewals,
  RENEWAL_FORM_TO_FILE,
  RENEWAL_TYPE_LABEL,
  type RenewalInput,
} from "@/lib/renewals";

interface LocalRequest {
  id: string;
  name: string;
  mode: ConsultationMode;
  lengthMinutes: 15 | 30;
  timePreference: TimePreference;
  language: string;
  timezone: string;
  when: string;
  decision: BookingDecision;
  proposedTime: string | null;
}

const EXAMPLE_REQUEST: LocalRequest = {
  id: "ex-1",
  name: "Example Client B",
  mode: "video",
  lengthMinutes: 15,
  timePreference: "evening",
  language: "es",
  timezone: "America/New_York",
  when: "Tue 2pm",
  decision: "pending",
  proposedTime: null,
};

export default function AppointmentsRenewals({
  liveRenewals = [],
}: {
  /** Real case_renewals rows (migration 0014, types widened in 0017).
   *  Empty = no real renewal dates on file. */
  liveRenewals?: RenewalInput[];
}) {
  const [requests, setRequests] = useState<LocalRequest[]>([EXAMPLE_REQUEST]);
  const renewalsComingUp = deriveRenewals(liveRenewals);
  const [name, setName] = useState("");
  const [when, setWhen] = useState("");
  const [mode, setMode] = useState<ConsultationMode>("video");
  const [lengthMinutes, setLengthMinutes] = useState<15 | 30>(15);
  const [timePreference, setTimePreference] = useState<TimePreference>("any");
  const [language, setLanguage] = useState("en");
  const [timezone, setTimezone] = useState("America/New_York");
  const [proposedFor, setProposedFor] = useState<string | null>(null);
  const [proposedTime, setProposedTime] = useState("");
  const [result, setResult] = useState<string | null>(null);

  const decide = async (id: string, decision: BookingDecision, proposed?: string) => {
    setResult(null);
    // Example row: decision is local-only (no id exists in the DB).
    // Real rows (from /api/bookings) PATCH their decision the same way.
    setRequests((rs) =>
      rs.map((r) =>
        r.id === id
          ? { ...r, decision, proposedTime: decision === "proposed" ? (proposed ?? null) : null }
          : r
      )
    );
    if (id.startsWith("ex-")) {
      setResult(
        decision === "accepted"
          ? "Accepted (example — local only). No calendar event was created: the calendar is NOT connected, so confirm the time with the client by message."
          : decision === "proposed"
            ? `Proposed ${proposed ?? ""} (example — local only). No calendar event was created; the client confirms by message.`
            : "Declined (example — local only). Nothing was booked and no message was sent."
      );
      setProposedFor(null);
      setProposedTime("");
      return;
    }
    try {
      const res = await fetch("/api/bookings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, decision, proposedTime: proposed ?? undefined }),
      });
      const data = await res.json().catch(() => ({}));
      setResult(
        res.ok
          ? `Decision saved: ${decision}. No calendar event was created — confirm the time by message.`
          : (data.error as string) || "Decision was NOT saved. Nothing was stored."
      );
    } catch {
      setResult("Decision was NOT saved — the bookings service is not reachable. Nothing was stored.");
    }
    setProposedFor(null);
    setProposedTime("");
  };

  const logRequest = async () => {
    if (!name.trim()) return;
    setResult(null);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preparerId: "example-preparer",
          requesterName: name.trim(),
          mode,
          lengthMinutes,
          preferredTime: when.trim() || null,
          timePreference,
          language,
          timezone,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setRequests((rs) => [
          ...rs,
          {
            id: (data.id as string) ?? `local-${rs.length + 1}`,
            name: name.trim(),
            mode,
            lengthMinutes,
            timePreference,
            language,
            timezone,
            when: when.trim(),
            decision: "pending",
            proposedTime: null,
          },
        ]);
        setResult("Request collected — no calendar event was created. Confirm the time by message.");
      } else {
        setResult((data.error as string) || "Request was NOT stored. Nothing was booked.");
      }
    } catch {
      setResult("Request was NOT stored — the bookings service is not reachable. Nothing was booked.");
    }
    setName("");
    setWhen("");
  };

  return (
    <section
      aria-labelledby="appointments-heading"
      className="rounded-lg border border-slate-300 bg-white p-4 shadow-sm"
    >
      <h2 id="appointments-heading" className="text-lg font-semibold">
        Appointment Booking &amp; Renewal Reminders
      </h2>
      <p className="mt-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
        Booking calendar NOT connected — consultation requests are collected,
        not auto-booked. A client who asks for a phone / video / in-person
        consultation gets a request logged here; you confirm the time
        yourself by message. Price up front: free 15-min call ($0) or
        30-min consultation $99 — not legal advice unless from a licensed
        attorney.
      </p>

      <h3 className="mt-4 text-sm font-semibold">Consultation requests</h3>
      <ul className="mt-2 space-y-2">
        {requests.map((r) => (
          <li key={r.id} className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
            <p>
              <strong>{r.name}</strong> — {CONSULTATION_MODE_LABEL[r.mode]} consultation,{" "}
              {r.lengthMinutes === 15 ? "free 15-min ($0)" : "30-min ($99)"}, time preference{" "}
              {TIME_PREFERENCE_LABEL[r.timePreference]}, language {r.language}, timezone {r.timezone}
              {r.when ? `, preferred time “${r.when}”` : ", no time given"}.
            </p>
            <p className="mt-1">
              Status:{" "}
              <strong>
                {r.decision === "pending"
                  ? "Awaiting your decision"
                  : r.decision === "accepted"
                    ? "Accepted — confirm the time by message (no calendar event created)"
                    : r.decision === "proposed"
                      ? `You proposed ${r.proposedTime ?? "another time"} — awaiting the client`
                      : "Declined"}
              </strong>
            </p>
            {r.decision === "pending" && (
              <span className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void decide(r.id, "accepted")}
                  className="rounded bg-green-700 px-3 py-1 text-xs font-semibold text-white"
                >
                  Accept
                </button>
                {proposedFor === r.id ? (
                  <span className="flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      value={proposedTime}
                      onChange={(e) => setProposedTime(e.target.value)}
                      placeholder="Proposed time, e.g. Wed 4pm"
                      className="rounded border border-slate-300 px-2 py-1 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => void decide(r.id, "proposed", proposedTime.trim() || undefined)}
                      disabled={!proposedTime.trim()}
                      className="rounded bg-slate-900 px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      Send proposal
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setProposedFor(null);
                        setProposedTime("");
                      }}
                      className="rounded border border-slate-300 px-3 py-1 text-xs"
                    >
                      Cancel
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setProposedFor(r.id)}
                    className="rounded bg-slate-900 px-3 py-1 text-xs font-semibold text-white"
                  >
                    Propose another time
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void decide(r.id, "declined")}
                  className="rounded border border-slate-300 px-3 py-1 text-xs font-semibold"
                >
                  Decline
                </button>
              </span>
            )}
          </li>
        ))}
      </ul>

      <h3 className="mt-4 text-sm font-semibold">Log a consultation request</h3>
      <div className="mt-2 flex flex-wrap gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Client name"
          aria-label="Client name"
          className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1 text-sm"
        />
        <input
          type="text"
          value={when}
          onChange={(e) => setWhen(e.target.value)}
          placeholder="Preferred time, e.g. Tue 2pm"
          aria-label="Preferred time"
          className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1 text-sm"
        />
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as ConsultationMode)}
          aria-label="Consultation mode"
          className="rounded border border-slate-300 px-2 py-1 text-sm"
        >
          <option value="phone">Phone</option>
          <option value="video">Video</option>
          <option value="in_person">In person</option>
        </select>
        <select
          value={lengthMinutes}
          onChange={(e) => setLengthMinutes(Number(e.target.value) as 15 | 30)}
          aria-label="Consultation length and price"
          className="rounded border border-slate-300 px-2 py-1 text-sm"
        >
          <option value={15}>Free 15-min ($0)</option>
          <option value={30}>30-min — $99</option>
        </select>
        <select
          value={timePreference}
          onChange={(e) => setTimePreference(e.target.value as TimePreference)}
          aria-label="Time preference"
          className="rounded border border-slate-300 px-2 py-1 text-sm"
        >
          <option value="any">Any time</option>
          <option value="weekday">Weekday</option>
          <option value="evening">Evening</option>
          <option value="weekend">Weekend</option>
        </select>
        <input
          type="text"
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          placeholder="Language, e.g. es"
          aria-label="Language"
          className="w-28 rounded border border-slate-300 px-2 py-1 text-sm"
        />
        <input
          type="text"
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          placeholder="Timezone"
          aria-label="Timezone"
          className="w-40 rounded border border-slate-300 px-2 py-1 text-sm"
        />
        <button
          type="button"
          onClick={() => void logRequest()}
          className="rounded bg-blue-600 px-3 py-1 text-sm font-medium text-white"
        >
          Log request
        </button>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        {CONSULTATION_30_MIN_LABEL}. Clients request a consultation from
        your public page. Appointment reminders are queued, not sent —
        Twilio / Resend are NOT connected.
      </p>
      {result && (
        <p className="mt-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {result}
        </p>
      )}

      <h3 className="mt-5 text-sm font-semibold">Renewals coming up</h3>
      {renewalsComingUp.length === 0 ? (
        <p className="mt-1 text-sm text-slate-600">
          No renewals coming up — no real renewal dates are on file for your
          cases yet. Add a green card, EAD, TPS, or passport expiry date to
          a case and the reminder is worked out from it here.
        </p>
      ) : (
        <ul className="mt-2 space-y-1 text-sm">
          {renewalsComingUp.map((r) => (
            <li key={r.id} className="rounded border border-slate-200 bg-slate-50 px-3 py-2">
              {RENEWAL_TYPE_LABEL[r.type]} — file {RENEWAL_FORM_TO_FILE[r.type]}.
              Expiry / eligibility {r.eligibilityOrExpiryDate}; reminder window
              opens {r.remindOn};{" "}
              {r.status === "done"
                ? "done."
                : r.isDue
                  ? "due — nudge queued every 48h in the client's language (queued only, nothing sent)."
                  : `${r.daysUntilDue} day(s) until the date.`}
            </li>
          ))}
        </ul>
      )}

      <h3 className="mt-5 text-sm font-semibold">Renewal reminders (example)</h3>
      <ul className="mt-2 space-y-1 text-sm">
        <li className="rounded border border-slate-200 bg-slate-50 px-3 py-2">
          Example Client C — TPS (I-821) renewal window opens in 2027 (example
          — confirm the current TPS dates at uscis.gov before telling a
          client anything).
        </li>
        <li className="rounded border border-slate-200 bg-slate-50 px-3 py-2">
          Example Client D — Green card renewal (I-90) due before expiry
          (example — check the card&apos;s expiry date, never guess it).
        </li>
      </ul>

      <h3 className="mt-5 text-sm font-semibold">Interview prep</h3>
      <p className="mt-1 text-sm text-slate-600">
        Interview readiness checklist lives in the Command Center tab
        (InterviewReadinessTracker). Packet readiness must be 100% before a
        packet is generated — see{" "}
        <Link href="/portal/packet-audit" className="font-semibold text-blue-700 underline">
          Packet Audit
        </Link>
        . Packet output is always a DRAFT for review — never auto-filed.
        Templates come from uscis.gov; field mappings are unverified and
        unfilled fields are listed, never silently skipped.
      </p>

      <div className="mt-5">
        <InterviewMedicalCard appointment={null} />
      </div>
    </section>
  );
}
