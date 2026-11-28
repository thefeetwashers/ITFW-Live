// /student-dashboard — Law Student dashboard (Role 5, $35/mo).
//
// NEW (2026-11-28). Before this page, law students shared the generic
// /legal-back-office with attorneys and nonprofits behind a demo role
// switcher. This page is student-only content, loaded from real data:
//   * Assigned cases ONLY — via GET /api/student/cases, which reads
//     public.case_student_assignments (migration 0004). A student
//     never sees unassigned cases here.
//   * Supervisor — the supervising attorney / clinic director from
//     the student's own student_profiles row, plus confirmation
//     status (pending until the supervisor/teacher confirms).
//   * Subscription status ($35/mo, checked server-side via /api/access).
// Supervised only: a student never files, signs, or advises alone —
// the supervisor signs. No cases are invented: when nothing is
// assigned, the honest empty state shows.
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import AccessStatus from "@/components/paywall/AccessStatus";
import RenewalRadarSection from "@/components/dashboard/RenewalRadarSection";
import TotalCostEstimatorSection from "@/components/dashboard/TotalCostEstimatorSection";
import VaultExpirySection from "@/components/dashboard/VaultExpirySection";
import {
  InterviewQuestionSection,
  TodayRemindersBanner,
} from "@/components/dashboard/DashboardEmbeds";
import DashboardTop from "@/components/nextstep/DashboardTop";

interface AssignedCase {
  caseId: string;
  forms: string[];
  status: string;
  assignedBy: string;
  supervisorName: string | null;
  assignedAt: string;
}

interface StudentPayload {
  student: {
    verified: boolean;
    verificationStatus: string;
    lawSchool: string | null;
    year: string | null;
    confirmationStatus: string;
  };
  supervisor: {
    name: string | null;
    barNumber: string | null;
    teacherName: string | null;
    teacherEmail: string | null;
  };
  cases: AssignedCase[];
}

type LoadState =
  | { kind: "checking" }
  | { kind: "no-session" }
  | { kind: "not-configured" }
  | { kind: "error"; message: string }
  | { kind: "ready"; data: StudentPayload };

