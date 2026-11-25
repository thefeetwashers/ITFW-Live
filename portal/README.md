# Immigration with NIPTEI — Portal (Next.js + Tailwind)

Real React / Next.js + Tailwind code. **Not live yet** — see "What is NOT live" below.
Deploy guide (real routes, real env vars, launch checklist): [DEPLOY.md](DEPLOY.md).

## Run

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # tsc + next build — see DEPLOY.md for the current route list (other builders are adding routes; a fixed count here would go stale)
```

Env vars (`.env.local` / Vercel, never in code): `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, server-only `SUPABASE_SERVICE_ROLE_KEY`,
`STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`,
`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`,
`TWILIO_WHATSAPP_NUMBER`,
`RESEND_API_KEY` (or `SENDGRID_API_KEY`).

## Routes

| Route | What it is |
|---|---|
| `/` | Landing with links to the three areas |
| `/portal` | Upgraded Client Portal (68/32): Order/Invoice/Roadmap, USCIS tracker (example), Priority Actions, Smart Forms, Document Checklist, Provider panel, Case Chat, Interview Prep, Fee Breakdown, Guest Invites, Mail/USCIS Proof Vault, Activity Log + Escalation |
| `/portal/questionnaire` | Multi-language intake (7 languages), save-and-resume, 5-year gap validator |
| `/portal/packet-audit` | Pre-filing audit — score computed from `src/lib/audit.ts` (88% example, ready only at 100%) |
| `/onboarding` | Step 1 Role Selection (7 role cards) + conditional onboarding, `onboarding_status` progress |
| `/register` | Role Registration & Checkout (locked tiers, Stripe checkout wired — 501 until STRIPE_SECRET_KEY is set) |
| `/admin/verifications` | Founder/Admin verification queue (bar/EOIR), Approve/Reject-with-reason, audit log |
| `/back-office` | Role-adaptive back office (preparer / attorney / nonprofit / law student / platform admin). G-28 hidden for preparers; students see only assigned cases |
| `/legal-back-office` | Legal Back Office — roles 3 (attorney) / 4 (DOJ nonprofit) / 5 (law student) only; G-28/EOIR-28 gates, student supervision |
| `/company-back-office` | Company back office — left rail / center workspace / right comms hub; Twilio/Resend/video/E-Sign honestly labelled not connected |
| `/preparer-dashboard` | Preparer Command Center: identity card (A-Number masked), billing pipeline, USCIS/NVC hub, family invites, compliance guardrails |
| `/family-portal/[token]` | Token-gated family/co-sponsor view (status + missing items + upload slots only; invoices hidden unless `can_view_invoices`) |
| `/p/[slug]` | Public profile / storefront — VERIFIED + published profiles only (via the `public_profiles` view, migration 0013); quote + order requests go to that professional's Lead Sheet (`preparer_leads`) |
| `/api/stripe/webhook` | Real handler — signature-verified, records invoices / applies the monthly 6/12 stop / flips listings only when verified; 501 until STRIPE_WEBHOOK_SECRET is set |
| `/api/checkout` | Real Checkout Session endpoint — validates Price IDs against the locked map (132 Prices, `src/lib/stripePrices.ts`); 501 until STRIPE_SECRET_KEY is set |
| `/api/reminders` | Skeleton — 501 until Twilio + email provider exist |
| `/api/pdf/autofill` | Skeleton — 501 until official USCIS PDF templates exist (pdf-lib IS installed) |
| `/api/notify-stage` | Stage notifications — 501 until Twilio/Resend configured; templates in `src/lib/notificationTemplates.ts` (7 languages) |
| `/api/register-role` | Role Registration API — 501 until Supabase env set; `is_verified` always false at registration |
| `/api/generate-packet` | PDF packet generator (pdf-lib) — 409 unless packet audit is 100% with no blocking items; 402 while a balance is due; DRAFT watermark, never auto-filed |
| `/api/templates/check` | USCIS template field-check (pdf-lib) — compares a PDF's AcroForm fields with `src/lib/uscisFieldMappings.ts` |
| `/api/translate` | 501 / "translation not configured" until `GOOGLE_TRANSLATE_API_KEY` is set (and a Google Cloud client is installed); never returns a fake translation |
| `/api/messages/send` | Unified Thread send — 501 / `not_configured` until Supabase (Portal Chat) or the professional's own Twilio / Resend / SES is connected; never claims a message was sent |
| `/api/byo/test-send` | BYO test-send to the professional's OWN email/phone only — 501 until that provider is connected; never to a client |

## Shared logic (`src/lib/`)

