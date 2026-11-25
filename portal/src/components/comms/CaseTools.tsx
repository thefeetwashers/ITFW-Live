// Case tools — the "add other things we forgot" panel (Nov 19, 2026).
// Everything a professional needs to service a client that was not
// already built elsewhere in the portal. All state here is local /
// EXAMPLE until Supabase is live.
// Tables: private notes + per-case to-dos already exist as
// preparer_case_notes / preparer_case_todos (migration 0012,
// preparer-scoped, owner-only — NOT recreated here, to avoid a second
// system; widening them to attorneys/DOJ reps needs a founder
// decision). Contact preferences, renewals, referrals and appointment
// reminders are in migration 0014 (case_contact_preferences,
// case_renewals, case_referrals, appointment_reminders).
// Existing tables are NOT duplicated: documents/invoices/signatures/
// appointments themselves already exist (migration 0001) and are NOT
// recreated here; this panel works on top of them.
"use client";

import { useState } from "react";
import { canDo, type MatrixRole } from "@/lib/permissions";
import {
  n400EligibilityDate, remind90DaysBefore, reminderTimes,
  type CaseNote, type CaseTask, type ContactCard, type RenewalReminder,
} from "@/lib/caseTools";

const EXAMPLE_CONTACT: ContactCard = {
  preferredLanguage: "Español (es)",
  timezone: "America/New_York",
  bestContactTime: "Weekdays after 6:00 PM (example)",
  preferredChannel: "WhatsApp",
  phoneMasked: "***-***-1234",
  emailMasked: "e***@example.com",
};

export function ContactCardView() {
  return (
    <section aria-label="Client contact card" className="rounded border border-slate-200 p-3">
      <h4 className="text-sm font-bold">Client Contact Card (example)</h4>
      <dl className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
        <div><dt className="font-medium">Preferred language</dt><dd>{EXAMPLE_CONTACT.preferredLanguage}</dd></div>
        <div><dt className="font-medium">Timezone</dt><dd>{EXAMPLE_CONTACT.timezone}</dd></div>
        <div><dt className="font-medium">Best contact time</dt><dd>{EXAMPLE_CONTACT.bestContactTime}</dd></div>
        <div><dt className="font-medium">Preferred channel</dt><dd>{EXAMPLE_CONTACT.preferredChannel}</dd></div>
        <div><dt className="font-medium">Phone</dt><dd>{EXAMPLE_CONTACT.phoneMasked}</dd></div>
        <div><dt className="font-medium">Email</dt><dd>{EXAMPLE_CONTACT.emailMasked}</dd></div>
      </dl>
      <p className="mt-1 text-xs text-slate-500">Full phone / email are never shown in full in logs or chat. Best contact time and timezone come from case_contact_preferences (migration 0014) once live.</p>
    </section>
  );
}

export function PrivateCaseNotes(props: { role: MatrixRole }) {
  const gate = canDo(props.role, "write_private_case_notes");
  const [notes, setNotes] = useState<CaseNote[]>([
    { id: "note-1", authorRole: "preparer", body: "Example private note: client prefers WhatsApp after 6 PM. Never shown to the client.", createdAt: "2026-11-19 (example)" },
  ]);
  const [draft, setDraft] = useState("");
  if (!gate.allowed) {
    return (
      <section aria-label="Private case notes" className="rounded border border-slate-200 p-3">
        <h4 className="text-sm font-bold">Private Case Notes 🔒</h4>
        <p className="mt-1 text-sm">Locked: {gate.reason}</p>
      </section>
    );
  }
  return (
    <section aria-label="Private case notes" className="rounded border border-slate-200 p-3">
      <h4 className="text-sm font-bold">Private Case Notes — provider-only, never shown to the client</h4>
      <p className="mt-1 text-xs text-slate-500">Stored in preparer_case_notes (migration 0012) once live — provider-only, no client/family read policy.</p>
      <ul className="mt-2 space-y-1 text-sm">
        {notes.map((n) => (<li key={n.id} className="rounded bg-slate-50 px-2 py-1">{n.body} <span className="text-xs text-slate-500">({n.authorRole}, {n.createdAt})</span></li>))}
      </ul>
      <div className="mt-2 flex gap-2">
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Add a private note… (local only, example)"
          className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1 text-sm" />
        <button type="button" onClick={() => { if (!draft.trim()) return; setNotes((ns) => [...ns, { id: `note-${Date.now()}`, authorRole: props.role, body: draft.trim(), createdAt: "just now (example)" }]); setDraft(""); }}
          className="rounded bg-slate-900 px-3 py-1 text-xs font-semibold text-white">Add note</button>
      </div>
    </section>
  );
}

