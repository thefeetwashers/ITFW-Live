# Five Founder-Approved Standout Features — Nov 28, 2026

Founder approval: "Yes — add them all" (Nov 28, 2026). All five built
in `~/workspace/itfw-live/portal/` (+ one migration). No Vercel /
Supabase live / Stripe live / GitHub / deploy touched. Code +
migrations + docs only. `~/workspace/itfw-live/index.html` untouched.

Verify: `npx tsc --noEmit` → exit 0 (clean rebuild, incremental cache
deleted first). Smoke: `npx -y tsx scripts/smoke-standout-five.ts` →
**60 checks passed** (fake data only, no live calls).

## 1. Whole Family in One Case

- **New:** `portal/src/lib/familyCase.ts` — four roles (petitioner,
  beneficiary, child, joint sponsor), per-member scope, role
  isolation, identifier masking.
- **New page:** `portal/src/app/family-case/page.tsx` — role/scope
  table + example child view (invoices + messages redacted).
- **Reused:** `case_family_members` (0009), `family_invites` (0002 +
  0005/0006 magic invite + 6-digit code), `src/lib/invites.ts`,
  `src/lib/loginCodes.ts` (0020), `src/lib/isolation.ts` (family
  viewer), `FamilyPortalView` (already hides invoices/messages).
- **Migration 0022 (genuinely needed):** `case_family_members` had NO
  `account_id` (no own login possible) and `is_case_participant()`
  (0001/0008) recognised only client/provider — a family member passed
  NO RLS gate. 0022 adds `account_id` + `can_view_messages`, widens
  the `family_invites.role` CHECK to petitioner/beneficiary/child,
  and extends `is_case_participant()` to linked family members.
  No new `account_role` enum value: a member's accounts row is role
  `client`; "family" is a viewer concept only.
- **Isolation:** one shared checklist + timeline; invoices shown only
  when `can_view_invoices`, messages only when `can_view_messages`
  (both default false). `scopeFamilyCaseView()` returns a redacted
  copy — hidden data is omitted, not filtered later.
- **Masking:** A-Number `A-***-***-123`, DOB year-only, passport last
  2 chars; never logged, never in email subjects; no SSN column
  exists or was added.

## 2. Seven Languages, Start To Finish

- **New:** `portal/src/lib/lockedTranslations.ts` — bilingual
  renderer over locked template strings.
- **Reused:** `src/lib/i18n.ts` (7 codes, ar RTL),
  `src/lib/translate.ts` (`translateText()` → `not_configured`,
  `numbersPreserved()`, `needsHumanConfirmation()`),
  `src/lib/storefront.ts` `STOREFRONT_STRINGS` (human-written locked
  strings in all 7 languages) + `SPOKEN_LABEL`.
- **Rule:** English original ALWAYS shown next to the translation. A
  translation is shown ONLY from a locked template string. Where none
  exists: English + `TRANSLATION_PENDING_NOTE` =
  "Translation pending — shown in English". Google Cloud Translation
  is NOT connected, so no translation is ever made up; live status
  always reports `not_configured`. Uncertain translations flagged;
  human confirmation required for quotes/contracts/prices/deadlines;
  numbers/dates/prices never altered (`numbersPreserved()` check).
  Arabic renders RTL.

## 3. Packet Rescue, Free Check First

- **New:** `portal/src/lib/packetRescue.ts` — free audit wrapper +
  paid-fix gate; `portal/src/app/packet-rescue/page.tsx`.
- **Reused:** `src/lib/audit.ts` `computePacketReadiness()` (NOT
  rebuilt); locked $199 price — `stripePrices.ts`
  `addon_packet_rescue` (`price_1UfS8YPfd9SRUcvhDBkEUJW2`) and
  `storefront.ts` LOCKED_ADDONS; pay-before-access gate
  `src/lib/paywall.ts` (new surface `packet_rescue_fix` added to the
  existing gate + audit row — no second gate invented).
- **Rules:** free audit shows exactly what is missing/wrong; it NEVER
  unlocks the paid fix (`paidFixUnlocked: false` always, even at
  100%). The fix unlocks ONLY with a paid invoice for the $199 price
  in the database. Ready-to-file is claimed ONLY at 100% + all
  blocking items cleared (example audit: 88%, 2 blocking, not ready).
