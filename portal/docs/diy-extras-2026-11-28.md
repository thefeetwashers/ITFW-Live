# DIY "Missing Ways" Extras — Nov 28, 2026

Founder's addition: *"if i am missing another way add it."* — this build
adds the missing ways that fit the brief and the hard rules. Each feature
below has a one-line reason. Nothing here duplicates the parallel DIY
flow builder's work (guided flow, pay-to-unlock checkout/webhook,
print/save/email, submission-order guide, copy deterrent, per-form
unlock gate, edition notices, `diy_drafts` / `diy_unlocks` tables) —
this build reuses that work instead of building a second copy of it.

**Rebase note (Nov 28, during this build):** the parallel builder
landed `src/app/diy/`, `src/lib/diy.ts` (incl. `decideDiyUnlock` +
`diyFormMeta`), `src/lib/diyAuth.ts`, `src/lib/diySubmission.ts`,
`src/lib/diyTransfer.ts`, `/api/diy/unlock-status`, `/api/diy/packet`,
`/api/diy/email-packet`, and migration
`0022_itfw_diy_drafts_unlocks.sql` while this build was in progress.
This build was rebased onto them the same day: my own draft
`diyPaywall.ts`, `diyEditions.ts`, `/api/diy/print-access` and
`0022_itfw_diy_drafts.sql` were DELETED (not shipped) because the
parallel builder's versions are authoritative and more complete —
notably `diy_unlocks` solves the per-form payment proof that my draft
gate had flagged as a gap. What remains here is only what the DIY flow
did not already have.

## Features added (each with its one-line reason)

1. **Free Packet Health Check before pay** (`src/lib/diyHealthCheck.ts`,
   `POST /api/diy/health-check`) — a client should see what is
   wrong/missing BEFORE paying $25, not after.
2. **"What happens after you file" timeline per form**
   (`src/lib/diyAfterFiling.ts`, `GET /api/diy/after-filing`) — the
   most common post-filing question deserves an answer built from
   process steps already in the codebase, never a promised date.
3. **Fee calculator shown BEFORE pay** (`src/lib/diyFees.ts`,
   `GET /api/diy/fee-breakdown`) — a client about to pay two different
   parties must see the two fees on separate lines, never combined.
4. **Save-and-resume drafts — save/load side** (`src/lib/diyDrafts.ts`,
   `/api/diy/drafts`) — a half-finished form is real work; losing it
   means starting over. Storage is the parallel builder's `diy_drafts`
   table (migration `0022_itfw_diy_drafts_unlocks.sql`, case-scoped,
   one draft per account + case + form, resume-position columns);
   this build adds the sanitize / summarize logic and the API route
   that migration anticipates — it writes NO new migration.
5. **Second-person review upsell at the print step**
   (`src/lib/diyReviewUpsell.ts`) — a client about to file alone may
   want a second pair of eyes, offered as an option, never a toll.
6. **Referral link after a successful print** (`src/lib/diyReferral.ts`)
   — after printing, the natural next step is telling someone else who
   needs the same help; reuses the existing `/r/[code]` system.
7. **Plain-language explanation of each question**
   (`src/lib/diyQuestionHelp.ts`) — USCIS wording is hard to read on
   first sight; every explanation is labelled "platform explanation,
   not USCIS text" because the codebase carries no official USCIS
   instruction text per question.
8. **Fee-waiver pointer in the fee calculator** (in `diyFees.ts`) —
   a client who cannot afford the USCIS fee should be told Form I-912
   exists; the platform does not decide whether they qualify.
9. **DIY components** (`src/components/diy/DiyExtras.tsx`) —
   `DiyHealthCheck`, `DiyFeeBreakdown`, `DiyAfterFilingTimeline`,
   `DiyEditionBanner` (reads the flow's own `diyFormMeta`, not a
   second edition module), `DiyQuestionHelp`, `DiyReviewUpsell`,
   `DiyReferralAfterPrint`, `DiyDraftsList` — the DIY page imports
   only what it needs.

NOT added by this build (already owned by the parallel builder):
edition notices (`diyFormMeta` in `src/lib/diy.ts`), the per-form
print gate (`decideDiyUnlock` + `GET /api/diy/unlock-status`), the
`diy_drafts` / `diy_unlocks` tables.

## Hard-rule compliance

- REAL ONLY: no invented prices (all from locked Stripe Prices /
  checklist templates), no invented edition (no edition is verified
  anywhere), no "live" claims. Every fee result carries "confirm the
  current USCIS fee at uscis.gov/fees before you pay".
- Document preparation only, NOT a law firm, NOT USCIS affiliated.
  No AI decides relief / eligibility / evidence strength / safe-to-leave.
  Nothing files for the client; the health check and timeline are
  labelled checklist / typical process, not legal advice (8 CFR 292.1).
- Locked prices unchanged: DIY $25/form, DIY Bundle $99, Review $99,
  Review Bundle $399, Review + Human Review $199, bundles
  $999/$1,799/$2,799, Member $9.80/mo or $98/yr.
- Pay-before-access is gated by DB records (`decideDiyUnlock` in
  `src/lib/diy.ts`, via `/api/diy/unlock-status`), never a front-end
  flag. The free health check always returns `unlocksPrint: false`.
- DOB / A-Number / SSN / passport numbers: masked in UI, never logged,
  never in email subjects. Drafts NEVER store SSN / A-Number / passport
  / green-card numbers — stripped in code (`sanitizeDraftAnswers`),
  refused by the DB trigger in migration 0022.
