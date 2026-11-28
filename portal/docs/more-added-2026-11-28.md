# More added — beyond the 20 differentiators (Nov 28, 2026)

Founder's instruction: "if you have more you can add them and do not leave anything behind."
This is the LAST ADDITION of Nov 28, 2026: six further expert features, each verified
against the codebase first so nothing duplicates another builder's work.

## Audit done before building

Read before building: `docs/diy-extras-2026-11-28.md`, `docs/standout-five-2026-11-28.md`,
`docs/sixth-addition-2026-11-28.md`, `docs/daily-home-2026-11-28.md`,
`docs/final-sweep-2026-11-28.md`, `docs/backbone-2026-11-28.md`,
`docs/surprise-seo-lead-loop-2026-11-28.md`. No twenty-differentiators doc existed in
`portal/docs/` at build time (the 20-builder had not written one yet), so duplication
against the 20 was checked against the code instead: the seven suggested ideas were
each verified against `src/lib/*` and the migrations before building.

What already existed (and was therefore NOT rebuilt):
- Biometrics GUIDE (static text, `lib/backbone.ts` BIOMETRICS_GUIDE) — but no stored
  dates and no tracker. → Built #1.
- AR-11 Stripe prices only (`ar-11_basic` $25 / standard $40 / premium $60) + one
  daily-news line about the 10-day rule — no helper, no deadline math. → Built #2.
- RFE decoder + RFE/NOID deadline countdown + a denial one-liner — but no single
  emergency guide, and I-290B prices were never surfaced. → Built #3.
- 125% lookup + shortfall math (`lib/formChecklists.ts` sponsorShortfallCheck) — but
  no client-facing calculator, and that function's `qualified` boolean reads as a
  verdict on sufficiency. → Built #4 as numbers-only (verdict deliberately dropped).
- Backbone list of which documents need certified translations — but no per-document
  status or cost. → Built #5.
- `payment_plans` rows (0002) + locked splitter (`lib/stripe.ts` splitInvoices) — but
  nothing showed a client their plan. → Built #6.

## What was built

### 1. Biometrics appointment tracker — `src/lib/moreAdded.ts` (`biometricsTrackerView`)
Stored dates (migration 0030 `biometrics_appointments`): appointment date, ASC
location, notice-received date, status, rescheduled-from date — all entered manually
from the client's own I-797C notice. Days-until / today / attended / missed /
rescheduled. A past date with status still "scheduled" is "overdue — unconfirmed":
the platform never guesses attended or missed. Why: the backbone guide is static
text with nowhere to store a date.

### 2. Address-change (AR-11) helper — `src/lib/moreAdded.ts` (`ar11Deadline`, `ar11View`, `AR11_CHECKLIST`)
10-day rule as math (deadline = move date + 10 days) + a 5-item checklist of what the
move updates: USCIS AR-11, NVC/CEAC, platform profile, tell the preparer, check
notices sent to the old address. The platform NEVER files AR-11 — stated in the lib
and on the page; `uscis_filed_at` is only a manual confirmation the client filed it
themself. Address changes store city / state / ZIP only, never a full street address.
Why: only locked prices and one news line existed.

### 3. Emergency "what if" guide — `src/lib/moreAdded.ts` (`EMERGENCY_GUIDE`)
Four scenarios: RFE arrived, notice lost / never arrived, interview missed, case
denied. Each has what-happened, do-now steps, do-not steps, deadline source, and an
attorney note. Educational only — every scenario says to ask a licensed attorney or
DOJ-accredited representative. Denial surfaces the locked I-290B preparation prices
(Basic $599 / Standard $750 / Premium $899, read from `stripePrices.ts`, never
re-typed) with "preparation only, never the legal decision to file". Why: RFE tools
existed in pieces but there was no single guide and no I-290B pricing anywhere.

### 4. Sponsor income calculator — `src/lib/moreAdded.ts` (`sponsorCalculator`)
Numbers only: required 125% figure, income, shortfall, asset multiple (3x spouse /
minor child of a U.S. citizen, 5x otherwise), assets needed — for the petitioner and,
if given, a joint sponsor judged on THEIR OWN household. The `qualified` verdict
from `sponsorShortfallCheck` is deliberately NOT returned: only USCIS decides
sufficiency. Source: locked 2026 I-864P table (`SPONSOR_125_2026`). Why: the math
existed but no client-facing calculator, and the existing function's verdict wording
overstates what a calculator may say.

