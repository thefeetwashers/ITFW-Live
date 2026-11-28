# Guided DIY Filing Flow — /diy

Founder addition, Nov 28, 2026. A client filing the application themselves gets a guided
DIY flow: the system already knows every form and its questions, asks the client the
questions one by one, fills the form with their name, address and all information needed,
and — for a fee — gives them access to print it, save it and email the completed
application to them, plus the document checklist, a draft cover letter, and how and in
what order to submit it to immigration.

## What was built (Nov 28, 2026)

| File | What it is |
|---|---|
| `src/app/diy/page.tsx` | NEW — mounts the flow at `/diy` (`?caseId=<uuid>&form=<code>`). |
| `src/components/diy/DiyGuidedFlow.tsx` | NEW — the 5-step flow (choose → answer → preview → pay → print/save/email). |
| `src/lib/diy.ts` | NEW — locked DIY prices, the pure unlock decision, the server-side reader, preview constants. |
| `src/lib/diySubmission.ts` | NEW — draft cover letter + submission-order guide, from locked data only. |
| `src/app/api/diy/unlock-status/route.ts` | NEW — GET: server-side unlock check + caller account id/email for checkout. |
| `src/app/api/diy/packet/route.ts` | NEW — POST: DIY pay gate, then delegates to the existing `/api/generate-packet`. |
| `src/app/api/diy/email-packet/route.ts` | NEW — POST: DIY pay gate, then packet, then SES email with the signed link. |
| `supabase/migrations/0024_itfw_diy_unlocks.sql` | NEW — `public.diy_unlocks` table (must be run; webhook wiring still needed — see below). |
| `scripts/smoke-diy-flow.ts` | NEW — smoke test, fake data only. |
| `docs/diy-flow.md` | This file. |

## What already existed (reused, not rebuilt)

- **Dynamic Intake Engine** (`src/lib/dynamicIntakeSchemas.ts` + `src/components/DynamicFormIntakeEngine.tsx`):
  15 registry schemas (I-130, I-130A, I-485, DS-260, I-864, I-864A, N-400, I-821, I-765, I-589,
  I-90, I-131, I-751, I-539, I-129F), timeline validators, the draft notice on every form, the
  AttorneyOptionsBar in both DIY and Preparer modes, DIY leaves the preparer section blank.
  The DIY flow mounts it once per form in `client_diy` mode.
- **Paywall module** (`src/lib/paywall.ts`): read first and reused as the pattern (server-side
  decision, fail closed, admin/founder support access). NOT duplicated. The DIY unlock decision
  is separate because DIY is per-form paid, not a subscription surface (see "Pay gate" below).
- **Stripe checkout + webhook** (`src/app/api/checkout`, `src/app/api/stripe/webhook`): unchanged.
  The DIY page uses the real `CheckoutButton` with the locked DIY Price IDs.
- **Packet route** (`src/app/api/generate-packet`): unchanged. The DIY packet/email routes
  delegate to its POST handler. Its own gates (audit 100%, balance paid, official USCIS
  template present) still apply.
- **Checklists** (`src/lib/formChecklists.ts`): reused via `checklistSlotsForForm()`; never duplicated.
- **Email** (`src/lib/email.ts`, AWS SES): reused. When SES is not configured the email route
  returns honest 501/`not_configured` and never claims the email was sent.
- **Locked prices** (`src/lib/stripePrices.ts`): DIY $25/form (`diy_form`,
  `price_1UfS5APfd9SRUcvh47Ks9Lw0`) and DIY Bundle $99 (`diy_bundle`,
  `price_1UfS5iPfd9SRUcvhKEQxf0pj`). Never changed.

## The flow, step by step

1. **Choose your form** — one of the 15 registry forms, one at a time.
2. **Answer the questions** — the intake engine, in order, with its timeline validators,
   document slots for that form only, and the attorney option on every page. Answers save to
   `questionnaire_responses` (migration 0005) when a real case id is present.
3. **Review your preview** — the client's own saved answers, rendered watermarked
   ("DRAFT — Immigration with NIPTEI — not for filing until reviewed and signed"), with text
   selection / right-click copy / copy-print shortcuts disabled. Sensitive values are shown
   masked only (`***-**-1234`). Free.
4. **Pay to unlock** — DIY $25 for the form, or DIY Bundle $99 for every form on the case,
   via the real Stripe Checkout button. The page passes `caseId` + `accountId` (resolved
   server-side) so the webhook can record the invoice — without both, the webhook records
   no invoice row and the payment can never be proven from the database.
5. **Print, save & email** — once the server confirms payment: the completed DRAFT packet
   (PDF, 24-hour signed link, via `/api/generate-packet`), email-to-self via SES (signed
   link, never an attachment — see below), the draft cover letter, and the submission-order
   guide.

## Pay gate — how it is enforced (server-side)

`decideDiyUnlock()` (pure, in `src/lib/diy.ts`) + `getDiyUnlockForCase()` (server-only reader)
decide from database records only:

