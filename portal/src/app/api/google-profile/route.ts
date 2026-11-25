// POST /api/google-profile — complete the profile of a user who
// signed in with Google and has NO account row yet.
//
// Why this route exists (instead of reusing /api/register-role):
// /api/register-role creates the Supabase Auth user with a password.
// A Google user ALREADY has an Auth user (created by Supabase Auth
// during Google sign-in, matched by email) — creating another one
// would fail, and asking a Google user for a portal password would
// store a password Google users must never need. So this route
// creates ONLY the profile rows, for the already-signed-in user.
//
// SECURITY
//   * Caller must send their Supabase access token as
//     `Authorization: Bearer <token>`. The token is verified with
//     supabase.auth.getUser() — the auth_user_id used here comes
//     from that verification, never from the request body. The token
//     is NEVER logged.
//   * body.email must equal the verified token email.
//   * If an accounts row already exists for this auth_user_id, the
//     route returns 409 and writes NOTHING — no duplicate account.
//   * is_verified is ALWAYS false; is_published is ALWAYS false
//     (listing flips only via the Stripe webhook + admin approval,
//     same as /api/register-role). onboarding_status follows the
//     same ladder: client → active; preparer → profile_completed;
//     attorney / nonprofit / student / teacher → pending_verification.
//     Teacher writes public.teacher_profiles (migration 0004) and
//     stays pending until an admin approves them — a teacher must
//     never be able to confirm students without admin approval, or
//     anyone could self-confirm as a "teacher" and approve their
//     own student account.
//   * No password is accepted or stored here.
//
// SKELETON / NOT LIVE until env vars are set — returns 501 then and
// creates nothing. No keys in code; values come from Vercel / .env.local.
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

type GoogleRole =
  | "client"
  | "preparer"
  | "attorney"
  | "nonprofit"
  | "student"
  | "teacher";

const SUBSCRIPTION_PLAN: Record<
  Exclude<GoogleRole, "client" | "teacher">,
  string
> = {
  preparer: "preparer_pro_49",
  attorney: "attorney_pro_99",
  nonprofit: "nonprofit_standard_24_50",
  student: "law_student_35",
};

const SLUG_RE = /^[a-z0-9][a-z0-9-]{2,60}$/;

function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function asStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(asString).filter(Boolean);
  const s = asString(v);
  return s ? s.split(",").map((x) => x.trim()).filter(Boolean) : [];
}