### 5. Document translation tracker — `src/lib/moreAdded.ts` (`translationEstimate`)
Per-document status (needed / in-progress / done / not-needed) for the civil
documents that can need a certified translation (birth, marriage, divorce/death,
police, other), at the locked $45/page (`addon_translation_page`). Passport, photos,
and DS-260 confirmation are listed explicitly as NOT needing translation. A document
with 0 pages costs $0 — page count unknown, never guessed. Why: the backbone lists
which documents need translations but nothing tracked status or cost per document.

### 6. Payment plan dashboard — `src/lib/moreAdded.ts` (`paymentPlanDashboard`)
From REAL `payment_plans` rows (0002) + the locked splitter: Pay in 3 / Monthly 6 /
Monthly 12 installments, paid vs remaining, next payment, and the exact
missed-payment math — a missed installment carries a 50% penalty on its unpaid part
(founder rule, from the row's `missed_payment_penalty_percent`, default 50).
Labelled manual handling only: there is NO Stripe setting for it, never an automatic
charge. If no plan start date is stored, every due date is "unknown" — never guessed.
Why: the rows and the splitter existed but no client-facing dashboard.

### Hub page — `src/app/more-added/page.tsx`
One page rendering all six: trackers show honest empty states until a real stored
record exists; the calculators run in the browser on what the visitor types (nothing
typed is sent or saved); the worked examples on the page are labelled examples, not
real appointments, moves, or plans.

## Files

- `portal/src/lib/moreAdded.ts` — all six features (pure logic + content).
- `portal/src/app/more-added/page.tsx` — hub page (`/more-added`).
- `portal/scripts/smoke-more-added.ts` — 18 smoke checks, fake data only.
- `supabase/migrations/0035_itfw_more_added.sql` — three new tables (see below).
- `portal/docs/more-added-2026-11-28.md` — this file.

## Migration 0030 — why

Three tables the features compute but could not store (all additive, RLS
`is_case_participant(case_id)` + founder/admin select, `updated_at` triggers):
- `biometrics_appointments` — appointment date, ASC location, notice-received date,
  status, rescheduled-from date.
- `address_changes` — move date, deadline, city/state/ZIP only, checklist booleans,
  manual `uscis_filed_at` confirmation.
- `document_translations` — document type, pages, status (unique per case + type).
No new table for the payment dashboard (reads `payment_plans` from 0002), the
emergency guide (fixed content), or the sponsor calculator (typed numbers, not saved).
Nothing in 0030 stores a DOB, A-Number, SSN, passport number, receipt number, or
full street address.

## Verification

- `npx tsc --noEmit`: exit 2 — BUT all 5 errors are in
  `portal/src/lib/interviewSimulator.ts`, an untracked file from another parallel
  builder that this task did not touch. Zero errors in `moreAdded.ts`,
  `more-added/page.tsx`, or any file this task wrote. Left untouched for the
  coordinator / owning builder; the coordinator's clean build is the place to
  reconcile it. (No `npm run build` run, per the brief.)
- `npx -y tsx scripts/smoke-more-added.ts`: **18/18 passed** (fake data only).
  One fix during the run: an assertion matched the wrong wording ("right away" vs
  the lib's "do not wait for a second letter") — test corrected, lib unchanged.

## Deliberately not built

- Live USCIS Production API / live case-status sync — stays a labelled next step;
  all statuses here are manual entry from the client's own notices.
- Live SMS reminders (biometrics / AR-11 / payment due) — no live SMS in this build;
  the trackers show dates and states only.
- Real video — no video in this build.
- Filing AR-11, I-290B, or any form for the client — the platform never files
  anything; helpers only count deadlines and list steps.
- Any verdict on sponsor sufficiency, RFE evidence strength, or denial outcomes —
  numbers and general information only; only USCIS decides, only an attorney or
  DOJ-accredited representative advises.
- A seventh feature beyond the six: the audit found no further honest, buildable gap
  that was not already covered by the 20 differentiators, the backbone, the daily
  home, or the six above — padding with a duplicate was avoided on purpose.
- Locked prices and Stripe Price IDs untouched (`src/lib/stripePrices.ts` not edited);
  `index.html` untouched; no Vercel / Supabase live / Stripe live / GitHub / deploy
  action taken.

## Collision note for the coordinator

Migration number 0030 was free when this task started (latest was 0029), but other
builders are working in parallel in the same repo — if another builder also wrote a
0030, the two files need renumbering into one sequence before apply.
