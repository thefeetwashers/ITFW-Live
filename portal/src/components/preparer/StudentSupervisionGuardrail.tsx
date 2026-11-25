// Law-student supervision guardrail — preparer dashboard.
// ENFORCED RULE: a Document Preparer CANNOT supervise a law student,
// CANNOT assign a case to a student, and CANNOT approve a student draft
// for legal content. A preparer CAN receive clerical help from a student
// ONLY if that student was assigned + supervised by a VERIFIED attorney
// or DOJ representative on that case. This component states the rule and
// gates the only thing a preparer may do: request clerical help on a
// case where a verified attorney/DOJ supervisor is already recorded.
// (Schema: migration 0004 case_student_assignments. There is NO
// preparer_student_help_requests table — a preparer's help request is
// local-only example state in this component; the supervisor
// requirement is enforced here, by refusing to log a request with no
// supervisor named. Do not invent the table.)
"use client";

import { useState } from "react";

export default function StudentSupervisionGuardrail() {
  const [supervisor, setSupervisor] = useState("");
  const [request, setRequest] = useState("");
  const [log, setLog] = useState<string[]>([]);
  const [denied, setDenied] = useState<string | null>(null);

  const askForHelp = () => {
    if (!supervisor.trim()) {
      setDenied(
        "DENIED — no verified attorney / DOJ supervisor named for this case. A preparer cannot assign a case to a student or supervise one. Name the verified attorney / DOJ representative who assigned + supervises the student on this case first."
      );
      return;
    }
    if (!request.trim()) return;
    setDenied(null);
    setLog((l) => [
      ...l,
      `Clerical-help request (example — local only): “${request.trim()}” — student supervised by verified attorney/DOJ: ${supervisor.trim()}. Preparer did NOT assign the student and does NOT approve legal content.`,
    ]);
    setRequest("");
  };

  return (
    <section
      aria-labelledby="student-guardrail-heading"
      className="rounded-lg border border-red-300 bg-white p-4 shadow-sm"
    >
      <h2 id="student-guardrail-heading" className="text-lg font-semibold">
        Supervised Law Students — What a Preparer May NOT Do
      </h2>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
        <li>
          <strong>A preparer CANNOT supervise a law student.</strong>
        </li>
        <li>
          <strong>A preparer CANNOT assign a case to a student.</strong>
        </li>
        <li>
          <strong>A preparer CANNOT approve a student draft for legal content.</strong>{" "}
          Legal content is approved by the supervising attorney / DOJ
          representative only.
        </li>
        <li>
          A preparer CAN receive clerical help from a student ONLY if that
          student was assigned + supervised by a VERIFIED attorney or DOJ
          representative on that case.
        </li>
      </ul>

      <label className="mt-3 block text-sm">
        <span className="font-medium">
          Verified attorney / DOJ supervisor on this case (required — the person who assigned + supervises the student)
        </span>
        <input
          type="text"
          value={supervisor}
          onChange={(e) => setSupervisor(e.target.value)}
          placeholder="Example: Example Attorney A — verification pending in this example"
          className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
        />
      </label>
      <label className="mt-3 block text-sm">
        <span className="font-medium">Clerical help requested (filing papers, organising documents — never legal content)</span>
        <input
          type="text"
          value={request}
          onChange={(e) => setRequest(e.target.value)}
          placeholder="Example: organise the I-130 evidence binder"
          className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
        />
      </label>
      <button
        type="button"
        onClick={askForHelp}
        className="mt-2 rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white"
      >
        Request clerical help from the supervised student (example)
      </button>
      {denied && (
        <p role="alert" className="mt-2 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm font-semibold text-red-900">
          {denied}
        </p>
      )}
      {log.length > 0 && (
        <ul className="mt-2 space-y-1">
          {log.map((entry, i) => (
            <li key={i} className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm">{entry}</li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-xs text-slate-500">
        Student assignment itself lives in migration 0004
        (case_student_assignments) and is attorney/DOJ-only. This page
        never creates an assignment.
      </p>
    </section>
  );
}
