"use client";

import { useState } from "react";
import Link from "next/link";
import { LANGUAGES, type LanguageCode } from "@/lib/i18n";
import { getSupabase } from "@/lib/supabase";
import type { OnboardingStatus } from "./OnboardingProgress";

export type RoleId =
  | "client"
  | "preparer"
  | "attorney"
  | "nonprofit"
  | "student"
  | "teacher"
  | "admin";

const inputCls =
  "w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm";
const labelCls = "block text-sm font-medium text-slate-700";
const btnCls =
  "rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50";
const noteCls = "rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800";
const priceCls =
  "rounded border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800";

// Password: 12+ characters, live strength meter (matches the live site's
// security rules and the /api/register-role server check). The meter is
// client-side guidance only — the server still enforces 12+ chars.
export function passwordChecks(pw: string): { label: string; pass: boolean }[] {
  return [
    { label: "At least 12 characters", pass: pw.length >= 12 },
    { label: "An uppercase letter (A–Z)", pass: /[A-Z]/.test(pw) },
    { label: "A lowercase letter (a–z)", pass: /[a-z]/.test(pw) },
    { label: "A number (0–9)", pass: /[0-9]/.test(pw) },
    { label: "A symbol (e.g. ! @ # $ %)", pass: /[^A-Za-z0-9]/.test(pw) },
  ];
}

function PasswordFields({
  password,
  setPassword,
  confirmPassword,
  setConfirmPassword,
}: {
  password: string;
  setPassword: (v: string) => void;
  confirmPassword: string;
  setConfirmPassword: (v: string) => void;
}) {
  const checks = passwordChecks(password);
  const score = checks.filter((c) => c.pass).length;
  const strengthLabel =
    score <= 1 ? "Too weak" : score === 2 ? "Weak" : score === 3 ? "Fair" : score === 4 ? "Good" : "Strong";
  const barColor =
    score <= 1 ? "bg-red-500" : score === 2 ? "bg-orange-500" : score === 3 ? "bg-amber-500" : score === 4 ? "bg-lime-600" : "bg-green-600";
  return (
    <div className="space-y-2">
      <Field label="Password (12+ characters)" required>
        <input
          className={inputCls}
          type="password"
          required
          minLength={12}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </Field>
      <div aria-live="polite">
        <div className="flex items-center justify-between text-xs text-slate-600">
          <span>
            Password strength: <strong>{password ? strengthLabel : "—"}</strong>
          </span>
          <span>{score}/5 checks</span>
        </div>
        <div className="mt-1 h-2 w-full overflow-hidden rounded bg-slate-200">
          <div className={`h-full ${barColor}`} style={{ width: `${(score / 5) * 100}%` }} />
        </div>
        <ul className="mt-1 space-y-0.5 text-xs">
          {checks.map((c) => (
            <li key={c.label} className={c.pass ? "text-green-700" : "text-slate-500"}>
              {c.pass ? "✓" : "○"} {c.label}
            </li>
          ))}
        </ul>
      </div>
      <Field label="Confirm password" required>
        <input
          className={inputCls}
          type="password"
          required
          minLength={12}
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
      </Field>
      {confirmPassword && password !== confirmPassword && (
        <p className="text-xs font-medium text-red-700">Passwords do not match.</p>
      )}
    </div>
  );
}

function Field({
  label,
  children,
  required,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className={labelCls}>
      {label}
      {required ? " *" : ""}
      <span className="mt-1 block">{children}</span>
    </label>
  );
}

