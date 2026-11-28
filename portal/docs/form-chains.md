# Form chaining — guided DIY flow (Nov 28, 2026)

Founder addition: when a client completes one form, the system tells
them the OTHER form to complete next, and the other after that, until
they finish them all — and charges a fee for printing / saving each
one. Copying / screenshots are deterred, never claimed impossible.

## Chains (src/lib/formChains.ts)

| Chain | Order | Source |
|---|---|---|
| Green Card Bundle — Family Adjustment | I-130 → I-130A → I-864 → I-485 → I-765 → I-131 → I-693 | Set of 7 forms: `FAMILY_ADJUSTMENT_BUNDLE.forms` in `src/lib/bundles.ts`. Filing order: founder's addition + the codebase's own dependencies (I-485 checklist needs the I-130 receipt and the I-864 with the I-485; I-130A is the supplement to the I-130; I-693 is the doctor's sealed exam). The bundle list itself is a set, not a filing order — it lists I-485 second. The Path Finder routes (`inside_us` / `outside_us` in `src/lib/nextStepEngine.ts`) carry no per-form order. |
| TPS + Work Permit | I-821 → I-765 | Bundle template `I-821+I-765` in `src/lib/bundles.ts`. |
| Consular / NVC | I-130 → I-864 → DS-260 | Bundle template `I-130+NVC` in `src/lib/bundles.ts`. |

Each step carries a plain-English reason why that form is next.
Standalone forms (N-400, I-589, I-90, I-751, I-539, I-129F, I-864A)
are in no chain and have no next form.

## How it works

- **Progress** — `chainProgress()` in `src/lib/formChains.ts`.
  Completed forms are revisitable; unreached forms are `locked`,
  never shown as completed. Progress label: "Form 3 of 7 — I-864 next".
- **Completed =** saved answers for the case in
  `questionnaire_responses` (migration 0005) OR a `diy_drafts` row
  (migration 0022) with status `submitted` for the account — read
  server-side by `GET /api/diy/chain-status`. In the session, a form
  is also marked completed when the client presses "Done answering —
  review my preview" in `DiyGuidedFlow`.
- **Pay gate (reused, not rebuilt)** — per-form print / save / email
  uses `decideDiyUnlock()` in `src/lib/diy.ts`, the same gate
  `/api/diy/packet` enforces. DIY $25/form
  (`price_1UfS5APfd9SRUcvh47Ks9Lw0`) unlocks one form; DIY Bundle $99
  (`price_1UfS5iPfd9SRUcvhKEQxf0pj`) unlocks the bundle's forms.
  Payment is confirmed in the database, never a front-end flag.
  A form whose DIY fee is unpaid stays locked even if completed.
- **I-130A is free with I-130** — no I-130A Stripe price exists by
  design, so its unlock follows the I-130 payment.
- **I-693 is a doctor step** — it has no registry schema and no DIY
  price. There are no questions for it in this portal and no DIY
  print gate for it: a USCIS-designated civil surgeon completes and
  seals it; the doctor's fee ($250–$500) is paid to the doctor.
- **Copy / screenshot deterrent** — the existing watermarked,
  non-copyable preview in `DiyGuidedFlow` step 3 (disabled text
  selection / copy / print shortcuts + watermark), labelled honestly
  as a deterrent, not a guarantee. A phone camera can still capture
  a screen. The pay gate is what protects the work.

## Files

- `src/lib/formChains.ts` — chain definitions, progress math,
  per-form unlock decision, validation. Pure (no Supabase/Stripe).
- `src/components/diy/FormChainProgress.tsx` — chain panel
  (progress bar, step list, per-form pay state, what's-next banner).
- `src/components/diy/DiyGuidedFlow.tsx` — mounts the panel on the
  `/diy` page; "Done answering" marks the form completed in-session
  and the panel offers "Start Form X →".
- `src/app/api/diy/chain-status/route.ts` — `GET
  ?caseId=&chainId=` (or `&formCode=`): server chain progress +
  per-form unlock. Fails closed (501 without Supabase, 401/403
  without a verified caller).
- `scripts/smoke-form-chains.ts` — 70 checks, fake data only.
  Run: `npx -y tsx scripts/smoke-form-chains.ts`.

## Hard rules kept

- "Check the current USCIS form edition at uscis.gov before filing"
  on every form; no edition is invented.
- Packet-audit-100% + balance-paid rule before a packet is marked
  ready — enforced by `/api/generate-packet` and `/api/diy/packet`,
  not here.
- Document-preparation service, NOT a law firm, NOT USCIS affiliated.
  Only a licensed attorney or DOJ-accredited representative gives
  legal advice (8 CFR 292.1). No AI decides relief / eligibility /
  evidence strength / safe-to-leave. The system never files for the
  client; the user reviews and signs before anything is submitted.
- Locked prices / Price IDs unchanged. DOB / A-Number / SSN /
  passport masked, never logged. Email is AWS SES via
  `src/lib/email.ts` (501/not_configured when unconfigured).

## Known gaps / still missing

- **Webhook `form_code` gap (pre-existing, not fixed here):** the
  Stripe webhook writes no `invoices.form_code`, so a $25 DIY
  payment is read case-scoped via `cases.forms` (see `src/lib/diy.ts`
  header). The durable per-form record is `diy_unlocks`
  (migration 0022) — until the webhook writes it, the chain-status
  route re-derives each form's unlock from the packet gate's own
  verdict, so the two can never disagree.
- **No "mark complete" button in the engine itself:** completion is
  inferred from saved answers / submitted drafts, plus the
  in-session "Done answering" tap. If the save-and-resume builder
  adds an explicit submit action for drafts, chain-status already
  reads `status = 'submitted'`.
- **I-130 is in two chains** (Green Card + consular). Both the page
  and the route resolve it to the Green Card chain first; there is
  no case-route signal to pick the consular chain yet. A case whose
  Path Finder route is `outside_us` should resolve I-130 to the
  consular chain — that needs the route passed into the chain-status
  call.
- **No live verification:** Supabase / Stripe are not connected in
  this build, so chain-status was verified fail-closed only (501).
  Live per-form unlock needs a real case + real payments.
