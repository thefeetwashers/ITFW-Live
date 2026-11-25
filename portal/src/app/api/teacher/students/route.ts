// Teacher students API — /api/teacher/students
// GET  — the signed-in teacher's law students (matched by the
//        teacher_email the student entered at registration,
//        student_profiles.teacher_email, migration 0004). Returns the
//        teacher's own verification state plus every student row.
// POST — { studentAccountId, action: "confirm" | "reject" } — sets
//        ONLY student_profiles.confirmation_status (+ confirmed_at /
//        confirmed_by). It does NOT flip the student's
//        accounts.onboarding_status — that stays with admin verification
//        in /admin/verifications.
//
// Gates (checked here, server-side, every call):
//   * The caller is identified by their Supabase Auth access token
//     (Authorization: Bearer <token>) — never by an account id in
//     the request body. The token is verified with the anon client,
//     then the account is read with the service-role client.
//   * Caller role must be "teacher" (403 otherwise).
//   * POST additionally requires the teacher to be approved:
//     accounts.verification_status = 'verified' (is_verified true).
//     A pending teacher can SEE their students but cannot confirm or
//     reject anyone — the buttons stay disabled until a founder
//     approves the teacher in /admin/verifications.
//   * The student row must belong to this teacher (teacher_email =
//     the teacher's own accounts.email, citext match) and must still
//     be 'pending' — only a pending confirmation can transition.
//
// Until Supabase env vars are set this route returns 501 and reads /
// writes nothing. No keys in code; values come from Vercel / .env.local.
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const NOT_CONFIGURED = {
  error:
    "Teacher dashboard not configured — Supabase env vars are not set, so no students were read. Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY, and run migrations 0001–0004 first.",
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

function notConfigured() {
  return NextResponse.json(NOT_CONFIGURED, { status: 501 });
}

type TeacherAccount = {
  id: string;
  role: string;
  email: string;
  verification_status: string;
  is_verified: boolean;
};

// Identify the caller from their Supabase Auth access token. Returns
// null (with the response to send) when the token is missing/invalid
// or the account is not a teacher.
async function getTeacher(
  req: Request
): Promise<
  | { teacher: TeacherAccount }
  | { response: NextResponse }
> {
  const cs = clients();
  if (!cs) return { response: notConfigured() };
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) {
    return {
      response: NextResponse.json(
        { error: "Sign in first — no access token was sent." },
        { status: 401 }
      ),
    };
  }
  const { data: userData, error: userError } = await cs.anon.auth.getUser(token);
  if (userError || !userData.user) {
    return {
      response: NextResponse.json(
        { error: "Your login could not be verified. Sign in again." },
        { status: 401 }
      ),
    };
  }
  const { data: account, error: accountError } = await cs.admin
    .from("accounts")
    .select("id, role, email, verification_status, is_verified")
    .eq("auth_user_id", userData.user.id)
    .maybeSingle();
  if (accountError || !account) {
    return {
      response: NextResponse.json(
        { error: "No Immigration account exists for this login." },
        { status: 403 }
      ),
    };
  }
  const teacher = account as TeacherAccount;
  if (teacher.role !== "teacher") {
    return {
      response: NextResponse.json(
        { error: "Only a teacher account can open the Teacher Dashboard." },
        { status: 403 }
      ),
    };
  }
  return { teacher };
}

