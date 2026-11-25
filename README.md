 # ITFW Live — Immigration with NIPTEI

Live Public webapp for **Immigration with NIPTEI**, a document
preparation service of The Feet Washers, Inc., based in Fort Pierce, Florida,
serving families across Florida and the entire United States (all 50 states).

- **Live site (once deployed):** https://immigration.niptei.com/
- **Vercel project:** `itfw-live` (nipteiapp Vercel account, Hobby)
- **This repo:** static site only. `index.html` is the exported Live Public
  webapp (single self-contained HTML file, ~1.1 MB).

## What this site is

- We are **not** a law firm, not attorneys, and not affiliated with USCIS or
  the U.S. Department of State. No one can guarantee a petition or visa will
  be approved.
- A computer does **not** tell you which documents are needed, does **not**
  gather them, and does **not** file/submit them — **ITFW does**.
- Everything can be done online, from home: upload your documents, pay your
  fee, in your language (English, Español, Kreyòl Ayisyen, Français,
  Português, 中文, العربية).

## Locked prices (2026 figures only — do not change without the founder)

| Item | Price |
|---|---|
| Green Card Bundle — Basic / Standard / Premium | $999 / $1,799 / $2,799 (save $528 / $649 / $451) |
| I-485 (paper filing only, 09/18/26 edition) | USCIS $1,440 |
| I-751 (paper filing only) | USCIS $750 |
| I-730 | $299 flat, USCIS $0 |
| DIY per form / DIY Bundle (all 6 Adjustment forms) | $25 / $99 |
| Review per form / Review Bundle | $99 / $399 |
| Human Review | $199 |
| Client membership | $9.80/month or $98/year |
| Document Preparer / Attorney / DOJ nonprofit | $49 / $99 / $24.50 or $49.50 per month |
| Employer Door | $49/month |
| Completion speed: Standard 15–30 days / Rush 7 days / 24-Hour Express | $0 / +$199 / +$399 |

USCIS government fees are always separate from our service fee, never combined.

## Deploy

Vercel project `itfw-live` is connected to this repo (GitHub → Vercel auto-deploy
on push to `main`). See [DEPLOY.md](DEPLOY.md).

## Backend (Supabase)

The static page in this repo does **not** save accounts, cases, or documents —
those need the real backend. The SQL is in `supabase/migrations/`, run in the
Supabase SQL Editor in strict filename order, 0001 → 0020. Project
"Immigration" — https://jdxjskqdvwqarfhcqjlg.supabase.co (org THE FEET
WASHERS). **0001–0008 are LIVE** (isolation passed Nov 19, 2026: client 1
case, assigned professional 1, unassigned 0). **0009–0020 are WRITTEN ONLY —
not run yet.** Do NOT run 0009+ live until the founder / browser task says
so, and do NOT wire Supabase Auth live until migration 0019 has run (it
blocks the role-escalation flaw in 0001).

- `0001_itfw_core.sql` — accounts, professional profiles, cases, inbox,
  documents (vault), messages, invoices, signatures, appointments,
  case watch, audit log, with Row-Level Security. **LIVE.**
- `0002_itfw_extended.sql` — fee schedules, payment plans, family invites,
  employers / jobs / talent board, custom quotes, NVC trackers, RFE uploads,
  admin audit log, site content. **LIVE.**
- `0003_itfw_power_backend.sql` — enum fix (law_student / teacher /
  founder roles; law_student_35 and employer_49 plans), hot-query indexes,
  payment-plan installment-sum enforcement (incl. monthly_6 / monthly_12),
  RLS policies for every table, audit triggers (cases, documents, invoices,
  signatures, payment_plans), updated_at triggers, and the
  `cases_due_next_7_days` reminder view. **LIVE.** It does NOT charge
  Stripe, send SMS/email, or look up USCIS live.
- `0004_itfw_onboarding_student_teacher.sql` — onboarding_status,
  student_profiles, teacher_profiles, case_student_assignments (supervised
  students see a case only through an explicit assignment). **LIVE.**
- `0005_itfw_timelines_questionnaire_audit_nudges.sql` — timelines,
  questionnaire responses, audit items, reminder nudges. **LIVE.**
- `0006_itfw_orders_shipments_notices.sql` — orders, shipments, notices,
  order_invoices. **LIVE.**
- `0007_itfw_rls_role_gapfill.sql` — RLS role gap-fill. **LIVE.**
- `0008_itfw_rls_recursion_fix.sql` — RLS recursion fix. **LIVE.**
- `0009_itfw_agency_family_arrangements.sql` — agency / family
  arrangements, payment_arrangements. Written only.
- `0010_itfw_leads_nvc_lifecycle_notifications.sql` — leads, NVC
  lifecycle, notification_logs. Written only.
- `0011_itfw_rls_deploy_gapfill.sql` — RLS deploy gap-fill. Written only.
- `0012_itfw_preparer_gaps.sql` — preparer_profiles, preparer_case_todos,
  preparer_case_notes (provider-only), preparer_rfe_items,
  preparer_attorney_referrals. Written only.
- `0013_itfw_public_profiles_view.sql` — public_profiles view (storefront
  listing gate). Written only.
- `0014_itfw_unified_comms_byo_service_sync.sql` — provider_settings,
  message_sends, message_translation_flags, case_contact_preferences,
  case_renewals, case_referrals, appointment_reminders. Written only.
- `0015_itfw_storefront_sections_addons.sql` — storefront sections /
  add-ons. Written only.
- `0016_itfw_next_step_stage_payment_comms.sql` — case_post_submission,
  case_route_changes, case_next_steps. Written only.
- `0017_itfw_reviews_referrals_renewals_booking.sql` — reviews, referrals,
  renewal widening, consultation_requests, preparer_appointments. Written
  only. (Merged from two duplicate 0016 files, Nov 19–20, 2026 — see
  DEPLOY.md for the full renumbering record.)
- `0018_itfw_visa_bulletin_uscis_templates.sql` — Visa Bulletin manual
  entries, USCIS templates. Written only.
- `0019_itfw_block_role_escalation.sql` — BEFORE UPDATE trigger blocking
  role changes by non-admin/founder. Written only — **must run before
  Supabase Auth goes live.**
- `0020_itfw_login_codes.sql` — server-only login_codes table (SHA-256
  code hash, 10-minute expiry, 3-wrong lock). Written only.

Run them in the Supabase SQL Editor, in order, then set the Vercel env vars
listed in `.env.example`. **Never commit real keys.** The service-role key
never goes in the browser. Full consolidation record, open gaps, and the
Founder Decision Checklist are in [DEPLOY.md](DEPLOY.md).

## Contact

Text / call (772) 971-6129 · Email nipteiapp@gmail.com ·
https://immigration.niptei.com/
