# Eleventh Addition — Surprise signature feature + tell-a-friend + SEO + honest lead-finding

Nov 28, 2026. Code + migrations + docs only. No Vercel, Supabase live,
Stripe live, GitHub, deploy, or push. `index.html` (frozen public site)
untouched. Locked prices untouched (132 Stripe prices verified).

## 1. Surprise signature feature — Immigration Journey Map

One living page per client/family: where they started, where they are
now, what is next, what is missing, interview date, green card in hand —
in plain language, in their language (7 languages where locked
translations exist, English original always shown).

- `src/lib/journeyMap.ts` — pure builder `buildJourneyMap(input)`.
  Input is real stored data only: `cases` (status, forms), `case_lifecycle`
  (stage + recorded dates), `case_agency_numbers.interview_date` (0010)
  / `nvc_trackers.interview_at` (0027), `cases.immigrant_fee_paid` /
  `us_entry_at` (0027), missing `inbox_items`, family-member count.
  Reuses `journey.ts` (only timing: "30–90 days after entry"),
  `lifecycle.ts` (where/next wording), `dailyHome.ts` row shapes, and
  `lockedTranslations.ts` (headings: locked translation only where one
  exists, otherwise English + "Translation pending — shown in English").
  No case → `null` + `JOURNEY_MAP_EMPTY_STATE` (never an invented
  journey). No stored interview date → "No interview date on file yet"
  (the date comes from the client's own interview letter). No date is
  ever promised or guessed. No DOB / A-Number / SSN / passport number
  is read, shown, or logged.
- `src/components/journey/JourneyMap.tsx` — renders the map (or the
  honest empty state). Sharing note: family is invited through the
  existing Family Invite system, each member with their own login, for
  their invited case only. **There is no public link to a private
  case**, and none is created.
- Home screen: `src/app/client-dashboard/page.tsx` now renders
  `<JourneyMap map={null} />` at the top (no case is open on that
  front-door page, so the honest empty state shows and points to the
  portal, where the map fills in from the real case file). The
  `/journey` page keeps the generic sourced timeline; the map is the
  per-client version of it.

## 2. Tell-a-friend — referral on the dashboard homes

Reuses the existing `/r/[code]` system (`src/lib/referrals.ts`,
`ReferralCard`, `preparer_leads` referral rows) — no second referral
system.

- Client dashboard (`src/app/client-dashboard/page.tsx`): `ReferralCard`
  added (0/0 + honest empty state on the front-door page, since no
  referral rows are loaded there).
- Professional dashboard: `ReferralCard` was already there
  (`src/components/preparer/PreparerDashboard.tsx`) — unchanged.
- Portal (`src/app/portal/page.tsx`): already had it — unchanged.
- Reward: `REFERRAL_REWARD_LABEL` — "Referral reward: to be announced
  by the founder". **No amount is invented**; no discount code, no
  payout, no Stripe until the founder sets it.

## 3. Search engines (SEO foundation)

- `src/lib/seo.ts` — `SITE_URL`, `PUBLIC_SITEMAP_PATHS`,
  `PRIVATE_PATH_PREFIXES`, `isPublicSitemapUrl()` guard,
  `sitemapEntries()`, per-form landing content `formLanding()` (from
  the locked catalog `bundles.ts` only — name, locked fee or
  "TO BE CONFIRMED", locked USCIS fee note, checklist), `SEO_FAQS`
  (answers = locked lifecycle wording, source named on each),
  `buildOrganizationJsonLd()` / `buildFaqJsonLd()`.
- `src/app/sitemap.ts` — Next.js sitemap, public pages only.
  Storefront URLs (`/p/<slug>`) are NOT listed until a profile is
  actually published — no slug is ever invented.
- `src/app/robots.ts` — public pages crawlable; portal, dashboards,
  family, auth, API, admin disallowed; points at the sitemap.
- `src/app/layout.tsx` — `metadataBase`, Open Graph, Twitter card.
- `src/app/page.tsx` — Organization + FAQ JSON-LD, links to
  `/leads`, `/journey`, `/professionals`, and the SEO note.
- `src/app/forms/[code]/page.tsx` — NEW per-form landing pages for
  every form in the locked catalog (static params), with fees shown
  separately, the locked checklist, and the SEO note. Unknown code →
  404 (nothing invented).
- **Honest label, in the product and here:** `SEO_NO_RANKING_NOTE` —
  "Search engines list this platform so people can find it. That does
  not guarantee a ranking, a number-one spot, or any position on
  Google, Yahoo, Bing, or any other search engine — no one can promise
  that."

## 4. Lead finding — honest boundary + arrival/follow-up/return loop

- `src/lib/leadLoop.ts` — `LEAD_BOUNDARY_NOTE`, `ARRIVAL_CHANNELS`
  (intake `/leads`, quote `/leads`, free Packet Health Check `/diy`,
  interview question of the day `/today`), `leadLoopSteps()` (arrive →
  capture → follow up → return → tell a friend), `summarizeLeadLoop()`
  (reuses `lifecycle.ts followUpReminders` + `countLeadsByBucket`).
  **The boundary, stated plainly:** the system CANNOT track or
  identify individual people searching for immigration services online
  — search engines do not share who searched for what, and watching
  individual searchers would violate their privacy. What it CAN do is
  capture the people who arrive and tell us what they need, follow
  them up on their follow-up date (existing reminders + SES email,
  501/not_configured when SES is unconfigured), and bring them back
  daily with `/today`. No second lead system was built.
- `src/app/leads/page.tsx` — the boundary note + the 5 loop steps are
  shown on the lead generator page.
- `supabase/migrations/0028_itfw_lead_arrival_channel.sql` — one
  nullable column `preparer_leads.arrival_channel` (intake / quote /
  packet_health_check / interview_question / referral / storefront /
  other) + index, so the loop can show which of our own doors a lead
  came through. Additive only; the migration comment restates the
  boundary. No RLS change.

## Verification

- `npx tsc --noEmit` — exit 0.
- `npx -y tsx scripts/smoke-surprise-seo.ts` — all checks passed
  (fake data only; no Supabase/Stripe/USCIS call). Proves: empty-state
  map with no case; stored case shows its real next step (Stage 5)
  and its real missing items; interview date shown only when stored;
  green-card line uses only the locked 30–90 day range; referral
  reward "to be announced" with no amount and counts only from real
  rows; sitemap public-only (every private prefix rejected);
  per-form landing from the locked catalog, unknown form → null; SEO
  note states no ranking is guaranteed; lead page boundary note
  present; locked Stripe prices still 132.

## Still missing / not done here

- The Journey Map has no live API route yet: no `/api/journey-map`
  reads `cases` / `case_lifecycle` / `case_agency_numbers` /
  `nvc_trackers` / `inbox_items` for the signed-in client, so the
  client dashboard currently shows the honest empty state until that
  route (or the portal wiring) is built. The pure builder is ready
  for it.
- Journey Map headings have no locked translations yet (no locked
  storefront string exists for them), so non-English languages show
  English + "Translation pending — shown in English" — honest, but
  not yet translated. Adding them needs human-written translations in
  all 7 languages, never machine translation pasted as verified.
- Migration 0028 is written, not applied (no live Supabase access in
  this task). No migration was run.
- SEO: no Search Console / Bing Webmaster Tools submission, no
  verification files, no live ranking check — and none is claimed.
  Storefront URLs enter the sitemap only when a profile is published.
- Referral reward amount is still NOT set — founder decision, on the
  DEPLOY.md checklist. Nothing pays out until then.
- `npm run build` was NOT run (coordinator runs one clean build at
  the end, per the brief).
