// Interview & Medical Exam appointment card — consular (NVC) cases.
// Every date is entered by the professional/client or left blank —
// NO appointment date is invented. Reminders 24h + 1h are QUEUED
// (appointment_reminders, migration 0014), never claimed sent.
"use client";

import { useState } from "react";
import {
  APPOINTMENT_REMINDER_OFFSETS,
  ORIGINAL_DOCUMENTS_BINDER,
  WHAT_TO_BRING,
  type InterviewMedicalAppointment,
} from "@/lib/booking";

export default function InterviewMedicalCard({
  appointment,
}: {
  appointment: InterviewMedicalAppointment | null;
}) {
  const [embassyPost, setEmbassyPost] = useState(appointment?.embassyPost ?? "");
  const [interviewDate, setInterviewDate] = useState(appointment?.interviewDate ?? "");
  const [vac, setVac] = useState(appointment?.vacAppointment ?? "");
  const [medicalDate, setMedicalDate] = useState(appointment?.medicalExamDate ?? "");
  const [physician, setPhysician] = useState(appointment?.panelPhysician ?? "");
  const [saved, setSaved] = useState<string | null>(null);

  return (
    <section
      aria-labelledby="interview-medical-heading"
      className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
    >
      <h2 id="interview-medical-heading" className="text-base font-semibold">
        Interview &amp; Medical Exam Appointments
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        For consular cases. Enter the dates your embassy and panel
        physician gave you — or leave them blank. No date is filled in
        for you, and no appointment is booked here.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <label className="text-sm">
          <span className="font-medium">Embassy post</span>
          <input
            type="text"
            value={embassyPost}
            onChange={(e) => setEmbassyPost(e.target.value)}
            placeholder="e.g. U.S. Embassy — enter the post from your interview letter"
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
          />
        </label>
        <label className="text-sm">
          <span className="font-medium">Panel physician</span>
          <input
            type="text"
            value={physician}
            onChange={(e) => setPhysician(e.target.value)}
            placeholder="Name from your medical exam instructions"
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
          />
        </label>
        <label className="text-sm">
          <span className="font-medium">Interview date</span>
          <input
            type="date"
            value={interviewDate}
            onChange={(e) => setInterviewDate(e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
          />
        </label>
        <label className="text-sm">
          <span className="font-medium">Medical exam date</span>
          <input
            type="date"
            value={medicalDate}
            onChange={(e) => setMedicalDate(e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
          />
        </label>
        <label className="text-sm sm:col-span-2">
          <span className="font-medium">VAC appointment (Visa Application Centre)</span>
          <input
            type="text"
            value={vac}
            onChange={(e) => setVac(e.target.value)}
            placeholder="Date/time from your VAC confirmation — leave blank if none yet"
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
          />
        </label>
      </div>
      <button
        type="button"
        onClick={() =>
          setSaved(
            "Dates noted on this screen only (example — local only). Nothing was booked and no reminder was sent: reminders are queued 24h + 1h before an appointment only once a real date is saved to the case, and Twilio/Resend are NOT connected."
          )
        }
        className="mt-2 rounded bg-slate-900 px-3 py-1 text-sm font-semibold text-white"
      >
        Save dates (example — local only)
      </button>
      {saved && (
        <p className="mt-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {saved}
        </p>
      )}
      <p className="mt-3 text-sm">
        <strong>Reminders:</strong>{" "}
        {APPOINTMENT_REMINDER_OFFSETS.map((o) => o.label).join(" + ")} before
        each appointment — queued, not sent (no message provider connected).
      </p>
      <h3 className="mt-3 text-sm font-semibold">
        Original-documents binder — bring the original of everything
      </h3>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
        {ORIGINAL_DOCUMENTS_BINDER.map((d) => (
          <li key={d}>{d}</li>
        ))}
      </ul>
      <h3 className="mt-3 text-sm font-semibold">What to bring</h3>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
        {WHAT_TO_BRING.map((d) => (
          <li key={d}>{d}</li>
        ))}
      </ul>
    </section>
  );
}
