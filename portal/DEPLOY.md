# Immigration with NIPTEI — Portal Deploy Guide

> **Portal only.** This file documents the Next.js portal in this folder
> (`portal/`). The repo-root `../DEPLOY.md` covers the static v33 public
> webapp (`index.html`), the GitHub repo, and the repo-level Vercel project.
> There is **one app tree, one folder tree**: the portal lives at
> `portal/src/app/` (Next.js App Router). Do **not** create a second app,
> a second `app/` folder, or a second Supabase project.
>
> **Status: NOT live.** Verified Nov 19, 2026: `npm run build` passes
> locally (tsc + next build), but no env vars are in Vercel, migrations
> 0001–0008 ran live Nov 19, 2026 6:52 PM EST (isolation check PASSED)
> and migrations 0009–0014 are written only, not run live, and Stripe /
> Twilio / Resend are not connected. Nothing below claims otherwise.

## 1. Real structure (checked in this repo — do not invent routes)

```
portal/
  package.json            # next 14.2.5, react 18.3.1, @supabase/supabase-js ^2.45.0, pdf-lib ^1.17.1
  next.config.js  tailwind.config.js  postcss.config.js  tsconfig.json
  .env.example            # NAMES ONLY — no values, no live keys
  .gitignore              # .env, .env.local, node_modules, .next (verified)
  src/
    app/                  # <-- App Router root is src/app, NOT portal/app
      page.tsx                    # / — landing with links to the three areas
      layout.tsx  globals.css
      portal/page.tsx             # /portal — client portal (68/32)
      portal/questionnaire/page.tsx
      portal/packet-audit/page.tsx
      onboarding/page.tsx         # /onboarding — role selection (7 roles)
      register/page.tsx           # /register — role registration & checkout
      admin/verifications/page.tsx
      back-office/page.tsx        # /back-office — role-adaptive
      legal-back-office/page.tsx  # /legal-back-office — roles 3/4/5 only
      company-back-office/page.tsx # /company-back-office — left rail / center / comms hub
      preparer-dashboard/page.tsx # /preparer-dashboard
      family-portal/[token]/page.tsx  # /family-portal/[token] — token-gated
      p/[slug]/page.tsx           # /p/[slug] — public profile / storefront
      api/
        stripe/webhook/route.ts   # /api/stripe/webhook — SKELETON, returns 501
        reminders/route.ts        # /api/reminders — SKELETON, returns 501
        pdf/autofill/route.ts     # /api/pdf/autofill — SKELETON, returns 501
        notify-stage/route.ts     # /api/notify-stage — 501 until Twilio/Resend set
        register-role/route.ts    # /api/register-role — 501 until Supabase env set
        generate-packet/route.ts  # /api/generate-packet — audit gate 409 / payment gate 402
        translate/route.ts        # /api/translate — 501 until Google Translate key set
        messages/send/route.ts    # /api/messages/send — 501 / not_configured until provider connected
        byo/test-send/route.ts    # /api/byo/test-send — 501 until the professional's provider connected
        templates/check/route.ts  # /api/templates/check — USCIS template field-check (pdf-lib)
    components/           # LanguagePicker, portal/*, onboarding/*, preparer/*, ...
    lib/                  # supabase.ts, stripe.ts, order.ts, audit.ts, ...
```

### Routes that exist

| Route | What it is |
|---|---|
| `/` | Landing with links to the three areas |
| `/portal` | Client portal: Order/Invoice/Roadmap, USCIS tracker (example), Priority Actions, Smart Forms, Document Checklist, Provider panel, Case Chat, Interview Prep, Fee Breakdown, Guest Invites, Mail/USCIS Proof Vault, Activity Log + Escalation |
| `/portal/questionnaire` | Multi-language intake (7 languages), save-and-resume, 5-year gap validator |
| `/portal/packet-audit` | Pre-filing audit — score from `src/lib/audit.ts` (88% example, ready only at 100%) |
| `/onboarding` | Step 1 Role Selection (7 role cards) + conditional onboarding, `onboarding_status` progress |
| `/register` | Role Registration & Checkout (locked tiers, Stripe skeleton only) |
| `/admin/verifications` | Founder/Admin verification queue (bar/EOIR), Approve/Reject-with-reason, audit log |
| `/back-office` | Role-adaptive back office (preparer / attorney / nonprofit / law student / platform admin). G-28 hidden for preparers; students see only assigned cases |
| `/legal-back-office` | Legal Back Office — roles 3 (attorney) / 4 (DOJ nonprofit) / 5 (law student) only; G-28/EOIR-28 gates, student supervision |
| `/company-back-office` | Company back office — left rail / center workspace / right comms hub; Twilio/Resend/video/E-Sign honestly labelled not connected |
| `/preparer-dashboard` | Preparer Command Center: identity card (A-Number masked), billing pipeline, USCIS/NVC hub, family invites, compliance guardrails |
| `/family-portal/[token]` | Token-gated family/co-sponsor view (status + missing items + upload slots only; invoices hidden unless `can_view_invoices`) |
| `/p/[slug]` | Public profile / storefront — VERIFIED + published profiles only (read via the `public_profiles` view, migration 0013); quote + order requests drop into that professional's Lead Sheet (`preparer_leads`) |
| `/api/stripe/webhook` | Skeleton — 501 until Stripe keys + signature verification exist |
| `/api/reminders` | Skeleton — 501 until Twilio + email provider exist |
| `/api/pdf/autofill` | Skeleton — 501 until official USCIS PDF templates exist (pdf-lib IS installed) |
| `/api/notify-stage` | Stage notifications — 501 until Twilio/Resend configured; templates in `src/lib/notificationTemplates.ts` (7 languages) |
| `/api/register-role` | Role Registration API — 501 until Supabase env set; writes `accounts` + `professional_profiles`/`student_profiles`, `is_verified` always false at registration |
| `/api/generate-packet` | PDF packet generator (pdf-lib) — 409 unless packet audit is 100% with no blocking items; 402 while a balance is due; DRAFT watermark, never auto-filed |
| `/api/translate` | 501 / "translation not configured" until `GOOGLE_TRANSLATE_API_KEY` is set; never returns a fake translation |
| `/api/messages/send` | Unified Thread send — 501 / `not_configured` until Supabase (Portal Chat) or the professional's own Twilio / Resend / SES is connected; never claims a message was sent |
| `/api/byo/test-send` | BYO test-send to the professional's OWN email/phone only — 501 until that provider is connected; never to a client |
| `/api/templates/check` | USCIS template field-check (pdf-lib) — compares a PDF's AcroForm fields with `src/lib/uscisFieldMappings.ts` |

### Routes that do NOT exist (do not link to, do not configure)

- `/api/webhooks/stripe` — the blueprint's webhook path is wrong. The real
  route is `/api/stripe/webhook`, so the Stripe webhook endpoint is
  `https://immigration.niptei.com/api/stripe/webhook`. Pointing Stripe at
  `/api/webhooks/stripe` would 404 and no invoice would ever flip to paid.
- No guest-upload API route exists yet. Family upload must go through a
  **server-side endpoint to be built** that checks
  `family_invites.invite_token` / `case_family_members.invite_token` +
  expiry + `allowed_document_types`, then inserts into `documents` with
  `storage_bucket = 'vault'` using the service-role key. Never grant an
  unauthenticated guest token direct RLS access (see migration 0011).
  (Correction Nov 19, late evening: an earlier version of this section
  said `/api/notify-stage` did not exist. It DOES exist now —
  `src/app/api/notify-stage/route.ts`, 501 until Twilio/Resend are
  configured. Do not re-add that claim.)

## 2. Real environment variables

`.env.example` in this folder lists names only. Values go in Vercel
(project `itfw-live`) or `.env.local` — never in chat, never in code.
`.env.local` is gitignored (verified in `portal/.gitignore` and the
repo-root `.gitignore`).

