# Sixth addition — Nov 28, 2026

Unpriced-form quotes, DIY fee up front + no double charge, a more
powerful Ask NIPTEI chat, immigration news inside the chat, and the
"anything missing" pieces (glossary, your-rights page, fee-waiver
checklist). Founder-approved. Code + migrations + docs only — nothing
deployed, nothing pushed, no live service touched.

## What already existed (verified, not rebuilt)

- **DIY pay gate** — `src/lib/diy.ts` `decideDiyUnlock` +
  `getDiyUnlockForCase` + `/api/diy/packet` (402 when unpaid) already
  enforced pay-before-unlock server-side from DB-confirmed payment.
  Verified by the smoke test; only the missing pieces were added
  (fee up front, already-paid guard).
- **Document-expiry reminders** — `src/lib/renewals.ts`
  (`deriveRenewal`, passport / green card / conditional / EAD / TPS /
  N-400 windows) + `/api/renewals` + `RenewalsSection` already exist
  end to end, from real dates only. Verified by the smoke test; nothing
  added.
- **Locked prices** — `src/lib/stripePrices.ts` untouched. DIY $25/form
  (`price_1UfS5APfd9SRUcvh47Ks9Lw0`) and DIY Bundle $99
  (`price_1UfS5iPfd9SRUcvhKEQxf0pj`) unchanged.

## 1. Unpriced forms — request a pricing quote

- `src/lib/quotedForms.ts` (new) — `UNPRICED_FORMS`: I-526E, I-526,
  I-829 (quoted individually) and I-693 (free booking; doctor $250–$500
  paid to the doctor). No price field exists anywhere on these records.
  `buildQuoteRequestRow()` validates and builds the row for
  `public.quote_requests`.
- `src/app/api/quote-requests/route.ts` (new) — POST saves to
  `quote_requests` (status `pending`) and attempts one SES email to the
  platform intake contact (`nipteiapp@gmail.com`, from
  `notificationTemplates.ts`) via `src/lib/email.ts`. SES unconfigured
  → honest `501/not_configured`, never claims sent. Subject carries
  only the form code (no PII). 400 for a priced form or bad email.
- `src/components/portal/RequestQuoteForm.tsx` (new) — mounted in the
  service catalog (`ServiceCatalog.tsx`, "Quoted individually" section).
- `supabase/migrations/0025_itfw_quote_requests_form_case.sql` (new) —
  adds nullable `form_code`, `account_id`, `case_id` to
  `quote_requests`. Additive only; the route still saves on the
  pre-0025 schema (form code in the description). No RLS change.

## 2. DIY fees — up front, never charged twice

- `src/components/diy/DiyGuidedFlow.tsx` — fee banner rendered BEFORE
  the step rail / step 1: DIY $25 for the form or $99 bundle, what it
  covers (guided help + print/save/email unlock), answering is free,
  USCIS fees separate. When unlocked it says "Already paid — you will
  not be charged again" instead of a pay button. Both `CheckoutButton`
  calls now pass `formCode`.
- `src/lib/diy.ts` — new `diyAlreadyPaidNotice(decision)`.
- `src/components/CheckoutButton.tsx` — optional `formCode` prop,
  passed to `/api/checkout`.
- `src/app/api/checkout/route.ts` — DIY checkout with case + account +
  form code is checked against the DB first; already-paid → **409
  `{ alreadyPaid: true }`**, no Checkout Session created. When payment
  records are not connected the check cannot verify, so it does not
  block checkout (the packet/email gates still fail closed).

## 3. Powerful chat — Ask NIPTEI, rule-based, sourced

- Label corrected everywhere: `COPILOT_DISCLAIMER` and `SYSTEM_LABEL`
  are now **"Ask NIPTEI — educational information only, not legal
  advice, not USCIS"** (system label adds "answered by the system, not
  a person"). The chat never pretends to be USCIS, a government
  officer, or an attorney. `scripts/smoke-instant-chat.ts` exact-label
  assertion updated to match.
