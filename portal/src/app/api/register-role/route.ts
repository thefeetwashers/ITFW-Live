// POST /api/register-role — Step 1 Register (role registration).
//
// Creates the user in Supabase Auth and writes the profile rows.
// SKELETON / NOT LIVE until env vars are set — returns 501 then and
// creates nothing. No keys in code; values come from Vercel / .env.local.
//
// CORRECTED wiring (verified against migrations 0001, 0003, 0004):
//   * Supabase URL is NEXT_PUBLIC_SUPABASE_URL (NOT process.env.SUPABASE_URL
//     — that variable does not exist) + SUPABASE_SERVICE_ROLE_KEY (server-only).
//   * Writes to public.accounts (NOT a `users` table — none exists) and to
//     public.professional_profiles (NOT `provider_profiles` — none exists)
//     for roles 2/3/4, public.student_profiles for role 5, and
//     public.teacher_profiles for role 6 (Teacher / Clinic Director —
//     free, no fee, pending founder approval before confirming students).
//   * email_confirm is NEVER set to true: the normal Supabase Auth
//     email-confirmation flow applies (user confirms via the email Supabase
//     sends). Do not bypass it.
//   * is_verified is ALWAYS false at registration, for every role.
//     Preparers sign the UPL agreement but are NOT "verified" like
//     attorneys / DOJ representatives. (accounts has a CHECK: is_verified
//     = true requires verification_status = 'verified'.)
//   * onboarding_status: 'active' for Client; 'pending_verification' for
//     Attorney / DOJ Nonprofit / Law Student; 'profile_completed' for
//     Document Preparer (profile claimed, listing pending Stripe + review).
//   * is_listed (professional_profiles.is_published) is NEVER set true here.
//     It flips to true ONLY via /api/stripe/webhook once the subscription is
//     active AND verification is approved — the webhook is still a 501
//     skeleton until Stripe is live, so nothing is listed by this route.
//   * Law-student supervisor confirmation email: sent via the platform
//     AWS SES sender (src/lib/email.ts) when SES is connected; when
//     it is not, the email is QUEUED, never claimed as sent.
//     student_profiles.confirmation_status stays 'pending' until the
//     supervisor confirms (future confirmation link or
//     /admin/verifications).
//   * Paid roles 2–5 route to Stripe Checkout with the exact LOCKED
//     Price ID (src/lib/stripePrices.ts, created Nov 24, 2026).
//     /api/checkout creates the Checkout Session — this route does not
//     create one itself. When STRIPE_SECRET_KEY is not set, checkout
//     returns 501 "Stripe not configured" and nothing is charged.
//     Clients route to /portal (free).
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getLockedPriceByKey } from "@/lib/stripePrices";
import { isEmailConfigured, sendEmail } from "@/lib/email";
//   * Password: 12+ characters, enforced here and by the live strength
//     meter on the register form.

export const runtime = "nodejs";

type RegisterRole =
  | "client"
  | "preparer"
  | "attorney"
  | "nonprofit"
  | "student"
  | "teacher";

// Locked plans (migration 0001 subscription_plan enum + 0003 law_student_35).
// Teacher has NO plan (free, no fee) — excluded from both maps.
const SUBSCRIPTION_PLAN: Record<
  Exclude<RegisterRole, "client" | "teacher">,
  string
> = {
  preparer: "preparer_pro_49",
  attorney: "attorney_pro_99",
  nonprofit: "nonprofit_standard_24_50", // overridden to full below when chosen
  student: "law_student_35",
};

const PRICE_KEY: Record<
  Exclude<RegisterRole, "client" | "teacher">,
  string
> = {
  preparer: "subscription_preparer",
  attorney: "subscription_attorney",
  nonprofit: "subscription_doj_standard", // overridden to FULL below
  student: "subscription_law_student",
};

const PLAN_PRICE: Record<string, string> = {
  preparer_pro_49: "$49/mo",
  attorney_pro_99: "$99/mo",
  nonprofit_standard_24_50: "$24.50/mo",
  nonprofit_full_49_50: "$49.50/mo",
  law_student_35: "$35/mo",
};