export default function RoleForms({
  role,
  googleMode,
  onComplete,
}: {
  role: RoleId;
  // True when the user arrived from Google sign-in (/onboarding?google=1):
  // their Auth user already exists (matched by Google email), their email
  // is already verified by Google, and they set NO portal password. The
  // form then posts to /api/google-profile (profile rows only — never a
  // second Auth user, never a duplicate accounts row) instead of
  // /api/register-role. Role selection is still required upstream and
  // nothing is pre-selected here.
  googleMode?: boolean;
  onComplete: (status: OnboardingStatus, note: string) => void;
}) {
  // ---- Client: two-phase (profile, then email verification) ----
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientLang, setClientLang] = useState<LanguageCode>("en");
  const [clientPhase, setClientPhase] = useState<"form" | "verify" | "done">(
    "form"
  );
  // Result of the last "Check — have I verified?" attempt (verify phase).
  const [verifyNote, setVerifyNote] = useState<string | null>(null);

  // ---- Document Preparer ----
  const [prepName, setPrepName] = useState("");
  const [prepEmail, setPrepEmail] = useState("");
  const [prepSlug, setPrepSlug] = useState("");
  const [uplAgreed, setUplAgreed] = useState(false);

  // ---- Licensed Attorney ----
  const [attyName, setAttyName] = useState("");
  const [attyEmail, setAttyEmail] = useState("");
  const [barNumber, setBarNumber] = useState("");
  const [barStates, setBarStates] = useState("");

  // ---- DOJ-Accredited Nonprofit ----
  const [npName, setNpName] = useState("");
  const [npEmail, setNpEmail] = useState("");
  const [eoirNumber, setEoirNumber] = useState("");
  const [accLevel, setAccLevel] = useState<
    "Partial — USCIS only" | "Full — USCIS and Court"
  >("Partial — USCIS only");
  const [accExpiry, setAccExpiry] = useState("");
  const [npPlan, setNpPlan] = useState<"standard" | "full">("standard");

  // ---- Law Student ----
  const [stuName, setStuName] = useState("");
  const [stuEmail, setStuEmail] = useState("");
  const [lawSchool, setLawSchool] = useState("");
  const [stuYear, setStuYear] = useState<"1L" | "2L" | "3L">("1L");
  const [schoolId, setSchoolId] = useState("");
  const [supAttorney, setSupAttorney] = useState("");
  const [supBar, setSupBar] = useState("");
  const [teacherName, setTeacherName] = useState("");
  const [teacherEmail, setTeacherEmail] = useState("");
  const [stuPending, setStuPending] = useState(false);

  // ---- Teacher / Clinic Director ----
  const [teachName, setTeachName] = useState("");
  const [teachEmail, setTeachEmail] = useState("");
  const [schoolClinic, setSchoolClinic] = useState("");
  const [teachTitle, setTeachTitle] = useState("");

  // ---- Founder / Admin login (no self-registration — see /login) ----
  // (No email/password state here: the admin card below links to /login.)

  // ---- Shared: password (12+ chars, live strength meter) + API submit ----
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  // Student rules checkbox (role 5 only).
  const [stuRulesAgreed, setStuRulesAgreed] = useState(false);
  // Nonprofit DOJ recognition date (role 4 only).
  const [dojRecognitionDate, setDojRecognitionDate] = useState("");
  // Public profile slug for attorney + nonprofit (role 2 already had one).
  const [attySlug, setAttySlug] = useState("");
  const [npSlug, setNpSlug] = useState("");

  const passwordValid =
    googleMode === true ||
    (password.length >= 12 &&
      password === confirmPassword &&
      passwordChecks(password).every((c) => c.pass));

  const submit =
    (fn: (e: React.FormEvent) => void) => (e: React.FormEvent) => {
      e.preventDefault();
      fn(e);
    };

  // Posts the registration to /api/register-role (email flow) or to
  // /api/google-profile (Google flow — profile rows only, verified by
  // the Google session token, no password, no second Auth user) and
  // returns the human-readable next step. On 501 (Supabase/Stripe not
  // configured) or any failure, shows the error honestly and creates
  // nothing.
  const postRegister = async (
    payload: Record<string, unknown>
  ): Promise<{ ok: boolean; message: string; nextType?: string }> => {
    setSubmitting(true);
    setApiError(null);
    try {
      // Google flow: prove the session with the access token; the
      // server verifies it and uses that Auth user id. The token is
      // sent only as an Authorization header, never logged.
      if (googleMode === true) {
        const supabase = getSupabase();
        let token: string | null = null;
        if (supabase) {
          const { data: sessionData } = await supabase.auth.getSession();
          token = sessionData.session?.access_token ?? null;
        }
        if (!supabase || !token) {
          setApiError(
            "Your Google session could not be found. Sign in with Google again from the Register page, then choose your role."
          );
          return { ok: false, message: "No Google session." };
        }
        const { password: _password, ...googlePayload } = payload;
        void _password;
        const res = await fetch("/api/google-profile", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(googlePayload),
        });
        const data = (await res.json()) as {
          ok?: boolean;
          error?: string;
          errors?: string[];
          accountId?: string;
          next?: { type?: string; url?: string; note?: string };
          supervisorConfirmationEmail?: { status?: string; detail?: string };
        };
        if (!res.ok || !data.ok) {
          const detail =
            data.errors?.join(" ") ?? data.error ?? `Registration failed (${res.status}).`;
          setApiError(
            `${detail} No account was created by this attempt unless the message says otherwise.`
          );
          return { ok: false, message: detail };
        }
        const next = data.next;
        let message = "Account created.";
        if (next?.type === "portal") {
          // Google already verified the email — no confirmation link.
          message =
            "Account created — Google already verified your email. Your client account is active. Go to the Client Portal (/portal). Free — $0.";
        } else if (next?.type === "pending_verification") {
          message = `Account created — onboarding: pending verification. ${next.note ?? "Nothing is listed and nothing is verified until an admin approves you."}`;
        }
        return { ok: true, message, nextType: next?.type };
      }
      const res = await fetch("/api/register-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        errors?: string[];
        accountId?: string;
        next?: { type?: string; url?: string; priceId?: string; priceKey?: string; status?: string; note?: string };
        supervisorConfirmationEmail?: { status?: string; detail?: string };
      };
      if (!res.ok || !data.ok) {
        const detail =
          data.errors?.join(" ") ?? data.error ?? `Registration failed (${res.status}).`;
        setApiError(
          `${detail} No account was created by this attempt unless the message says otherwise.`
        );
        return { ok: false, message: detail };
      }
      const next = data.next;
      let message = "Account created.";
      if (next?.type === "portal") {
        message =
          "Account created — check your email for the Supabase Auth confirmation link, then go to the Client Portal (/portal). Free — $0.";
      } else if (next?.type === "pending_verification") {
        message = `Account created — onboarding: pending verification. ${next.note ?? "Nothing is listed and nothing is verified until an admin approves you."}`;
      } else if (next?.type === "stripe_checkout") {
        message =
          `Account created — onboarding: pending verification. Next: Stripe Checkout (${next.priceId ?? next.priceKey ?? "price not set"}) — ${next.status ?? "not_configured"}: ${next.note ?? "Stripe is not connected; nothing was charged and your directory listing stays off until subscription + verification are both confirmed."}`;
      }
      if (data.supervisorConfirmationEmail) {
        message +=
          " Supervisor confirmation email: QUEUED, NOT SENT (email sending is not connected) — your status stays pending until your supervisor / clinic director confirms.";
      }
      return { ok: true, message, nextType: next?.type };
    } catch {
      setApiError("Could not reach the registration route (network error). No account was created.");
      return { ok: false, message: "Network error." };
    } finally {
      setSubmitting(false);
    }
  };

  if (role === "client") {
    if (clientPhase === "done") {
      return (
        <div className="space-y-3">
          <p className="text-sm font-medium text-green-800">
            Email verified — your client account is active.
          </p>
          <Link
            href="/portal"
            className="inline-block rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Go to Client Portal →
          </Link>
        </div>
      );
    }
    if (clientPhase === "verify") {
      return (
        <div className="space-y-3">
          <p className={noteCls}>
            Account created via /api/register-role. Supabase Auth sent a
            confirmation email to {clientEmail || "your email"} — click the
            link in that email to confirm. (If Supabase is not connected, no
            email was sent and no account exists yet — the error above says so.)
          </p>
          <p className="text-sm text-slate-700">
            After clicking the confirmation link, come back here and check
            below — the check reads your live Supabase session, it does
            not take your word for it.
          </p>
          {verifyNote && (
            <p className={noteCls}>{verifyNote}</p>
          )}
          <button
            type="button"
            className={btnCls}
            onClick={() => {
              void (async () => {
                const supabase = getSupabase();
                if (!supabase) {
                  setVerifyNote(
                    "Supabase is not connected in this build, so verification cannot be checked here. If you clicked the confirmation link in your email, sign in at /login — your account activates on first sign-in."
                  );
                  return;
                }
                const { data } = await supabase.auth.getUser();
                const confirmedAt = (
                  data.user as { email_confirmed_at?: string | null } | null
                )?.email_confirmed_at;
                if (data.user && confirmedAt) {
                  setClientPhase("done");
                  onComplete(
                    "active",
                    `Client ${clientName || "account"} active after email verification.`
                  );
                } else {
                  setVerifyNote(
                    "Not confirmed yet — click the confirmation link in the email Supabase sent, then come back and check again. If you already clicked it, sign in at /login instead."
                  );
                }
              })();
            }}
          >
            Check — have I verified?
          </button>
          <p className="text-sm text-slate-600">
            Already clicked the link?{" "}
            <Link href="/login" className="text-blue-600 underline">
              Sign in →
            </Link>
          </p>
        </div>
      );
    }
    return (
      <form
        className="space-y-4"
        onSubmit={submit(() => {
          void (async () => {
            const result = await postRegister({
              role: "client",
              fullName: clientName,
              email: clientEmail,
              phone: clientPhone,
              password,
              preferredLanguage: clientLang,
            });
            if (result.ok) {
              if (googleMode === true) {
                // Google already verified the email — no confirmation
                // link step. Client goes straight to active.
                onComplete("active", result.message);
                setClientPhase("done");
              } else {
                onComplete("profile_completed", result.message);
                setClientPhase("verify");
              }
            }
          })();
        })}
      >
        <p className={priceCls}>Client — Free $0. No per-lead or percentage fees.</p>
        {apiError && <p className={noteCls}>{apiError}</p>}
        <Field label="Full name" required>
          <input className={inputCls} required value={clientName} onChange={(e) => setClientName(e.target.value)} />
        </Field>
        <Field label="Email" required>
          <input className={inputCls} type="email" required value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} />
        </Field>
        <Field label="Phone" required>
          <input className={inputCls} type="tel" required value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} />
        </Field>
        {/* Google users set no portal password — Google verified them. */}
        {googleMode !== true && (
          <PasswordFields
            password={password}
            setPassword={setPassword}
            confirmPassword={confirmPassword}
            setConfirmPassword={setConfirmPassword}
          />
        )}
        <Field label="Preferred language" required>
          <select
            className={inputCls}
            value={clientLang}
            onChange={(e) => setClientLang(e.target.value as LanguageCode)}
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.native} ({l.label})
              </option>
            ))}
          </select>
        </Field>
        <p className="text-xs text-slate-500">
          {googleMode === true
            ? "Next step: none — Google already verified your email. No payment, no documents to upload at this step."
            : "Next step: email verification only. No payment, no documents to upload at this step."}
        </p>
        <button type="submit" className={btnCls} disabled={submitting || !passwordValid}>
          {submitting ? "Creating your account…" : "Continue to email verification"}
        </button>
      </form>
    );
  }

  if (role === "preparer") {
    return (
      <form
        className="space-y-4"
        onSubmit={submit(() => {
          void (async () => {
            const result = await postRegister({
              role: "preparer",
              fullName: prepName,
              email: prepEmail,
              password,
              slug: prepSlug,
              uplAgreed,
            });
            if (result.ok) onComplete("profile_completed", result.message);
          })();
        })}
      >
        <p className={priceCls}>
          Document Preparer — Free to register. Back Office &amp; directory
          listing: $49/mo. No per-lead or percentage fees.
        </p>
        {apiError && <p className={noteCls}>{apiError}</p>}
        <Field label="Full name" required>
          <input className={inputCls} required value={prepName} onChange={(e) => setPrepName(e.target.value)} />
        </Field>
        <Field label="Email" required>
          <input className={inputCls} type="email" required value={prepEmail} onChange={(e) => setPrepEmail(e.target.value)} />
        </Field>
        {/* Google users set no portal password — Google verified them. */}
        {googleMode !== true && (
          <PasswordFields
            password={password}
            setPassword={setPassword}
            confirmPassword={confirmPassword}
            setConfirmPassword={setConfirmPassword}
          />
        )}
        <Field label="Public slug" required>
          <span className="flex items-center gap-1">
            <span className="text-sm text-slate-500">immigration.niptei.com/p/</span>
            <input
              className={inputCls}
              required
              placeholder="your-name"
              value={prepSlug}
              onChange={(e) => setPrepSlug(e.target.value)}
            />
          </span>
        </Field>
        <label className="flex items-start gap-2 rounded border border-slate-300 bg-slate-50 px-3 py-2 text-sm">
          <input
            type="checkbox"
            checked={uplAgreed}
            onChange={(e) => setUplAgreed(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            <strong>UPL (Unauthorized Practice of Law) disclaimer agreement *</strong>
            <br />
            I understand document preparers give clerical help only — no legal
            advice and no representation. Only a licensed attorney or a
            DOJ-Accredited Representative may give legal advice or represent a
            client (8 CFR 292.1).
          </span>
        </label>
        {!uplAgreed && (
          <p className="text-xs text-slate-500">
            You must tick the UPL disclaimer agreement to continue.
          </p>
        )}
        <button type="submit" className={btnCls} disabled={!uplAgreed || submitting || !passwordValid}>
          {submitting ? "Claiming your profile…" : "Claim free profile"}
        </button>
      </form>
    );
  }

  if (role === "attorney") {
    return (
      <form
        className="space-y-4"
        onSubmit={submit(() => {
          void (async () => {
            const result = await postRegister({
              role: "attorney",
              fullName: attyName,
              email: attyEmail,
              password,
              slug: attySlug,
              barNumber,
              barStates,
            });
            if (result.ok) onComplete("pending_verification", result.message);
          })();
        })}
      >
        <p className={priceCls}>
          Licensed Attorney — Free to register · $99/mo, charged only after
          verification. No per-lead or percentage fees.
        </p>
        <p className={noteCls}>
          Your submission goes to a pending-verification state for manual/admin
          approval against your state bar. A bar number is never shown as
          verified until an admin approves it.
        </p>
        {apiError && <p className={noteCls}>{apiError}</p>}
        <Field label="Full name" required>
          <input className={inputCls} required value={attyName} onChange={(e) => setAttyName(e.target.value)} />
        </Field>
        <Field label="Email" required>
          <input className={inputCls} type="email" required value={attyEmail} onChange={(e) => setAttyEmail(e.target.value)} />
        </Field>
        {/* Google users set no portal password — Google verified them. */}
        {googleMode !== true && (
          <PasswordFields
            password={password}
            setPassword={setPassword}
            confirmPassword={confirmPassword}
            setConfirmPassword={setConfirmPassword}
          />
        )}
        <Field label="Public slug" required>
          <span className="flex items-center gap-1">
            <span className="text-sm text-slate-500">immigration.niptei.com/p/</span>
            <input
              className={inputCls}
              required
              placeholder="your-name"
              value={attySlug}
              onChange={(e) => setAttySlug(e.target.value)}
            />
          </span>
        </Field>
        <Field label="Bar number" required>
          <input className={inputCls} required value={barNumber} onChange={(e) => setBarNumber(e.target.value)} />
        </Field>
        <Field label="State(s) admitted (comma-separated)" required>
          <input
            className={inputCls}
            required
            placeholder="Florida, New York"
            value={barStates}
            onChange={(e) => setBarStates(e.target.value)}
          />
        </Field>
        <button type="submit" className={btnCls} disabled={submitting || !passwordValid}>
          {submitting ? "Submitting…" : "Submit for manual/admin approval"}
        </button>
      </form>
    );
  }

  if (role === "nonprofit") {
    return (
      <form
        className="space-y-4"
        onSubmit={submit(() => {
          void (async () => {
            const result = await postRegister({
              role: "nonprofit",
              fullName: npName,
              orgName: npName,
              email: npEmail,
              password,
              slug: npSlug,
              eoirNumber,
              dojRecognitionDate,
              accreditationTier: accLevel.startsWith("Full") ? "full" : "partial",
              accreditationExpiry: accExpiry,
              nonprofitPlan: npPlan,
            });
            if (result.ok) onComplete("pending_verification", result.message);
          })();
        })}
      >
        <p className={priceCls}>
          DOJ-Accredited Nonprofit — Free to register · 50% off: $24.50/mo
          Standard or $49.50/mo Full. No per-lead or percentage fees.
        </p>
        <p className={noteCls}>
          Admin checks your EOIR number against the official EOIR Recognition
          &amp; Accreditation roster before approving. Nothing is listed until
          that check passes.
        </p>
        {apiError && <p className={noteCls}>{apiError}</p>}
        <Field label="Organization name" required>
          <input className={inputCls} required value={npName} onChange={(e) => setNpName(e.target.value)} />
        </Field>
        <Field label="Contact email" required>
          <input className={inputCls} type="email" required value={npEmail} onChange={(e) => setNpEmail(e.target.value)} />
        </Field>
        {/* Google users set no portal password — Google verified them. */}
        {googleMode !== true && (
          <PasswordFields
            password={password}
            setPassword={setPassword}
            confirmPassword={confirmPassword}
            setConfirmPassword={setConfirmPassword}
          />
        )}
        <Field label="Public slug" required>
          <span className="flex items-center gap-1">
            <span className="text-sm text-slate-500">immigration.niptei.com/p/</span>
            <input
              className={inputCls}
              required
              placeholder="your-organization"
              value={npSlug}
              onChange={(e) => setNpSlug(e.target.value)}
            />
          </span>
        </Field>
        <Field label="EOIR number" required>
          <input className={inputCls} required value={eoirNumber} onChange={(e) => setEoirNumber(e.target.value)} />
        </Field>
        <Field label="DOJ recognition date" required>
          <input className={inputCls} type="date" required value={dojRecognitionDate} onChange={(e) => setDojRecognitionDate(e.target.value)} />
        </Field>
        <Field label="Accreditation level" required>
          <select
            className={inputCls}
            value={accLevel}
            onChange={(e) =>
              setAccLevel(
                e.target.value as "Partial — USCIS only" | "Full — USCIS and Court"
              )
            }
          >
            <option value="Partial — USCIS only">Partial — USCIS only</option>
            <option value="Full — USCIS and Court">Full — USCIS and Court</option>
          </select>
        </Field>
        <Field label="Accreditation expiry" required>
          <input className={inputCls} type="date" required value={accExpiry} onChange={(e) => setAccExpiry(e.target.value)} />
        </Field>
        <fieldset>
          <legend className={labelCls}>Plan (50% off)</legend>
          <div className="mt-1 space-y-2 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="np-plan"
                checked={npPlan === "standard"}
                onChange={() => setNpPlan("standard")}
              />
              Standard — $24.50/mo
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="np-plan"
                checked={npPlan === "full"}
                onChange={() => setNpPlan("full")}
              />
              Full — $49.50/mo
            </label>
          </div>
        </fieldset>
        <p className="text-xs text-slate-500">
          Multi-staff seats: your nonprofit can add staff seats under the same
          organization account — seat details are set with the admin after
          approval.
        </p>
        <button type="submit" className={btnCls} disabled={submitting || !passwordValid}>
          {submitting ? "Submitting…" : "Submit for roster check & approval"}
        </button>
      </form>
    );
  }

  if (role === "student") {
    if (stuPending) {
      return (
        <div className="space-y-3">
          <p className="text-sm font-medium text-amber-800">
            Status: Pending teacher confirmation
          </p>
          <p className="text-sm text-slate-700">
            Your account was created and the supervisor confirmation is queued
            for {teacherName || "your teacher"} ({teacherEmail || "teacher email"})
            — no confirmation email was actually sent yet, because email
            sending is not connected. Your status stays “Pending teacher
            confirmation” until your supervisor / clinic director confirms via
            the 1-click link (once email is connected) or /admin/verifications.
          </p>
          <p className="text-xs text-slate-500">
            Supervised only: no solo cases, no legal advice, no G-28 signature,
            no representation. Cases only when explicitly assigned by a verified
            attorney or DOJ representative.
          </p>
          <p className="text-sm text-slate-700">
            Your teacher confirms you in their Teacher Dashboard once their
            own account is approved — or a founder confirms you in{" "}
            <Link href="/admin/verifications" className="text-blue-600 underline">
              /admin/verifications
            </Link>
            . Nothing on this page can mark you confirmed: the button that
            used to simulate a confirmation was removed — a confirmation
            is only real when your teacher or a founder records it.
          </p>
        </div>
      );
    }
    return (
      <form
        className="space-y-4"
        onSubmit={submit(() => {
          void (async () => {
            const result = await postRegister({
              role: "student",
              fullName: stuName,
              email: stuEmail,
              password,
              lawSchool,
              year: stuYear,
              schoolId,
              supervisorName: teacherName,
              supervisorEmail: teacherEmail,
              supervisingAttorneyName: supAttorney,
              supervisingAttorneyBarNumber: supBar,
              teacherName,
              teacherEmail,
              studentRulesAgreed: stuRulesAgreed,
            });
            if (result.ok) {
              setStuPending(true);
              onComplete("pending_verification", result.message);
            }
          })();
        })}
      >
        <p className={priceCls}>Law Student — Free to register · $35/mo. Supervised-only workspace. No per-case, per-lead or percentage fees.</p>
        <p className={noteCls}>
          Supervised only: no solo cases, no legal advice, no G-28 signature,
          no representation. Cases only when explicitly assigned by a verified
          attorney or DOJ representative.
        </p>
        {apiError && <p className={noteCls}>{apiError}</p>}
        <Field label="Full name" required>
          <input className={inputCls} required value={stuName} onChange={(e) => setStuName(e.target.value)} />
        </Field>
        <Field label="Email" required>
          <input className={inputCls} type="email" required value={stuEmail} onChange={(e) => setStuEmail(e.target.value)} />
        </Field>
        {/* Google users set no portal password — Google verified them. */}
        {googleMode !== true && (
          <PasswordFields
            password={password}
            setPassword={setPassword}
            confirmPassword={confirmPassword}
            setConfirmPassword={setConfirmPassword}
          />
        )}
        <Field label="Law school" required>
          <input className={inputCls} required value={lawSchool} onChange={(e) => setLawSchool(e.target.value)} />
        </Field>
        <Field label="Year" required>
          <select
            className={inputCls}
            value={stuYear}
            onChange={(e) => setStuYear(e.target.value as "1L" | "2L" | "3L")}
          >
            <option value="1L">1L</option>
            <option value="2L">2L</option>
            <option value="3L">3L</option>
          </select>
        </Field>
        <Field label="School ID" required>
          <input className={inputCls} required value={schoolId} onChange={(e) => setSchoolId(e.target.value)} />
        </Field>
        <Field label="Supervising attorney / clinic" required>
          <input className={inputCls} required value={supAttorney} onChange={(e) => setSupAttorney(e.target.value)} />
        </Field>
        <Field label="Supervising attorney bar number" required>
          <input className={inputCls} required value={supBar} onChange={(e) => setSupBar(e.target.value)} />
        </Field>
        <Field label="Teacher / clinic-director name" required>
          <input className={inputCls} required value={teacherName} onChange={(e) => setTeacherName(e.target.value)} />
        </Field>
        <Field label="Teacher / clinic-director email" required>
          <input
            className={inputCls}
            type="email"
            required
            value={teacherEmail}
            onChange={(e) => setTeacherEmail(e.target.value)}
          />
        </Field>
        <p className="text-xs text-slate-500">
          A confirmation link is sent to your teacher / clinic director once
          email sending is connected. Until then the confirmation is queued
          and your status stays “Pending teacher confirmation” — no email is
          actually sent in this build.
        </p>
        <label className="flex items-start gap-2 rounded border border-slate-300 bg-slate-50 px-3 py-2 text-sm">
          <input
            type="checkbox"
            checked={stuRulesAgreed}
            onChange={(e) => setStuRulesAgreed(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            <strong>Supervised-only student rules *</strong>
            <br />
            I will not give independent legal advice, sign or generate Form
            G-28 / EOIR-28, message clients without my supervisor seeing it,
            or file anything directly with USCIS or the Court. My drafts need
            supervisor review and approval before they unlock for client
            E-Sign or filing.
          </span>
        </label>
        {!stuRulesAgreed && (
          <p className="text-xs text-slate-500">
            You must agree to the supervised-only student rules to continue.
          </p>
        )}
        <button type="submit" className={btnCls} disabled={!stuRulesAgreed || submitting || !passwordValid}>
          {submitting ? "Submitting…" : "Submit for teacher confirmation"}
        </button>
      </form>
    );
  }

  if (role === "teacher") {
    return (
      <form
        className="space-y-4"
        onSubmit={submit(() => {
          // Both flows post for real: Google posts to /api/google-profile
          // (profile rows only, verified by the Google session token)
          // and email posts to /api/register-role (Auth user + password
          // + teacher_profiles). Either way the account stays
          // pending_verification until a founder approves it — a teacher
          // is NEVER told they are active with no account row.
          void (async () => {
            const result = await postRegister({
              role: "teacher",
              fullName: teachName,
              email: teachEmail,
              password,
              schoolName: schoolClinic,
              title: teachTitle,
            });
            if (result.ok) onComplete("pending_verification", result.message);
          })();
        })}
      >
        <p className={priceCls}>
          Teacher / Clinic Director — confirms students. No fee listed for
          this role in this build.
        </p>
        {apiError && <p className={noteCls}>{apiError}</p>}
        <Field label="Full name" required>
          <input className={inputCls} required value={teachName} onChange={(e) => setTeachName(e.target.value)} />
        </Field>
        <Field label="Email" required>
          <input className={inputCls} type="email" required value={teachEmail} onChange={(e) => setTeachEmail(e.target.value)} />
        </Field>
        {/* Google users set no portal password — Google verified them. */}
        {googleMode !== true && (
          <PasswordFields
            password={password}
            setPassword={setPassword}
            confirmPassword={confirmPassword}
            setConfirmPassword={setConfirmPassword}
          />
        )}
        <Field label="School / clinic" required>
          <input className={inputCls} required value={schoolClinic} onChange={(e) => setSchoolClinic(e.target.value)} />
        </Field>
        <Field label="Title" required>
          <input
            className={inputCls}
            required
            placeholder="e.g. Clinical Professor, Clinic Director"
            value={teachTitle}
            onChange={(e) => setTeachTitle(e.target.value)}
          />
        </Field>
        <p className="text-xs text-slate-500">
          Teachers and clinic directors confirm their law students. Your
          account stays pending verification until an admin approves it —
          you cannot confirm students before approval.
        </p>
        <button type="submit" className={btnCls} disabled={submitting || !passwordValid}>
          {submitting ? "Submitting…" : "Submit for admin approval"}
        </button>
      </form>
    );
  }

  // role === "admin": login only, no self-registration. The real login
  // lives at /login (password + email code, every time) — this card
  // only links there. It never checks a password and never creates a
  // session, so there is no demo login left on this page.
  return (
    <div className="space-y-4">
      <p className={noteCls}>
        Founder / Admin login only — no self-registration. Admin accounts
        are created by the founder, never in code and never by a form.
      </p>
      <p className="text-sm text-slate-700">
        Sign in with your email + password and the 6-digit code emailed
        to you. A code is required every login — no remember-device.
      </p>
      <Link
        href="/login"
        className="inline-block rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        Go to log in →
      </Link>
      <p className="text-xs text-slate-500">
        Need an admin account? Ask the founder — accounts are created by
        the founder, never by self-registration.
      </p>
    </div>
  );
}