| Variable | Read by code? | Correct value / status |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes — `src/lib/supabase.ts` | `https://jdxjskqdvwqarfhcqjlg.supabase.co` (NOT `https://supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes — `src/lib/supabase.ts` | Supabase anon public key, via Secure Vault / Vercel only |
| `SUPABASE_SERVICE_ROLE_KEY` | Not read yet (server-only) | Service-role key, Vercel only, never `NEXT_PUBLIC_`, never in client code |
| `NEXT_PUBLIC_APP_URL` | Not read yet | `https://immigration.niptei.com` (NOT `https://niptei.com`) |
| `STRIPE_SECRET_KEY` | Not read yet | Needs founder Stripe account confirmation (asked Nov 16, still unanswered) |
| `STRIPE_WEBHOOK_SECRET` | Yes — `src/app/api/stripe/webhook/route.ts` (501 until set) | From the Stripe webhook endpoint below |
| `STRIPE_PRICE_PREPARER_49` | Not read yet | `price_...` placeholder — Preparer $49/mo recurring |
| `STRIPE_PRICE_ATTORNEY_99` | Not read yet | `price_...` placeholder — Attorney $99/mo recurring |
| `STRIPE_PRICE_NONPROFIT_STD_2450` | Not read yet | `price_...` placeholder — Nonprofit Standard $24.50/mo |
| `STRIPE_PRICE_NONPROFIT_FULL_4950` | Not read yet | `price_...` placeholder — Nonprofit Full $49.50/mo |
| `STRIPE_PRICE_STUDENT_35` | Not read yet | `price_...` placeholder — Law Student $35/mo |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` | Not read yet | Not connected yet |
| `TWILIO_PHONE_NUMBER` | Not read yet | Placeholder example `+17725550100` — replace with the real sender |
| `TWILIO_WHATSAPP_NUMBER` | Not read yet | Placeholder example `+14155238886` (Twilio WhatsApp sandbox number) — replace |
| `RESEND_API_KEY` | Not read yet | Not connected yet; sender `updates@niptei.com` is **UNVERIFIED** — needs verified Resend domain |

Naming note: the portal README and `src/app/api/reminders/route.ts`
comments call the SMS sender `TWILIO_FROM_NUMBER`. No code reads either
name yet, so the canonical name going forward is `TWILIO_PHONE_NUMBER`
(plus `TWILIO_WHATSAPP_NUMBER` for WhatsApp). Do not set both names.

## 3. Deploy steps (real project)

### Step 1 — Supabase (project "Immigration" already exists)

Do **NOT** create a second project. Project:
`https://jdxjskqdvwqarfhcqjlg.supabase.co` (org THE FEET WASHERS).

1. SQL Editor → run `supabase/migrations/0001` → `0014` **in order**.
   - **Duplicate numbers (concurrent builders, Nov 19, 2026): two 0012
     files and two 0013 files exist.** Run order within a number is
     filename order: `0012_itfw_preparer_gaps.sql`, then
     `0012_itfw_visa_bulletin_uscis_templates.sql`, then
     `0013_itfw_public_profiles_view.sql` (public-profile view), then
     `0013_itfw_unified_comms_byo_service_sync.sql`, then `0014`.
     No object overlaps between the duplicates (verified Nov 19).
     Do NOT rename them by hand — a future consolidation may renumber
     before anything runs live, and that is a founder / parent decision.
   - 0003's two `ALTER TYPE ... ADD VALUE` statements cannot run inside a
     transaction block; if the SQL Editor reports that error, run those
     two statements on their own first, then the rest of 0003.
   - **0008 must run before the isolation check is re-run** (recreates
     `current_account_id()` / `current_account_role()` /
     `is_case_participant()` as SECURITY DEFINER; without it every
     authenticated read recurses and fails).
   - 0010 is present (preparer_leads, case_lifecycle,
     notification_logs, NVC columns on case_agency_numbers) — run it
     in its numbered position; 0011's audit was reconciled against it.
   - 0013 (public-profiles view) grants anon SELECT on the view only —
     it is the public read for `/p/[slug]`. 0014's public policies on
     the base tables gate on an EXISTS check against `public.accounts`;
     anon has no accounts SELECT policy, so those checks likely
     evaluate false for anon — **verify with a real anonymous query
     after running 0013 + 0014**: an anon SELECT on
     `public.public_profiles` must return a listed row, and an anon
     SELECT on `professional_profiles` must be checked against the
     0014 policies (if it returns zero rows for a listed profile, the
     fix is a SECURITY DEFINER helper per the 0008 pattern, not a
     wider policy — see the 0013 header).
   - Report any error verbatim and stop; do not skip ahead.
2. Storage: create a **private** bucket named `vault` (NOT
   `case-documents` — do not create a second bucket). Signed URLs only,
   short expiry, no public bucket, no permanent URLs.
3. Auth: Email provider enabled. **Google Auth provider is already
   enabled in Supabase** (callback
   `https://jdxjskqdvwqarfhcqjlg.supabase.co/auth/v1/callback`) — but the
   live site still needs wiring to Supabase Auth (the portal's
   `getSupabase()` returns null without env vars and pages fall back to
   labelled EXAMPLE data). Wiring Auth is still TO DO.
4. Isolation check (before the first real client document is stored):
   one client, one assigned professional (must see exactly one case), one
   unassigned professional (must see zero client rows on every case-scoped
   table). Re-run it after 0008 and after 0011; an assigned but
   **unconfirmed** student must see 0 cases / 0 documents.

### Step 2 — Stripe (needs founder Stripe account confirmation)

Stripe account **NOT confirmed yet** (asked Nov 16, still unanswered).
Label: **needs founder Stripe account confirmation**.

1. In the founder's Stripe account, create the 5 recurring prices:
   Preparer $49/mo, Attorney $99/mo, Nonprofit Standard $24.50/mo,
   Nonprofit Full $49.50/mo, Law Student $35/mo. Put the real Price IDs
   in Vercel as the `STRIPE_PRICE_*` vars. No `price_...` ID exists in
   code yet — do not invent one.
2. Create the webhook endpoint:
   `https://immigration.niptei.com/api/stripe/webhook` (real route —
   see §1). Subscribe to `checkout.session.completed` and `invoice.paid`.
   Copy the signing secret to `STRIPE_WEBHOOK_SECRET`.
3. Until the webhook handler is implemented (signature verification +
   flipping the matching `order_invoices.status` to `paid` + roadmap
   unlock), the route returns 501 and changes nothing. Checkout,
   Pay in 3 / Monthly charging, and invoice-paid unlocks are NOT live.

### Step 3 — Twilio & Resend (both NOT connected yet)

1. Twilio: add a WhatsApp sender and an SMS sender number; replace the
   placeholder `TWILIO_PHONE_NUMBER` / `TWILIO_WHATSAPP_NUMBER` values.
   Until then `/api/reminders` returns 501 and sends nothing (nudge
   logic + queue live only in `src/lib/nudges.ts` + migration 0005).
2. Resend: verify a sending domain first. Sender `updates@niptei.com`
   is **UNVERIFIED — needs verified Resend domain**. Do not send from it
   until verified.

### Step 4 — Vercel (project `itfw-live`)

1. Vercel project `itfw-live` → Settings → Environment Variables. Set
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and
   server-only `SUPABASE_SERVICE_ROLE_KEY` via the Secure Vault flow —
   never paste keys in chat. Add the Stripe / Twilio / Resend vars only
   when those accounts are confirmed (Steps 2–3).
2. Deploy the portal from this folder (`portal/` is the Next.js app;
   the repo root is the static v33 site — same repo, same Vercel project
   `itfw-live`, do not create a second Vercel project).
3. The v33 redeploy to `immigration.niptei.com` is **blocked on the
   founder's Vercel sign-in in a separate browser task** — do not touch
   that task from here.

### Step 5 — Verify (do not claim live before this)

```bash
cd portal
npm install
npx tsc --noEmit   # must pass
npm run build      # must pass (verified passing Nov 19, 2026)
```

Then, with env vars set: Supabase Auth login works, a test client sees
only their own case, the isolation check passes, and the Stripe webhook
test event returns 200 (not 501). Until then the portal is a working
local build with EXAMPLE data, not a live service.

## 4. Quick Launch Checklist

- [ ] **(1) Supabase — project "Immigration" already exists.** Do NOT
  create a second project. Run migrations `0001 → 0014` in order (two
  0012s + two 0013s — filename order within a number, see §3 Step 1),
  `0008` before the isolation check, then **re-run isolation (client 1 /
  assigned 1 / unassigned 0) before any real client document is stored**.
  Private Storage bucket is named **`vault`** (NOT `case-documents` — do
  NOT create a second bucket).
- [ ] **(2) Stripe — 5 recurring prices created** ($49 / $99 / $24.50 /
  $49.50 / $35), webhook to
  `https://immigration.niptei.com/api/stripe/webhook`.
  **Stripe account NOT confirmed yet — needs founder Stripe account
  confirmation** (asked Nov 16, still unanswered).
- [ ] **(3) Twilio & Resend — Twilio WhatsApp sender + verified Resend
  domain added. Both NOT connected yet.** Placeholders only in
  `.env.example`; sender `updates@niptei.com` unverified.
- [ ] **Vercel — project `itfw-live` env vars set** (`NEXT_PUBLIC_SUPABASE_URL`
  / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / server-only
  `SUPABASE_SERVICE_ROLE_KEY` via Secure Vault, never in chat).
- [ ] **Google Auth — already enabled in Supabase** (callback
  `https://jdxjskqdvwqarfhcqjlg.supabase.co/auth/v1/callback`), **but the
  live site still needs wiring to Supabase Auth** (login, session,
  role-based redirects).
- [ ] **v33 redeploy to `immigration.niptei.com`** — blocked on founder
  Vercel sign-in in a separate browser task. Do NOT touch that task.

## 5. What is still NOT live

Supabase Auth wiring / env vars in Vercel · migrations 0009–0014 run live
(0001–0008 ran live Nov 19, 2026 6:52 PM EST, isolation check PASSED;
0009–0014 are WRITTEN ONLY, not run live) · Stripe (checkout, webhook
handler, Pay in 3 / Monthly charging) · Twilio / Resend sending ·
guest-upload server endpoint (family upload via token — to build; no
direct RLS for guests) · Google Cloud Translation (UI + mapping only) ·
USCIS Production key + worker (Sandbox only; receipt/status/deadlines are
EXAMPLE) · NVC/CEAC (manual link-out, no API, never store a CEAC
password) · carrier API (link-outs only) · certified-translation
fulfilment (requests only, no price/provider invented) · refund policy
(attorney review) · PDF auto-fill (pdf-lib IS installed; still needs the
official USCIS templates — see §10). All example data (Jane Doe, Alex M.,
IOE0928374651, INV-2049) is labelled EXAMPLE in the UI and code. No login,
upload, chat message, payment, or verification is live until wired +
tested.

## 6. Corrections made to the deployment blueprint

The blueprint was integrated, not copy-pasted. Every correction below was
verified against the repo (Nov 19, 2026):

1. **Paths are `src/app/*`, not `app/*`.** There is no `app/` directory
   at the portal root. All routes in §1 use their real `src/app/...` paths.
2. **Webhook route is `/api/stripe/webhook`, not `/api/webhooks/stripe`.**
   The blueprint's endpoint URL would 404. Stripe must point at
   `https://immigration.niptei.com/api/stripe/webhook`.
3. **`/api/notify-stage` EXISTS** (`src/app/api/notify-stage/route.ts`,
   501 until Twilio/Resend are configured; templates in
   `src/lib/notificationTemplates.ts`, 7 languages). An earlier version
   of this guide said it did not exist — that was true when written and
   is false now; do not re-add the claim.
4. **Supabase URL corrected** to
   `https://jdxjskqdvwqarfhcqjlg.supabase.co` (not `https://supabase.co`).
5. **App URL corrected** to `https://immigration.niptei.com`
   (not `https://niptei.com`).
6. **No `preparer_leads` table existed when first checked — but 0010
   landed concurrently** (`0010_itfw_leads_nvc_lifecycle_notifications.sql`,
   another builder, read not edited). It creates `preparer_leads` with
   owner-only SELECT / INSERT / UPDATE / DELETE + founder/admin SELECT,
   so the "preparer_leads owner-only" intent is already covered in 0010
   and 0011 adds no policy for it. No table was invented here to match
   the draft; the draft's `leads` / `case_documents` tables still do not
   exist (real tables: `accounts` / `quote_requests` / `documents`).
7. **The pasted `rls_policies.sql` was NOT run.** It used nonexistent
   tables (`users` / `leads` / `case_documents`), compared `auth.uid()`
   directly to account ids (ours uses `public.current_account_id()`
   via `accounts.auth_user_id = auth.uid()`, SECURITY DEFINER since
   0008), and granted family access by email match (ours uses
   `family_invites.invite_token` + a server endpoint, because an
   unauthenticated guest token cannot get RLS access via `auth.uid()`).
   Migration `0011_itfw_rls_deploy_gapfill.sql` covers the same intent
   correctly; its header lists everything already covered (not duplicated)
   and one known gap not fixed there (see §7 below).
8. **Twilio sender name:** README / reminders comments say
   `TWILIO_FROM_NUMBER`; canonical name going forward is
   `TWILIO_PHONE_NUMBER` + `TWILIO_WHATSAPP_NUMBER`. No code reads either
   name yet, so the rename is safe.
9. **Storage bucket is `vault`, not `case-documents`.** Do not create a
   second bucket.
10. **No second Supabase project, no second app tree.** One project
    ("Immigration"), one portal tree (`portal/src/app/`).
11. **Stripe Price IDs do not exist in code yet.** The five
    `STRIPE_PRICE_*` vars are `price_...` placeholders until the founder's
    Stripe account is confirmed and the prices are created.
12. **Resend sender `updates@niptei.com` is UNVERIFIED** (needs verified
    Resend domain); Twilio numbers `+17725550100` / `+14155238886` are
    placeholders (the WhatsApp one is Twilio's sandbox number).

## 7. Known RLS gap flagged, not silently fixed

`accounts_update_own` (0001) lets an account owner change **any** column
on their own row, including `role` — a client could set `role = 'admin'`
and then pass every admin/founder RLS check. Fixing it needs a
`BEFORE UPDATE` trigger (same shape as 0001's `block_self_verification`,
exempting service role where `auth.uid()` IS NULL), not a policy, so it
was **not** folded into migration 0011's "policies only" scope. Do not
wire Supabase Auth live until the founder decides on that trigger (or
restricts role changes to service role). See the 0011 header.

## 8. Schema audit — pasted `schema.sql` vs migrations 0001–0011 (Nov 19, 2026)

No `supabase/schema.sql` was created: migrations 0001–0011 are the
canonical schema and the ONLY source of truth, and no runnable combined
file exists. Note: no verbatim paste text was supplied with this audit
task — the audit below covers every table / enum / policy / field named
in the task's itemised paste description. If the verbatim paste is
produced later, re-audit against its exact text before acting on it.

Live status at the time of this audit: migrations 0001–0008 ran cleanly
live Nov 19, 2026 6:52 PM EST; isolation check PASSED after the 0008
fix (client 1 case / assigned professional 1 / unassigned professional
0); 35 tables in public, private `vault` bucket, Email auth enabled.
Migrations 0009–0011 are WRITTEN ONLY, not run live.

### (a) Already in the migrations — do NOT duplicate

- `accounts` (0001) — not `users`. `professional_profiles` (0001) —
  not `provider_profiles`. `documents` (0001) — not `case_documents`.
  `messages` (0001) — not `case_messages`. `audit_log` (0001) +
  `admin_audit_log` (0002) — not `case_audit_logs`.
- Role / verification / language / subscription enums (0001, extended
  0003: `law_student` / `teacher` / `founder` roles,
  `law_student_35` / `employer_49` plans).
- Payment plans: `payment_plans` (0002, enforced 0003 — locked
  `pay_choice` `all_at_once` / `installments_3` / `monthly_6` /
  `monthly_12`, instalments must sum to the total) + `service_orders` /
  `order_invoices` (0006, milestone slices linked 1:1 to `invoices`)
  + `payment_arrangements` (0009, auto-draft schedule). No competing
  subscription / invoice system is needed.
- Provider subscriptions: `professional_profiles.subscription_plan` /
  `subscription_status` / `stripe_customer_id` / `current_period_end`
  (0001); `employers.subscription_plan` / `subscription_status` (0002).
- Student assignment: `case_student_assignments` (0004) + confirmed-
  student helper `is_assigned_student()` (0011). No
  `assigned_student_id` column on `cases`.
- Family access: `family_invites.invite_token` (0002, extended 0005 /
  0006) + `case_family_members.invite_token` (0009) + a server-side
  guest-upload endpoint to be built — never email matching against a
  users table (see §1, §7 of the 0011 header and §7 above).
- G-28: there is NO `g28` table (0007 documents this deliberately).
  G-28 access is decided by the assigned provider's verified role
  (attorney / DOJ nonprofit, partial vs full accreditation) + the
  0003 `validate_assigned_provider()` trigger + UI hiding — not by a
  boolean. A dedicated `g28_signatures` table with attorney-only
  policies is a possible FUTURE migration if G-28 is ever stored
  separately (0007); it was not created here (see (b)).
- RLS helpers: `current_account_id()` / `current_account_role()` /
  `is_case_participant()` — SECURITY DEFINER since 0008, search_path
  pinned. Every policy uses them.

### (b) Genuinely NEW in the paste — none. No migration 0012 created

Nothing in the itemised paste is both (i) genuinely missing from
0001–0011 and (ii) safe to add as written. Every named item is either
already covered in (a) or an error in (c). So **no `0012` migration
file was created** — an empty 0012 would be worse than none. Two
follow-ups are PROPOSED, not built, for a founder decision:

1. `g28_signatures` table (attorney / DOJ-only policies) IF G-28
   signatures are ever stored in the database (0007's stated
   condition). Not built now: no decision to store G-28 exists.
2. Checklist persistence columns for `src/lib/formChecklists.ts`:
   `inbox_items.assigned_family_member_id` (FK to
   `case_family_members`) + `inbox_items.translation_required`
   boolean, so `assignedTo` (Spouse-Beneficiary / Joint Sponsor) and
   the translation flag are queryable columns instead of text inside
   `inbox_items.instructions`. Not built now: the helper works today
   on existing columns (see §9); a migration needs the founder's
   go-ahead, and 0012 is reserved for audit items only.

**Update Nov 19, late evening:** two `0012` files DO now exist, from
other builders, for other concerns — `0012_itfw_preparer_gaps.sql`
(preparer tables) and `0012_itfw_visa_bulletin_uscis_templates.sql`
(Visa Bulletin + USCIS template registry). Neither is the audit-0012
discussed above, and neither builds the two proposed follow-ups in
this section — `g28_signatures` and the checklist-persistence columns
are still proposed, not built.

### (c) Errors in the paste — do NOT re-introduce

1. Wrong table names: `users` / `provider_profiles` /
   `case_documents` / `case_messages` / `case_audit_logs`. Ours are
   `accounts` / `professional_profiles` / `documents` / `messages` /
   `audit_log` + `admin_audit_log` (0001–0002). A policy on a
   nonexistent table errors the whole run.
2. A `subscriptions` table duplicates `payment_plans` +
   `order_invoices` (and the subscription columns already on
   `professional_profiles` / `employers`). Reuse them; do not create
   a competing subscriptions table.
3. `quoted_fee NUMERIC` dollars is WRONG. Money is integer cents
   everywhere (`quoted_fee_cents`, `total_service_fee_cents`,
   `service_fee_cents` / `uscis_fee_cents` on `invoices`).
4. `payment_plan_offered` / `payment_plan_type 'split_50_50'` is WRONG
   for immigration. Locked plans only: `full_upfront` /
   `installments_3` / `monthly_6` / `monthly_12` (0006
   `service_orders.payment_plan_type`; 0010 `preparer_leads.
   payment_plan_offered`; 0002/0003 `payment_plans.pay_choice` spells
   the upfront option `all_at_once` — the two spellings are a known
   pre-case vs post-case difference, documented in 0010, not a bug
   to silently rename). 50/50 belongs to the Florida Property
   Compliance OS, a different business.
5. RLS comparing `auth.uid()` directly to account ids is WRONG. Use
   `public.current_account_id()` (accounts.auth_user_id = auth.uid(),
   SECURITY DEFINER after 0008) and `is_case_participant()`. The one
   legitimate `auth.uid()` comparison is `accounts_insert_own`
   (0011), where `auth_user_id = auth.uid()` IS the auth id.
6. Family access by matching email to a `users` table is WRONG. Use
   `family_invites.invite_token` + `case_family_members.invite_token`
   + a server-side endpoint (service role) that checks token + expiry
   + `allowed_document_types`, then inserts into `documents` with
   `storage_bucket = 'vault'`. An unauthenticated guest token cannot
   get RLS access via `auth.uid()` — no anon/guest policy is created.
7. `g28_allowed` / `eoir28_allowed` BOOLEAN columns on `cases` are
   NOT a substitute for the verification gate. G-28 access is decided
   by the assigned provider's verified role (attorney / DOJ, partial
   vs full accreditation — `professional_profiles.accreditation_level`),
   not a boolean a preparer could flip.
8. `assigned_student_id` on `cases` duplicates
   `case_student_assignments` (0004). Reuse that table (+
   `is_assigned_student()`, 0011).

## 9. Master Form & Checklist Templates — `src/lib/formChecklists.ts`

Built Nov 19, 2026 (not live — Supabase not connected in this build,
migrations 0009–0011 written only). 8 templates: I-130 + NVC Consular,
I-485 Adjustment of Status, I-821 TPS + I-765, N-400 Citizenship,
I-589 Asylum (clerical prep only), I-864 Affidavit of Support + I-864A
(built here — it was NOT in the paste), I-90 Green Card Renewal, and
the Family Adjustment Bundle composite (7 forms, Basic $999 /
Standard $1,799 / Premium $2,799, from `bundles.ts`).

Corrections applied in that file (paste figures NOT shipped as
verified): example prep fees ($1,200 / $1,100 / $350 / $350 / $650 /
$200) replaced with the locked tiers (I-130 $299/$499/$750, I-485
$750/$1,200/$1,500, I-821 $189/$295/$400, I-765 $129/$249/$350,
N-400 $199/$400/$600, I-589 $900/$1,050/$1,200, I-90 $129/$240/$350,
I-864 $99/$175/$250); I-130 $675 gov fee is TO BE CONFIRMED and the
I-130+NVC $1,355 total is shown ONLY as conditional arithmetic
($675 TBC + $120 + $325 + $235), never as a verified total; I-765
$260 concurrent, TPS $30 biometrics, I-765 $520 paper / $470 online,
N-400 $710 / $760 / $380, I-90 $415 / $465 are all TO BE CONFIRMED;
I-589 "$0 fee" corrected to locked $100 + $105/yr. I-864 uses the
locked 2026 I-864P 125% table (HH4 contiguous $41,250) from
`workspace/your_files/itfw-sponsor-qualifier/
itfw-2026-sponsor-qualifier-and-fees.md`, with the joint-sponsor and
I-864A flows and the 3x / 5x asset math.

Two flags for the parent / founder:

- `bundles.ts` still marks the I-765 standalone, I-90 and I-864
  service fees TO BE CONFIRMED (no `serviceFee` on those entries).
  The tier prices in `formChecklists.ts` come from the locked price
  list given for this build; `bundles.ts` needs reconciling by its
  owner before it is quoted from. This file does not edit it.
- Checklist rows go to `inbox_items` (type `missing_document`) +
  `packet_audit_items`, NOT to `documents`: a `documents` row is a
  real uploaded file (whitelisted mime_type, UNIQUE `storage_path`,
  `storage_bucket = 'vault'`). `insertChecklistRows()` in that file
  is the hook — call it from the "Convert Lead to Active Case"
  handler in `LeadLifecycle.tsx` once the case exists (that file was
  NOT edited here; another builder owns it). `LeadSheet.tsx` (CSV
  bulk importer) was also NOT edited — template selection does not
  belong in a bulk-import form. `rowsForTemplate()` /
  `serviceOrderDraftForTemplate()` (prep fee vs gov fee kept separate
  on `service_orders`) / `auditItemsForTemplate()` +
  `readinessForTemplate()` (Stage 4 checklist -> `audit.ts` packet
  audit, ready only at 100%) are all in `formChecklists.ts`.

## 8. New routes (Nov 19, 2026 — legal back office, register API, company back office, public profiles)

- `/legal-back-office` — Role-gated Legal Back Office for Roles 3 (Attorney $99/mo),
  4 (DOJ Nonprofit $24.50 / $49.50/mo), 5 (Law Student $35/mo). Separate from
  `/back-office` (preparers never see G-28). DEMO-only role preview + DEMO-only
  "Simulate Verified Credential" checkbox; real role comes from Supabase Auth /
  `public.accounts`. EOIR-28 unlocks only for Full accreditation + verification.
- `/api/register-role` — Step 1 Register API. Creates the Auth user (normal
  email-confirmation flow — never `email_confirm: true`) and writes
  `public.accounts` + `public.professional_profiles` / `public.student_profiles`
  (never `users` / `provider_profiles`). `is_verified` is always false at
  registration; `is_published` flips only via `/api/stripe/webhook` once the
  subscription is active AND verification is approved. Returns 501 until
  `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` are set; Stripe
  Checkout step returns `not_configured` until Stripe is live (no charge).
- `/company-back-office` — Unified company back office (left rail / center tools /
  always-visible omni-channel hub). SMS / WhatsApp / Email are NOT live (Twilio /
  Resend not connected — hub queues only, never claims a send); video call is a
  placeholder ("video room not connected yet"); auto-translate needs Google Cloud
  Translation (not connected); E-Sign provider not connected; billing is Pay in
  Full / Pay in 3 / Monthly 6 / 12 ONLY (no 50/50 split for immigration).
- `/p/[slug]` — Public profile + self-booking at `immigration.niptei.com/p/<slug>`.
  Lists VERIFIED + published profiles only; unverified shows "Pending verification"
  and no booking. Booking calendar NOT connected — requests are collected only.
- `/register` — now exactly the 5 locked roles (no pre-selection, cannot continue
  without choosing one); password 12+ chars with live strength meter; attorney /
  nonprofit public-slug fields and DOJ recognition date added; law-student rules
  checkbox added; forms POST to `/api/register-role`. Teacher / admin are not
  register roles here (teachers confirm students via `/onboarding` +
  `/admin/verifications`; admin accounts are founder-created).
- `/api/generate-packet` — PDF packet generator (pdf-lib, installed
  `^1.17.1`). Enforces the audit gate (409 unless packet audit is 100%
  with no blocking items) and the payment gate (402 while a balance is
  due); DRAFT watermark, never auto-filed; no E-Sign provider connected;
  caller auth NOT enforced yet (flagged in the route header — enforce
  before live use).
- `/api/notify-stage` — stage notifications, 501 until Twilio/Resend are
  configured; templates in `src/lib/notificationTemplates.ts` (6 stage
  templates × 7 languages) + missing-document nudge templates in all 7
  languages (FR/PT/ZH/AR need founder/native-speaker review before any
  live send).
- `/api/templates/check` — USCIS template field-check (pdf-lib); see §10.
- `/p/[slug]` (storefront) — order/quote/call requests insert ONE row
  into `preparer_leads` with `preparer_id` = that profile's account_id
  (migration 0014 public insert policy); the profile row is read via
  the `public_profiles` view (migration 0013) — see §3 Step 1 for the
  anon-read verification that still has to happen after 0013 + 0014 run.

## 9. Canonical schema — migrations only, no combined schema.sql

Migrations `0001`–`0014` in `../supabase/migrations/` are the canonical schema.
(Two 0012s + two 0013s exist — filename order within a number, see §3
Step 1.) Do NOT create a combined `schema.sql` — it would drift from the
migrations and from what is actually run live. New tables/columns/policies
go in a new numbered migration, never in a side file and never by editing
`0001`–`0014`.

## 10. USCIS template download + verification guide (Nov 19, 2026)

PDF Auto-Fill (`/api/pdf/autofill`, skeleton — 501) needs the OFFICIAL
USCIS PDF template for each form. No template is included in this repo,
and none is downloaded by any builder. The founder (or a professional)
downloads each one from uscis.gov and uploads it in the portal
(Preparer Dashboard → "Visa Bulletin & Templates" tab, or Back Office →
USCIS Templates section). Upload goes to the private `vault` bucket at
`vault/templates/<form-code>/<edition>.pdf` and is recorded in the
`uscis_templates` table (migration 0018 — renumbered from 0012 by the Nov 19–20 consolidation).

Step by step, per form:

1. Go to uscis.gov and open the form's page (search "USCIS I-130" etc.
   on uscis.gov — do not use a third-party copy). Check the **edition
   date** printed on the form and that it is the edition USCIS currently
   accepts; an expired edition is rejected by USCIS.
