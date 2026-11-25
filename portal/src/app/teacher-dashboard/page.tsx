// /teacher-dashboard — Teacher Dashboard (NEW, Nov 19–20, 2026).
// Teachers / clinic directors confirm their law students here.
// There was no Teacher Dashboard before this: the login mapping and
// the register flow both pointed at /teacher-dashboard, and the
// legal back office showed an example student queue instead.
//
// What it does (real data only, via /api/teacher/students):
//   * Lists the students who named this teacher at registration
//     (matched by teacher_email, migration 0004) — pending first,
//     then confirmed, then rejected.
//   * Confirm / Reject sets ONLY student_profiles.confirmation_status
//     (+ confirmed_at / confirmed_by). It does NOT flip the student's
//     accounts.onboarding_status — that stays with admin verification
//     in /admin/verifications.
//   * A teacher who is not approved yet (verification_status !=
//     'verified') can SEE their students but the Confirm / Reject
//     buttons are disabled until a founder approves the teacher.
//   * A teacher confirms STUDENTS, never cases: students see a case
//     only through an explicit assignment by the case's verified
//     attorney / DOJ provider (migration 0004).
//
// HONEST STATUS: nothing here is live until Supabase is wired and
// the portal is deployed. Until then the page says so and shows an
// honest empty state — no example students are invented (REAL ONLY).
// The caller is identified by their Supabase Auth access token, sent
// as Authorization: Bearer <token> to the API route.
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import LanguagePicker from "@/components/LanguagePicker";
import { getSupabase } from "@/lib/supabase";

type StudentRow = {
  studentAccountId: string;
  fullName: string;
  email: string;
  lawSchool: string;
  year: string;
  clinicName: string | null;
  supervisingAttorneyName: string;
  confirmationStatus: "pending" | "confirmed" | "rejected";
  confirmedAt: string | null;
};