export function CaseTaskList() {
  const [tasks, setTasks] = useState<CaseTask[]>([
    { id: "task-1", title: "Review re-uploaded bank statement (example)", dueAt: "2026-11-20", status: "open", assignedTo: "You" },
    { id: "task-2", title: "Request missing 2024 address dates (example)", dueAt: "2026-11-19", status: "overdue", assignedTo: "You" },
  ]);
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  return (
    <section aria-label="Case tasks" className="rounded border border-slate-200 p-3">
      <h4 className="text-sm font-bold">Task / To-Do List — per case, with due dates</h4>
      <ul className="mt-2 space-y-1 text-sm">
        {tasks.map((t) => (
          <li key={t.id} className="flex flex-wrap items-center gap-2 rounded bg-slate-50 px-2 py-1">
            <span className={t.status === "done" ? "line-through" : ""}>{t.title}</span>
            <span className="text-xs text-slate-500">due {t.dueAt} · {t.status} · {t.assignedTo}</span>
            {t.status !== "done" && (
              <button type="button" onClick={() => setTasks((ts) => ts.map((x) => (x.id === t.id ? { ...x, status: "done" } : x)))}
                className="rounded border border-slate-300 px-2 py-0.5 text-xs font-semibold">Mark done</button>
            )}
          </li>
        ))}
      </ul>
      <div className="mt-2 flex flex-wrap gap-2">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="New task…" aria-label="New task"
          className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1 text-sm" />
        <input type="date" value={due} onChange={(e) => setDue(e.target.value)} aria-label="Due date"
          className="rounded border border-slate-300 px-2 py-1 text-sm" />
        <button type="button" onClick={() => { if (!title.trim()) return; setTasks((ts) => [...ts, { id: `task-${Date.now()}`, title: title.trim(), dueAt: due || "—", status: "open", assignedTo: "You" }]); setTitle(""); setDue(""); }}
          className="rounded bg-slate-900 px-3 py-1 text-xs font-semibold text-white">Add task</button>
      </div>
    </section>
  );
}

export function AppointmentBooker() {
  const [date, setDate] = useState("2026-11-20");
  const [time, setTime] = useState("10:00");
  const [booked, setBooked] = useState<string | null>(null);
  const reminders = booked ? reminderTimes(booked) : null;
  return (
    <section aria-label="Appointment booking" className="rounded border border-slate-200 p-3">
      <h4 className="text-sm font-bold">Appointment Booking + Reminders</h4>
      <p className="mt-1 text-xs font-semibold text-amber-800">Calendar NOT connected — booking is recorded locally only in this build; no calendar invite is sent.</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Appointment date" className="rounded border border-slate-300 px-2 py-1 text-sm" />
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Appointment time" className="rounded border border-slate-300 px-2 py-1 text-sm" />
        <button type="button" onClick={() => setBooked(`${date}T${time}:00`)} className="rounded bg-slate-900 px-3 py-1 text-xs font-semibold text-white">Book (local only)</button>
        {booked && (
          <button type="button" onClick={() => setBooked(null)} className="rounded border border-slate-300 px-3 py-1 text-xs font-semibold">Cancel (one tap)</button>
        )}
      </div>
      {booked && (
        <p className="mt-2 text-sm">Booked (example, local only): {booked}. Reminders: 24h before ({reminders?.remind24h}) and 1h before ({reminders?.remind1h}) — reminders send only when Twilio / email is connected; today they queue as “not configured”.</p>
      )}
      <p className="mt-1 text-xs text-slate-500">Reschedule / cancel is one tap above. No calendar invite is sent until a calendar is connected.</p>
    </section>
  );
}