2. Download the PDF from the uscis.gov form page. Do NOT edit, flatten,
   or re-save it in another tool — re-saving can strip the AcroForm
   fields the auto-fill needs.
3. In the portal, pick the form code, type the edition date exactly as
   printed on the form (for example `07-28-25`), and paste the uscis.gov
   page URL you downloaded it from.
4. Choose the PDF and click **Run field-check**. The check
   (`POST /api/templates/check`, pdf-lib) lists every AcroForm field the
   template actually contains and compares it with
   `src/lib/uscisFieldMappings.ts`: matched / unmatched (fields on the
   PDF with no mapping yet) / unverified (mappings whose guessed name
   was NOT found on this PDF).
5. Click **Upload to vault & record** only after the field-check. The
   file goes to `vault/templates/<form-code>/<edition>.pdf` and the
   record stores form code + edition + source URL + uploaded by/at +
   field counts + the full check result.
6. Mappings are updated from the CHECK results only — a mapping counts
   as verified only when its exact AcroForm field name appears on the
   uploaded PDF for that edition. Never mark a mapping verified from a
   guess, and never copy a field name from a different edition.

Per-form status is shown in the portal: "Template uploaded — edition
[date] — X of Y fields verified" vs "No template uploaded — PDF
Auto-Fill will return an error for this form". Forms tracked:
I-130 (5 mappings, all UNVERIFIED until checked), I-485 (no mappings
yet — included blank and listed as unfilled until mappings are
verified), I-864, I-821, I-765, N-400, I-589, I-90.