export async function POST(req: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return NextResponse.json(
      {
        error:
          "Supabase not configured — NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are not set. No account was created and nothing was written.",
      },
      { status: 501 }
    );
  }

  // Verify the caller's Google session. The token itself is never logged.
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) {
    return NextResponse.json(
      { error: "A Google sign-in session is required. Sign in with Google first, then choose your role." },
      { status: 401 }
    );
  }
  const authed = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: userData, error: userError } = await authed.auth.getUser(token);
  if (userError || !userData.user) {
    return NextResponse.json(
      { error: "Your Google session could not be verified. Sign in with Google again, then choose your role." },
      { status: 401 }
    );
  }
  const authUserId = userData.user.id;
  const tokenEmail = (userData.user.email ?? "").toLowerCase();

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const role = asString(body.role) as GoogleRole;
  const roles: GoogleRole[] = [
    "client",
    "preparer",
    "attorney",
    "nonprofit",
    "student",
    "teacher",
  ];
  if (!roles.includes(role)) {
    return NextResponse.json(
      { error: "role is required and must be one of: client, preparer, attorney, nonprofit, student, teacher." },
      { status: 400 }
    );
  }
  const fullName = asString(body.fullName);
  const email = asString(body.email);
  const phone = asString(body.phone);
  const preferredLanguage = asString(body.preferredLanguage) || "en";

  const errors: string[] = [];
  if (!fullName) errors.push("Full name (or organization name) is required.");
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push("A valid email is required.");
  // The profile email must be the Google-verified email — nobody may
  // complete a profile for someone else's address.
  if (email && email.toLowerCase() !== tokenEmail)
    errors.push("The email must match the Google account you signed in with.");

  const slug = asString(body.slug);
  const barNumber = asString(body.barNumber);
  const barStates = asStringArray(body.barStates);
  const orgName = asString(body.orgName) || fullName;
  const eoirNumber = asString(body.eoirNumber);
  const accreditationTier = asString(body.accreditationTier);
  const accreditationExpiry = asString(body.accreditationExpiry);
  const dojRecognitionDate = asString(body.dojRecognitionDate);
  const nonprofitPlan = asString(body.nonprofitPlan) || "standard";
  const lawSchool = asString(body.lawSchool);
  const studentYear = asString(body.year);
  const schoolId = asString(body.schoolId);
  const supervisorName = asString(body.supervisorName);
  const supervisorEmail = asString(body.supervisorEmail);
  const supervisingAttorneyName = asString(body.supervisingAttorneyName);
  const supervisingAttorneyBarNumber = asString(body.supervisingAttorneyBarNumber);
  const teacherName = asString(body.teacherName) || supervisorName;
  const teacherEmail = asString(body.teacherEmail) || supervisorEmail;
  // Teacher / Clinic Director profile fields (role "teacher" only).
  const schoolName = asString(body.schoolName);
  const teacherTitle = asString(body.title);

  if (role === "preparer" || role === "attorney" || role === "nonprofit") {
    if (!slug || !SLUG_RE.test(slug))
      errors.push("Public profile slug is required: 3–61 chars, lowercase letters, numbers and hyphens only (immigration.niptei.com/p/<slug>).");
    if (role === "preparer" && body.uplAgreed !== true)
      errors.push("The UPL (Unauthorized Practice of Law) agreement must be accepted.");
  }
  if (role === "attorney") {
    if (!barNumber) errors.push("State Bar # is required for attorneys.");
    if (barStates.length === 0) errors.push("Jurisdiction (state(s) admitted) is required for attorneys.");
  }
  if (role === "nonprofit") {
    if (!orgName) errors.push("Organization name is required.");
    if (!dojRecognitionDate) errors.push("DOJ recognition date is required.");
    if (!eoirNumber) errors.push("EOIR number is required.");
    if (accreditationTier !== "partial" && accreditationTier !== "full")
      errors.push("Accreditation tier is required: Partial (DHS/USCIS & NVC only) or Full (USCIS and Court).");
    if (!accreditationExpiry) errors.push("Accreditation expiry date is required.");
    if (nonprofitPlan !== "standard" && nonprofitPlan !== "full")
      errors.push("Nonprofit plan is required: standard ($24.50/mo) or full ($49.50/mo).");
  }
  if (role === "student") {
    if (!lawSchool) errors.push("Law school is required.");
    if (!["1L", "2L", "3L"].includes(studentYear)) errors.push("Year is required: 1L, 2L or 3L.");
    if (!schoolId) errors.push("School ID is required.");
    if (!supervisorName) errors.push("Supervisor / clinic director name is required.");
    if (!supervisorEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supervisorEmail))
      errors.push("A valid supervisor / clinic director email is required.");
    if (body.studentRulesAgreed !== true)
      errors.push("The supervised-only student rules must be agreed to.");
  }
  if (role === "teacher") {
    if (!schoolName) errors.push("School / clinic is required.");
    if (!teacherTitle) errors.push("Title is required (e.g. Clinical Professor, Clinic Director).");
  }
  if (errors.length > 0) {
    return NextResponse.json({ error: "Validation failed.", errors }, { status: 400 });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // No duplicate account: one accounts row per Auth user, ever.
  const { data: existing } = await admin
    .from("accounts")
    .select("id")
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  if (existing) {
    return NextResponse.json(
      {
        error:
          "An account already exists for this Google sign-in. Do not re-register — log in instead. No duplicate account was created.",
      },
      { status: 409 }
    );
  }

  const accountRole = role === "student" ? "law_student" : role;
  const onboardingStatus =
    role === "client"
      ? "active"
      : role === "preparer"
        ? "profile_completed"
        : "pending_verification";
  const verificationStatus = role === "client" ? "not_required" : "pending";

  const { data: account, error: accountError } = await admin
    .from("accounts")
    .insert({
      auth_user_id: authUserId,
      role: accountRole,
      full_name: fullName,
      email,
      phone: phone || null,
      preferred_language: preferredLanguage,
      is_verified: false,
      verification_status: verificationStatus,
      onboarding_status: onboardingStatus,
    })
    .select("id")
    .single();
  if (accountError || !account) {
    return NextResponse.json(
      { error: `Account row could not be written to public.accounts: ${accountError?.message ?? "unknown error"}.` },
      { status: 500 }
    );
  }
  const accountId = (account as { id: string }).id;

  if (role === "preparer" || role === "attorney" || role === "nonprofit") {
    const plan =
      role === "nonprofit"
        ? nonprofitPlan === "full"
          ? "nonprofit_full_49_50"
          : "nonprofit_standard_24_50"
        : SUBSCRIPTION_PLAN[role];
    const { error: profileError } = await admin.from("professional_profiles").insert({
      account_id: accountId,
      role,
      company_name: role === "nonprofit" ? orgName : null,
      slug,
      is_published: false,
      bar_number: role === "attorney" ? barNumber : null,
      bar_states: role === "attorney" ? barStates : [],
      eoir_number: role === "nonprofit" ? eoirNumber : null,
      accreditation_level:
        role === "nonprofit"
          ? accreditationTier === "full"
            ? "full_uscis_and_court"
            : "partial_uscis_only"
          : null,
      accreditation_expiry: role === "nonprofit" ? accreditationExpiry : null,
      subscription_plan: plan,
      subscription_status: "none",
    });
    if (profileError) {
      return NextResponse.json(
        {
          error: `Professional profile could not be written to public.professional_profiles: ${profileError.message}. Your account exists (id ${accountId}) — ask the admin to finish the profile; do not re-register with the same email.`,
          accountId,
        },
        { status: 500 }
      );
    }
  }

  if (role === "student") {
    const { error: studentError } = await admin.from("student_profiles").insert({
      account_id: accountId,
      law_school: lawSchool,
      year: studentYear,
      school_id: schoolId,
      supervising_attorney_name: supervisingAttorneyName || supervisorName,
      supervising_attorney_bar_number: supervisingAttorneyBarNumber || null,
      teacher_name: teacherName,
      teacher_email: teacherEmail,
      confirmation_status: "pending",
      subscription_plan: "law_student_35",
    });
    if (studentError) {
      return NextResponse.json(
        {
          error: `Student profile could not be written to public.student_profiles: ${studentError.message}. Your account exists (id ${accountId}) — ask the admin to finish the profile; do not re-register with the same email.`,
          accountId,
        },
        { status: 500 }
      );
    }
  }

  if (role === "teacher") {
    // Teacher profiles (migration 0004). The account stays
    // pending_verification until a founder approves it — a teacher must
    // never be able to confirm students without admin approval.
    const { error: teacherError } = await admin.from("teacher_profiles").insert({
      account_id: accountId,
      school_name: schoolName,
      clinic_name: null,
      title: teacherTitle,
    });
    if (teacherError) {
      return NextResponse.json(
        {
          error: `Teacher profile could not be written to public.teacher_profiles: ${teacherError.message}. Your account exists (id ${accountId}) — ask the admin to finish the profile; do not re-register with the same email.`,
          accountId,
        },
        { status: 500 }
      );
    }
  }

  // Google already verified this email, so there is no email-confirmation
  // step here. Professionals still wait for admin verification; law
  // students still wait for teacher/supervisor confirmation.
  return NextResponse.json(
    {
      ok: true,
      accountId,
      role,
      onboardingStatus,
      verificationStatus,
      isVerified: false,
      isListed: false,
      next:
        role === "client"
          ? {
              type: "portal",
              url: "/portal",
              note: "Google verified your email — your client account is active. Go to the Client Portal. Free — $0.",
            }
          : {
              type: "pending_verification",
              note:
                role === "student"
                  ? "Account created — onboarding: pending verification. Your supervisor / clinic director must still confirm you; confirmation stays pending until then. No listing, no G-28, no assignments until verification."
                  : role === "teacher"
                    ? "Account created — onboarding: pending verification. An admin must approve your teacher account before you can confirm students. No student confirmations until approval."
                    : "Account created — onboarding: pending verification. Nothing is listed and nothing is verified until an admin approves you.",
            },
    },
    { status: 201 }
  );
}