- Email: this build sends no email. (SES via `src/lib/email.ts` is the
  only sender; nothing here calls it.)
- No Vercel / Supabase live / Stripe live / GitHub / deploy / push.
  Code + docs only — no migration file from this build. No keys or
  secrets anywhere. `~/workspace/itfw-live/index.html` untouched.

## Save-and-resume: why no migration from this build, and the 0022 collision

No existing table could hold a DIY draft before the parallel builder's
migration — and that migration (`0022_itfw_diy_drafts_unlocks.sql`)
now creates `diy_drafts` (case-scoped, unique account + case + form,
`status in_progress/completed/transferred`, resume-position columns)
plus `diy_unlocks` and the sensitive-key trigger. This build's draft
`0022_itfw_diy_drafts.sql` was deleted rather than shipped.

**Coordinator action needed:** THREE files now carry the `0022`
prefix — `0022_itfw_diy_drafts_unlocks.sql` (drafts + unlocks) and
`0022_itfw_diy_unlocks.sql` (unlocks again, with DIFFERENT columns:
`client_id` vs `account_id`) from the parallel builder, plus this
build's file which was removed. The two remaining `0022` files both
define `diy_unlocks` and must be reconciled / renumbered before any
live run — running both as-is risks a conflicting-table error, and the
run order 0001 → 0022 is ambiguous. This build writes no migration,
so it adds no further collision.

Also: `/api/diy/drafts` never marks a draft `completed` — the
migration says completion is set server-side "after its own completion
check", and that check does not exist yet. Drafts stay `in_progress`
until it is built; do not trust a client claim of completion.

## Known gaps / follow-ups for the coordinator

- The per-form payment proof the draft gate worried about is SOLVED
  by design: `diy_unlocks` is the durable per-form record, written by
  the webhook after a real Stripe payment; `decideDiyUnlock` reads it
  plus a case-scoped invoice fallback. The webhook change that writes
  `diy_unlocks` rows belongs to the webhook owner (flagged in
  `src/lib/diy.ts` / `portal/docs/diy-flow.md`).
- `/api/diy/drafts` does not enforce caller authentication yet — same
  caveat as `/api/generate-packet`. Put it behind caller auth before
  any live use. (`/api/diy/unlock-status` already enforces a sign-in
  via `resolveDiyCaller`.)
- The DIY page (`src/app/diy/page.tsx`) reads `?caseId=&form=` today;
  the draft resume URL is `/diy?caseId=<id>&form=<form>&draft=<id>`,
  and the page will need to load that draft through
  `GET /api/diy/drafts` — that wiring is not in the page yet.

## Integration notes for the DIY page builder

- Gate print/save/email with `GET /api/diy/unlock-status?caseId=&formCode=`
  (402 = locked, 200 = allowed). Never gate on a front-end flag.
- Offer the free health check (`POST /api/diy/health-check`) BEFORE
  the pay step; show the fee breakdown (`GET /api/diy/fee-breakdown`)
  BEFORE the pay step; show the after-filing timeline on the form page;
  show the review upsell at the print step (print works without it);
  show `DiyReferralAfterPrint` after a successful print using the
  client's `accounts.referral_code`.
- Save drafts with `POST /api/diy/drafts` (`accountId`, `caseId`,
  `formCode`, `answers`, optional resume position); list/resume with
  `GET /api/diy/drafts?accountId=&caseId=&formCode=`; resume URL is
  `/diy?caseId=<id>&form=<form>&draft=<id>`.

## Verification

- `npx tsc --noEmit` — exit 0 (run from `portal/`).
- `npx -y tsx scripts/smoke-diy-extras.ts` — fake data only; asserts
  the health check never unlocks print (even at 100%), fees are never
  combined, save-and-resume round-trips without losing answers
  (sensitive keys stripped), review is optional (print works without
  it; review has no unlock path in `decideDiyUnlock`), the per-form
  gate (`decideDiyUnlock`) locks unpaid, unlocks a `diy_unlocks` row
  for its exact form, unlocks a `diy_form` invoice only for forms on
  the case, and unlocks any form on a DIY Bundle.

## Deliberately NOT built (and why)

- **Live USCIS Production API** — stays a labelled next step; no key,
  no lookup, no live case-status check.
- **Live SMS** — stays a labelled next step; Twilio is not connected.
- **Real video** — stays a labelled next step; no video was produced.
- **A second pay gate / second edition module / second drafts table**
  — the parallel builder owns all three; this build's drafts were
  deleted on rebase rather than shipped as duplicates.
- **Submission-order guide / copy deterrent** — owned by the parallel
  builder; not duplicated here.
- **Per-question USCIS instruction citations** — the codebase carries
  no official USCIS instruction text per question, so none was
  invented; every explanation is labelled platform wording.
- **Post-filing tails for N-400 / I-90 / I-821 / I-765 / I-589 / I-131 /
  I-751 / I-539 / I-864** — the codebase carries no verified tail for
  these forms, so they get the USCIS stages only, with a note saying
  so, rather than a guessed tail.
- **Fee-waiver eligibility decision** — the calculator only notes
  that Form I-912 exists; the platform never decides who qualifies.
- **Draft `completed` marking** — needs the server-side completion
  check the migration anticipates; not built here, and not faked.