export function PaymentActions() {
  const [notice, setNotice] = useState<string | null>(null);
  return (
    <section aria-label="Payment reminders and receipts" className="rounded border border-slate-200 p-3">
      <h4 className="text-sm font-bold">Payment Reminder + Receipt Resend</h4>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" onClick={() => setNotice("Payment reminder queued only — Twilio / email not connected, so nothing was sent. (Example invoice INV-2049-2.)")}
          className="rounded bg-slate-900 px-3 py-1 text-xs font-semibold text-white">Send payment reminder (queues only)</button>
        <button type="button" onClick={() => setNotice("Receipt resend queued only — email not connected, so nothing was sent. (Example invoice INV-2049-2.)")}
          className="rounded border border-slate-300 px-3 py-1 text-xs font-semibold">Resend receipt (queues only)</button>
      </div>
      {notice && <p role="status" className="mt-2 text-xs font-semibold text-amber-800">{notice}</p>}
    </section>
  );
}

export function DocumentRequestCard() {
  const [doc, setDoc] = useState("Joint Bank Statement");
  const [reason, setReason] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  return (
    <section aria-label="Document request and rejection" className="rounded border border-slate-200 p-3">
      <h4 className="text-sm font-bold">Document Request + Rejection with Reason</h4>
      <div className="mt-2 flex flex-wrap gap-2">
        <input value={doc} onChange={(e) => setDoc(e.target.value)} aria-label="Document name" className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1 text-sm" />
        <button type="button" onClick={() => setNotice(`Document requested (local only, example): ${doc}. The client sees it on their checklist.`)}
          className="rounded bg-slate-900 px-3 py-1 text-xs font-semibold text-white">Request document</button>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Rejection reason, e.g. photo is blurry" aria-label="Rejection reason"
          className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1 text-sm" />
        <button type="button" onClick={() => setNotice(`Document rejected with reason (local only, example): ${reason || "no reason given — a reason is required before rejecting."}`)}
          className="rounded border border-slate-300 px-3 py-1 text-xs font-semibold">Reject with reason</button>
      </div>
      {notice && <p role="status" className="mt-2 text-xs font-semibold text-amber-800">{notice}</p>}
    </section>
  );
}

export function ESignStatusCard() {
  return (
    <section aria-label="E-sign status" className="rounded border border-slate-200 p-3">
      <h4 className="text-sm font-bold">E-Sign Status Tracking</h4>
      <p className="mt-1 text-sm">Form I-130 draft — <strong>not signed yet</strong> (example). E-Sign unlocks only after the balance is paid in full and the packet audit is 100%.</p>
      <p className="mt-1 text-xs text-slate-500">E-Sign provider NOT connected in this build — status is tracked here, signatures are collected only once a provider is connected. A law-student draft unlocks for client E-Sign only after supervisor approval.</p>
    </section>
  );
}