Visa Bulletin note (same tab): cutoff dates are entered by hand from
the official bulletin at
`https://travel.state.gov/content/travel/en/legal/visa-law0/visa-bulletin/<fiscal-year>/visa-bulletin-for-<month>-<year>.html`
(verified pattern — November 2026 is Fiscal Year 2027). Nothing is
scraped. The matcher (`src/lib/visaBulletin.ts`) labels every result
"Cutoff dates entered from the official Visa Bulletin, month [X] —
verify at travel.state.gov before filing".

## 11. Founder Decision Checklist (Nov 19, 2026)

Decisions only the founder can make. Nothing below is done until the
founder answers it.

1. **Stripe account?** Do you already have a Stripe account for NIPTEI /
   The Feet Washers? (Asked Nov 16, still unanswered.) Needed before
   any live payment — no Stripe keys exist, no charge can run, and the
   webhook stays a 501 skeleton until this is answered.
2. **Vercel sign-in.** Sign in to Vercel as nipteiapp@gmail.com in the
   secure card in this chat so the v33 redeploy can finish.
3. **USCIS templates.** Upload the USCIS templates from uscis.gov —
   guide is section 10 above. PDF Auto-Fill returns an error for any
   form with no template uploaded.
4. **Attorney review before go-live.** Attorney review of the
   installment contract, refund policy, UPL agreement, and
   retainer/trust wording before they go live. None of these is live
   until reviewed.

## 12. Deployment, storage & Stripe webhook test guide — Smart Intake (Nov 19, 2026)

Appended, not rewritten: sections 1–11 above are owned by other
builders. This section covers the Smart Guided Intake
(`src/components/SmartIntakeCalculator.tsx` +
`src/app/api/confirm-intake-order/route.ts` +
`portal/scripts/test-platform.js`) and corrects the pasted
deployment guide it replaces. Do NOT follow the paste's guide.

### 12a. Storage — the ONLY bucket is the private `vault`

- Do NOT create `uscis-templates` or `case-documents` buckets. The
  only bucket is the private `vault` (created once, §3 step 1).
- Templates go under `vault/templates/<form-code>/<edition>.pdf`
  (see §10 for the per-form upload + field-check flow).
- Client uploads and merged packets go under `vault/uploads/` and
  `vault/packets/` respectively.
