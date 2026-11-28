# Twenty Differentiators — Things Only We Have
## Immigration with NIPTEI — audit, Nov 28, 2026 (TWELFTH ADDITION, part B)

**How this list was made:** each item below was checked against the code in
`~/workspace/itfw-live/portal/` before it was claimed. A "BUILT" item names
the real file and route — nothing is listed that cannot be pointed to.
Three items were NOT built when audited; the interview simulator was built
in this build, the professional invitation flow was built in this build (as
a library, sending still to be wired), and the Google Calendar/Drive
connect is honestly NOT built and needs the founder (contract library built
in this build). One item — document resend — was built in parallel by the
second builder working on professional discovery + Google integrations +
document flow (their files, credited below); this build's duplicate draft
was deleted rather than kept.

**Statuses:** BUILT (code exists in the repo) · SCRIPT/PLAN (written plan or
script, not code) · NEEDS FOUNDER (needs the founder's decision, consent,
or a live external approval before it can exist).

**Standing rules (apply to every item):** REAL ONLY — no invented clients,
professionals, reviews, prices, or "live" claims. The platform is a
document-preparation service, NOT a law firm, NOT USCIS affiliated. Only a
licensed attorney or DOJ-accredited representative gives legal advice
(8 CFR 292.1). No AI decides relief, eligibility, evidence strength, or
whether it is safe to leave. Nothing promises or implies an approval.
Locked prices in `src/lib/stripePrices.ts` must not change. Nothing here
is claimed live until it is deployed.

---

## The 20

### 1. Journey Map — one living page for the whole journey
**BUILT** — `src/lib/journeyMap.ts` · page `src/app/journey/page.tsx`
Where you started, where you are now, what is next, what is missing, your
interview date (only when it is on file from your own letter), and the
green card in hand — in plain language, in your language. No milestone is
shown as done unless a stored record says so; no date is ever promised
or guessed.

### 2. Family in one case — the whole family, one case
**BUILT** — `src/lib/familyCase.ts` · `src/lib/invites.ts` · page `src/app/family-case/page.tsx`
One case holds the client, the spouse abroad, the sponsor, and the children.
Each person has their own login and sees only their part. Co-sponsors
upload their own I-864 tax returns under their own invite; they never see
the client's password or other cases.

### 3. 7-language end-to-end — the platform in your language
**BUILT** — `src/lib/i18n.ts` · `src/lib/lockedTranslations.ts` · `src/lib/translate.ts`
English, Spanish, Haitian Creole, French, Portuguese, Chinese, Arabic.
Headings show a locked translation only where one exists; otherwise English
plus "Translation pending — shown in English". Live translation is
`not_configured` — no translation is ever made up.

### 4. Packet Rescue — a free check before you pay anything
**BUILT** — `src/lib/packetRescue.ts` · page `src/app/packet-rescue/page.tsx`
A free Packet Health Check audits a DIY draft before payment and shows
what is wrong or missing. The check is free; print / save / email still
require the DIY payment. Paying and only then finding a mistake does not
happen here.

### 5. Whole-journey tracking — from first form to green card in hand
**BUILT** — `src/lib/journey.ts` · `src/lib/lifecycle.ts` · `src/lib/caseTracking.ts` · route `src/app/api/case-status/route.ts`
One timeline from intake to post-arrival (including the locked 30–90 day
green-card timing). Case statuses are entered manually after the client or
preparer checks uscis.gov — there is NO live USCIS lookup (USCIS Case
Status API is Sandbox-only; Production is not granted), and NVC/CEAC is a
manual link-out, never a stored password.

### 6. Verified flat-price directory — every professional, one honest price list
**BUILT** — `src/lib/verifiedDirectory.ts` · page `src/app/professionals/page.tsx`
Professionals list only after admin verification (attorney bar, DOJ EOIR
roster, or student supervisor). Prices are flat per form from the locked
price list — no hidden hourly meter, no invented reviews or rankings.

### 7. Renewal radar — we watch the expiry dates so you don't have to
**BUILT** — `src/lib/renewalReminders.ts` · `src/lib/renewals.ts` · route `src/app/api/renewals/route.ts`
Renewals and expiries (work permit, green card, passport, DACA where it
applies) are watched on a 60/30/14/7/0-day ladder, with a reminder email
built per item. A renewal is never shown as done until it is recorded.

### 8. Fee waiver checker — find out before you pay the fee
**BUILT** — `src/lib/feeWaiverChecker.ts` · `src/lib/feeWaiverChecklist.ts` · page `src/app/fee-waiver/page.tsx`
Checks whether a fee waiver (Form I-912) may apply to a form, with the
checklist of what the waiver needs. It is a checker, not a decision: it
never decides eligibility — only USCIS decides, and only an attorney or
DOJ-accredited representative gives legal advice.