export function InterviewPrepChecklist() {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const items = [
    "Joint documents gathered (bank statements, lease, photos, messages)",
    "Marriage timeline reviewed with the client",
    "5-year address / work / travel history complete — no gaps",
    "Client knows the interview location, date, and what to bring",
  ];
  return (
    <section aria-label="Interview prep checklist" className="rounded border border-slate-200 p-3">
      <h4 className="text-sm font-bold">Interview Prep Checklist</h4>
      <ul className="mt-2 space-y-1 text-sm">
        {items.map((item) => (
          <li key={item}>
            <label className="flex items-start gap-2">
              <input type="checkbox" checked={checked[item] ?? false} onChange={(e) => setChecked((c) => ({ ...c, [item]: e.target.checked }))} />
              <span className={checked[item] ? "line-through" : ""}>{item}</span>
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function RenewalReminders() {
  // EXAMPLE dates only — a real client's green-card date comes from
  // their case, never from an example. 2021-06-01 is an example date.
  const exampleGreenCardDate = "2021-06-01";
  const n400Date = n400EligibilityDate(exampleGreenCardDate, 5);
  const renewals: RenewalReminder[] = [
    { id: "ren-1", kind: "N-400 eligibility", eligibilityOrExpiryDate: n400Date, remindOn: remind90DaysBefore(n400Date), status: "upcoming" },
    { id: "ren-2", kind: "EAD", eligibilityOrExpiryDate: "2027-03-01", remindOn: remind90DaysBefore("2027-03-01"), status: "upcoming" },
    { id: "ren-3", kind: "Green Card", eligibilityOrExpiryDate: "2031-06-01", remindOn: remind90DaysBefore("2031-06-01"), status: "upcoming" },
  ];
  return (
    <section aria-label="Renewal reminders" className="rounded border border-slate-200 p-3">
      <h4 className="text-sm font-bold">Renewal Reminders — EAD / Green Card / N-400 eligibility date</h4>
      <ul className="mt-2 space-y-1 text-sm">
        {renewals.map((r) => (
          <li key={r.id}>{r.kind}: eligible / expires {r.eligibilityOrExpiryDate} — remind on {r.remindOn} (90 days before) · {r.status}</li>
        ))}
      </ul>
      <p className="mt-1 text-xs text-slate-500">Example dates only. N-400 eligibility here is 5 years after the example green-card date ({exampleGreenCardDate}) — date math only, not legal advice about eligibility.</p>
    </section>
  );
}

export function ReferralTracker() {
  const [referrals, setReferrals] = useState([
    { id: "ref-1", source: "Example community referral (example)", status: "contacted" },
  ]);
  const [source, setSource] = useState("");
  return (
    <section aria-label="Referral tracking" className="rounded border border-slate-200 p-3">
      <h4 className="text-sm font-bold">Referral Tracking</h4>
      <ul className="mt-2 space-y-1 text-sm">
        {referrals.map((r) => (<li key={r.id}>{r.source} — {r.status}</li>))}
      </ul>
      <div className="mt-2 flex gap-2">
        <input value={source} onChange={(e) => setSource(e.target.value)} placeholder="Referral source…" aria-label="Referral source"
          className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1 text-sm" />
        <button type="button" onClick={() => { if (!source.trim()) return; setReferrals((rs) => [...rs, { id: `ref-${Date.now()}`, source: source.trim(), status: "new" }]); setSource(""); }}
          className="rounded bg-slate-900 px-3 py-1 text-xs font-semibold text-white">Add referral</button>
      </div>
      <p className="mt-1 text-xs text-slate-500">Only the referral source and status are tracked here — no referred person's private details are stored without their consent.</p>
    </section>
  );
}

export default function CaseToolsPanel(props: { role: MatrixRole; caseLabel: string }) {
  return (
    <section aria-label={`Case tools — ${props.caseLabel}`} className="space-y-3 rounded-lg border border-slate-300 bg-white p-4 shadow-sm">
      <h3 className="text-base font-semibold">Case Tools — {props.caseLabel}</h3>
      <p className="text-xs text-slate-500">Local / example state only until Supabase is live. Private notes live in preparer_case_notes (migration 0012, provider-only) — never shown to the client. Widening that table beyond preparers needs a founder decision (see migration 0014 header).</p>
      <ContactCardView />
      <PrivateCaseNotes role={props.role} />
      <CaseTaskList />
      <AppointmentBooker />
      <PaymentActions />
      <DocumentRequestCard />
      <ESignStatusCard />
      <InterviewPrepChecklist />
      <RenewalReminders />
      <ReferralTracker />
    </section>
  );
}