- Storage access is participant-only via signed URLs (short expiry)
  and the service-role key — NEVER a blanket "any authenticated user
  can upload / read case documents" policy. The paste's storage
  policies would break case isolation (one client reading another
  client's documents). Do NOT run the paste's `storage.sql`.
- A `documents` row is a real uploaded file (whitelisted mime type,
  UNIQUE `storage_path`, `storage_bucket = 'vault'`). Checklist rows
  live in `inbox_items` + `packet_audit_items`, never in `documents`.

### 12b. Vercel — do NOT re-import, do NOT add a new domain

- Project is `itfw-live` (nipteiapp-9260). Do NOT re-import a new
  repo and do NOT create a second Vercel project. Separation rule
  (founder, Nov 19, 2026): EVERY app is separate — its own Vercel
  project connected to its own Supabase project/account, never
  touching each other, never sharing keys/data. Immigration with
  NIPTEI is Vercel `itfw-live` → Supabase "Immigration"
  (`jdxjskqdvwqarfhcqjlg`) ONLY; Supabase keys are NOT yet in Vercel.
  Do NOT cross-connect any app.
- Domain `immigration.niptei.com` is ALREADY added and Valid. Do NOT
  add `niptei.com` (no `://niptei.com` — the app URL is
  `https://immigration.niptei.com`, not `https://niptei.com`).
- IONOS DNS: `CNAME | immigration → e6285fa37c4c09c6.vercel-dns-017.com`.
  (NOT `cname.vercel-dns.com` — that generic target is what the
  stale repo-root `../DEPLOY.md` shows; the real target for this
  project is the `e6285fa37c4c09c6.vercel-dns-017.com` value above.)
- GitHub remote is `thefeetwashers/ITFW-Live`.
- BEFORE any GitHub push: the local `index.html` is STALE / pre-rebrand
  and the repo-root `README.md` / `DEPLOY.md` still point at
  `immigration.thefeetwashers.com` and `cname.vercel-dns.com`.
  Refresh `index.html` from the v33 export and fix `README.md` /
  `DEPLOY.md` first — pushing the stale files would redeploy the old
  site over the live one.
- Env vars for the intake route (Vercel → project `itfw-live` →
  Settings → Environment Variables, via the Secure Vault flow, never
  in chat): `NEXT_PUBLIC_SUPABASE_URL` +
  `SUPABASE_SERVICE_ROLE_KEY` (server-only, never `NEXT_PUBLIC_`).
  Until both are set, `/api/confirm-intake-order` returns 501 and
  creates nothing — that is the correct behaviour, not a bug.

### 12c. Stripe webhook — needs founder Stripe account confirmation

Stripe account NOT confirmed yet (asked Nov 16, still unanswered).
Label the whole section: **needs founder Stripe account confirmation**.

- Endpoint (real route — check the file first, do not guess):
  `https://immigration.niptei.com/api/stripe/webhook`
  (`src/app/api/stripe/webhook/route.ts`). NOT `https://niptei.com`,
  and NOT `/api/webhooks/stripe` — that route does not exist and
  would 404, so no invoice would ever flip to paid.
- Events to subscribe to: `customer.subscription.created` /
  `customer.subscription.updated` / `customer.subscription.deleted` +
  `invoice.paid` (+ `checkout.session.completed` /
  `payment_intent.succeeded` — the webhook does NOT handle those yet
  either; it handles nothing yet, see below).
- The webhook handler is still a 501 skeleton: it returns 501 until
  `STRIPE_WEBHOOK_SECRET` is set, and signature verification + the
  invoice-paid unlock (flip the matching `order_invoices.status` to
  `paid` + roadmap unlock via `roadmapStages()` in `lib/order.ts`)
  are NOT implemented. Subscribing the endpoint alone changes
  nothing — a test event returning 501 is the EXPECTED result today.
- Copy the signing secret to `STRIPE_WEBHOOK_SECRET` in Vercel only
  after the endpoint is created in the founder's Stripe account.
- The intake route itself takes NO payment and calls NO Stripe API:
  invoices are created as `draft` and the professional sends a
  payment link. Pay in 3 / Monthly charging stays NOT live until
  the webhook handler + checkout exist.

### 12d. Test script — `portal/scripts/test-platform.js`

```bash
cd portal
# Local (dev server must be running: npm run dev)
BASE_URL=http://localhost:3000 node scripts/test-platform.js your-name
# Production (only after the Vercel deploy + env vars are set)
BASE_URL=https://immigration.niptei.com node scripts/test-platform.js <real-slug>
```

- `providerSlug` defaults to the PLACEHOLDER `your-name` — replace
  it with a real storefront slug (`immigration.niptei.com/p/<slug>`).
- The script tests: (1) `confirm-intake-order` returns a caseId +
  redirectUrl, (2) `notify-stage` returns 501 / `not_configured`
  without Twilio/Resend keys (and never claims a send).
- EXAMPLE data only, labelled in the script: client "Carlos & Elena
  Mendez" / `test.client@example.com` / `+17725550194`, and case
  `PHP2026514009` / Invoice `42117188` (example reference labels —
  a real run returns a UUID caseId and an `INV-…` invoice number,
  never those strings). `paymentOption` is a LOCKED plan
  (`installments_3` — Pay in 3), never `split_50_50`. Prep/gov figures
  asserted are locked or TO BE CONFIRMED values only (Standard bundle
  $1,799 + Rush $199 = $1,998 prep; I-485 paper gov fee $1,440 LOCKED).
- Expected results TODAY (Supabase/Stripe not wired): test (1)
  returns 501 / "not configured" and the script reports NOT WIRED —
  no order created; test (2) returns 501. Both are passing results.
  The script exits non-zero only on an UNEXPECTED status.
- Stripe webhook manual test (after the founder confirms the Stripe
  account — not before):

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
stripe trigger checkout.session.completed
stripe trigger invoice.paid
stripe trigger customer.subscription.created
```

  Expect 501 from the webhook until the handler is implemented (§12c).

### 12e. What is still NOT live (Smart Intake)

Supabase env vars in Vercel (route returns 501 until set) · no live
order, case, invoice or checklist has been created by the intake
flow · Stripe checkout + webhook handler + Pay in 3 / Monthly
charging · Twilio / Resend sending (`notify-stage` returns 501) ·
standalone I-765 checklist template (no template exists in
`src/lib/formChecklists.ts` — the route reports it as TO BE
CONFIRMED and creates no checklist rows for that goal) · NVC
consular-guidance prep price (TO BE CONFIRMED — no locked combined
I-130 + NVC fee) · every TO BE CONFIRMED gov fee (I-130 $625/$675,
I-485 online $1,390, I-765 $260/$470/$520/$560/$280, N-400
$710/$760/$380, I-90 $415/$465, I-907 $1,780, $30 biometrics) ·
Google Cloud Translation (language selector sets the case language;
the calculator UI stays in English).

## 13. Forgotten items — reviews, referrals, renewals, booking (Nov 20, 2026)

Appended, not rewritten: sections 1–12 above are owned by other
builders. This section records the "forgotten items" build (Nov 20,
2026, two builders in parallel — one wrote the migration + libs +
components, the other wired them into pages + API routes + this
section), plus the consolidation that followed. Nothing below is live:
no migration was run, no env var was set, no provider was connected,
no key was created.

RENUMBERING + MERGE (consolidation, Nov 19–20, 2026): the migrations
were renumbered to a single linear sequence 0001–0020 — the duplicate
0012/0013 files no longer exist (old `0012_itfw_visa_bulletin_uscis_templates.sql`
is now 0018, old `0013_itfw_unified_comms_byo_service_sync.sql` is now
0014, old 0014 storefront is now 0015, old 0015 next-step is now 0016).
The two competing 0016 files (reviews/referrals/renewals/booking and
reviews/referrals/bookings) were MERGED into a single
`0017_itfw_reviews_referrals_renewals_booking.sql`, which replaces
them both. Canonical reviews schema is the one the portal code uses
(`professional_account_id`, `consent_given`, `reply_text`, `visible`);
merged in from the other file: the `consultation_requests` table,
`accounts.referral_code`, `case_agency_numbers.medical_exam_date` +
`panel_physician`, and the stricter moderation trigger (a
founder/admin may not edit review content either). Neither 0016 ran
live, so the merge is safe.

### 13a. What was built (code-complete, no key/account/sign-in needed)

| Item | Files |
|---|---|
| Real reviews system | `supabase/migrations/0017_itfw_reviews_referrals_renewals_booking.sql` (reviews table + moderation trigger + RLS), `portal/src/lib/reviews.ts`, `portal/src/components/portal/ReviewsSection.tsx`, `portal/src/app/reviews/new/page.tsx` ("Tell us how we did"), `portal/src/app/api/reviews/route.ts` (GET/POST/PATCH, stage-6 gate) |
| Refer-a-Family | `portal/src/lib/referrals.ts`, `portal/src/components/portal/ReferralCard.tsx`, `portal/src/app/r/[code]/page.tsx`, `portal/src/app/api/referrals/route.ts` (resolves a professional's `professional_profiles.referral_code` and a client's `accounts.referral_code`); storefront quote/booking/order (`portal/src/app/p/[slug]/page.tsx`) records the referral in `preparer_leads` with `referral_source='Referral'` + `referrer_account_id` + `referral_code` |
| Renewal reminders | `portal/src/lib/renewals.ts`, `portal/src/components/portal/RenewalsSection.tsx` ("Your renewals"), "Renewals coming up" in `portal/src/components/preparer/DailyCommand.tsx`, `portal/src/app/api/renewals/route.ts` |
| Booking + embassy/medical scheduling | `portal/src/lib/booking.ts`, `portal/src/components/portal/InterviewMedicalCard.tsx`, `portal/src/components/preparer/AppointmentsRenewals.tsx` (Accept / Propose another time / Decline), `portal/src/app/api/bookings/route.ts` |
| EOIR roster (full 3-link version) | `portal/src/lib/example-data.ts` (`EOIR_ROSTER_LINKS`), `portal/src/components/EoirRosterLinks.tsx` (used in back office, legal back office, verification queue, storefront) |
| Catalog audit 105 vs 107 | `portal/src/lib/catalogAudit.ts`, honest count shown in `portal/src/components/portal/ServiceCatalog.tsx` |
| Mobile header Start button | `portal/src/components/portal/PortalShell.tsx` — Start link, flex-wrap header, no nowrap/ellipsis/overflow-hidden on the button |
| Checklist 4 of 6 | `portal/src/components/nextstep/ColourChecklist.tsx` shows the COMPUTED count + the computed "Not yet approved" line; `portal/src/lib/example-data.ts` comment records the 5-of-6 vs 4-of-6 discrepancy |

Honesty rules enforced by the build: reviews exist only after a real
case reaches stage 6, with the client's permission; the professional
can reply only (DB trigger blocks edits); a founder/admin can hide
only with a reason logged to `audit_log`; reviews are never deleted.
Referral counts come only from real `preparer_leads` rows (0 at
start). Renewal reminders derive only from real `case_renewals`
dates. Booking collects requests — the calendar is NOT connected and
no calendar sync is claimed. No review, rating, count, reward,
appointment date, or fee was invented anywhere in this build.

### 13b. Migration run order (verify, do NOT run live)

CORRECTED Nov 20, 2026 (retry pass — the paragraph below this one
was stale: the reviews migration was renumbered 0016 → 0017 and the
duplicate 0012/0013 files were renumbered, so its run order was
wrong). Verified Nov 20, 2026: migrations 0001–0020 exist, each
number exactly once, and all 20 parse clean (pglast parse-check, no
live run). Run order, once the founder says so:

```
0001 → 0002 → 0003 → 0004 → 0005 → 0006 → 0007 → 0008 → 0009 → 0010 →
0011 → 0012 → 0013 → 0014 → 0015 → 0016 → 0017 → 0018 → 0019 → 0020
```

0001 core · 0002 extended · 0003 power backend · 0004 onboarding /
student-teacher · 0005 timelines / questionnaire / audit / nudges ·
0006 orders / shipments / notices · 0007 RLS role gapfill · 0008 RLS
recursion fix · 0009 agency / family arrangements · 0010 leads / NVC
/ lifecycle / notifications · 0011 RLS deploy gapfill · 0012
preparer gaps · 0013 public profiles view · 0014 unified comms / BYO
/ service sync (this is the file that was the duplicate 0013) ·
0015 storefront sections / addons · 0016 Next Step stage / payment /
comms · 0017 reviews / referrals / renewals / booking (this is the
file that was 0016) · 0018 Visa Bulletin / USCIS templates (this is
the file that was the duplicate 0012) · 0019 block role escalation ·
0020 login codes.

Migrations 0001–0008 ran live Nov 19, 2026 6:52 PM EST;
0009–0020 are written only, not run live. `case_renewals` already
existed (0014) — 0017 only widens its `renewal_type` CHECK; no
duplicate renewals table was created. The genuinely new tables in
0017 are `reviews` and `consultation_requests` only. No new
migration was needed for this retry pass: 0017 already covered
reviews, referrals, renewals, and booking, so no 0021 was created
and no number was duplicated.

### 13c. Founder decision checklist (NOT decided here)

1. **Referral reward amount.** "Referral reward: to be announced by the founder" is shown everywhere; no amount, discount code, payout, or Stripe flow exists until the founder sets it.
2. **Which checklist item counts as approved to make 5 of 6?** The brief said "5 of 6 Approved" but the data gives 4 of 6 (Birth Certificate In Review, Joint Bank Statement needs retake). The portal keeps showing the computed 4 of 6 with the explanatory note until the founder decides.
3. **Catalog label — 105 or 107?** Audit of the static site's form directory: 107 entries = 105 standalone forms + 2 supplements (I-485 Supplement A and I-485 Supplement J, filed with I-485). The portal shows "105 forms listed" with that note. Confirm the 2 supplements stay counted as directory entries (107) or relabel the static site to 105. The static site's "All 107 Forms" label is NOT fixed by this portal build.
4. **Duplicate migration numbers 0012/0013 — RESOLVED Nov 20, 2026.** The duplicates were renumbered (unified comms is now 0014, Visa Bulletin / USCIS templates is now 0018); migrations 0001–0020 now exist once each. No founder action needed on this item.
5. **Stripe account.** "Do you already have a Stripe account for NIPTEI / The Feet Washers?" — real checkout / Pay in 3 / Monthly / payment links need it; the portal webhook (`/api/stripe/webhook`) stays a 501 skeleton until the keys exist. (Also §11 item 1 — still unanswered.)
6. **Attorney review BEFORE live use.** Installment contract, refund policy, UPL agreement, retainer/trust wording — each is labelled "Draft — for a licensed attorney to review before live use". None goes live until reviewed. (Also §11 item 4.) Status Nov 20, 2026: the refund policy IS labelled that way in code (`src/lib/fees.ts`, `src/components/portal/OrderSections.tsx`) and retainer/trust wording IS labelled "DRAFT — trust accounting is regulated and needs attorney review" (`src/app/legal-back-office/page.tsx`). The installment-contract text and the UPL-agreement text do NOT exist anywhere in the portal yet — only references to them ("Pay in 3", "UPL agreement required", "UPL agreement NOT signed") — so there is nothing to label in code; when either document is written, it must carry the "Draft — for a licensed attorney to review before live use" label and must not be used live until reviewed.

### 13d. Live-setup checklist (guide only — nothing here is live)

- **Supabase env vars to Vercel project itfw-live** (values never in chat/code): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server-only). Supabase project is "Immigration" (jdxjskqdvwqarfhcqjlg) ONLY — one Vercel project to one Supabase project, never shared with another app, per the founder's separation rule (Nov 19, 2026). Keys are NOT yet in Vercel.
- **USCIS Production key:** 5 days of Sandbox traffic + demo + approval — guide only. Sandbox only in code; live USCIS lookup is NOT built.
- **Visa Bulletin:** manual entry from travel.state.gov only — never invent a cutoff, never claim live scraping.
- **Twilio + Resend/SendGrid + Google Translate + e-signature:** skeletons return 501 / `not_configured` until keys exist. BYO per professional. Renewal nudges (48h, client's language) and appointment reminders (24h + 1h) are QUEUED only — nothing is ever claimed sent.
- **E-signature (explicit):** NO e-signature provider is connected. Status is tracked only (`src/components/comms/CaseTools.tsx`, `src/components/DynamicFormIntakeEngine.tsx`); signatures are collected only once a provider is connected, and a law-student draft unlocks for client E-Sign only after supervisor approval. 501 / `not_configured` until a provider + keys exist.
- **Tesseract / OCR:** NO unpinned CDN is loaded anywhere in the portal (verified Nov 20, 2026 — zero external script/CDN loads in `portal/src`). OCR is labelled "not available until the library is pinned" in the company back office. Do not add a Tesseract CDN script without a pinned version + SRI `integrity=` hash; if pinning cannot be verified, keep the CDN load removed.
- **Tesseract / OCR (Nov 28, 2026 — expert tools):** pinning verdict is now in `src/lib/expertTools.ts` OCR_STATUS: NO OCR library is installed, and pinning the npm package alone would NOT pin what runs — tesseract.js (latest 7.0.0, registry reachable Nov 28, 2026) downloads its worker script + trained language data from a CDN at runtime by default. Safe pinning needs pinned npm package + self-hosted worker + traineddata (or pinned SRI-hashed script + pinned data URLs), verified by hash. Until that is built, OCR stays unavailable and no text is extracted.
- **Expert tools (Nov 28, 2026 — founder's question):** `src/lib/expertTools.ts` + migration 0033. E-sign: in-platform typed signature completion (POST /api/signatures/sign) over the 0001 signatures table; no outside provider connected. Video: manual pasted link via bookings PATCH (Google Meet NOT connected, no fake links). Translation orders: POST /api/translation-orders, locked $45/page, status pending, payment confirmed only by the Stripe webhook. Receipts: GET /api/invoices/[id]/receipt, USCIS fee always on its own line. Founder analytics: roll-up over real rows in reporting.ts (subscription revenue excluded — no subscriptions table). Export: GET /api/export/case, printable manifest, audit-logged. Smoke: `npx -y tsx scripts/smoke-expert-tools.ts` (73 checks, fake data only).
- **EOIR roster links** (checked Nov 14, 2026): roster PDF `https://www.justice.gov/eoir/media/1398081/dl?inline`, roster-reports page `https://www.justice.gov/eoir/recognition-accreditation-roster-reports`, R&A Program page `https://www.justice.gov/eoir/recognition-and-accreditation-program`. Florida tip in the component: Ctrl+F / Cmd+F "Florida" in the by-state PDF.

### 13e. Retry verification (Nov 20, 2026 — this pass)

The previous worker was lost in a daemon restart, so this pass
re-audited every forgotten item against the code instead of
rebuilding it. Findings: items 1–5 were already built and wired by
the earlier builders (migration 0017, libs, components, API routes,
portal/preparer/storefront wiring) — verified, not rebuilt. No new
migration was created; no live run, no Supabase/Vercel/GitHub touch,
no static v33 touch, no DNS touch.

- **Verified, no change needed:** reviews (stage-6 gate in
  `/api/reviews` — `case_lifecycle.stage` is integer 1–6 per
  migration 0010, so the `stage !== 6` check is correct; empty state
  "No reviews yet — be our first."; professional reply only; hide
  only with reason logged to `audit_log`; no delete); "Tell us how
  we did" (`/reviews/new`) + stage-6 prompt in `ReviewsSection`;
  referrals (counts from real `preparer_leads` rows, 0/0 empty
  state, "Referral reward: to be announced by the founder", no
  discount/payout/Stripe); renewals (I-90 6 months, I-751 90 days,
  EAD/TPS 180 days, passport; 48h nudge queue; "Your renewals" in
  the client portal; "Renewals coming up" in preparer
  `DailyCommand`); booking (free 15-min / 30-min $99, phone / video
  / in-person, evening / weekend, language, timezone; Accept /
  Propose another time / Decline; "Calendar not connected" label);
  Interview & Medical card (embassy post, interview date, VAC,
  panel-physician medical exam, original-documents binder,
  "What to bring", 24h + 1h reminders queued not sent); mobile
  header (flex-wrap, no nowrap/ellipsis/overflow-hidden on the
  Start button); EOIR (full labels + all 3 official links +
  Florida Ctrl+F tip + "Links checked Nov 14, 2026" — the 4 short
  labels "Urgent Help, VAWA, U visa, DOJ pages" exist ONLY in the
  static `index.html` nav, which this portal build does not touch);
  catalog (105 unique form codes verified by count in
  `src/lib/catalogAudit.ts`; 2 supplements excluded, honest note
  shown); Tesseract (zero external script/CDN loads in
  `portal/src` — grep verified Nov 20, 2026; OCR labelled not
  available until pinned); checklist (computed 4 of 6 kept, with
  the "Not yet approved" explanation — founder decision item 2
  above, undecided).
- **Fixed in this pass (2 files):** client referral codes now
  resolve. Before, `/api/referrals?code=` and `/r/<code>` only
  looked up `professional_profiles.referral_code`, so a client's
  `accounts.referral_code` resolved nowhere and the referred person
  got "No professional was found". Now the API resolves the
  professional code first, then falls back to the client's account
  code → that client's latest case → its assigned provider's
  storefront (the referrer stays the client), and `/r/<code>` uses
  the API as the single resolution path instead of querying
  Supabase directly. Files: `portal/src/app/api/referrals/route.ts`,
  `portal/src/app/r/[code]/page.tsx`.
- **Verified in this pass:** all 20 migrations (0001–0020) parse
  clean (pglast, Nov 20, 2026); `npm run build` + `npx tsc
  --noEmit` pass (see §13e note below — rerun after this edit if
  the parent needs a fresh confirmation).

### 13f. Second-retry verification (Nov 19, 2026, evening — this pass)

The parent re-ran this task as a second retry (two earlier workers
were reported lost in daemon restarts). This pass re-audited every
forgotten item from scratch against the code and the database files
instead of rebuilding: **no code file needed changing, and none was
changed** — the only edit in this pass is this §13f note in
`DEPLOY.md`. Nothing was run live, no Supabase / Vercel / GitHub
touch, no static v33 touch, no DNS touch, no `rm -rf .next`.

- **Verification run in this pass:** `npx tsc --noEmit` — exit 0.
  `npm run build` — exit 0, "Compiled successfully", 37/37 static
  pages generated, including `/reviews/new`, `/r/[code]`,
  `/api/reviews`, `/api/referrals`, `/api/renewals`, `/api/bookings`.
  (Build took ~6 minutes on the shared 1.5-CPU VM; no other builder's
  files were touched and `.next` was not cleaned.) All 20 migrations
  0001–0020 parse clean with pglast (no live run). Catalog count
  re-verified by count: `CATALOG_FORM_CODES` in
  `src/lib/catalogAudit.ts` is exactly 105 unique codes, 0
  duplicates; the 2 excluded entries are I-485 Supplement A and
  I-485 Supplement J.
- **Item-by-item re-verification (all confirmed present, no gaps):**
  1. Reviews — `src/lib/reviews.ts`, `src/components/portal/ReviewsSection.tsx`,
     `src/app/reviews/new/page.tsx`, `src/app/api/reviews/route.ts`,
     migration 0017 `reviews` table + `reviews_enforce_moderation`
     trigger. Stage-6 gate confirmed against the schema:
     `case_lifecycle.stage` is integer 1–6 (migration 0010), so the
     API's `stage !== 6` check is correct. Empty state is exactly
     "No reviews yet — be our first." everywhere; professional reply
     only; founder/admin hide only with `hidden_reason`, logged to
     `audit_log` by the trigger; no delete, no edit of rating/text/
     name/service. "Tell us how we did" page + stage-6 prompt in
     `ReviewsSection` (prompt appears only when `caseClosed`).
  2. Referrals — `src/lib/referrals.ts`, `src/components/portal/ReferralCard.tsx`
     ("X families you referred, Y became clients" from real
     `preparer_leads` rows, 0/0 at start), `/r/<code>` resolves via
     `/api/referrals?code=` (professional code first, then client
     account code → latest case → assigned provider's storefront),
     storefront `insertLead` records `referral_source='Referral'` +
     `referrer_account_id` + `referral_code`. "Referral reward: to be
     announced by the founder" shown; no reward amount, discount
     code, payout, or Stripe anywhere.
  3. Renewals — `src/lib/renewals.ts` (I-90 green card 180 days,
     I-751 conditional 90 days, EAD/TPS 180 days, passport 180 days,
     N-400 90 days; 48h nudge via `NUDGE_INTERVAL_HOURS`),
     `src/components/portal/RenewalsSection.tsx` ("Your renewals"),
     "Renewals coming up" in `src/components/preparer/DailyCommand.tsx`,
     `src/app/api/renewals/route.ts` (501 until Supabase set).
     `case_renewals` already exists (migration 0014); 0017 only
     widens its `renewal_type` CHECK — no duplicate table.
  4. Booking — `src/lib/booking.ts` (free 15-min $0 / 30-min $99,
     phone/video/in-person, evening/weekend, language, timezone),
     storefront consultation form in `src/app/p/[slug]/page.tsx`,
     `src/app/api/bookings/route.ts` (POST request, PATCH Accept /
     Propose another time / Decline), `src/components/preparer/AppointmentsRenewals.tsx`,
     `src/components/portal/InterviewMedicalCard.tsx` (embassy post,
     interview date, VAC appointment, panel-physician medical exam
     date, original-documents binder, "What to bring", 24h + 1h
     reminders queued, never claimed sent). "Calendar not connected —
     requests are collected, the professional confirms by message"
     is labelled in the UI and the API; no calendar sync is claimed.
     No appointment date is invented (all dates blank until entered).
  5. Polish — Portal header `src/components/portal/PortalShell.tsx`:
     flex-wrap header, Start is a real link, no `white-space:nowrap` /
     `overflow:hidden` / `text-overflow:ellipsis` on the button (the
     landing page `src/app/page.tsx` has no Start button, so there is
     no second portal header to fix; the live static site's clipping
     is NOT claimed fixed). EOIR: `src/components/EoirRosterLinks.tsx`
     + `EOIR_ROSTER_LINKS` in `src/lib/example-data.ts` — full labels,
     all 3 official links (roster PDF
     `https://www.justice.gov/eoir/media/1398081/dl?inline`,
     roster-reports page, R&A Program page), Florida Ctrl+F tip,
     "Links checked Nov 14, 2026". The 4 short labels ("Urgent Help",
     "VAWA", "U visa", "DOJ pages") exist ONLY in the static
     `index.html` nav (line 369) — that file is the live static v33
     artifact and is out of scope for this portal build, so they were
     left untouched there. Catalog: 105 unique codes (above) with the
     honest note in `ServiceCatalog.tsx`; no 2 forms invented.
     Tesseract: zero external script/CDN loads in `portal/src`
     (grep re-verified this pass); OCR is labelled "not available
     until the library is pinned" in the company back office — do not
     add a Tesseract CDN script without a pinned version + SRI hash.
  6. Checklist discrepancy — `src/components/nextstep/ColourChecklist.tsx`
     keeps the COMPUTED 4 of 6 with the explanatory note (Birth
     Certificate In Review, Joint Bank Statement needs retake); the
     brief's "5 of 6 Approved" is never hardcoded. Founder decision
     item 2 below, still undecided.

### 13g. Founder decision + live-setup checklist (consolidated — Nov 19, 2026)

Founder decisions — NOT decided here, each needs the founder's word:

1. **Referral reward amount.** Shown as "Referral reward: to be
   announced by the founder" until the founder sets an amount. No
   discount code, payout, or Stripe flow until then.
2. **Which checklist item counts as approved to make 5 of 6?**
   Brief said "5 of 6 Approved"; data gives 4 of 6 (Birth Certificate
   In Review, Joint Bank Statement needs retake). Portal keeps
   showing computed 4 of 6 until the founder decides.
3. **Catalog label — 105 or 107?** 107 directory entries = 105
   standalone forms + 2 supplements (I-485 Supplement A / J). Portal
   shows "105 forms listed" with that note. Confirm the supplements
   stay counted as directory entries (107) or relabel the static
   site to 105 standalone forms.
4. **Stripe account.** "Do you already have a Stripe account for
   NIPTEI / The Feet Washers?" — real checkout / Pay in 3 / Monthly /
   payment links need it; `/api/stripe/webhook` stays a 501 skeleton
   until keys exist. (Also §11 item 1, §13c item 5 — still
   unanswered.)
5. **Attorney review BEFORE live use.** Installment contract, refund
   policy, UPL agreement, retainer/trust wording — each labelled
   "Draft — for a licensed attorney to review before live use". None
   goes live until reviewed. Status: refund policy IS labelled that
   way in code (`src/lib/fees.ts`, `src/components/portal/OrderSections.tsx`);
   retainer/trust wording IS labelled "DRAFT — trust accounting is
   regulated and needs attorney review"
   (`src/app/legal-back-office/page.tsx`). The installment-contract
   text and the UPL-agreement text do NOT exist anywhere in the
   portal yet — only references ("Pay in 3", "UPL agreement
   required", "UPL agreement NOT signed") — so there is nothing to
   label in code; when either document is written it must carry the
   "Draft — for a licensed attorney to review before live use" label
   and must not be used live until reviewed.

Live setup — guide only, nothing here is live:

- **Supabase env vars to Vercel project `itfw-live`** (names only,
  NO values, never in chat/code): `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
  (server-only). Supabase project is "Immigration"
  (jdxjskqdvwqarfhcqjlg) ONLY — one Vercel project to one Supabase
  project, never shared with another app. Keys are NOT yet in Vercel.
- **Migrations run order (verify, do NOT run live):** 0001 → 0002 →
  0003 → 0004 → 0005 → 0006 → 0007 → 0008 → 0009 → 0010 → 0011 →
  0012 → 0013 → 0014 → 0015 → 0016 → 0017 → 0018 → 0019 → 0020.
  0001–0008 ran live Nov 19, 2026 6:52 PM EST; **0009–0020 are
  written only, not run live** (0009 agency/family, 0010 leads/NVC/
  lifecycle, 0011 RLS gapfill, 0012 preparer gaps, 0013 public
  profiles view, 0014 unified comms/BYO/service sync incl.
  `case_renewals`, 0015 storefront sections/addons, 0016 Next Step
  stage/payment/comms, 0017 reviews/referrals/renewals/booking,
  0018 Visa Bulletin/USCIS templates, 0019 block role escalation,
  0020 login codes). No new migration was needed in this pass: 0017
  already covered reviews, referrals, renewals, and booking, so no
  0021 was created and no number was duplicated.
- **USCIS Production key:** guide only — 5 days of Sandbox traffic +
  demo + approval. Sandbox only in code; live USCIS lookup is NOT
  built and no Production key exists.
- **Visa Bulletin:** manual entry from travel.state.gov only — never
  invent a cutoff, never claim live scraping.
- **Twilio + Resend/SendGrid + Google Translate + e-signature:**
  skeletons return 501 / `not_configured` until keys exist. Renewal
  nudges (48h, client's language) and appointment reminders (24h +
  1h) are QUEUED only — nothing is ever claimed sent. E-signature:
  NO provider is connected; signatures are collected only once a
  provider is connected.

## 14. Google Register + Login — Supabase Auth (Nov 19, 2026)

> Google sign-in is wired to Supabase Auth — it will work once the Supabase env vars are set in Vercel and the portal is deployed. It does NOT work on the static live site.

- **Supabase side — already done, do not redo.** Google Auth is ALREADY ENABLED in the live Supabase "Immigration" project (verified Nov 19, 2026 — Client ID + Client Secret already filled in Supabase). The founder does NOT need to create a Google Cloud OAuth client. Do NOT create a second Google OAuth client and do NOT change the Supabase Google provider settings. Exact callback URL Supabase shows: `https://jdxjskqdvwqarfhcqjlg.supabase.co/auth/v1/callback`.
- **Files (portal only, no other builder's files touched):**
  - `src/lib/googleAuth.ts` — `signInWithOAuth({ provider: 'google' })`, role destinations, `public.accounts` lookup by `auth_user_id`, the honest not-live note.
  - `src/components/auth/GoogleSignInButton.tsx` — shared "Continue with Google" button (Register + Login). Disabled with the not-live note until Supabase is wired; never a fake button that does nothing.
  - `src/app/register/page.tsx` — Google button above the email role forms, plus a link to `/login`.
  - `src/app/login/page.tsx` — NEW page (there was no Login page before). Google button + email-code login (code every email login, `signInWithOtp` with `shouldCreateUser: false` + `verifyOtp`; no password login, no remember-device). Founder / Admin section: email + code only, no Google button.
  - `src/app/auth/callback/page.tsx` — where Google sends the user back. Existing account (matched by email) → role destination; no account row yet → `/onboarding?google=1` for role selection.
  - `src/app/api/google-profile/route.ts` — completes the profile of a Google user with no account row yet. Verifies the session token, writes ONLY the profile rows (`public.accounts` + `professional_profiles` / `student_profiles`), returns 409 and writes nothing if an accounts row already exists. No password accepted or stored.
  - `src/app/onboarding/page.tsx` + `src/components/onboarding/RoleForms.tsx` — `?google=1` notice; in Google mode the role forms post to `/api/google-profile`, hide the password fields, and skip the email-confirmation step (Google already verified the email). Role selection is still required — nothing is pre-selected.
- **Flow:** Google sign-in → `/auth/callback` → existing account signs into that same account (matched by email, no duplicate) → new user picks ONE role and completes that role's profile → onboarding ladder is the same as email register: `role_selected` → `profile_completed` → `pending_verification` → `active`. Professionals still need admin verification before listing / G-28 / assignments (attorney bar, DOJ EOIR roster, student supervisor confirmation). Law Students still need teacher/supervisor confirmation.
- **Security:** email code every login still applies to EMAIL logins. Google logins use Google's own verification — no second email code on top of Google, no Google password stored, the Google token is never logged. A user's Google email is shown only to the user themselves, to their assigned professional, and to the Founder/Admin verification queue where the role requires it — never to other users, never in a URL, never logged.
- **What is still NOT live:** Supabase env vars in Vercel (`NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` — NOT yet set, Vercel sign-in still waiting) · portal deployment (the portal is not deployed, so no Google login can complete end-to-end yet) · no live Google sign-in has been tested against the deployed portal. Until both are done, the button stays disabled with the note above.
- **Teacher addendum (Nov 19, 2026 — same day, second pass):** the first pass left Teacher out of `/api/google-profile` and the Google-mode teacher form claimed "active (example)" with no account row. Fixed: `google-profile` now accepts role `teacher` (writes `public.accounts` role `teacher` + `public.teacher_profiles` from migration 0004, `onboarding_status` `pending_verification` — an admin must approve a teacher before they can confirm students, so nobody can self-confirm as a "teacher" and approve their own student account); the Google-mode teacher form in `RoleForms.tsx` now posts to `/api/google-profile` instead of the example completion (email-mode teacher form is unchanged — teacher is not an email register role). `roleDestination("teacher")` in `src/lib/googleAuth.ts` is now `/teacher-dashboard`, matching email login (`redirectAfterLogin` in `src/lib/loginCodes.ts`) — it was wrongly `/admin/verifications`, which is the Founder/Admin queue. NOTE: no `/teacher-dashboard` page exists in the app yet, for either login path — that page is still to be built; until then a teacher lands on a 404 rather than inside the admin queue.

## 15. SEO + free-tools lead generator — Search Console / Bing Webmaster verification guide (Nov 28, 2026)

> **What this section is.** The portal's SEO foundation (`src/lib/seo.ts`,
> `src/app/sitemap.ts`, `src/app/robots.ts`, per-form / per-topic /
> per-language landing pages, JSON-LD) and the free-tools lead generator
> (`/free-tools` hub + the five free tools) are code in this repo. They
> make the platform **findable** in Google, Yahoo, and Bing. They do NOT
> guarantee a ranking, a number-one spot, traffic, or clients — no one
> can promise that, and the product says so on every public page
> (`SEO_NO_RANKING_NOTE`). Search engines list the pages; people find
> them; the free tools and the enquiry form turn finders into leads.
> No tracking of individual searchers, no bought lists, no fake
> reviews/testimonials.

### 15.1 What is already live in code (nothing to submit yet)

- Sitemap (public pages only — no dashboard, portal, family, auth, or
  API URL ever appears): `https://immigration.niptei.com/sitemap.xml`
  — generated by `src/app/sitemap.ts` from `src/lib/seo.ts`
  `sitemapEntries()`. It lists the home page, `/leads`, the `/free-tools`
  hub + both tool pages, `/professionals`, `/for-professionals`,
  `/glossary`, `/journey`, `/your-rights`, `/cheatsheets` + all 6 role
  pages, `/fee-waiver`, `/packet-rescue`, `/intake`, `/onboarding`,
  `/diy`, `/interview-prep`, `/backbone`, `/safety` + its 3 sub-pages,
  `/reviews/new`, all 9 `/topics/<slug>` pages, all 7 `/lang/<code>`
  pages, and one page per form in the locked catalog (`/forms/<code>`).
  Storefront URLs (`/p/<slug>`) are NOT listed until a profile is
  actually published — no slug is ever invented. Referral URLs
  (`/r/<code>`) are never listed.
- Robots: `https://immigration.niptei.com/robots.txt` — public pages
  crawlable; portal, dashboards, family, auth, API, and admin
  disallowed; points at the sitemap above.
- Every public page carries a meta title + description
  (`src/lib/seo.ts` `PUBLIC_PAGE_META` + `metaForPublicPath()`; client
  pages carry theirs in a `layout.tsx` in the same segment).
- Structured data (JSON-LD) only where the content already exists:
  Organization + FAQ on `/`, FAQ on `/forms/<code>`, HowTo (from the
  existing lead-loop steps) on `/free-tools` and
  `/topics/getting-started`. No other page claims FAQ/HowTo data.

### 15.2 What only the founder can do (from her own accounts)

Nobody else can do these steps — they need the founder signed in to
her Google and Microsoft accounts. Do them **after the portal is
deployed** (the sitemap URL must return the live sitemap, not a 404)
and after migration 0033 has run (so tool leads store `tool_used`).

**Google Search Console — https://search.google.com/search-console**

1. Sign in with the founder's Google account (the one that owns the
   Google for Nonprofits / Ad Grants account — do NOT create a new
   Google account for this).
2. Add property → **URL prefix** → enter exactly
   `https://immigration.niptei.com/` → Continue.
3. Verify ownership. Pick **HTML tag** (easiest): copy the
   `<meta name="google-site-verification" content="...">` tag Google
   shows. Give that tag to the portal builder — it goes into
   `src/app/layout.tsx` `metadata.verification.google` (code change,
   then redeploy). Do NOT paste the tag anywhere else, and do NOT use
   the DNS method unless the builder asks for it (DNS lives with the
   domain registrar, and a wrong DNS edit can take the site down).
   Alternative if the tag route stalls: **Google Analytics** — only if
   Google Analytics is already on the site, which it is not today.
4. After verification shows as confirmed, go to **Sitemaps** (left
   menu) → enter exactly `sitemap.xml` → Submit. The full sitemap URL
   being submitted is `https://immigration.niptei.com/sitemap.xml`.
5. Wait. Google reads the sitemap on its own schedule — days to
   weeks. Check **Pages** (under Indexing) after a week: it shows
   which submitted pages were indexed and which were not, with a
   reason per page. Fix only what it names; do not resubmit daily.

**Bing Webmaster Tools — https://www.bing.com/webmasters**

1. Sign in with the founder's Microsoft account.
2. Add site → enter exactly `https://immigration.niptei.com/` →
   Add. (Bing covers Yahoo search results too — one submission
   reaches both.)
3. Verify ownership. Pick **HTML tag** (same pattern as Google): copy
   the `<meta name="msvalidate.01" content="...">` tag and give it to
   the portal builder — it goes into `src/app/layout.tsx`
   `metadata.verification.other` (code change, then redeploy).
   Shortcut: if Google Search Console verification is already done,
   Bing offers **Import from Google Search Console** — use that
   instead of a second tag; it copies the verified property and the
   sitemap in one step.
4. After verification, go to **Sitemaps** → Submit sitemap → enter
   exactly `https://immigration.niptei.com/sitemap.xml` → Submit.
5. Check **URL Inspection** / **Site Explorer** after a few days for
   crawl errors. Fix only what it names.

### 15.3 What to expect — and what NOT to expect

- Expect: pages become findable in search over days–weeks; Search
  Console / Bing show impressions and clicks per page and per query
  (aggregate counts only — never who searched).
- Do NOT expect: a ranking position, a number of visitors, or a
  number of clients by any date. Nobody can promise those, and this
  platform never claims them. If anyone offers "guaranteed #1 on
  Google" for money, that is a scam — say no.
- The lead generator works the same honest way: people who arrive
  use a free tool, and — only if they choose — leave their details
  for one follow-up. The tools do not watch searchers.

### 15.4 Free-tools lead generator — how it converts (code reference)

- Hub: `/free-tools` — all five tools, one line + CTA each
  (`src/lib/freeTools.ts` FREE_TOOLS; page `src/app/free-tools/page.tsx`).
  Share buttons on the hub and on both tool pages (plain links, no
  tracking parameters).
- Packet Health Check + fee calculator: existing tools, public entry
  `/diy` (`src/lib/diyHealthCheck.ts`, `src/lib/diyFees.ts`).
- Interview question of the day: existing, entry `/today`
  (`src/lib/dailyHome.ts questionOfTheDay()`). Free once signed in
  and interview-prep access is confirmed — the hub says so.
- Sponsor income checker: NEW public UI
  (`src/app/free-tools/sponsor-income` +
  `src/components/free-tools/SponsorIncomeChecker.tsx`) over the
  existing locked qualifier (`src/lib/formChecklists.ts`
  `sponsorShortfallCheck`). Runs in the browser; income never stored.
- Visa Bulletin date checker: NEW public UI
  (`src/app/free-tools/visa-bulletin` +
  `src/components/free-tools/VisaBulletinChecker.tsx`) over the
  existing matcher (`src/lib/visaBulletin.ts matchPriorityDate`). No
  cutoff dates are stored — the visitor enters the cutoff from
  travel.state.gov.
- Follow-up nudge: after a tool is used, `ToolLeadCapture`
  (`src/components/leads/ToolLeadCapture.tsx`) OFFERS a capture
  (name/phone/email/service) with the honest what-happens-next note
  (one follow-up, never spam, details never sold). It posts to the
  EXISTING `/api/leads` route with `toolUsed` + `arrivalChannel`;
  migration 0033 adds `preparer_leads.tool_used`.
- **Open founder decision (not decided in code):** `/api/leads`
  deliberately refuses when no professional is identified (no
  `?provider=<slug>` or `?ref=<code>`) — a lead is never assigned to
  a guessed preparer. A visitor who arrives from search with no link
  therefore sees the honest routing note and links to pick a
  professional, instead of their enquiry being saved. To let search
  traffic convert directly, the founder must designate a platform
  intake fallback (for example, the platform intake account that
  already receives quote requests at nipteiapp@gmail.com) and say so
  in her own words. Until then, the hub preserves `?ref=` /
  `?provider=` through every tool link, so referred visitors convert.
- Referral + share (verified Nov 28, 2026): `ReferralCard` is on the
  client dashboard, the preparer home, the attorney home (added Nov
  28 — it was missing there), and the portal; `ClientInviteCard` is
  on the preparer home and the attorney home (added Nov 28). The
  Journey Map is shared only through the family invite system —
  there is no public link to a private case, and none is created.