- `src/lib/askNiptei.ts` — new intents, all from locked data +
  content already in the platform, every answer sourced:
  `interview` (what-to-bring lists, conduct guide, 25-of-100 civics
  sample, no guarantee), `bundles` (Family Adjustment Bundle
  $999/$1,799/$2,799 locked + catalog), `diy_fees` ($25/$99 locked),
  `fee_waiver` (I-912 checklist — see below), `glossary` (strict
  matcher: acronym or ≥2 shared words, so "Family Adjustment Bundle"
  no longer misfires on "Adjustment of Status"), `quoted_form`
  (I-526E/I-526/I-829/I-693 — no price invented), `news` (built-in
  posts + case-aware flag). Documents answers now list the FULL
  checklist, not just the first 5 items. Fee-waiver info questions
  are answered with the checklist; "do I qualify" still escalates.
  Non-English: original always shown, English null, translation note
  (no machine translation connected). No live AI model added; BYO AI
  stays 501.
- `src/lib/instantChat.ts` — label + `caseForms` passthrough.
- `src/app/api/ask-niptei/route.ts` — accepts `caseForms`, passes to
  engine + instant mode.

## 4. News inside the chat

- `src/lib/immigrationNews.ts` (new) — **no live feed is connected**
  (`feedConnected: false`, honest note). The ONLY built-in post is the
  one dated official item already in the codebase: the Visa Bulletin
  for November 2026 (2026-11-19, travel.state.gov, from
  `src/lib/visaBulletin.ts`). A grep found no other built-in news
  content anywhere in the portal, docs, or migrations — nothing else
  was invented. `matchNewsForCase()` flags matches as "This may affect
  your case — [summary] — source: [official source]". A flag means
  "read this", never "your case will change".
- `src/app/api/news/route.ts` (new) — GET, `?forms=` matching.
- `src/components/copilot/NewsAlert.tsx` (new) — alert/popup with the
  flags (`role="alert"`), the dated/sourced list, the no-live-feed
  note, and a dismiss button. Rendered in `InstantAnswerChat.tsx`
  (new optional `caseForms` prop).

## 5. Anything missing

- `src/lib/glossary.ts` (new) — 24 plain-language terms, each with
  the codebase location that defines/uses it and an official source.
  Strict `findGlossaryTerm()` matcher (see §3).
- `src/app/glossary/page.tsx` (new).
- `src/app/your-rights/page.tsx` (new) — interview half sourced from
  `interviewPrep.ts` (conduct guide, what the officer looks for, what
  to bring, representation under 8 CFR 292.1 / EOIR roster); border
  half states honestly that the platform holds no locked
  border-encounter guidance and gives only general pointers + "ask an
  attorney". Educational only, not legal advice.
- `src/lib/feeWaiverChecklist.ts` (new) + `src/app/fee-waiver/page.tsx`
  (new) — Form I-912 checklist of the three questions USCIS asks
  (means-tested benefit; household income ≤150% FPL; financial
  hardship), "Only USCIS decides" throughout. A checklist, never a
  decision. Locked I-912 prep price noted as $39 Basic.
- Document-expiry reminders: already built — verified, not rebuilt
  (see above).

## Verification

- `npx tsc --noEmit` — exit 0, no errors.
- `npx -y tsx scripts/smoke-sixth-addition.ts` — **113 checks passed**
  (fake data only; no send, save, or charge).
- Regression: `scripts/smoke-instant-chat.ts` — 42 passed;
  `scripts/smoke-diy-flow.ts` — 201 passed.

## Still missing / next steps (not built)

- Live USCIS Production API, live SMS, and real video stay labelled
  next steps (not built, per the brief).
- A live immigration-news feed: the module is ready for one, but no
  feed is connected and no live news is claimed until it is.
- The webhook writing `invoices.form_code` / `diy_unlocks` per-form
  rows (flagged in `docs/diy-flow.md`, belongs to the webhook owner)
  would make the DIY duplicate-charge guard work even when the caller
  omits `formCode`; today the guard needs `formCode` in the checkout
  call, which the DIY flow now sends.
- Migration 0025 must be run before the new `quote_requests` columns
  exist in live Supabase; the route works without it (legacy fallback).
