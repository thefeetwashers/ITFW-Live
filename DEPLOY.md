# ITFW Live — Immigration with NIPTEI — Deploy & Consolidation Record

## Status: BUILT, NOT LIVE

> **UPDATE Nov 24, 2026 — portal deployment route CHANGED (see §10).**
> The portal will deploy as its OWN Vercel project (`itfw-portal`),
> NOT into `itfw-live`. The v33 static site on `immigration.niptei.com`
> stays exactly as it is (Production deployment `FgLzyTGab`, Nov 24,
> 2026) and is NOT replaced. The checklist in this section that says
> "portal deployed to `itfw-live`" is superseded by §10.

The portal is **built** (code-complete in this repo) and **NOT live**. It goes
live only when ALL of these are true:

1. Vercel env vars are set in project `itfw-live` (names in §2 — values are
   never in this repo, never in chat).
2. The portal is deployed to `itfw-live` (GitHub → Vercel auto-deploy, §6).
3. Stripe is connected (account CONFIRMED Nov 24, 2026 — IMMIGRATION WITH
   THE FEET WASHERS, acct_1UVh7DPfd9SRUcvh; 132 LIVE Prices; portal wired
   Nov 24, 2026 — see §3A). Env vars are still NOT set in Vercel and the
   webhook endpoint is still NOT registered in Stripe, so checkout returns
   501 until those two steps are done.
4. The founder signs in (nipteiapp@gmail.com) and verifies the live site.

Until then, every page that needs the backend says so honestly on the page
("Example data — not live", "Supabase is not connected in this build", or a
501 from the API route). **Do not claim anything is live that is not.**

---

## 1. Supabase — project "Immigration"