`validator.ts` (5-year gap detection), `audit.ts` (packet readiness),
`questionnaire.ts` (question → USCIS field mapping, 7 languages),
`nudges.ts` (48h SMS/WhatsApp nudge logic), `invites.ts` (co-sponsor
invites, canonical link `https://immigration.niptei.com/guest/<token>`),
`order.ts` (roadmap unlocks; locked bundles $999/$1,799/$2,799; plans
Pay in Full / Pay in 3 / Monthly 6/12; missed-payment rule),
`bundles.ts` (I-130/I-485/N-400/I-589/I-821 templates),
`fees.ts` (3-line fee split; translation $45/page locked; draft refund
policy), `shipments.ts` (carrier link-outs, countdowns),
`activity.ts` (activity log + attorney escalation),
`agency.ts` (USCIS/NVC numbers, A-Number masking, CEAC link-out),
`stripe.ts` (split-invoice math).
`translate.ts` (7-language rules: original always shown, numbers/dates/
prices never altered, human confirmation for quotes/contracts/prices/
deadlines; Google Cloud Translation NOT connected), `messageTemplates.ts`
(6 quick templates in all 7 languages), `serviceTiers.ts` (service →
tier → features → permissions; `createCaseFromOrder()` sync plan),
`permissions.ts` (service-level permissions matrix — single source of
truth; `docs/permissions-matrix.md` is the same matrix),
`isolation.ts` (role-isolation helpers: `canViewCase()` /
`filterCasesForViewer()`), `byo.ts` (BYO provider definitions, last-4
masking, connected/tested gates), `caseTools.ts` (contact card, private
notes, tasks, appointments + 24h/1h reminders, renewals, daily command).

## Unified Communication layer (Nov 19, 2026)

One thread per case in every professional dashboard and in the Client &
Family Portal (`src/components/comms/UnifiedThread.tsx`); "What you can
do" panel (`PermissionsPanel.tsx`, from the matrix); BYO settings
(`ByoSettings.tsx`, last-4 only, keys never persisted in this build);
case tools (`CaseTools.tsx`, `DailyCommand.tsx`); tier summary
(`TierSummary.tsx`). Migration `0013_itfw_unified_comms_byo_service_sync.sql`
(new tables only: `provider_settings`, `message_sends`,
`message_translation_flags`, `case_contact_preferences`,
`case_renewals`, `case_referrals`, `appointment_reminders`, plus the
student message policies 0011 left open; private notes / to-dos reuse
`preparer_case_notes` / `preparer_case_todos` from 0012 — not duplicated).
Note: two 0012 and two 0013 files exist (concurrent builders); see the
0013 header for the numbering + reconciliation note. Known open gap:
migration 0003 §7a still grants Founder/Admin SELECT on case tables in
the database, while the task rule (and the UI) limits Founder/Admin to
the verification queue + audit log — closing it needs a founder
decision + follow-up migration; see `docs/permissions-matrix.md` §4.

## Migrations (`../supabase/migrations/`)

Run in order **0001 → 0020** in the Supabase SQL Editor. **0008 must run
before the isolation check is re-run** (fixes RLS recursion: helpers
recreated SECURITY DEFINER). No real client documents go into
Immigration until the isolation check passes (client 1 case / assigned
professional 1 / unassigned 0).
**Live status Nov 24, 2026: 0001–0020 ALL ran live** (0001–0008 Nov 19,
2026, isolation check PASSED; 0009–0020 Nov 24, 2026 — 0013 failed first
run with ERROR 42P16 and was fixed on disk, drop view + recreate, then
ran clean). 0015 storefront sections/add-ons · 0016 next-step engine ·
0017 reviews/referrals/renewals/booking · 0018 Visa Bulletin/USCIS
templates · 0019 role-escalation blocker · 0020 server-only login codes.
Isolation re-test with real rows is still open (the DB holds no user
data yet). **Do NOT wire Supabase Auth live until the founder decides
0003 §7a** (founder/admin DB read of client documents).

## What is NOT live

Supabase Auth / env vars in Vercel · Stripe keys in Vercel + webhook
endpoint registration in Stripe (checkout + webhook are WIRED in code —
`src/lib/stripePrices.ts` locked map of 132 LIVE Prices,
`src/app/api/checkout/route.ts`, `src/app/api/stripe/webhook/route.ts`;
both return 501 until the keys are set, so nothing charges yet) ·
Twilio/Resend sending · Google Cloud Translation (UI + mapping only) ·
USCIS Production key + worker (Sandbox only; receipt/status/deadlines
are EXAMPLE) · NVC/CEAC (manual link-out, no API, never store a CEAC
password) · carrier API (link-outs only) · certified-translation
fulfilment (requests only, no price/provider invented) · refund policy
(attorney review) · PDF auto-fill (pdf-lib IS installed; still needs
the official USCIS templates). All example data (Jane Doe, Alex M.,
IOE0928374651, INV-2049) is labelled EXAMPLE in the UI and code. No login,
upload, chat message, payment, or verification is live until wired + tested.