export default function TeacherDashboardPage() {
  const supabaseLive = useMemo(() => getSupabase() !== null, []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [teacherVerified, setTeacherVerified] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<string>("pending");
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    const sb = getSupabase();
    if (!sb) {
      setLoading(false);
      return;
    }
    const { data } = await sb.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      setError("Sign in first — no session was found. Use the Login page.");
      setLoading(false);
      return;
    }
    try {
      const res = await fetch("/api/teacher/students", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        teacher?: { verified: boolean; verificationStatus: string };
        students?: StudentRow[];
      };
      if (!res.ok) {
        setError(body.error ?? "Could not load your students.");
        return;
      }
      setTeacherVerified(body.teacher?.verified ?? false);
      setVerificationStatus(body.teacher?.verificationStatus ?? "pending");
      setStudents(body.students ?? []);
    } catch {
      setError("Could not reach the teacher service. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function decide(studentAccountId: string, action: "confirm" | "reject") {
    setBusyId(studentAccountId);
    setError(null);
    setNote(null);
    const sb = getSupabase();
    const { data } = sb ? await sb.auth.getSession() : { data: { session: null } };
    const token = data.session?.access_token;
    if (!token) {
      setError("Sign in first — no session was found. Use the Login page.");
      setBusyId(null);
      return;
    }
    try {
      const res = await fetch("/api/teacher/students", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ studentAccountId, action }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        note?: string;
      };
      if (!res.ok) {
        setError(body.error ?? "Could not record the decision.");
        return;
      }
      setNote(body.note ?? "Decision recorded.");
      await load();
    } catch {
      setError("Could not reach the teacher service. Check your connection and try again.");
    } finally {
      setBusyId(null);
    }
  }

  const pending = students.filter((s) => s.confirmationStatus === "pending");
  const confirmed = students.filter((s) => s.confirmationStatus === "confirmed");
  const rejected = students.filter((s) => s.confirmationStatus === "rejected");

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Teacher Dashboard — confirm your law students
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Teachers and clinic directors confirm the law students who
            named them at registration. Confirming a student records only
            that you confirmed them — their account still flips to active
            only when an admin verifies them. Questions? Email{" "}
            <a className="text-blue-600 underline" href="mailto:nipteiapp@gmail.com">
              nipteiapp@gmail.com
            </a>{" "}
            or call{" "}
            <a className="text-blue-600 underline" href="tel:+17729716129">
              (772) 971-6129
            </a>
            .
          </p>
        </div>
        <LanguagePicker />
      </header>

      {!supabaseLive && (
        <p className="mb-4 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Example data — not live. Supabase is not connected in this build,
          so no students can be listed yet. No example students are shown —
          the list is empty until the portal is wired to Supabase.
        </p>
      )}

      <section
        aria-label="Your approval status"
        className={`mb-6 rounded border px-4 py-3 text-sm ${
          teacherVerified
            ? "border-green-300 bg-green-50 text-green-900"
            : "border-amber-300 bg-amber-50 text-amber-900"
        }`}
      >
        {loading ? (
          <p>Checking your approval status…</p>
        ) : teacherVerified ? (
          <p>
            <strong>You are approved.</strong> You can confirm or reject
            the students below.
          </p>
        ) : (
          <p>
            <strong>Pending admin approval</strong> (status: {verificationStatus}).
            You can see your students below, but you cannot confirm or
            reject anyone until a founder approves your teacher account in{" "}
            <Link href="/admin/verifications" className="font-semibold underline">
              /admin/verifications
            </Link>
            .
          </p>
        )}
      </section>

      {error && (
        <p className="mb-4 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}
      {note && (
        <p className="mb-4 rounded border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-800">
          {note}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-slate-600">Loading your students…</p>
      ) : (
        <>
          <section aria-label="Students waiting for confirmation" className="mb-8">
            <h2 className="mb-3 text-lg font-semibold text-slate-900">
              Waiting for your confirmation ({pending.length})
            </h2>
            {pending.length === 0 ? (
              <p className="rounded border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
                No students are waiting for you yet. A student appears here
                once they register as a law student and name you (by your
                email) as their teacher.
              </p>
            ) : (
              <ul className="space-y-3">
                {pending.map((s) => (
                  <li
                    key={s.studentAccountId}
                    className="rounded border border-slate-300 bg-white px-4 py-3"
                  >
                    <p className="font-semibold text-slate-900">{s.fullName}</p>
                    <p className="text-sm text-slate-600">
                      {s.lawSchool} · {s.year}
                      {s.clinicName ? ` · ${s.clinicName}` : ""} · Supervising
                      attorney: {s.supervisingAttorneyName}
                    </p>
                    <p className="text-sm text-slate-600">{s.email}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="rounded bg-green-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                        disabled={!teacherVerified || busyId === s.studentAccountId}
                        onClick={() => void decide(s.studentAccountId, "confirm")}
                      >
                        {busyId === s.studentAccountId ? "Recording…" : "Confirm student"}
                      </button>
                      <button
                        type="button"
                        className="rounded border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 disabled:opacity-50"
                        disabled={!teacherVerified || busyId === s.studentAccountId}
                        onClick={() => void decide(s.studentAccountId, "reject")}
                      >
                        Reject
                      </button>
                    </div>
                    {!teacherVerified && (
                      <p className="mt-2 text-xs text-slate-500">
                        Confirm / Reject unlock once a founder approves your
                        teacher account.
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-label="Confirmed students" className="mb-8">
            <h2 className="mb-3 text-lg font-semibold text-slate-900">
              Confirmed ({confirmed.length})
            </h2>
            {confirmed.length === 0 ? (
              <p className="rounded border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
                No confirmed students yet.
              </p>
            ) : (
              <ul className="space-y-2">
                {confirmed.map((s) => (
                  <li
                    key={s.studentAccountId}
                    className="rounded border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700"
                  >
                    <strong className="text-slate-900">{s.fullName}</strong> —{" "}
                    {s.lawSchool} · {s.year}
                    {s.confirmedAt
                      ? ` · confirmed ${new Date(s.confirmedAt).toLocaleDateString("en-US")}`
                      : ""}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-label="Rejected students" className="mb-8">
            <h2 className="mb-3 text-lg font-semibold text-slate-900">
              Rejected ({rejected.length})
            </h2>
            {rejected.length === 0 ? (
              <p className="rounded border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
                No rejected students.
              </p>
            ) : (
              <ul className="space-y-2">
                {rejected.map((s) => (
                  <li
                    key={s.studentAccountId}
                    className="rounded border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700"
                  >
                    <strong className="text-slate-900">{s.fullName}</strong> —{" "}
                    {s.lawSchool} · {s.year} · a founder can review this in{" "}
                    <Link href="/admin/verifications" className="underline">
                      /admin/verifications
                    </Link>
                    .
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      <p className="rounded border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-600">
        Immigration with NIPTEI is not a law firm and is not affiliated with
        USCIS. We provide clerical and educational help only — no approval
        is guaranteed. Only a licensed attorney or a DOJ-Accredited
        Representative can give legal advice or represent a client
        (8 CFR 292.1). A law student works supervised only, and sees a case
        only when the case&apos;s verified attorney or DOJ provider assigns
        it to them.
      </p>

      <footer className="mt-8 text-xs text-slate-500">
        <Link href="/" className="text-blue-600 underline">
          ← Back to home
        </Link>
      </footer>
    </main>
  );
}