- **Still missing:** no server API route reads Packet Rescue invoices
  yet — the decision function is ready and smoke-tested, but the
  route feeding it real invoice rows still needs building. The page
  therefore offers the free audit only; the fix is not sold from it.

## 4. One Case, Whole Journey

- **New:** `portal/src/lib/journey.ts` — 10-step timeline + 6-item
  post-arrival checklist; `portal/src/app/journey/page.tsx`.
- **Reused/extended:** `src/lib/lifecycle.ts` stages 1–6, Stage 5A/5B
  guidance. Stage 6 already held the post-arrival facts ($235 USCIS
  Immigrant Fee before flying; sealed packet in carry-on; Green Card
  & SSN mailed 30–90 days after entry; tell us if you move in 90
  days) — this feature extends them honestly into the final steps.
- **Rules:** every step carries its locked `source`; every step has a
  `dateBasis` (`locked_range` / `no_date_promised` /
  `client_specific_date` — interview date comes only from the
  client's own letter). NO USCIS timeline invented: the ONLY range in
  the journey is "30–90 days after entry". `journeyHasNoPromisedDates()`
  scans for specific calendar dates (smoke-proved: 0 violations).

## 5. Verified Professionals, Flat Prices

- **New:** `portal/src/lib/verifiedDirectory.ts` — verified-only
  search/filter; `portal/src/app/professionals/page.tsx` — directory
  page reading the `public_profiles` view + filter form (language /
  form / max price / role), each listing linking to `/p/[slug]`.
- **Reused:** `public_profiles` VIEW listing gate (0013:
  `is_published` + `subscription_status='active'` + preparer-or-
  verified), `professional_form_fees` (0001 flat fees),
  `src/lib/stripePrices.ts` (unchanged — 132 prices), existing
  `/p/[slug]` storefronts.
- **Rules:** `isListedProfile()` applies the 0013 gate exactly and the
  search filters to listed profiles FIRST — an unverified professional
  never appears, whatever the filters. Flat locked prices only
  (Preparer $49/mo, Attorney $99/mo, DOJ $24.50/$49.50/mo, Law Student
  $35/mo, DIY $25, Review $99, single-form tiers) — no percentage,
  no per-lead fee anywhere. Verification shown as status only (bar /
  EOIR numbers never shown). Honest empty state: "No verified
  professionals match yet …".
- **Still missing:** the page reads `professional_form_fees` best
  effort — anon may get no rows (known 0013/0015 RLS-inside-policy
  issue). A profile with no readable fees simply cannot match a form
  filter; no price is invented. Directory shows "not connected" until
  Supabase env vars are set.

## Files changed / added

Added libs: `src/lib/familyCase.ts`, `src/lib/lockedTranslations.ts`,
`src/lib/packetRescue.ts`, `src/lib/journey.ts`,
`src/lib/verifiedDirectory.ts`.
Added pages: `src/app/family-case/page.tsx`,
`src/app/packet-rescue/page.tsx`, `src/app/journey/page.tsx`,
`src/app/professionals/page.tsx`.
Added test: `portal/scripts/smoke-standout-five.ts` (60 checks).
Added migration: `supabase/migrations/0022_itfw_family_login.sql`
(0021 was already taken by the lead-scoring builder; 0022 was free).
Edited (additive only): `src/lib/paywall.ts` — `packet_rescue_fix`
surface + audit row. `src/lib/stripePrices.ts` NOT changed.
Docs: this file.

## Standing rules kept

- REAL ONLY: example data labelled EXAMPLE; honest empty states; no
  invented clients, professionals, reviews, prices, or live claims.
- Document-preparation service, NOT a law firm, NOT USCIS affiliated.
  Only a licensed attorney or DOJ-accredited representative gives
  legal advice (8 CFR 292.1). No AI decides relief / eligibility /
  evidence strength / safe-to-leave. The system never files for the
  client; the user reviews and signs before anything is submitted.
- DOB / A-Number / SSN / passport: masked in UI, never logged, never
  in email subjects; stored only where migrations already provide.
- Email is AWS SES via `src/lib/email.ts`; unconfigured → honest
  501/`not_configured`, never "sent". (No email sent by this build.)
- No `npm run build` run (coordinator runs the clean build at the
  end). No live systems touched.