- `public.diy_unlocks` (migration 0024) — a paid row for the exact form, or a paid bundle row.
- `public.invoices` (0001) — status `paid`, description starting `diy_form` / `diy_bundle`
  (what the webhook writes today), read **case-scoped** via `cases.forms`.
- `public.order_invoices` (0006) — status `paid` + `unlocks_stage = 'esign_and_download'`.
- `public.payment_plans` (0002) — fully paid (`paid_cents >= total_service_fee_cents`) for the case.
- Admin / founder: support access only.

`/api/diy/packet` and `/api/diy/email-packet` run this check FIRST and return 402
`diy_not_paid` before ever touching the packet route. Hiding buttons in the UI is not the
gate. Unconfigured Supabase, unknown account/case, or a case belonging to someone else =
DENIED (fail closed). No active subscription unlocks DIY: DIY is a per-form paid product,
not a subscription surface; teachers are not auto-unlocked here either (unlike Smart Forms).

## Copy / screenshot protection — honest limit

Implemented: watermark on the preview, text selection disabled, right-click copy disabled,
copy/cut/print/save keyboard shortcuts intercepted in the preview. **This is a deterrent,
not a guarantee.** A phone camera or the browser's own print function can still capture a
screen, and no code in this repo pretends to block the operating system or a camera. The
label says so in the UI and in the code (`DIY_COPY_DETERRENT_LABEL`). The lock that actually
protects the work is the pay gate above, not the copy deterrent.

## What is NOT invented

- **No USCIS form edition is printed anywhere.** No verified edition is stored in this
  codebase (templates live in the vault per edition, named by file), so every form carries
  `DRAFT_SCHEMA_NOTICE` ("Draft intake mapping — check against the current USCIS form
  edition at uscis.gov before filing") plus "confirm the current edition at uscis.gov".
  The brief asked for each form's edition; the hard rule (never invent an edition) wins.
- **No filing (lockbox) address is printed anywhere**, and the guide never claims which
  forms accept online filing — no verified list of either exists in this codebase. The guide
  tells the client to confirm the fee, edition and address on that form's USCIS page before
  paying or sending.
- **No prices, clients, or "live" claims are invented.** Government fees are shown exactly
  as stored (LOCKED vs TO BE CONFIRMED, never combined into a single total when unconfirmed).
- **Documents: only `review_status = 'accepted'` are included in a packet** (migration 0001
  enum: uploaded / under_review / accepted / retake_requested). There is NO `'approved'`
  status — the brief's word "approved" is corrected here, and the packet route's GET text
  says so.
- **Email delivery is a signed download link (24h), not an attachment.** `src/lib/email.ts`
  uses SES `SendEmail`, which has no attachment support in this codebase; the packet route
  returns a signed URL, and that is what is emailed. No new delivery mechanism was invented.

## Known gaps (not fixed here — owned elsewhere)

1. **Webhook writes no `form_code`.** `/api/stripe/webhook` records a DIY payment as
   `invoices.description = "diy_form — full"` with no `form_code`, so a paid $25 invoice
   cannot by itself prove WHICH form was paid for. The reader works around it case-scoped
   (`cases.forms`). The durable fix: the webhook (or checkout route) must record the form —
   write `invoices.form_code` and insert a `public.diy_unlocks` row (migration 0024) on
   `checkout.session.completed` when `price_key` is `diy_form` / `diy_bundle`. That change
   belongs to the webhook owner; this build does not touch the webhook.
2. **DIY payment does not create a service order.** `/api/generate-packet` additionally
   requires a `service_orders` row with the balance paid/current (402 otherwise). A DIY-only
   $25 payment creates an `invoices` row, not a service order — so after DIY unlock, the
   packet route can still honestly return 402 "no service order" until a service order exists
   for the case. The DIY routes pass that error through unchanged rather than faking a packet.
   Creating a service order at DIY checkout belongs to the checkout/webhook owner.
3. **After checkout the client returns to `/portal`, not `/diy`.** `CheckoutButton` has no
   success-path prop; the checkout route defaults to `/portal?checkout=success`. The DIY page
   re-checks unlock status on load and has an "I've paid — check again" button.
4. **Step-by-step is one form at a time, not one question at a time.** The engine renders a
   whole form's sections in order; this flow adds the step rail and mounts one form at a time
   rather than rebuilding the engine into a per-question wizard (forbidden by the brief).
   A per-question wizard needs an engine change, not a wrapper.
5. **No USCIS template is uploaded to the vault yet.** The packet route returns an honest
   404 until the current edition is downloaded from uscis.gov and uploaded per form.
   E-Sign is not connected; the client reviews and signs outside the packet.

## Verification

- `npx tsc --noEmit` — must exit 0.
- `npx -y tsx scripts/smoke-diy-flow.ts` — fake data only; proves the unpaid/paid unlock
  matrix, the server-side 401/501 refusals, the watermark + deterrent label, the edition
  notice on all 15 forms, the draft cover letter, the 6-step submission guide, and the
  `'accepted'` document rule.