### 9. Cost estimator — the whole journey's cost, up front
**BUILT** — `src/lib/totalCostEstimator.ts` · `src/lib/intakeCalculator.ts`
Adds up government fees, the platform's flat prices, and the cost of the
forms chained after the first one — before the client pays anything. No
price is invented; every figure comes from the locked price list or a
published government fee.

### 10. Vault expiry — your documents, watched
**BUILT** — `src/lib/vaultExpiry.ts` · route `src/app/api/vault-expiry/route.ts`
Every vault document carries an expiry date; the vault warns before a
passport, a medical exam, or a police certificate goes stale. An expired
document is flagged, never silently used.

### 11. Form chaining — one finished form starts the next
**BUILT** — `src/lib/formChains.ts`
Forms are chained the way the process actually runs (e.g. I-130 → I-485 →
work permit; N-400 after the residence requirement). A chain never promises
an outcome, and the DIY $25 pay gate still applies per form (I-130A is
included free with I-130).

### 12. Save-and-resume DIY — never lose a half-finished form
**BUILT** — `src/lib/diy.ts` · `src/lib/diyDrafts.ts` · `src/lib/diySubmission.ts`
A DIY draft saves as the client goes and resumes later from any device.
Draft values are sanitised (no SSN or full bank number is ever stored in a
draft key), and print / save / email stay locked until the DIY payment is
confirmed.

### 13. Pay-to-print — pay once, then print, save, and email
**BUILT** — `src/lib/diyHealthCheck.ts` · `src/lib/diyReviewUpsell.ts` · routes `src/app/api/diy/*`
DIY is $25 per form (locked price). Print, save, and email unlock only
after that payment is confirmed in the platform's records. Review is an
optional add-on — it never unlocks printing on its own, and the client is
told that plainly before paying.

### 14. Case-aware news alerts — news that follows YOUR case
**BUILT** — `src/lib/immigrationNews.ts` · `src/lib/dailyNews.ts` · component `src/components/copilot/NewsAlert.tsx` · route `src/app/api/news/route.ts`
News items are matched to the forms on the client's own case, so a client
hears about a rule change only if it touches their case. Every item is
sourced; nothing is presented as a USCIS announcement unless it is one.

### 15. Interview simulator with scoring — practise the interview, timed, with a score
**BUILT (this build)** — `src/lib/interviewSimulator.ts` · route `src/app/api/interview-simulator/route.ts`
A timed mock interview built only from the existing question banks
(`src/lib/interviewPrep.ts`: 25 official civics + 38 practice questions).
Civics answers are scored against official answers using USCIS's own
6-of-10 pass mark; practice questions are scored only on what can honestly
be measured (answered? in time? matches your application — self-checked?).
Every result is labelled PRACTICE ONLY with a no-prediction notice: it
never predicts the real interview outcome. Served only to paid users, after
the same server-side paywall check as `/api/interview-prep`; the run plan
sent to the browser contains questions only, never answers.

### 16. Document resend by email or text — "send it again"
**BUILT (parallel builder, professional discovery + document flow)** — `src/lib/docResend.ts` · route `src/app/api/documents/resend/route.ts` · migration `supabase/migrations/0030_itfw_pro_discovery_google_docresend.sql`
A professional resends a client document by email (SES, vault link — never
a raw attachment), SMS via the professional's own Twilio (BYO; not
connected, so SMS honestly returns `not_configured`), in-app message, or a
7-day shareable vault link. Every attempt is logged in `document_resends`;
DOB / A-Number / SSN / passport numbers are rejected (400) and never
appear in a subject, a log, or a link.

### 17. Google Calendar + Google Drive connect — your appointments and files, in your Google
**NEEDS FOUNDER** — contract built this build: `src/lib/googleWorkspace.ts`
Google SIGN-IN is built (`src/lib/googleAuth.ts`, Supabase Auth), but
sign-in is not Calendar and not Drive: the booking calendar is NOT
connected (consultation requests are collected, not auto-booked —
`src/lib/booking.ts`, `src/lib/byo.ts`), and no Drive file has ever been
read or written. The contract library names the exact OAuth scopes
(`calendar.events`, `drive.file` — file-scoped only, never whole-Drive),
what each would do, and the four founder steps (add scopes to the existing
consent screen, complete Google's verification for the Drive scope, choose
opt-in per professional, name the Drive folder rule). Nothing connects
until the founder does those steps.

