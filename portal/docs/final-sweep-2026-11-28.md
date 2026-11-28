# Final Expert Sweep — Breathtaking Dashboards + Powerful Client Intake
## Nov 28, 2026 — Founder's final charge

> "We are the advanced more powerful platform and our dashboard is
> breathtaking, all profession is amazed and happy it make the job easy,
> a powerful client intake, all this is needed and more stuff that i have
> missed since you are the expert know we need include them all do not
> leave anything behind."

## What was built

### 1. Dashboard polish — next step first, no clutter
- `src/components/nextstep/DashboardTop.tsx` (new) — one component that
  renders every role dashboard in the fixed order
  (`src/lib/finalSweep.ts` `DASHBOARD_SECTION_ORDER`): next step FIRST
  (existing `deriveNextStep`), then the colour-coded checklist, then
  one-click actions, then the deadline countdown, then the notification
  inbox, then one compact row of links to the tools that already exist
  (pipeline, portal, interview prep, Today). No dashboard was restyled
  and no whole dashboard was rebuilt.
- Wired into the five role front doors: `/client-dashboard`,
  `/attorney-dashboard`, `/doj-dashboard`, `/student-dashboard`,
  `/teacher-dashboard`. With no case open, the next step honestly says
  the route is not set and the checklist shows its empty state — no
  example items are presented as a real client's checklist.
- `/preparer-dashboard` (command tab): the `CaseCommandPanel` (next step
  → checklist → payment) now leads the tab; the thread, Daily Command,
  and permissions follow it instead of burying it. One-click actions +
  notification inbox added after the panel.
- `/portal` (client workspace): the `CaseCommandPanel` now leads the
  main column, ahead of the order summary and the new-application
  calculator; one-click actions added after it; notification inbox
  added to the sidebar after the unified thread. `/today` was already
  next-step-first and was not touched.

### 2. Powerful client intake — one guided sequence
- `src/app/intake/page.tsx` (new) — six steps, rendered from
  `INTAKE_STEPS` in `src/lib/finalSweep.ts`, with the free/paid boundary
  marked: Path Finder questions → fee estimate (Smart Intake Calculator,
  USCIS fee + prep fee separate) → checklist preview (first 2 items free
  from the existing form-checklist templates, the rest counted as locked)
  → register (free) → pay (Stripe checkout, DB-confirmed) → case created
  (opens in `/portal` + `/today`). Save-and-resume links to the existing
  DIY drafts (`/diy`). The missed-payment rule is quoted verbatim with
  its exact math. Nothing is invented: every step reuses an existing
  route/component/table.
- `/portal` links to `/intake` above the existing calculator.

### 3. Last sweep — one-click actions, inbox, countdown
- `src/components/nextstep/OneClickActions.tsx` (new) — draft email
  (preview only, sends NOTHING), send status update (POST
  `/api/case-status`, saved to the case first, delivery reported
  honestly incl. SES `not_configured`), open chat, open checklist. Each
  does one thing and shows its result. With no case id, the two write
  actions explain they need an open case instead of posting against an
  example id.
- `src/app/api/notifications/route.ts` (new) + `src/components/nextstep/NotificationInbox.tsx`
  (new) — GET `/api/notifications` merges stored `notification_logs`
  (0010) + `messages` (0001) rows for the signed-in caller only
  (`resolveDiyCaller`, 401/501 honest). Message bodies are never copied
  or returned. Filter: All / Status & email / Messages; unread count
  from stored `is_read`.
- `src/components/nextstep/DeadlineCountdown.tsx` (new) — RFE / NOID /
  interview / biometrics countdowns from stored dates only
  (`deadlineCountdown` in `src/lib/finalSweep.ts`: overdue / due today /
  due soon ≤14 days / due / no date on file). The full radar with
  stored-date basis text already exists (`DeadlineRadar`) and was not
  duplicated.
- `src/lib/finalSweep.ts` (new) — the sweep's single source of truth:
  dashboard order, intake steps + free/paid boundary, checklist preview,
  inbox normalisation, deadline countdown.

## Nothing left behind — included, each with a reason
- Next step first on every dashboard — the user must see the one thing
  to do before anything else.
- Colour-coded checklist second, exact existing meanings — one palette
  everywhere, no new colours to learn.
- One-click actions — professionals act without hunting through menus.
- Notification inbox — status/email/message events were scattered
  across the thread, the feed, and the logs; now they are in one place.
- Deadline countdown — RFE/NOID/interview/biometrics dates were visible
  only in the radar; dashboards now show the countdown up front.
- Guided intake with an honest free/paid boundary — new clients were
  dropped into the calculator with no sense of what is free and what
  the full checklist costs.
- Missed-payment math in the intake page as well as the payment centre —
  the rule is the most-asked money question and must be visible before
  anyone pays.
- Example-data discipline — role dashboards with no case show empty
  states, never example clients as real ones.

## Deliberately NOT included, with the reason
- Live USCIS Production lookup — no Production key exists; manual entry
  + Sandbox only (unchanged).
- Live SMS / WhatsApp sending — Twilio is not connected; the inbox
  reports `not_configured` honestly instead of claiming sends.
- Real video / video calls — no video provider exists; "Book a call"
  stays a labelled placeholder (unchanged).
- Mark-as-read endpoint for the inbox — no endpoint exists yet; unread
  counts are the stored `is_read` values only.
- A new payment plan or price change — locked prices in
  `src/lib/stripePrices.ts` and the 50% missed-payment rule were not
  touched.
- Restyling the whole app — the brief said polish within the existing
  design system; the palette, cards, and Tailwind classes are unchanged.
- Rebuilding any dashboard whole — preparer, portal, and Today already
  had their engines; this sweep reordered and added beside them.
- `/today` changes — it was already next-step-first with real stored
  rows; nothing was left to fix there.

## Still missing / next steps (not built here)
- Real case ids wired into `OneClickActions` on the preparer command tab
  and `/portal` — both currently pass no case id, so the draft-email and
  status-update actions honestly wait for a real case. Wire them when
  those screens load a real case.
- Mark-as-read for inbox messages (needs a small POST endpoint writing
  `messages.is_read`).
- A supervision-assignment API for the attorney dashboard (noted as
  missing in that page already) — the dashboard still shows its honest
  empty state for supervised students.
- `npm run build` — not run here by instruction; the coordinator runs
  one clean build at the end.

## Verify
- `npx tsc --noEmit` — exit 0.
- `npx -y tsx scripts/smoke-final-sweep.ts` — 9 checks passed (dashboard
  order; exact colour meanings + colour-derived readiness; intake
  free/paid boundary + first-2-free preview; inbox from stored rows
  only, newest-first, no bodies; missed-payment math exactly;
  deadline countdown from stored dates; next-step priority).
