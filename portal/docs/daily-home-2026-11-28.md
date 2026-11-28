# Daily Home Screen + Completeness Sweep — Nov 28, 2026 (Seventh Addition)

The "Today" screen (`/today`) is where a client lands every day: case
status at a glance, today's next step, what changed today, reminders,
the interview question of the day, today's immigration news, per-case
timelines, and everything they saved — in one place.

## What was built

| File | What it does |
|---|---|
| `src/lib/dailyNews.ts` | 7 built-in immigration news posts, each dated with a real official source (USCIS / Department of State / CEAC). No live feed is connected yet — the screen says so on every view (`LIVE_FEED_NOTICE`). |
| `src/lib/dailyHome.ts` | Pure logic: case-at-a-glance (reuses `deriveNextStep`), deterministic question of the day, per-case timeline from `case_lifecycle` rows, what-changed-today feed, reminders (renewals via `deriveRenewals` + open `rfe_uploads` deadlines + document retakes), saved-things gatherer, daily check-in streak (`computeStreak`), identifier masking, empty payload. |
| `src/app/api/today/route.ts` | GET assembles the payload from real stored rows only. Auth reuses `resolveDiyCaller()` (Bearer token). Pay gates reused, never rebuilt: question of the day via `getPaidAccessForAccount(..., "interview_prep")`, draft download via `getDiyUnlockForCase()`, document download via `getPaidAccessForAccount(..., "document_vault")`. 401 unsigned, 501 unconfigured. |
| `src/app/api/today/checkin/route.ts` | GET/POST daily check-in. One row per account + day (+ case). Second tap the same day returns `{ already: true }`. 501 with an honest message when migration 0026 has not been run. |
| `src/app/today/page.tsx` | Client page: fetches `/api/today` with the Supabase session token, posts check-ins. Unsigned / unconfigured → honest empty states, never invented cases. |
| `src/components/today/TodayHome.tsx` | Presentational sections, each with an honest empty state. |
| `supabase/migrations/0026_itfw_daily_home.sql` | `daily_checkins` table only (account_id, case_id, checked_date; unique per account+day+case, NULLS NOT DISTINCT; RLS own-rows-only + founder/admin read). Numbered 0026 because another parallel builder already took 0025 (`0025_itfw_quote_requests_form_case.sql`). |
| `scripts/smoke-daily-home.ts` | 15 checks, fake data only (see Verification). |
| `src/app/client-dashboard/page.tsx` | Fixed stale copy: it claimed "there is no client case-list API yet". The Today screen is now that API's front door; the page links to `/today`. |
| `src/app/portal/page.tsx` | One link added at the top: "Today — your daily home". |

## Completeness sweep — everything added in this sweep (one line each)

1. **Daily home screen (`/today`)** — one landing place so clients come back daily instead of hunting through dashboards.
2. **Case status at a glance from real stored cases** — stored `cases.status` + manually recorded `case_watch` agency status, always labelled "as recorded in your file, not a live check with USCIS".
3. **Today's next step per case** — reuses the existing `deriveNextStep` engine with the case's real route and real blocking documents.
4. **Built-in sourced news (7 posts)** — the platform had no news at all; these are dated, sourced, and labelled "no live feed connected yet".
5. **Interview question of the day** — deterministic by date from the existing banks (official N-400 civics 6 days out of 7, practice on the 7th), always with source and kind label.
6. **Per-case timeline view** — from `case_lifecycle` rows only; stages with no row say "No record yet", never a date.
7. **"My saved things"** — drafts + documents + questionnaire answers in one place, with the existing pay gates carried through for download/print.
8. **"What changed today" feed** — lifecycle changes, recorded agency status, messages, notifications, document requests, and today's matching news; "Nothing new today" when empty.
9. **Reminders surfaced daily** — renewals (real dates), open RFE deadlines (`rfe_uploads.deadline`), document retakes; nothing invented.
10. **Daily check-in + streak** — the honest daily-return mechanic; a streak exists only when stored check-in rows exist.
11. **Unread-message count on the home screen** — clients see at a glance that their provider wrote to them.
12. **Client-dashboard stale-copy fix** — removed the "no case-list API yet" claim now that `/api/today` exists.
13. **Portal link to Today** — clients actually land on it from the workspace they already use.

## Deliberately left out (and why)

- **Live USCIS status lookup** — no Production USCIS API key exists; the task forbids building one. Status stays "as recorded in your file".
- **Live news feed** — no feed provider is connected; built-in sourced posts only, labelled as such.
- **Live SMS / push notifications** — Twilio is not connected; the feed shows stored notification *records*, never a claimed send.
- **Real video** — interview videos stay storyboards (existing rule in `interviewPrep.ts`).
- **Any claim USCIS or any government body adopted/endorsed the platform** — not true, never stated anywhere in the product or these docs.
- **A second paywall** — download/print gates reuse `paywall.ts` (`interview_prep`, `document_vault`) and `diy.ts` (`getDiyUnlockForCase`); nothing new was built.
- **New prices / Stripe Price IDs** — untouched (`stripePrices.ts` unchanged).
- **Filing anything for the client** — the home screen files nothing; the client reviews and signs before anything is submitted (existing rule).
- **Storing DOB / A-Number / SSN / passport numbers in the new tables** — `daily_checkins` stores only account id, case id, and date. Identifiers are masked (last 3 chars) wherever shown.
- **Editing `index.html`** — frozen public site, untouched. No Vercel / Supabase live / Stripe live / GitHub / deploy action taken.

## Verification

- `npx tsc --noEmit`: **exit non-zero only for 4 pre-existing errors in
  `src/app/api/ask-niptei/route.ts`** (another builder's file, `caseForms`
  property — untouched by this sweep). All files added or edited in this
  sweep type-check clean.
- `npx -y tsx scripts/smoke-daily-home.ts`: **PASS — 15 checks** (fake
  data only): empty states with no cases; stored case shows its real
  next step and timeline; question of the day from the banks with source,
  deterministic and rotating; feed empty when nothing changed and lists
  real stored events when present; reminders from real dates only;
  saved-things gathering; streak from stored rows only; all news posts
  sourced with no adoption/endorsement claim; masking.

## Still missing / next steps (not built here)

- Migration 0026 must be run in the SQL Editor (after 0025) before
  check-ins can be recorded; until then the check-in route returns an
  honest 501 and `/api/today` reads the streak defensively as empty.
- A live USCIS Production API key (founder decision + key) for real
  live status — deliberately not built.
- A live news feed provider (founder choice) to replace the built-in
  posts — the posts carry a `publishedDate` so a feed can supersede
  them by date.
- The 4 pre-existing `tsc` errors in `ask-niptei/route.ts` belong to
  the instant-chat builder; the coordinator's clean build will surface
  them.
- `/api/today` returns the question of the day only to paid
  `interview_prep` access; a founder decision could make one question
  a day free as a teaser — not decided here.