// professional_profiles.slug CHECK (migration 0001): ^[a-z0-9][a-z0-9-]{2,60}$
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
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      {
        error:
          "Supabase not configured — NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are not set. No account was created and nothing was written.",
      },
      { status: 501 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const role = asString(body.role) as RegisterRole;
  const roles: RegisterRole[] = ["client", "preparer", "attorney", "nonprofit", "student", "teacher"];
  if (!roles.includes(role)) {
    return NextResponse.json(
      { error: "role is required and must be one of: client, preparer, attorney, nonprofit, student, teacher." },
      { status: 400 }
    );
  }

  const fullName = asString(body.fullName);
  const email = asString(body.email);
  const phone = asString(body.phone);
  const password = typeof body.password === "string" ? body.password : "";
  const preferredLanguage = asString(body.preferredLanguage) || "en";

  const errors: string[] = [];
  if (!fullName) errors.push("Full name (or organization name) is required.");
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push("A valid email is required.");
  if (password.length < 12)
    errors.push("Password must be at least 12 characters (see the live strength meter on the form).");

  const slug = asString(body.slug);
  const barNumber = asString(body.barNumber);
  const barStates = asStringArray(body.barStates);
  const orgName = asString(body.orgName) || fullName;
  const eoirNumber = asString(body.eoirNumber);
  const accreditationTier = asString(body.accreditationTier); // "partial" | "full"
  const accreditationExpiry = asString(body.accreditationExpiry);
  const dojRecognitionDate = asString(body.dojRecognitionDate);
  const nonprofitPlan = asString(body.nonprofitPlan) || "standard"; // "standard" | "full"
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

  // Map the register role to the accounts.account_role enum value
  // (migration 0003 added 'law_student' to the enum).
  const accountRole = role === "student" ? "law_student" : role;
  const onboardingStatus =
    role === "client"
      ? "active"
      : role === "preparer"
        ? "profile_completed"
        : "pending_verification";
  // Verification: nobody is verified at registration. Client does not
  // need verification; everyone else is pending admin / roster /
  // supervisor checks.
  const verificationStatus = role === "client" ? "not_required" : "pending";

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // NOTE: email_confirm is deliberately NOT passed. Supabase Auth's
  // default (false) applies, so the user must confirm via the normal
  // email-confirmation flow. Never set email_confirm: true here.
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    user_metadata: { role: accountRole, full_name: fullName },
  });
  if (authError || !authData.user) {
    return NextResponse.json(
      { error: `Supabase Auth could not create the user: ${authError?.message ?? "unknown error"}. No profile rows were written.` },
      { status: 400 }
    );
  }
  const authUserId = authData.user.id;

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
    // Best-effort cleanup so a failed registration does not leave an
    // orphan Auth user with no accounts row.
    await admin.auth.admin.deleteUser(authUserId);
    return NextResponse.json(
      { error: `Account row could not be written to public.accounts: ${accountError?.message ?? "unknown error"}. The Auth user was removed; please try again.` },
      { status: 500 }
    );
  }
  const accountId = (account as { id: string }).id;

  // Role profile rows. is_published stays false for every role here —
  // listing flips only via the Stripe webhook (see header).
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
    // Teacher profile (migration 0004). No fee, no Stripe. The account
    // stays pending_verification until a founder approves it — a teacher
    // must never confirm students without admin approval.
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

  if (role === "client") {
    return NextResponse.json(
      {
        ok: true,
        accountId,
        role,
        onboardingStatus,
        verificationStatus,
        isVerified: false,
        isListed: false,
        next: {
          type: "portal",
          url: "/portal",
          note: "Free — $0. Confirm your email via the Supabase Auth confirmation link, then go to the Client Portal.",
        },
      },
      { status: 201 }
    );
  }

  if (role === "teacher") {
    // No fee, no Stripe. Pending founder approval before confirming students.
    return NextResponse.json(
      {
        ok: true,
        accountId,
        role,
        onboardingStatus,
        verificationStatus,
        isVerified: false,
        isListed: false,
        next: {
          type: "pending_verification",
          note: "Teacher account created — pending founder approval. You cannot confirm students until a founder approves your account. Free — no fee.",
        },
      },
      { status: 201 }
    );
  }

  const priceKey =
    role === "nonprofit"
      ? nonprofitPlan === "full"
        ? "subscription_doj_full"
        : "subscription_doj_standard"
      : PRICE_KEY[role];
  const lockedPrice = getLockedPriceByKey(priceKey);
  const plan =
    role === "nonprofit"
      ? nonprofitPlan === "full"
        ? "nonprofit_full_49_50"
        : "nonprofit_standard_24_50"
      : SUBSCRIPTION_PLAN[role];
  const stripeConfigured = Boolean(process.env.STRIPE_SECRET_KEY && lockedPrice);

  // Law-student supervisor confirmation email — platform AWS SES.
  // Sent only when SES is connected; otherwise queued, never claimed.
  let supervisorConfirmationEmail: {
    sent: boolean;
    status: "sent" | "queued_not_sent" | "failed";
    to: string;
    detail: string;
  } | null = null;
  if (role === "student") {
    if (!isEmailConfigured()) {
      supervisorConfirmationEmail = {
        sent: false,
        status: "queued_not_sent",
        to: supervisorEmail,
        detail:
          "Email sending is not connected (AWS SES not configured), so no confirmation email was sent. The supervisor confirmation stays pending (student_profiles.confirmation_status = 'pending') until the supervisor confirms via the future 1-click link or /admin/verifications. Never treat this as sent.",
      };
    } else {
      const result = await sendEmail({
        to: supervisorEmail,
        subject: "Immigration with NIPTEI — please confirm your law student",
        text:
          `Hello ${supervisorName},\n\n` +
          `${fullName} registered on Immigration with NIPTEI as a law student and named you as their supervising attorney / clinic director.\n\n` +
          `Please confirm that you supervise this student. Until you confirm, the student cannot take on cases. ` +
          `You can confirm in the Founder/Admin verification queue, or reply to this email.\n\n` +
          `Immigration with NIPTEI — https://immigration.niptei.com`,
      });
      supervisorConfirmationEmail = result.ok
        ? {
            sent: true,
            status: "sent",
            to: supervisorEmail,
            detail:
              "Confirmation email sent to the supervisor via AWS SES. The supervisor confirmation stays pending (student_profiles.confirmation_status = 'pending') until the supervisor confirms.",
          }
        : {
            sent: false,
            status: "failed",
            to: supervisorEmail,
            detail: `Confirmation email could not be sent. ${result.error} The supervisor confirmation stays pending (student_profiles.confirmation_status = 'pending'). Never treat this as sent.`,
          };
    }
  }

  return NextResponse.json(
    {
      ok: true,
      accountId,
      role,
      onboardingStatus,
      verificationStatus,
      isVerified: false,
      isListed: false,
      plan: `${plan} (${PLAN_PRICE[plan] ?? "price not locked"})`,
      publicProfile: `https://immigration.niptei.com/p/${slug ?? ""}`,
      next: {
        type: "stripe_checkout",
        priceId: lockedPrice?.priceId ?? null,
        priceKey,
        status: stripeConfigured ? "awaiting_checkout_session" : "not_configured",
        note: stripeConfigured
          ? "Stripe is configured — POST /api/checkout with this Price ID to start a Checkout Session (subscription mode). Nothing is charged until checkout completes, and your directory listing stays off until the Stripe webhook confirms an active subscription AND verification is approved."
          : "Stripe is not connected — STRIPE_SECRET_KEY is not set, so /api/checkout returns 501 and no checkout session was created. Nothing was charged. Your directory listing (is_published) stays off until the Stripe webhook confirms an active subscription AND verification is approved.",
      },
      ...(role === "student" && supervisorConfirmationEmail
        ? { supervisorConfirmationEmail }
        : {}),
    },
    { status: 201 }
  );
}