export async function GET(req: Request) {
  const found = await getTeacher(req);
  if ("response" in found) return found.response;
  const { teacher } = found;
  const cs = clients();
  if (!cs) return notConfigured();

  // Students are linked to the teacher by the email the student typed
  // at registration (student_profiles.teacher_email, citext — case
  // does not matter). There is no teacher_account_id column.
  const { data: profiles, error: profilesError } = await cs.admin
    .from("student_profiles")
    .select(
      "account_id, law_school, year, school_id, supervising_attorney_name, clinic_name, teacher_name, confirmation_status, confirmed_at, confirmed_by"
    )
    .eq("teacher_email", teacher.email)
    .order("created_at", { ascending: true });
  if (profilesError) {
    return NextResponse.json(
      {
        error: `Could not read your students: ${profilesError.message}. Migration 0004 may not have run yet.`,
      },
      { status: 500 }
    );
  }
  const rows = (profiles ?? []) as Array<Record<string, unknown>>;
  // Names come from the students' own accounts rows — never invented.
  const ids = rows.map((r) => r.account_id as string);
  let names: Record<string, { full_name: string; email: string }> = {};
  if (ids.length > 0) {
    const { data: accounts } = await cs.admin
      .from("accounts")
      .select("id, full_name, email")
      .in("id", ids);
    for (const a of (accounts ?? []) as Array<Record<string, unknown>>) {
      names[a.id as string] = {
        full_name: a.full_name as string,
        email: a.email as string,
      };
    }
  }
  return NextResponse.json({
    teacher: {
      verified: teacher.verification_status === "verified" && teacher.is_verified,
      verificationStatus: teacher.verification_status,
    },
    students: rows.map((r) => ({
      studentAccountId: r.account_id,
      fullName: names[r.account_id as string]?.full_name ?? "Name not on file",
      email: names[r.account_id as string]?.email ?? "",
      lawSchool: r.law_school,
      year: r.year,
      clinicName: r.clinic_name,
      supervisingAttorneyName: r.supervising_attorney_name,
      confirmationStatus: r.confirmation_status,
      confirmedAt: r.confirmed_at,
    })),
  });
}

export async function POST(req: Request) {
  const found = await getTeacher(req);
  if ("response" in found) return found.response;
  const { teacher } = found;
  const cs = clients();
  if (!cs) return notConfigured();

  // Confirming / rejecting is an approval action: only a verified
  // (founder-approved) teacher may do it.
  if (!(teacher.verification_status === "verified" && teacher.is_verified)) {
    return NextResponse.json(
      {
        error:
          "Your teacher account is not approved yet — a founder must approve it in /admin/verifications before you can confirm or reject students.",
      },
      { status: 403 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const studentAccountId =
    typeof body.studentAccountId === "string" ? body.studentAccountId : "";
  const action = typeof body.action === "string" ? body.action : "";
  if (!studentAccountId) {
    return NextResponse.json({ error: "studentAccountId is required." }, { status: 400 });
  }
  if (action !== "confirm" && action !== "reject") {
    return NextResponse.json(
      { error: 'action must be "confirm" or "reject".' },
      { status: 400 }
    );
  }

  // The student must be one of THIS teacher's students and still
  // pending — a confirmed / rejected student cannot be re-decided
  // here; that goes back to a founder in /admin/verifications.
  const { data: profile, error: profileError } = await cs.admin
    .from("student_profiles")
    .select("account_id, teacher_email, confirmation_status")
    .eq("account_id", studentAccountId)
    .maybeSingle();
  if (profileError || !profile) {
    return NextResponse.json(
      { error: "That student was not found." },
      { status: 404 }
    );
  }
  const row = profile as {
    teacher_email: string;
    confirmation_status: string;
  };
  if (row.teacher_email.toLowerCase() !== teacher.email.toLowerCase()) {
    return NextResponse.json(
      { error: "That student is not assigned to you." },
      { status: 403 }
    );
  }
  if (row.confirmation_status !== "pending") {
    return NextResponse.json(
      {
        error: `That student is already ${row.confirmation_status} — a decided confirmation cannot be changed here.`,
      },
      { status: 409 }
    );
  }

  // Only confirmation_status (+ confirmed_at / confirmed_by) changes.
  // The student's accounts.onboarding_status is NOT touched — it flips
  // only when an admin verifies the student in /admin/verifications.
  const patch: Record<string, unknown> = {
    confirmation_status: action === "confirm" ? "confirmed" : "rejected",
    confirmed_by: teacher.id,
  };
  if (action === "confirm") patch.confirmed_at = new Date().toISOString();
  const { error: updateError } = await cs.admin
    .from("student_profiles")
    .update(patch)
    .eq("account_id", studentAccountId)
    .eq("confirmation_status", "pending");
  if (updateError) {
    return NextResponse.json(
      { error: `Could not record the decision: ${updateError.message}` },
      { status: 500 }
    );
  }
  return NextResponse.json({
    ok: true,
    studentAccountId,
    confirmationStatus: action === "confirm" ? "confirmed" : "rejected",
    note:
      action === "confirm"
        ? "Student confirmed. Their onboarding status still flips only when an admin verifies them in /admin/verifications."
        : "Student rejected. They stay pending with the admin — a founder can review this in /admin/verifications.",
  });
}