### 18. Professional invitation flow — invite a professional to a case, or to the platform
**BUILT (this build, library)** — `src/lib/professionalInvites.ts`
A client or the Founder/Admin invites a named professional by email, to
join the platform or to join one case in a named role (attorney of record,
DOJ representative, preparer, reviewer, nonprofit caseworker). Token +
6-digit code, 7-day expiry, canonical link
`https://immigration.niptei.com/guest/<token>` — the same pattern as the
family invites in `src/lib/invites.ts`. An invite NEVER verifies anyone:
bar, DOJ roster, and supervisor checks still gate listing and assignment.
Sending and persistence are still to be wired — until then an invite is a
draft the inviter shares by hand, labelled as such.

### 19. Daily home screen — one small step every morning
**BUILT** — `src/lib/dailyHome.ts` · page `src/app/today/page.tsx` · route `src/app/api/today/route.ts`
The Today screen: one next step, what changed today, reminders, and the
interview question of the day. It is the home screen of the client
dashboard, built from the client's own stored case data — no case, honest
empty state, never an invented journey.

### 20. Interview question of the day — one question, every day
**BUILT** — `src/lib/dailyHome.ts` (`questionOfTheDay`) · route `src/app/api/today/route.ts` · page `src/app/today/page.tsx`
One interview question a day, deterministic by date, drawn from the
existing question banks with its source labelled. Paid access only (same
`interview_prep` paywall surface as the banks). A daily reason to come
back — and a daily reason to practise.

---

## Bonus — two more, also built, also verifiable

### 21. Instant case-aware answers — ask, get a sourced answer in plain English
**BUILT** — `src/lib/askNiptei.ts` · `src/lib/instantChat.ts` · route `src/app/api/ask-niptei/route.ts`
The client asks a question in their own words and gets a plain-English
answer with its source, matched to the forms on their case. When the
platform does not know, it says so exactly (`UNKNOWN_ANSWER_EXACT`) and
escalates to a human — it never guesses, never decides eligibility, and
never gives legal advice.

### 22. One-tap document checklist per form — know exactly what to gather
**BUILT** — `src/lib/formChecklists.ts` · `src/lib/formChecklists.ts` (`FORM_CHECKLIST_TEMPLATES`)
Every form has a checklist of the documents it needs, with originals vs.
copies called out (and the sealed I-693 envelope rule: do not open it).
The checklist is what the Packet Rescue audit and the interview
what-to-bring guides are built from — one source, never three lists that
disagree.

---

## What is still missing (honest list)

1. **Google Calendar/Drive connect (#17)** — NEEDS FOUNDER: add the two
   OAuth scopes to the existing consent screen, complete Google's
   verification for the Drive scope, choose opt-in per professional, name
   the Drive folder rule. Until then, consultation requests stay
   collect-only and no Drive file is touched.
2. **Professional invite sending + persistence (#18)** — the library is
   built; sending (email/text via the platform sender) and a stored
   invite record are still to be wired. Invites are drafts until then.
3. **Interview simulator page** — the library and the paywall-gated API
   route are built; there is no client page at
   `src/app/interview-prep/` that runs a timed session yet (the existing
   interview-prep page serves the banks; a simulator UI is a follow-up
   build, in the same paywall).
4. **Live USCIS case-status lookup (#5)** — NEEDS USCIS: Production API
   access is not granted (Sandbox only; needs 5 days of Sandbox traffic
   + a demo + approval). Statuses stay manual-entry until then.
5. **Video production** — the 180-second script is written
   (`docs/niptei-tv-180-script-2026-11-28.md`); no video was produced,
   nothing was posted, and the length conflicts with the standing
   60-second rule — the founder must pick one-off 180s, three 60s cuts,
   or do not produce.
6. **Text (SMS) document resend (#16)** — honestly `not_configured`: it
   needs a professional's own Twilio account connected (BYO). Email
   resend works through SES when configured; SMS never claims to work
   until Twilio is connected.

## Files added / changed in this build

| File | What |
|---|---|
| `src/lib/interviewSimulator.ts` (new) | Timed mock interview + plain-English scoring, practice-only |
| `src/app/api/interview-simulator/route.ts` (new) | Paywall-gated GET run plan (questions only) + POST score |
| `src/lib/professionalInvites.ts` (new) | Professional invitation flow (library; sending to be wired) |
| `src/lib/googleWorkspace.ts` (new) | Google Calendar/Drive connect contract + founder steps |
| `docs/niptei-tv-180-script-2026-11-28.md` (new) | 180-second video script + storyboard (script only) |
| `docs/twenty-differentiators-2026-11-28.md` (new) | This file |
| `scripts/smoke-twenty.ts` (new) | Smoke test for this build (fake data only) |

Nothing else was touched. No Vercel, Supabase live, Stripe live, GitHub,
deploy, or push. No `index.html` change. No locked price changed.
`src/lib/docResend.ts`, `src/app/api/documents/resend/route.ts`, and
migration `0030` are the parallel builder's work, credited at #16; this
build's duplicate draft of that feature was deleted.