- Project: **"Immigration"** — https://jdxjskqdvwqarfhcqjlg.supabase.co
- Org: **THE FEET WASHERS** (Pro). Do NOT create a second project. Do NOT
  reuse the NIPTEI shop project
  (https://cjatliwegffjsbyanbjk.supabase.co) for ITFW.
- Storage: **private bucket `vault`** (client documents only). No public
  bucket, no permanent URLs — signed URLs only, short expiry.
- Auth: **Email + Google enabled** (verified Nov 19, 2026 — Google Client ID
  + Client Secret already filled in Supabase). Do NOT create a second Google
  Cloud OAuth client and do NOT change the Supabase Google provider
  settings. Callback URL Supabase shows:
  `https://jdxjskqdvwqarfhcqjlg.supabase.co/auth/v1/callback`
- Isolation test passed Nov 19, 2026 (migrations 0001–0008): client 1 case,
  assigned professional 1 case, unassigned professional 0 client rows on
  every case-scoped table.
- **Separation rule:** EVERY app is separate — its own Vercel project
  connected to its own Supabase project/account, never touching each other,
  never sharing keys/data. Immigration with NIPTEI is Vercel `itfw-live` →
  Supabase "Immigration" ONLY.

## 2. Vercel env vars needed (names only — NO values)

Set in Vercel project `itfw-live` (nipteiapp account). Supabase keys are
**NOT yet in Vercel**.

- `NEXT_PUBLIC_SUPABASE_URL` (= https://jdxjskqdvwqarfhcqjlg.supabase.co)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only, never `NEXT_PUBLIC_`)
- `NEXT_PUBLIC_APP_URL` (= https://immigration.niptei.com)
- Stripe (account CONFIRMED Nov 24, 2026 — IMMIGRATION WITH THE FEET
  WASHERS, acct_1UVh7DPfd9SRUcvh, LIVE mode, USD; 132 Prices created
  Nov 24, 2026; 63 old Oct 29 Prices archived, nothing deleted).
  Set in Vercel `itfw-live` (Production + Preview):
  `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
  `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, plus the subscription Price IDs
  (public — see `portal/.env.example` and §3A):
  `STRIPE_PRICE_PREPARER_49`, `STRIPE_PRICE_ATTORNEY_99`,
  `STRIPE_PRICE_NONPROFIT_STD_2450`, `STRIPE_PRICE_NONPROFIT_FULL_4950`,
  `STRIPE_PRICE_STUDENT_35`, `STRIPE_PRICE_EMPLOYER_49`,
  `STRIPE_PRICE_MEMBER_MONTHLY_980`, `STRIPE_PRICE_MEMBER_YEARLY_9800`.
  Webhook endpoint (real route):
  `https://immigration.niptei.com/api/stripe/webhook`
  (NOT `/api/webhooks/stripe` — that route does not exist).
  Register it in Stripe (Dashboard → Developers → Webhooks) with events
  `checkout.session.completed` + `invoice.paid` — NOT registered yet.
- AWS SES — platform email sender (replaces Resend, Nov 28, 2026):
  `AWS_SES_REGION` (default us-east-1 in code), `AWS_ACCESS_KEY_ID`,
  `AWS_SECRET_ACCESS_KEY`, `EMAIL_FROM` (default updates@niptei.com).
  Login codes + notifications send through SES (see §3B). Resend is
  NO LONGER the platform sender — do not re-add `RESEND_API_KEY` /
  `RESEND_FROM_EMAIL`. Sender `updates@niptei.com` is UNVERIFIED until
  the niptei.com domain identity is verified in SES (see §3B).
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`,
  `TWILIO_WHATSAPP_NUMBER` (each professional's OWN Twilio — platform
  never sends from a personal number).
- `GOOGLE_TRANSLATE_API_KEY` (translation — NOT connected).
- USCIS Sandbox first: `USCIS_CLIENT_ID`, `USCIS_CLIENT_SECRET`,
  `USCIS_API_BASE_URL`. The USCIS Team App is approved for Sandbox; the
  founder still needs to click "Add key" in the USCIS Developer Portal.
  USCIS Production keys do NOT exist yet.

## 3. Migrations — run order 0001 → 0020 (strict filename order)

**0001–0020 are ALL LIVE** (run in Supabase Nov 19 + Nov 24, 2026).
0009–0020 ran Nov 24, 2026 in order in the SQL Editor; 0013 failed first
run (ERROR 42P16 — cannot change name of view column) and was fixed on
disk (drop view + recreate) before a clean re-run. **Migration 0019 has
run** (role-escalation blocker). **Do NOT wire Supabase Auth live until
the founder decides 0003 §7a** (founder/admin DB read of client
documents — §3, Known DB gaps). Isolation re-test with real rows is still
open: the DB holds no user data yet, so the per-role outcome (client 1 /
assigned 1 / unassigned 0) could only be verified structurally.

| # | File | Contents | Status |
|---|------|----------|--------|
| 0001 | `0001_itfw_core.sql` | accounts, professional_profiles, cases, inbox, documents (vault), messages, invoices, signatures, appointments, case watch, audit log, RLS | LIVE |
| 0002 | `0002_itfw_extended.sql` | fee schedules, payment plans, family invites, employers/jobs/talent board, custom quotes, NVC trackers, RFE uploads, admin audit log, site content | LIVE |
| 0003 | `0003_itfw_power_backend.sql` | Enum fix (law_student/teacher/founder; law_student_35, employer_49), indexes, installment-sum enforcement, RLS for every table, audit + updated_at triggers, `cases_due_next_7_days` view | LIVE |
| 0004 | `0004_itfw_onboarding_student_teacher.sql` | onboarding_status, student_profiles, teacher_profiles, case_student_assignments | LIVE |
| 0005 | `0005_itfw_timelines_questionnaire_audit_nudges.sql` | timelines, questionnaire_responses, audit items, reminder nudges | LIVE |
| 0006 | `0006_itfw_orders_shipments_notices.sql` | orders, shipments, notices, order_invoices | LIVE |
| 0007 | `0007_itfw_rls_role_gapfill.sql` | RLS role gap-fill | LIVE |
| 0008 | `0008_itfw_rls_recursion_fix.sql` | RLS recursion fix | LIVE |
| 0009 | `0009_itfw_agency_family_arrangements.sql` | agency/family arrangements, payment_arrangements | LIVE (Nov 24, 2026) |
| 0010 | `0010_itfw_leads_nvc_lifecycle_notifications.sql` | leads, NVC lifecycle, notification_logs | LIVE (Nov 24, 2026) |
| 0011 | `0011_itfw_rls_deploy_gapfill.sql` | RLS deploy gap-fill | LIVE (Nov 24, 2026) |
| 0012 | `0012_itfw_preparer_gaps.sql` | preparer_profiles, preparer_case_todos, preparer_case_notes (provider-only), preparer_rfe_items, preparer_attorney_referrals | LIVE (Nov 24, 2026) |
| 0013 | `0013_itfw_public_profiles_view.sql` | public_profiles view (storefront listing gate) | LIVE (Nov 24, 2026) |
| 0014 | `0014_itfw_unified_comms_byo_service_sync.sql` | provider_settings, message_sends, message_translation_flags, case_contact_preferences, case_renewals, case_referrals, appointment_reminders | LIVE (Nov 24, 2026) |
| 0015 | `0015_itfw_storefront_sections_addons.sql` | storefront sections / add-ons | LIVE (Nov 24, 2026) |
| 0016 | `0016_itfw_next_step_stage_payment_comms.sql` | case_post_submission, case_route_changes, case_next_steps | LIVE (Nov 24, 2026) |
| 0017 | `0017_itfw_reviews_referrals_renewals_booking.sql` | reviews, referrals, renewal widening, consultation_requests, preparer_appointments | LIVE (Nov 24, 2026) |
| 0018 | `0018_itfw_visa_bulletin_uscis_templates.sql` | Visa Bulletin manual entries, USCIS templates | LIVE (Nov 24, 2026) |
| 0019 | `0019_itfw_block_role_escalation.sql` | BEFORE UPDATE trigger blocking role changes by non-admin/founder; recreates `block_self_verification` exempting founder as well as admin | LIVE (Nov 24, 2026) — **must run before Auth goes live** |
| 0020 | `0020_itfw_login_codes.sql` | Server-only login_codes table (SHA-256 code hash, 10-min expiry, 3-wrong 15-min lock, one use) | LIVE (Nov 24, 2026) |

### Renumbering record (Nov 19–20, 2026 consolidation)

The repo originally had **three duplicate numbers** (two 0012s, two 0013s,
two 0016s). None of 0009+ had run live, so the duplicates were renumbered
to the next free numbers, dependency-preserving (not literal "next free"
— 0016-renewals ALTERs `case_renewals` created in the comms file, so
comms must run first):

- 0012 `preparer_gaps` — KEPT; 0013 `public_profiles_view` — KEPT.
- 0013 `unified_comms_byo` → **0014**; 0014 `storefront` → **0015**;
  0015 `next_step` → **0016**.
- Both 0016 files **merged into 0017**
  (`0017_itfw_reviews_referrals_renewals_booking.sql`): the two files both
  created `public.reviews` with different columns — running both would have
  failed. Canonical reviews schema = the renewals_booking file, because
  portal code (`src/lib/reviews.ts`, `ReviewsSection.tsx`) matches it
  exactly. The merged file also carries the stricter moderation trigger
  (founder/admin may NOT edit content either; service-role bypass via
  `auth.uid() IS NULL`; professional reply-only; un-hide logged as
  `review_unhidden`), the renewal CHECK union set, both referral_code
  columns, `consultation_requests`, `preparer_appointments` decision
  columns, and `medical_exam_date` + `panel_physician`.
- 0012 `visa_bulletin` → **0018**.
- New **0019** (role-escalation trigger) and **0020** (login codes) written
  in this pass.

All 20 files parse (pglast, 657 statements, 0 failures). Cross-check: 68
tables/views created, none created twice; all FK/ALTER targets resolve; no
`users` / `provider_profiles` / `case_documents` / `case_messages` /
`case_audit_logs` tables; no NUMERIC dollars (integer cents only); no
`split_50_50`; vault bucket only (0003 CHECK `storage_bucket='vault'`).

Note on 0003: its `ALTER TYPE ... ADD VALUE` statements cannot run inside
a transaction block; if the SQL Editor reports that error, run those
statements on their own first, then run the rest of 0003.

### Known DB gaps (founder decision needed)

- **0003 §7a founder/admin SELECT on every case-scoped table.** The UI
  enforces the stricter rule (verification queue + audit log only —
  `src/lib/isolation.ts` `canViewCase()` returns false for
  `founder_admin` on case content), but in the database today a founder
  CAN read a client's documents. Closing it means dropping/replacing the
  0003 `select_founder_admin_*` policies in a follow-up migration, after
  the founder decides. **Do NOT wire Supabase Auth live until this is
  decided.**
- **Role-escalation flaw FIXED by 0019** — 0001's `accounts_update_own`
  let a client change their own `role` to `admin`. 0019 adds the BEFORE
  UPDATE trigger and **HAS RUN live (Nov 24, 2026)**. Supabase Auth must
  still NOT go live until the founder decides 0003 §7a above.
- `preparer_case_notes` / `preparer_case_todos` (0012) are preparer-only
  by design. Widening them to attorneys/DOJ reps needs a founder
  decision (see 0014 header).
- `consultation_requests` (0017) has no API route yet; booking requests
  go through `preparer_appointments`.

## 3A. Stripe wiring — portal (Nov 24, 2026)

**Account:** IMMIGRATION WITH THE FEET WASHERS, `acct_1UVh7DPfd9SRUcvh`,
LIVE mode, USD. Login is thefeetwashers@gmail.com (saved in the Secure
Vault). **132 Prices created Nov 24, 2026, all LIVE** — bundles,
subscriptions, 92 single-form tiers, DIY/Review, 16 add-ons, speed,
bundle-monthly. 63 old Oct 29 Prices archived (never deleted). Full
Price-ID table: `AUDIT-2026-11-24.md` (Stripe section). **GovWin OS
(`acct_1UYhRHPZebjmuzoH`) is a DIFFERENT Stripe account — never use it
for Immigration work.**

**Portal code (this repo):**
- `src/lib/stripePrices.ts` — locked Price-ID map (132 Prices) + lookup
  helpers. The checkout endpoint validates against THIS map in code —
  it never accepts an arbitrary Price ID from the client.
- `src/lib/stripeClient.ts` — server-only Stripe client (`stripe`
  17.5.0, pinned). `getStripe()` returns null when
  `STRIPE_SECRET_KEY` is missing (→ 501). `applyMonthlyStop()` converts
  a monthly subscription into a Subscription Schedule with a fixed
  number of iterations (6 or 12) and `end_behavior: cancel`.
- `src/app/api/checkout/route.ts` — POST /api/checkout. Body:
  `{ priceId }` (or `{ items: [{ priceId, quantity }] }`),
  optional `plan` (`full` / `installments_3` / `monthly_6` /
  `monthly_12`), `email`, `accountId`, `caseId`. Mode: `payment` for
  one-time, `subscription` for recurring. Unknown Price ID → 400.
  Missing key → 501. **Pay in 3:** Stripe Checkout has no native
  Pay-in-3 — the endpoint charges **Instalment 1 only** (one-time Price,
  amount = total / 3, labelled in the Checkout description) and records
  the 3-instalment plan in `payment_plans` (migration 0002) when a
  `caseId` + `accountId` are supplied; instalments 2–3 are due before
  filing and are NOT auto-charged. **Monthly Bundle:** recurring Price
  + Subscription Schedule with iterations 6 or 12 (applied by the
  webhook; see below), so it STOPS after 6/12 payments. Standard
  monthly totals are $1,798.98 (6×$299.83) / $1,799.04 (12×$149.92)
  vs $1,799 — the founder's exact monthly amounts are used unchanged
  and the 2¢/4¢ difference is shown in the Checkout description.
- `src/app/api/stripe/webhook/route.ts` — POST /api/stripe/webhook
  (real handler, replaces the old 501 skeleton). Verifies the Stripe
  signature with `STRIPE_WEBHOOK_SECRET` first — an unverified payload
  is rejected with 400 and changes nothing. Missing secret → 501.
  `checkout.session.completed`: applies the monthly 6/12 stop (via
  `applyMonthlyStop`); records the paid invoice in `invoices`
  (migration 0001) when session metadata has `case_id` + `account_id`;
  for a professional subscription sets
  `professional_profiles.subscription_status = 'active'` and flips
  `is_published = true` **only when** `accounts.verification_status`
  is already `'verified'` — payment alone never publishes a listing.
  `invoice.paid`: marks the matching `invoices` row `paid` (by
  `stripe_invoice_id`); if no row matches, no row is invented.
- `src/components/CheckoutButton.tsx` — shared client button calling
  /api/checkout, redirecting to the Stripe Checkout URL, showing the
  honest 501 message ("Stripe checkout not connected yet") while the
  key is not set. Wired into: registration summary
  (`CheckoutSummary.tsx` — paid roles) and the storefront 5-step
  checkout (`/p/[slug]`, step 5 — locked form prep fee only, Pay in
  Full or Pay in 3; professional add-ons have no locked Price ID, so
  they are billed separately by the professional).
- `src/app/api/register-role/route.ts` now returns the locked
  `priceId` (not a price env var) for paid roles.
- Google button text fixed Nov 24, 2026
  (`GoogleSignInButton.tsx`): Google login DOES require the 6-digit
  email code after Google — the button now says so.

**Still to do (founder / browser task):**
1. Set `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`,
   `STRIPE_WEBHOOK_SECRET` in Vercel project `itfw-live`
   (Production + Preview).
2. Register the webhook endpoint in Stripe:
   `https://immigration.niptei.com/api/stripe/webhook`, events
   `checkout.session.completed` + `invoice.paid`.
3. **Monthly stop is NOT set on the Prices** — Stripe's Add-price
   dialog has no cycles field. The stop is applied by the webhook
   (Subscription Schedule, 6/12 iterations, `end_behavior: cancel`)
   when a bundle-monthly subscription is created. If the webhook has
   not run yet, the stop must be applied manually in the Dashboard
   (Subscriptions → Duration → 6 or 12 cycles).
4. **The 50% missed-payment rule has NO Stripe setting** — Settings →
   Billing → Subscriptions offers only retries, then cancel / pause /
   mark unpaid / leave past-due. The rule is shown to the client and
   handled manually. Do NOT create a penalty price.
5. Account gaps (Nov 24, 2026): phone verification still required to
   process payments from the Dashboard; no payout bank on file; no
   webhook endpoint (step 2 above); Stripe Connect not enabled.
6. **BYO Stripe** (professional back offices): each professional
   connects their own Stripe to charge their own clients — platform
   never holds money or splits legal fees. Not yet wired live.

## 3B. AWS SES — platform email sender (replaces Resend, Nov 28, 2026)

**Founder decision:** the platform sender is AWS SES, not Resend —
SES costs $0.10 per 1,000 emails with no monthly fee. Resend is NO
LONGER the platform sender; do not re-add `RESEND_API_KEY` /
`RESEND_FROM_EMAIL`. (A professional may still connect their OWN
Resend account as a BYO provider — that is separate, see
`portal/src/lib/byo.ts`.)

**Portal code (this repo):**
- `portal/src/lib/email.ts` — single shared sender module
  (`@aws-sdk/client-ses` 3.1179.0, pinned). Reads `AWS_SES_REGION`
  (default us-east-1), `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`,
  `EMAIL_FROM` (default updates@niptei.com). `sendEmail()` returns
  `email_not_configured` (no network call) when the keys are missing,
  and `sender_not_verified` / `recipient_not_verified` /
  `ses_rejected` / `ses_unreachable` on SES failures — it never claims
  success when SES refused. Keys are never logged or returned.
- Wired through it: login codes (`src/app/api/auth/login/route.ts`
  — 6-digit, 10-min, one-use per migration 0020; generation/verify
  logic unchanged, only the send step), stage notifications
  (`src/app/api/notify-stage/route.ts` — email channel actually sends
  via SES when configured, 200 with sentCount; SMS/WhatsApp still
  logic-only), supervisor confirmation emails
  (`src/app/api/register-role/route.ts`), unified-thread email
  (`src/app/api/messages/send/route.ts`), BYO test-send for provider
  `aws_ses` only (`src/app/api/byo/test-send/route.ts` — to the
  professional's OWN email, never a client). `/api/reminders` still
  returns 501 — it takes no recipient payload yet.
- Smoke test: `portal/scripts/smoke-ses.ts` (FAKE credentials only,
  no email sent) — 10/10 passed Nov 28, 2026.
- Verification Nov 28, 2026: `npx tsc --noEmit` exit 0; clean
  sequential `npm run build` exit 0 (40 routes: 21 API + 19 pages).

**AWS-side steps still needing the founder (NOT done in code):**
1. In AWS SES, verify the niptei.com domain identity (SES → Verified
   identities → Create identity → Domain).
2. Add the DKIM DNS records SES shows into IONOS DNS for niptei.com
   (SES gives 3 CNAME records; wait for SES to show "Verified").
3. Request production access out of the SES sandbox (SES → Account
   dashboard → Request production access) — in sandbox SES only sends
   to verified addresses, so no client would receive a login code.
4. Create an IAM user/key with `ses:SendEmail` only (least privilege),
   for the portal.
5. Set the four env vars in Vercel project `immigration-niptei`
   (Production + Preview): `AWS_SES_REGION`, `AWS_ACCESS_KEY_ID`,
   `AWS_SECRET_ACCESS_KEY`, `EMAIL_FROM` — then redeploy.
6. Send one real test login code to the founder's own email and confirm
   it arrives before telling clients login works.

## 4. Portal — what is built (all in `portal/`)

Next.js 14.2.5 app (`immigration-niptei-portal@0.1.0`). Build + type-check
status: **PASSING as of Nov 20, 2026** — `npm run build` exit 0 (compiled
successfully, 37/37 static pages; routes include `/login`, `/register`,
`/auth/callback`, `/teacher-dashboard`, `/api/auth/login`,
`/api/register-role`) and `npx tsc --noEmit` exit 0. Note: the first
final-build attempt failed at the last step with a Next.js `ENOENT`
renaming `.next/export/500.html` (no custom 500 page exists; the file was
already present in `.next/server/pages/`); a clean retry passed — treat
as a build-tool race, not a code error. If it recurs, re-run the build
before investigating code.

### Account set-up (registration + login, all 7 roles)

- **Roles:** Client, Preparer, Attorney, DOJ Nonprofit, Law Student,
  Teacher, Founder/Admin. Role-first, nothing pre-selected; 6 role cards
  on `/register` (Founder/Admin is login-only, never self-registered).
- **Register:** `src/app/register/page.tsx` + `src/app/api/register-role/route.ts`
  + `src/components/onboarding/RoleForms.tsx`. Locked rules verified:
  `accounts` NOT `users`; `professional_profiles` NOT `provider_profiles`;
  `student_profiles` / `teacher_profiles` (0004); Supabase Auth user +
  password (12+ chars, server-enforced, live strength meter with 5
  checks); never `email_confirm: true`; preparers sign UPL, never
  "verified"; `is_listed` TRUE only via the Stripe webhook once the
  subscription is active AND verification is approved; 501 until Stripe
  is live.
- **Login — password + 6-digit email code, EVERY login, no exceptions:**
  - Step 1: email + password checked by `POST /api/auth/login`
    (`portal/src/app/api/auth/login/route.ts`). The password is verified
    against Supabase Auth and the session is DISCARDED — no login exists
    until step 2.
  - Step 2: 6-digit code checked by `POST /api/auth/verify-code`
    (`portal/src/app/api/auth/verify-code/route.ts`). Code rules
    (migration 0020, `src/lib/loginCodes.ts`): 10-minute expiry, one use,
    3 wrong codes lock the email 15 minutes, only the latest unused code
    counts. The code is stored only as a SHA-256 hash and never returned.
    Only then is a session created (password logins get tokens back;
    Google logins keep the OAuth session they already hold).
  - Google: Supabase Auth (Google provider, already enabled). Google
    verifies the email — and the user STILL gets a code after Google:
    `/auth/callback` POSTs `/api/auth/login { email, oauthAccessToken }`
    and sends the user to `/login?step=code&email=…&oauth=1`. The user is
    NEVER redirected straight to their role destination.
  - **Founder/Admin: email + password + code ONLY.** No Google button for
    Founder/Admin anywhere; no remember-device option anywhere.
  - If Resend is not connected the login API answers 501
    `email_not_configured` and the page says so honestly — no code is
    pretended sent.
  - Destinations (`src/lib/loginCodes.ts redirectAfterLogin`, kept in
    sync with `src/lib/googleAuth.ts roleDestination`): client →
    `/portal`; preparer → `/preparer-dashboard`; attorney, nonprofit AND
    law_student → `/legal-back-office`; teacher → `/teacher-dashboard`;
    founder/admin → `/admin/verifications`.
- **Teacher Dashboard (built Nov 19–20, 2026):**
  `src/app/teacher-dashboard/page.tsx` + `src/app/api/teacher/students/route.ts`.
  Lists the students who named the teacher (by `teacher_email`, 0004).
  Confirm/Reject sets ONLY `student_profiles.confirmation_status` (+
  `confirmed_at`/`confirmed_by`). A teacher who is not approved yet
  (`verification_status != 'verified'`) can SEE students but the buttons
  are disabled until a founder approves them in `/admin/verifications`.
  The student's `accounts.onboarding_status` is NOT touched — it flips
  only on admin verification. Caller is identified by Supabase Auth
  access token (`Authorization: Bearer`), never by an account id in the
  body. 501 until env vars are set.
- **Verification queue:** `/admin/verifications` (+
  `src/components/admin/VerificationQueue.tsx`) — EXAMPLE local state
  only for now (attorney/nonprofit rows; needs teacher row type added
  when wired; no student confirmation; no Supabase wiring yet).
- **Demo-login residue removed in this pass:** the legal back office's
  "Simulate Verified Credential" checkbox is gone — `verified` is now
  always false until real verification lands (the "Preview As Role"
  switch stays, labelled DEMO, because the page cannot know the role
  without a session). The Supabase-OTP login flow (`signInWithOtp` /
  `verifyOtp`, no password) was replaced by password + custom code.

### Dashboards & portal features (verified Nov 19–20, 2026)

- **Client Portal** (`/portal`), **Preparer Command Center**
  (`/preparer-dashboard`), **Attorney/DOJ/Law Student Legal Back Office**
  (`/legal-back-office`, Roles 3/4/5 only), **Teacher Dashboard**
  (`/teacher-dashboard`), **Founder/Admin Verification Dashboard**
  (`/admin/verifications`), **Company Back Office**
  (`/company-back-office`), **Family Portal** (`/family-portal/[token]`,
  needs Supabase + 0009), storefront **`/p/[slug]`** (listing gate =
  0013 `public_profiles` view), **Lead Sheet + 6-Stage Lifecycle**,
  **NVC/CEAC tracker** (`src/lib/nvc.ts`, CEAC login URL, manual post
  lookup — no live USCIS lookup).
- **Smart Intake Calculator** (`src/components/portal/SmartIntakeCalculator.tsx`,
  `src/lib/intakeCalculator.ts`) and **Dynamic Intake Engine**
  (`src/components/DynamicFormIntakeEngine.tsx`) — all forms incl.
  I-131 / I-751 / I-539 / I-129F + I-589 (`src/lib/dynamicIntakeSchemas.ts`).
  The attorney option bar is on EVERY form page in BOTH modes (DIY and
  preparer): "A licensed attorney can protect you. Only an attorney gives
  legal advice." DIY $25 / Review $99 / Human Review $199.
- **Ask NIPTEI AI Copilot + BYO AI** — rule-based FAQ; 501 for AI until a
  provider is connected; no fake AI. BYO keys stored only as an encrypted
  key reference (0014 `provider_settings.encrypted_key_reference`), last
  4 chars shown only.
- **Unified Communication + Translation** — one thread per case, original
  + English, numbers/dates/prices never altered. Google Translate NOT
  connected (501). SMS/WhatsApp/Email go through the professional's OWN
  Twilio/Resend — never the founder's personal number, never claimed
  sent.
- **Colour-coded documents; Next Step + Stage + Payment + Communication
  engine** — inside-US vs outside-US flows, never mixed; route switches
  logged to `audit_log` + `case_route_changes` (0016).
- **Payment centre** — locked plans only: Pay in Full / Pay in 3 /
  Monthly 6 / Monthly 12. Missed-payment 50% rule with exact math:
  `missedPaymentTotal = Math.round(totalCents * 1.5)`, displayed in the
  Payment Centre (`missedPaymentMath`) and the back-office roadmap.
  Invoice sending is a Stripe skeleton — 501, never claimed live.
- **Visa Bulletin Matcher** — manual entry only (travel.state.gov URL).
- **Reporting + Money Ladder** — real tables only, honest empty states.
- **Reviews** (real only, 0017 — consented, stage-6 closed cases only),
  **Refer-a-Family** (0017, real counts from `preparer_leads`, reward
  amount NOT set — founder decision), **Renewal Reminders** (0017,
  derived from real case dates only, never invented), **Booking +
  Embassy/Medical scheduling** (0017 `preparer_appointments`; calendar
  NOT connected — booking collects requests, the professional confirms
  by message).
- **Service-Level Permissions Matrix** — `portal/docs/permissions-matrix.md`
  + visible `PermissionsPanel` per dashboard.
- **PDF Auto-Fill + Packet Merger** — DRAFT only, blocked until audit
  100%; templates from uscis.gov; unverified mappings marked.
- **Template Upload + Verification Workflow** — `TemplateVerification`
  component in the back office.
- **G-28:** hidden/blocked for preparers (`ComplianceGuardrails`,
  `UplBadge`); legal-back-office G-28 section attorney/nonprofit only;
  EOIR-28 locked for partial DOJ (Full + verified only).
- **Students:** assigned-only (`case_student_assignments`, 0004);
  E-Sign / G-28 / Billing locked; `StudentSupervisionGuardrail`
  (preparer dashboard) states the rule — a preparer CANNOT supervise,
  assign, or approve a student draft for legal content; clerical help
  only when a verified attorney/DOJ supervisor is recorded. (There is NO
  `preparer_student_help_requests` table — the guardrail's help requests
  are local-only example state; do not invent the table.)
- **DIY:** the Preparer section stays blank in the intake engine
  (`DynamicFormIntakeEngine`).
- **Locked prices (do not change without the founder):** bundles
  $999 / $1,799 / $2,799; I-485 $1,440; DIY $25 / Review $99 / Human
  Review $199; preparer $49/mo, attorney $99/mo, DOJ nonprofit
  $24.50/$49.50/mo, law student $35/mo, client $9.80/mo or $98/yr.
  **To be confirmed before quoting:** I-765, I-90, I-864 in `bundles.ts`
  are marked TO BE CONFIRMED; no I-130+NVC or I-821+I-765 combined price;
  Premium extras TO BE CONFIRMED; Member tier details TO BE CONFIRMED.

### APIs (all 501 until env vars are set — nothing sends/charges live)

`src/app/api/` — register-role, google-profile, auth/login,
auth/verify-code, teacher/students, reviews, referrals, renewals,
bookings, messages/send, reminders, notify-stage, stripe/webhook (REAL
handler — signature-verified, §3A), checkout (real Stripe Checkout
Session endpoint, §3A), pdf/autofill, generate-packet. Twilio / Resend /
Google Translate / USCIS Production / carrier / E-Sign are all labelled
NOT connected / 501. No keys or secrets in code (only an `AKIA…`
placeholder string in `src/lib/byo.ts`); `.env.example` holds only
public Stripe Price IDs (no secrets).

## 5. Corrections made in this consolidation pass (Nov 19–20, 2026)

1. **Migrations renumbered/merged** — three duplicate numbers resolved
   (0012/0013/0016), 0017 merged, 0019 + 0020 written (§3).
2. **Login rebuilt to password + custom code** — Supabase OTP removed;
   login page, auth callback, and `googleAuth.ts` role destinations
   reconciled to the task mapping (§4).
3. **Teacher Dashboard built** — page + API route (§4).
4. **RoleForms fixed** — real email-confirmation check instead of
   self-attestation; fake "Simulate teacher confirmation" button removed;
   teacher form posts for real in both modes (password in email mode);
   admin card replaced with a `/login` link.
5. **Legal back office demo-verification removed** — "Simulate Verified
   Credential" checkbox deleted; verified tools stay locked until real
   verification.
6. **Migration-number sweep** — stale 0013/0016 references fixed in
   `lib/byo.ts`, `lib/caseTools.ts`, `lib/booking.ts`,
   `api/messages/send/route.ts`, `components/comms/UnifiedThread.tsx`,
   `components/comms/ByoSettings.tsx`, `components/comms/CaseTools.tsx`,
   `components/nextstep/PaymentCentre.tsx` (payment_arrangements is 0009,
   not 0016), `docs/permissions-matrix.md`. Also fixed: `caseTools.ts`
   claimed `case_notes`/`case_tasks` tables that do not exist — the real
   tables are `preparer_case_notes` / `preparer_case_todos` (0012); the
   permissions matrix wrongly said the role-escalation gap was still open
   — it is fixed by 0019.
7. **README + `.env.example` updated** — README Backend section now lists
   all 20 migrations with LIVE vs WRITTEN ONLY; `.env.example` gains
   `RESEND_FROM_EMAIL` (login codes need it).
8. **Teacher role added to register** — `register-role` route +
   register page (6th role card) + `google-profile` route.

## 6. Deploy steps (founder / browser task — NOT done by this pass)

> **Superseded for the portal by §10 (Nov 24, 2026):** the portal now
> deploys as its OWN Vercel project (`itfw-portal`), NOT into
> `itfw-live`. Steps 1 (GitHub repo) and 3 (Vercel) below are replaced
> by §10. Step 2 (Supabase) is already done — migrations 0001–0020
> are LIVE. Step 4 (domain) is unchanged: `immigration.niptei.com`
> stays on `itfw-live`.

1. **GitHub repo** — `thefeetwashers/ITFW-Live`. The `gh` CLI in this VM
   is NOT logged in. A GitHub login IS saved in the Secure Vault for
   github.com (username + password), but its value cannot be read out to
   run `gh` — the browser / parent agent must use it. Do NOT touch the
   `thefeetwashers/NIPTEI-Shop` repo. Do NOT use the `info@ncgod.org`
   account. Commands once authenticated as `thefeetwashers`:
   ```bash
   cd ~/workspace/itfw-live
   git init
   git config user.name "thefeetwashers"
   git config user.email "thefeetwashers@gmail.com"
   git add index.html README.md vercel.json .env.example .gitignore supabase DEPLOY.md
   git commit -m "ITFW Live: static Live Public webapp + Supabase migrations"
   gh repo create thefeetwashers/ITFW-Live --public --source=. --remote=origin --push
   # Expected: https://github.com/thefeetwashers/ITFW-Live
   ```
   Note: the repo currently has 1 commit (`0bac70d`); `portal/` +
   migrations 0003–0020 are untracked and DEPLOY.md/README.md/index.html
   are modified uncommitted. Do NOT commit/push without the founder
   saying so.
2. **Supabase** — run 0009–0020 in the SQL Editor in order (§3). The
   vault bucket already exists (private). Isolation test again after
   0009+ run (client 1 / assigned 1 / unassigned 0).
3. **Vercel** — project `itfw-live` (nipteiapp account) → Settings → Git
   → connect `thefeetwashers/ITFW-Live`, production branch `main`. Set
   the env vars in §2. Redeploy (or push — auto-deploy does it).
4. **Domain** — `immigration.niptei.com` is ALREADY added to project
   `itfw-live` (Valid Configuration, Nov 14, 2026) and already pointed
   in IONOS: `CNAME | immigration | e6285fa37c4c09c6.vercel-dns-017.com`.
   Do NOT re-add it and do NOT change it. Do not copy DNS records from
   another project. Do not touch MX/email records or the apex
   `thefeetwashers.com` records. (A separate domain,
   `immigration.thefeetwashers.com`, is NOT pointed at this project.)
5. **Verify before claiming live** — open the `*.vercel.app` URL in a
   fresh browser and check: I-485 Paper $1,440, Bundle $999 / $1,799 /
   $2,799 with savings $528 / $649 / $451, VAWA page, U visa page, live
   chat button, top language bar (7 languages), no old prices ($1,199 /
   $1,999 / $2,999). Then verify `immigration.niptei.com` the same way.
   (Note: the v33 redeploy is handled by a separate browser task —
   this pass does not touch it.)
6. **Static export note** — `index.html` in this repo is the exported
   Live Public webapp (md5 `b69f4c883971a060061fed26ce1a1f39`, exported
   Nov 19, 2026, 22:31 UTC). The portal in `portal/` is the Next.js app
   that replaces it once deployed.

## 7. Open gaps (with reason)

- **Portal not deployed; env vars not in Vercel; Stripe keys + webhook
  not set** (founder action — Vercel sign-in as nipteiapp@gmail.com;
  set the §2 vars; register the webhook in Stripe, §3A). Twilio /
  Resend / Google Translate / USCIS Production / carrier / E-Sign NOT
  connected (live provider + keys).
- **Migrations 0009–0020 ARE LIVE (Nov 24, 2026)** — isolation re-test
  with real rows still open (DB holds no user data yet).
- **Founder/admin DB conflict (0003 §7a)** — needs a founder decision +
  follow-up migration to drop/replace `select_founder_admin_*` policies
  (§3). Do NOT wire Auth live until decided.
- **Role-escalation fix (0019) HAS RUN (Nov 24, 2026)** — Auth still
  must NOT go live until §7a is decided.
- **VerificationQueue is example local state only** (needs Supabase
  wiring + teacher row type; no student confirmation yet).
- **Dashboard-level session gating (middleware / `getUser` checks per
  dashboard) still open** — the login flow is code-complete; dashboards
  currently use EXAMPLE data until wired.
- **`consultation_requests` (0017) has no API route yet.**
- **Referral reward amount NOT set** (founder decision).
- **Prices TO BE CONFIRMED before quoting** — I-765, I-90, I-864;
  I-130+NVC / I-821+I-765 combined prices; Premium extras; Member tier
  details (§4).
- **USCIS templates upload + attorney review** — installment contract,
  refund policy, UPL, retainer/trust (attorney review; templates from
  uscis.gov).
- **Calendar NOT connected** — booking collects requests; the
  professional confirms by message.
- **Google for Nonprofits / Ad Grants** — separate track; Ad Grants
  Customer ID 138-080-4600 (approved). Two ads in the NC GOD INC
  Workforce campaign were disapproved for 'Destination not working'
  (404) — the exact final URLs must be pulled from Policy Manager,
  which only the founder can do.

## 8. Founder Decision Checklist

- [x] Stripe account — CONFIRMED Nov 24, 2026 (acct_1UVh7DPfd9SRUcvh);
  132 Prices created, 63 old ones archived (§3A). Still open: set the
  Stripe keys in Vercel + register the webhook endpoint in Stripe.
- [ ] Vercel sign-in as nipteiapp@gmail.com — set the env vars in §2,
  connect GitHub repo, deploy.
- [ ] USCIS templates upload — templates from uscis.gov into the
  Template Upload + Verification Workflow.
- [ ] Attorney review — installment contract + refund policy + UPL +
  retainer/trust.
- [ ] Checklist 5-of-6 call — the 5-of-6 launch checklist decision
  (which item, if any, is deferred).
- [ ] Referral reward amount — set the Refer-a-Family reward (or
  confirm $0 / no reward).
- [ ] Founder/admin DB conflict (0003 §7a) — decide: drop/replace the
  `select_founder_admin_*` policies, or keep UI-only enforcement.
- [x] Migrations 0009–0020 — RAN LIVE Nov 24, 2026. Still open:
  re-run the isolation test once a real client case + assigned
  professional exist.
- [ ] Resend domain verification — verify the sender domain so
  `updates@niptei.com` (login codes + notifications) can send.
- [ ] Teacher approval flow — founder approves teacher accounts in
  `/admin/verifications` (the queue needs teacher rows wired).

## 10. Portal Deployment — separate Vercel project (Nov 24, 2026)

**Route (expert decision, Nov 24, 2026):** the portal deploys as its OWN
Vercel project, e.g. `itfw-portal`, under the nipteiapp-9260 account —
NOT into `itfw-live`. First target is the Vercel-assigned URL for that
new project (e.g. `https://itfw-portal.vercel.app`) — verify it live
there first. Do NOT assign `immigration.niptei.com` or any niptei.com
subdomain to it in this step; that DNS decision comes after the founder
sees it working on the Vercel URL. Do NOT link from the v33 site yet.
Do NOT touch the live v33 Production deployment `FgLzyTGab` (Nov 24,
2026), do NOT touch NIPTEI-Shop or any other Vercel project, do NOT
touch GovWin OS Stripe.

### Build re-verified Nov 24, 2026 (portal alone)

- `npx tsc --noEmit` — **exit 0**.
- One clean sequential `npm run build` (fresh `.next`, run alone) —
  **exit 0, 38/38 static pages** (was 37/37; the extra page is the new
  `/api/checkout` route). Routes include `/api/checkout` and
  `/api/stripe/webhook` (dynamic).

### GitHub push — BLOCKED, NOT pushed (Nov 24, 2026)

- Push manifest regenerated Nov 24, 2026:
  `~/workspace/itfw-push-manifest.txt` — **206 files, 4.57 MiB total**,
  NUL-terminated, all UTF-8, no missing files, no symlinks, no
  `node_modules/`, `.next/`, or `.env` files. Within the 2,000-file /
  16 MiB limits. Includes the corrected migration 0013 (drop-view fix)
  and the Stripe wiring files.
- **No sync record exists** (`~/workspace/itfw-live.muse-github-snapshot-sync.json`
  does not exist) — nothing has ever been pushed via the snapshot tool.
- **Repo verification FAILED — `thefeetwashers/ITFW-Live` was NOT found:**
  - `search_repositories "ITFW-Live user:thefeetwashers"` → total_count 0.
  - `search_repositories "user:thefeetwashers"` → 6 repos, none of them
    ITFW-Live: NIPTEI-Shop, clearpath-tax, govwin-site,
    Feet-Washers-Staffing, Wholesaling-OS, immigration-the-feet-washers.
    (Private repos ARE visible through this connector, so this is a
    real catalogue listing, not a visibility fluke.)
  - `list_commits thefeetwashers/ITFW-Live` → 404 Not Found.
  - `get_file_contents thefeetwashers/ITFW-Live README.md` → 404
    "failed to get repository info".
  - GitHub connector authenticated as `thefeetwashers` (id 282077324),
    account_id `0d44c6e5eed34c2db3bc37f63cdd1ef9`.
- **The push was STOPPED, per the task's hard rule — nothing was
  pushed, no commit SHA exists, no sync record was written.** The Nov 20
  discrepancy is now resolved the same way it appeared then: the repo
  does not exist under `thefeetwashers` as far as the connector can see,
  despite the founder's Nov 20 "repo created-ITFW-Live" message.
- **Two possible causes:** (a) the repo was never created, or was
  created under a different name/account; (b) it exists but was never
  added to the Muse GitHub App installation, so the connector cannot
  see it. **Do NOT force a push.** Resolution (founder / parent):
  open `https://github.com/thefeetwashers/ITFW-Live` in a browser and
  confirm whether it exists and is empty; if it exists but is invisible
  here, add it to the Muse GitHub App installation (repository
  selection). Note: `create_repository` via this connector returned 403
  on Nov 20, 2026 — GitHub App tokens cannot create user-account repos,
  so the repo must be created by the founder in the browser if it does
  not exist. Once the repo is confirmed to exist AND is empty, re-run
  the snapshot push with the regenerated manifest above (message:
  "ITFW Live: v33 public site + portal + Supabase migrations
  0001-0020"), verify with `list_commits` + `get_file_contents` for
  `index.html`, `portal/package.json`,
  `supabase/migrations/0020_itfw_login_codes.sql`, and write the sync
  record to `~/workspace/itfw-live.muse-github-snapshot-sync.json`.
- **Do NOT push to `thefeetwashers/immigration-the-feet-washers`** (the
  unrelated private repo created Nov 12, 2026) as a substitute.

### Vercel import — steps for the browser task (NOT run yet)

Prerequisite: the GitHub repo above must exist and contain the pushed
snapshot before this can run. Import as a NEW project in the browser,
signed in as nipteiapp@gmail.com (team nipteiapp-9260):

1. Vercel → Add New → Project → Import Git Repository →
   `thefeetwashers/ITFW-Live` (do NOT pick any other repo).
2. Project name: `itfw-portal`. Framework Preset: Next.js (auto-detected).
3. **Root Directory: `portal/`** (the Next.js app lives in
   `portal/`; the repo root holds the static v33 `index.html` and must
   NOT be the root — deploying the repo root would serve the wrong app).
   No `portal/vercel.json` exists; Vercel auto-detects Next.js 14.2.5.
   Build Command: `npm run build` (default). Output: default.
4. Environment variables (names only — values EMPTY here, never in a
   file or in chat; set in Vercel, Production + Preview):
   `NEXT_PUBLIC_SUPABASE_URL` (= https://jdxjskqdvwqarfhcqjlg.supabase.co),
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   (server-only), `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`,
   `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_APP_URL` (set to the NEW
   project's Vercel URL first, e.g. `https://itfw-portal.vercel.app` —
   NOT `https://immigration.niptei.com` yet), `RESEND_API_KEY`,
   `RESEND_FROM_EMAIL`.
   **Still to be supplied/set:** Supabase anon + service-role keys are
   NOT yet in any Vercel project; Resend is NOT connected
   (`updates@niptei.com` unverified). Stripe keys ARE already set in
   project `itfw-live` — the SAME live keys must be set in `itfw-portal`
   too (each Vercel project holds its own copy; do NOT move them out of
   `itfw-live`).
5. Deploy. Verify the Vercel URL fresh: home page loads, `/login`,
   `/register`, `/portal`, `/teacher-dashboard`, `/p/[slug]` respond;
   `/api/checkout` without a key returns 501 (honest, not a crash).
   Do NOT assign any domain in this step.
6. **Webhook URL changes:** the Stripe webhook currently registered
   is `https://immigration.niptei.com/api/stripe/webhook`
   (events `checkout.session.completed` + `invoice.paid`). The portal's
   webhook will live at
   `https://<new-project>.vercel.app/api/stripe/webhook` — the Stripe
   webhook must be **re-registered for that new URL** (and
   `STRIPE_WEBHOOK_SECRET` in `itfw-portal` updated to the new signing
   secret) before live checkout works. Flagged here, NOT done in this
   task. Until then the monthly 6/12 stop is not applied automatically
   (manual fallback: Dashboard → Subscriptions → Duration → 6/12 cycles).
7. Do NOT wire Supabase Auth live until the founder decides 0003 §7a
   (§3). Login codes need Resend connected first (§2).

### Still NOT live (after this task)

- Portal: NOT deployed anywhere; no Vercel URL yet.
- GitHub push: NOT done (repo not found — see above).
- Supabase env vars: NOT in any Vercel project; Resend NOT connected;
  0003 §7a decision still open; live isolation test with real rows
  still open (DB empty).
- Live site: unchanged — v33 static site on `immigration.niptei.com`
  (deployment `FgLzyTGab`, Nov 24, 2026), Stripe keys effective there
  via its env vars; portal checkout is NOT reachable from it yet.

## 9. What the portal does NOT do yet

Saved accounts/logins, saved cases, document vault as a live system, real
SMS/email alerts, live USCIS lookup — all need the Supabase backend +
env vars above wired in. Stripe checkout is wired in code (§3A) but
returns 501 until the Stripe keys are set in Vercel and the webhook is
registered — do not claim payments work until both are done and a
Checkout Session has been created in a live test. The static live site
(`immigration.niptei.com`, v33) is NOT the portal.

## 11. SEO + free-tools lead generator — Search Console / Bing guide (Nov 28, 2026)

The portal's SEO + lead-generator system (free-tools hub, per-form /
per-topic / per-language landing pages, sitemap, robots, JSON-LD) is
code in `portal/` — see the full guide in `portal/DEPLOY.md` §15,
including the exact founder-only steps for Google Search Console and
Bing Webmaster Tools and the sitemap URL to submit
(`https://immigration.niptei.com/sitemap.xml`).

Short version: after the portal is deployed, the founder — signed in
to her own Google and Microsoft accounts — verifies
`https://immigration.niptei.com/` in Search Console (HTML tag, given
to the builder for `src/app/layout.tsx`) and in Bing Webmaster Tools
(or via Bing's "Import from Google Search Console"), then submits the
sitemap URL above in each. SEO makes the platform findable; it does
NOT guarantee a ranking, traffic, or clients, and the product says so
on every public page. One founder decision is still open (portal
DEPLOY.md §15.4): `/api/leads` refuses enquiries with no professional
identified, so search traffic with no referral/storefront link cannot
be saved until the founder designates a platform intake fallback.

## 12. Expert build — coordinator final verification (Nov 28, 2026)

On Nov 28, 2026 the founder delegated a full expert build (26 parallel
work streams, code + migrations + docs only — nothing deployed, pushed,
or run live). What was built is in `portal/`; the gap table before/after
and per-stream reports are in `portal/docs/` (one dated report per
stream, e.g. `leads-pipeline-2026-11-28.md`, `diy-flow-2026-11-28.md`,
`standout-five-2026-11-28.md`, `fullstack-sweep-2026-11-28.md`,
`strengths-weaknesses-2026-11-28.md`, `dashboard-email-2026-11-28.md`).

**Coordinator verification (this pass, Nov 28, 2026, ~6:30 AM EST):**
- `npx tsc --noEmit` — exit 0.
- ONE clean sequential `npm run build` (fresh `.next`) — exit 0.
  52 pages, 60 API routes. No live deploy.
- All 27 smoke scripts in `portal/scripts/smoke-*.ts` — 27/27 pass
  (~1,515 checks, fake data only, nothing sent/charged/written).
- Migrations reconciled: 0021–0036 are now unique and sequential. The
  build briefly held TWO files named 0030 and TWO named 0033; resolved
  by rename only, no content changed (`0030_itfw_more_added.sql` →
  `0035_itfw_more_added.sql`; `0033_itfw_expert_tools.sql` →
  `0036_itfw_expert_tools.sql`). None of 0021–0036 have been run live.
- ONE build failure found and fixed in verification: the SEO builder's
  `src/app/p/[slug]/layout.tsx` and `src/app/r/[code]/layout.tsx`
  called `metaForPublicPath("/p/example")!` / `("/r/example")!`, but
  the sitemap guard rightly rejects `/p/` and `/r/` paths without a
  real slug/code, so both returned null and the build crashed reading
  `.title`. Fixed by exporting `STOREFRONT_META` / `REFERRAL_META`
  from `src/lib/seo.ts` and using them directly in both layouts
  (same copy, no invented slug). Build passes after the fix.
- Five smoke tests failed on first run and were fixed in verification:
  three read migration files by their old names (paths updated to
  0035/0036); `smoke-paywall-interview` expected 5 paywall-audit
  surfaces but the audit now honestly lists 6 (`packet_rescue_fix`
  added by the standout-five builder — test updated to 6);
  `smoke-expert-additions` barred any migration filename containing
  "expert", which the later expert-tools migration (0036) now trips —
  narrowed to safety/privacy migrations, which is what that builder
  was barred from adding.

**What the build added (high level):** lead generator + pipeline,
case-status sync, instant-answer chat wired into messaging, 6 role
cheatsheets, interview prep (63 questions, 25 official civics) +
6 video scripts (scripts only — no video produced), server-side
paywall gating, 4 role dashboards, guided DIY flow with pay-to-unlock
$25/$99 + save-and-resume + auto-transfer to the form, form chaining
for the Green Card Bundle, quote requests, case-aware news, daily home
(/today), case tracking + NVC with the honest "cannot see inside the
officer's file" note, USCIS/NVC/Embassy backbone, family-in-one-case,
7 languages, Packet Rescue free check, verified flat-price directory,
renewal radar, fee-waiver checker, cost estimator, vault expiry,
Journey Map + tell-a-friend + SEO foundation, professional discovery +
Google (not connected) + document resend, 20 differentiators, biometrics
tracker, AR-11 helper, emergency guide, sponsor calculator, Quick Exit,
scam guide, privacy page, printable guides, full-stack sweep (RLS
gapfill migration 0031, audit logging, rate limits, error handling),
strengths/weaknesses review + business tools (migration 0032),
SEO + free-tools hub (migration 0033), expert tools — e-sign,
video meetings, OCR (kept honestly unavailable), translation orders,
receipts, founder analytics, case export (migration 0036) — and
in-dashboard email with 32 drafted templates (migration 0034).

**Webhook fix (Nov 28, 2026, URGENT — landed before any push/deploy):**
The Stripe webhook gap found in this build is FIXED in code (not yet
deployed, migration 0037 not yet run live):
- `portal/src/lib/webhookRecords.ts` (new) — the database writes for
  a verified `checkout.session.completed`, testable without Stripe
  or Supabase; `portal/src/app/api/stripe/webhook/route.ts` now only
  verifies the signature, applies the monthly 6/12 stop, and
  delegates the writes. `portal/src/app/api/checkout/route.ts` now
  puts `form_code` in the Checkout Session metadata (validated DIY
  registry code first, else the single Price's locked formCode).
- On `checkout.session.completed` (paid): the invoices row now
  carries `form_code`; a DIY purchase writes a `diy_unlocks` row
  (migration 0024) — form_code / is_bundle / price / Stripe
  checkout session id, status 'paid'; a subscription purchase
  writes a `subscriptions` row (migration 0037, new table) —
  account + locked price key/id + plan + status 'active' + Stripe
  subscription/customer/checkout ids. professional_profiles plan +
  status set to 'active' (is_published ONLY when already verified);
  student_profiles.subscription_status set to 'active' for the Law
  Student price (migration 0037 added the column). All three writes
  are idempotent on replay (invoice by case+client+description /
  stripe_invoice_id; unlock by checkout session id; subscription
  by stripe_subscription_id) — a replayed event never double-writes.
- `src/lib/paywall.ts` now reads `public.subscriptions` and
  `student_profiles.subscription_status`, so a paying Member
  ($9.80/mo) or Law Student ($35/mo) with no case — and therefore
  no invoices row — is recognised and allowed. Until migration
  0037 is run live, the reader treats a missing subscriptions
  table as "no rows" and the old denial stands.
- `invoice.paid` still marks the matching invoice paid by
  stripe_invoice_id (no row invented) and now also flips a
  matching subscriptions row back to 'active'.
- Verification: new `portal/scripts/smoke-webhook-fix.ts` — 44/44
  assertions pass (fake Stripe signature at route level, fake
  in-memory Supabase for the writes; no real keys, nothing
  charged); `smoke-stripe.ts` 22/22, `smoke-paywall-interview.ts`
  56/56, `smoke-diy-flow.ts` 201/201 all still pass; `npx tsc
  --noEmit` exit 0; ONE clean sequential `npm run build` (fresh
  `.next`) exit 0. Locked prices untouched (still 132).
- One deliberate narrowing: the webhook no longer touches
  professional_profiles for a bundle-monthly subscription (a client
  buying a bundle is not a professional); professional keys
  (preparer/attorney/DOJ/employer) behave exactly as before.
- Migration 0037 `0037_itfw_webhook_subscription_records.sql`:
  creates `public.subscriptions` + adds
  `student_profiles.subscription_status`. Written, NOT run live —
  run 0001–0037 in order before relying on paywall enforcement.

**Still NOT live / still needs the founder (unchanged from §7–§10):**
SES keys in Vercel + niptei.com verification + DKIM + production
access; §7a decision (founder/admin DB read of client documents);
real login test end-to-end; real video production; USCIS Production
API (Sandbox only); live SMS (Twilio not connected); Google Cloud
OAuth consent; submitting the sitemap to Search Console/Bing;
designating a platform intake fallback for search traffic (see §11);
referral reward amount ("to be announced"); migration 0037 must be
run live (with 0001–0037) before the webhook fix takes effect —
until then the paywall still denies a paying member/student.
Migrations 0021–0037 are written, not run live. The public v33 site
(`immigration.niptei.com`) is unchanged and frozen.
