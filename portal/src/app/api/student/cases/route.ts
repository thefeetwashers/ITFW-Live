// GET /api/student/cases — the signed-in law student's ASSIGNED cases
// only, plus their supervisor.
//
// A supervised student sees a case ONLY through an explicit assignment
// by the case's verified attorney / DOJ provider
// (public.case_student_assignments, migration 0004). There is no
// general case list here: a student never sees unassigned cases.
//
// Gates (checked here, server-side, every call):
//   * Caller identified by Supabase Auth access token (Bearer) —
//     never by an account id in the request.
//   * Caller role must be "law_student" (403 otherwise).
//   * Only rows in case_student_assignments for this student's
//     accounts.id are returned, joined to public.cases (forms,
//     status, assigned provider role).
//   * The supervisor is read from the student's own
//     student_profiles row — never invented.
//
// Until Supabase env vars are set this route returns 501 and reads
// nothing. No keys in code.
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const NOT_CONFIGURED = {
  error:
    "Student dashboard not configured — Supabase env vars are not set, so no cases were read. Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY, and run migrations 0001–0004 first.",
};

function clients() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceKey) return null;
  return {
    anon: createClient(url, anonKey, { auth: { persistSession: false } }),
    admin: createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
  };
}

export async function GET(req: Request) {
  const cs = clients();
  if (!cs) {
    return NextResponse.json(NOT_CONFIGURED, { status: 501 });
  }
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) {
    return NextResponse.json(
      { error: "Sign in first — no access token was sent." },
      { status: 401 }
    );
  }
  const { data: userData, error: userError } = await cs.anon.auth.getUser(token);
  if (userError || !userData.user) {
    return NextResponse.json(
      { error: "Your login could not be verified. Sign in again." },
      { status: 401 }
    );
  }
  const { data: account, error: accountError } = await cs.admin
    .from("accounts")
    .select("id, role, verification_status, is_verified")
    .eq("auth_user_id", userData.user.id)
    .maybeSingle();
  if (accountError || !account) {
    return NextResponse.json(
      { error: "No Immigration account exists for this login." },
      { status: 403 }
    );
  }
  const student = account as {
    id: string;
    role: string;
    verification_status: string;
    is_verified: boolean;
  };
  if (student.role !== "law_student") {
    return NextResponse.json(
      { error: "Only a law student account can open the Law Student Dashboard." },
      { status: 403 }
    );
  }

  // Supervisor + confirmation state, from the student's own profile.
  const { data: profile } = await cs.admin
    .from("student_profiles")
    .select(
      "law_school, year, supervising_attorney_name, supervising_attorney_bar_number, teacher_name, teacher_email, confirmation_status"
    )
    .eq("account_id", student.id)
    .maybeSingle();
  const profileRow = (profile ?? null) as {
    law_school?: string;
    year?: string;
    supervising_attorney_name?: string;
    supervising_attorney_bar_number?: string | null;
    teacher_name?: string | null;
    teacher_email?: string;
    confirmation_status?: string;
  } | null;

  // Assigned cases only — never the full case list.
  const { data: assignments, error: assignmentsError } = await cs.admin
    .from("case_student_assignments")
    .select("case_id, assigned_by, supervisor_name, created_at")
    .eq("student_id", student.id)
    .order("created_at", { ascending: true });
  if (assignmentsError) {
    return NextResponse.json(
      {
        error: `Could not read your assigned cases: ${assignmentsError.message}. Migration 0004 may not have run yet.`,
      },
      { status: 500 }
    );
  }
  const rows = (assignments ?? []) as Array<Record<string, unknown>>;
  const caseIds = rows.map((r) => r.case_id as string);
  let casesById: Record<string, { forms: string[]; status: string }> = {};
  if (caseIds.length > 0) {
    const { data: cases } = await cs.admin
      .from("cases")
      .select("id, forms, status")
      .in("id", caseIds);
    for (const c of (cases ?? []) as Array<Record<string, unknown>>) {
      casesById[c.id as string] = {
        forms: (c.forms as string[]) ?? [],
        status: c.status as string,
      };
    }
  }

  return NextResponse.json({
    student: {
      verified: student.verification_status === "verified" && student.is_verified,
      verificationStatus: student.verification_status,
      lawSchool: profileRow?.law_school ?? null,
      year: profileRow?.year ?? null,
      confirmationStatus: profileRow?.confirmation_status ?? "pending",
    },
    supervisor: {
      name: profileRow?.supervising_attorney_name ?? null,
      barNumber: profileRow?.supervising_attorney_bar_number ?? null,
      teacherName: profileRow?.teacher_name ?? null,
      teacherEmail: profileRow?.teacher_email ?? null,
    },
    cases: rows.map((r) => ({
      caseId: r.case_id,
      forms: casesById[r.case_id as string]?.forms ?? [],
      status: casesById[r.case_id as string]?.status ?? "unknown",
      assignedBy: r.assigned_by,
      supervisorName: r.supervisor_name,
      assignedAt: r.created_at,
    })),
  });
}