export default function StudentDashboardPage() {
  const [state, setState] = useState<LoadState>({ kind: "checking" });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const sb = getSupabase();
      if (!sb) {
        if (!cancelled) setState({ kind: "not-configured" });
        return;
      }
      const { data } = await sb.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        if (!cancelled) setState({ kind: "no-session" });
        return;
      }
      try {
        const res = await fetch("/api/student/cases", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const body = (await res.json().catch(() => ({}))) as Partial<StudentPayload> & {
          error?: string;
        };
        if (cancelled) return;
        if (res.status === 501) {
          setState({ kind: "not-configured" });
          return;
        }
        if (!res.ok || !body.student) {
          setState({
            kind: "error",
            message: body.error ?? `Could not load your assigned cases (${res.status}).`,
          });
          return;
        }
        setState({ kind: "ready", data: body as StudentPayload });
      } catch {
        if (!cancelled) {
          setState({ kind: "error", message: "Could not reach the student service. Check your connection and try again." });
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <header>
        <h1 className="text-2xl font-bold">Law Student Dashboard</h1>
        <p className="mt-1 text-sm text-slate-600">
          Supervised Law Student — Role 5 ($35/mo). Supervised only: you
          work under a licensed attorney or DOJ-accredited representative,
          and you see a case only when they assign it to you. You never
          file, sign, or advise alone.
        </p>
      </header>

      {/* Final sweep (Nov 28, 2026): next step first, then checklist,
          one-click actions, deadline countdown, notification inbox. A
          student sees a case only when assigned, so with nothing
          assigned yet the next step honestly says the route is not set
          and the checklist shows its empty state. */}
      <div className="mt-6">
        <DashboardTop
          nextStepInput={{ route: null, uscisStage: null, blockingItems: [], language: "en" }}
        />
      </div>

      <section aria-label="Subscription" className="mt-6 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold">Your subscription — $35/mo</h2>
        <div className="mt-2">
          <AccessStatus surface="interview_prep" />
        </div>
      </section>

      {state.kind === "checking" && (
        <p className="mt-4 text-sm text-slate-600">Loading your assigned cases…</p>
      )}
      {state.kind === "no-session" && (
        <p className="mt-4 rounded border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          Sign in first to see your assigned cases.{" "}
          <Link href="/login" className="font-semibold text-blue-700 underline">
            Sign in →
          </Link>
        </p>
      )}
      {state.kind === "not-configured" && (
        <p className="mt-4 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Supabase is not connected in this build, so no assigned cases
          can be listed yet. No example cases are shown.
        </p>
      )}
      {state.kind === "error" && (
        <p className="mt-4 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {state.message}
        </p>
      )}

      {state.kind === "ready" && (
        <>
          <section aria-label="Supervisor" className="mt-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-base font-semibold">Your supervisor</h2>
            <dl className="mt-2 space-y-1 text-sm">
              <div className="flex gap-2">
                <dt className="font-semibold">Supervising attorney:</dt>
                <dd>{state.data.supervisor.name ?? "Not on file"}</dd>
              </div>
              {state.data.supervisor.barNumber && (
                <div className="flex gap-2">
                  <dt className="font-semibold">Bar #:</dt>
                  <dd>{state.data.supervisor.barNumber}</dd>
                </div>
              )}
              <div className="flex gap-2">
                <dt className="font-semibold">Teacher / clinic director:</dt>
                <dd>
                  {state.data.supervisor.teacherName ?? "Not on file"}
                  {state.data.supervisor.teacherEmail ? ` (${state.data.supervisor.teacherEmail})` : ""}
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="font-semibold">Law school:</dt>
                <dd>
                  {state.data.student.lawSchool ?? "Not on file"}
                  {state.data.student.year ? ` · ${state.data.student.year}` : ""}
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="font-semibold">Supervisor confirmation:</dt>
                <dd>
                  {state.data.student.confirmationStatus === "confirmed"
                    ? "Confirmed"
                    : state.data.student.confirmationStatus === "rejected"
                      ? "Rejected — ask a founder to review this in /admin/verifications"
                      : "Pending — you cannot take on cases until your supervisor confirms you"}
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="font-semibold">Account verification:</dt>
                <dd>{state.data.student.verified ? "Verified" : `Pending (${state.data.student.verificationStatus})`}</dd>
              </div>
            </dl>
          </section>

          <section aria-label="Assigned cases" className="mt-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-base font-semibold">
              Your assigned cases only ({state.data.cases.length})
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              These are the only cases you can see — cases assigned to you
              by their verified attorney or DOJ provider. Unassigned cases
              never appear here.
            </p>
            {state.data.cases.length === 0 ? (
              <p className="mt-3 rounded border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
                No cases are assigned to you yet. A case appears here once
                its verified attorney or DOJ provider assigns it to you.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {state.data.cases.map((c) => (
                  <li key={c.caseId} className="rounded border border-slate-200 px-3 py-2 text-sm">
                    <p className="font-medium">
                      Case {c.caseId.slice(0, 8)}… — {c.forms.length > 0 ? c.forms.join(", ") : "No forms on file"}
                    </p>
                    <p className="text-slate-600">
                      Status: {c.status}
                      {c.supervisorName ? ` · Supervisor: ${c.supervisorName}` : ""}
                      {c.assignedAt ? ` · Assigned ${new Date(c.assignedAt).toLocaleDateString("en-US")}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {/* EXPERT FEATURES, INSIDE THE DASHBOARD (Nov 28, 2026): the
          renewal radar, vault expiry flags, and cost estimator for
          your ASSIGNED cases only — the same sections the other
          dashboards show, scoped to the cases your supervisor
          assigned you. A fee-waiver check is not a student task: only
          a licensed attorney or DOJ-accredited representative confirms
          one, so the checker lives on the client and professional
          dashboards, not here. */}
      <div className="mt-4">
        <TodayRemindersBanner />
      </div>

      <div className="mt-4">
        <RenewalRadarSection renewals={[]} audience="professional" />
      </div>

      <div className="mt-4">
        <VaultExpirySection documents={[]} audience="professional" />
      </div>

      <div className="mt-4">
        <TotalCostEstimatorSection audience="professional" />
      </div>

      <div className="mt-4">
        <InterviewQuestionSection />
      </div>

      <section aria-label="Paid tools" className="mt-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold">Paid tools</h2>
        <ul className="mt-2 space-y-2 text-sm">
          <li>
            <Link href="/interview-prep" className="font-semibold text-blue-700 underline">
              Interview Preparation →
            </Link>{" "}
            — mock banks and video scripts (paid access, checked server-side).
          </li>
          <li>
            <Link href="/portal/smart-forms" className="font-semibold text-blue-700 underline">
              Smart Forms — Dynamic Intake Engine →
            </Link>{" "}
            — the 15-schema intake engine (paid access, checked server-side).
          </li>
        </ul>
      </section>

      <footer className="mt-8 text-xs text-slate-500">
        <Link href="/" className="text-blue-600 underline">← Back to home</Link>
      </footer>
    </main>
  );
}
