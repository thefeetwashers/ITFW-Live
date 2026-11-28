# In-Dashboard Email + Auto-Drafted Messages and Cover Letters
## Founder's confirmation + instruction, Nov 28, 2026 — BUILD REPORT

Founder: "did you add here me or the provider can email the client inside the dashboard, and the system already draft any missing that need to be send to the client, based on the document form and more ... think before me and please think of everything needed."

**Confirmed and built.** The founder and any professional can now email the client from inside the dashboard, and the system already drafts every missing document and every missing form answer, per form, plus cover letters and the lifecycle emails the platform needs. Nothing here is a second letter engine or a second composer: everything reuses the existing engines (see "What already existed").

## What already existed (reused, not rebuilt)

| Existing piece | Where | How it is reused |
|---|---|---|
| Platform SES sender | `portal/src/lib/email.ts` | The only platform send path. Unconfigured → `email_not_configured`, never a fake "sent". |
| Drafted-email library (11 templates) | `portal/src/lib/draftedEmails.ts` | Extended with 5 lifecycle templates (now 16). Same `renderDraft()`, same attorney-review gate, same 7-language nudge reuse. |
| DIY cover letter | `portal/src/lib/diySubmission.ts` (`buildDiyCoverLetter`) | Professional cover letters reuse it for the enclosure list + filing rules — no second letter engine. |
| One-click draft-email routes | `portal/src/app/api/case-status/draft-email/route.ts`, `portal/src/app/api/pipeline/draft-email/route.ts` | Left untouched. The new route mirrors their delivery-recording pattern. |
| Form checklists (12 templates) | `portal/src/lib/formChecklists.ts` | The auto-draft engine maps every checklist row to a draft; no checklist is duplicated. |
| Registry intake schemas (15 forms) | `portal/src/lib/dynamicIntakeSchemas.ts` | Missing-answer drafts come from `requiredFieldsForSchemas()`; sensitive fields are flagged by `RegistryField.sensitive`. |
| Thread + delivery records | `portal/src/lib/caseStatusSync.ts` (`insertCaseThreadMessage`, `recordEmailSend`), `notification_logs` (0010), `message_sends` (0014) | The composer route records delivery in these existing tables. `recordEmailSend` gained one optional `provider` param (default `"aws_ses"`) so BYO sends log under their real provider. |
| BYO providers | `portal/src/lib/byo.ts`, `provider_settings` (0014) | Sender-source resolution reads the provider_settings row (connected + test passed) — never a guessed connection. |
| 7-language message templates | `portal/src/lib/messageTemplates.ts`, `portal/src/lib/notificationTemplates.ts` | The general single-document request still reuses the existing 7-language nudge; no translation is invented. |

## What was added

### 1. In-dashboard email composer
- **Component:** `portal/src/components/comms/DashboardEmailComposer.tsx` — template picker (16 drafted emails + 16 cover letters), free-form subject + body, Preview (renders the full draft, sends nothing), one-click Send, Save draft, sender-source selector, attorney-review checkbox, per-channel delivery status. Mounted in the preparer dashboard Communication Hub tab (`portal/src/components/preparer/PreparerDashboard.tsx`) — with no real case loaded it browses templates and honestly says sending needs a real open case; it never sends against an example id.
- **API route:** `portal/src/app/api/dashboard-email/route.ts` — `GET` lists templates + sender sources + SES status; `POST` composes (template or free-form) and sends. Platform SES by default; BYO Resend / BYO SES only when the professional's `provider_settings` row says connected + test passed — and, honestly, a BYO send returns `not_configured` until the vault-backed BYO send path lands (the key lives only as an encrypted vault reference and this route never decrypts it). SES unconfigured → email `not_configured`, in-app copy still lands. Delivery is recorded in `notification_logs` + `message_sends` + `audit_log`, per channel, from real send records only.
- **Saved drafts table:** `supabase/migrations/0034_itfw_dashboard_email.sql` — new table `dashboard_email_drafts` (case-scoped, `is_case_participant()` RLS, founder/admin read) for Save-draft. A saved draft is not a send.

### 2. Auto-drafted messages for every missing document and every missing form answer
- **Engine:** `portal/src/lib/dashboardEmail.ts`
  - `templateIdForChecklistItem()` — keyword rules map each checklist item to one of the 8 missing-document templates; the fallback is always `general_document_request`, so a missing item **always** produces a draft.
  - `draftsForMissingChecklist()` — one one-click draft per missing item on a template, plus the single `missing_summary` draft listing them all.
  - `draftsForAllChecklists()` — full coverage check (used by the smoke test).
  - `draftsForMissingAnswers()` — one draft per unanswered required registry field, per form. **Sensitive fields (SSN / A-Number / passport number) get a portal-only draft**: it tells the client to enter the value in the portal and explicitly says "Do not send it by email or chat" — the value is never requested by email.
  - `validateComposerInput()` + `containsApprovalPromise()` — rejects DOB / A-Number / SSN / passport values and any approval promise before anything is sent.
  - `resolveSenderSource()` — platform SES default; BYO only when connected + test passed.
  - `listComposerTemplates()` — the picker: 32 entries (16 drafted emails + 16 cover letters).

### 3. Cover letters for every form / bundle
- **Library:** `portal/src/lib/coverLetters.ts` — `renderCoverLetter()` + `listCoverLetters()`. Reuses `buildDiyCoverLetter()`; adds the preparer header, locked gov-fee lines per form, and the enclosure list. **Every professional cover letter is labelled "DRAFT — for a licensed attorney to review before sending"** and the send route requires `confirmAttorneyReview: true`. No filing address is printed (none is stored anywhere); no fee is presented as verified when the checklist marks it TO BE CONFIRMED.

### 4. The five extra lifecycle emails (system-drafted, one-click send)
Added to `portal/src/lib/draftedEmails.ts` (`DraftCategory` gained `"lifecycle"`):

| # | Template id | Label | Attorney review? |
|---|---|---|---|
| 1 | `missing_summary` | What is missing — summary email | No |
| 2 | `deadline_warning` | Deadline warning | **Yes** (states a government deadline) |
| 3 | `file_complete` | Your file is complete | No |
| 4 | `receipt_confirmation` | Receipt confirmation — we received your documents | No |
| 5 | `interview_reminder` | Interview reminder | **Yes** (government appointment) |

## Every drafted template (32 in the composer picker)

### A. Drafted emails — `portal/src/lib/draftedEmails.ts` (16)
**Missing-document letters — the 8 (7 specific + general), all pre-existing and verified wired:**

| # | Template id | Label |
|---|---|---|
| 1 | `missing_birth_certificate` | Missing birth certificate |
| 2 | `missing_passport_photos` | Missing passport photos |
| 3 | `missing_passport_bio_page` | Missing passport bio page |
| 4 | `missing_marriage_certificate` | Missing marriage certificate |
| 5 | `missing_i864_income_evidence` | Missing I-864 supporting income evidence |
| 6 | `missing_tax_transcript` | Missing tax transcript |
| 7 | `missing_police_certificate` | Missing police certificate |
| 8 | `general_document_request` | General document request (any missing items) — reuses the existing 7-language nudge for a single document |

**Appointments / deadlines — pre-existing (3):**

| # | Template id | Label | Attorney review? |
|---|---|---|---|
| 9 | `interview_appointment_details` | Interview appointment details | Yes |
| 10 | `rfe_deadline_reminder` | RFE deadline reminder | Yes |
| 11 | `biometrics_appointment_details` | Biometrics appointment details | No |

**Lifecycle — NEW (5):** `missing_summary`, `deadline_warning` (review), `file_complete`, `receipt_confirmation`, `interview_reminder` (review) — see table above.

### B. Cover letters — `portal/src/lib/coverLetters.ts` (16, all NEW, all attorney-review)
One per registry form (15) + the Family Adjustment Bundle:

| # | Template id | Covers |
|---|---|---|
| 1 | `cover_letter:i-130` | Form I-130 |
| 2 | `cover_letter:i-130a` | Form I-130A |
| 3 | `cover_letter:i-485` | Form I-485 |
| 4 | `cover_letter:ds-260` | Form DS-260 |
| 5 | `cover_letter:i-864` | Form I-864 |
| 6 | `cover_letter:i-864a` | Form I-864A |
| 7 | `cover_letter:n-400` | Form N-400 |
| 8 | `cover_letter:i-821` | Form I-821 |
| 9 | `cover_letter:i-765` | Form I-765 |
| 10 | `cover_letter:i-589` | Form I-589 |
| 11 | `cover_letter:i-90` | Form I-90 |
| 12 | `cover_letter:i-131` | Form I-131 |
| 13 | `cover_letter:i-751` | Form I-751 |
| 14 | `cover_letter:i-539` | Form I-539 |
| 15 | `cover_letter:i-129f` | Form I-129F |
| 16 | `cover_letter:family-adjustment` | Family Adjustment Bundle (I-130 + I-485 + I-130A + I-864 + I-765 + I-131 + I-693) |

Note: Form I-693 has no registry schema (it is a sealed medical exam from the doctor, covered by the I-485 checklist template). The bundle cover letter accepts it via the checklist template; a form with neither a registry schema nor a checklist template has no cover letter — the engine reports it as missing, never invents one.

### Language
English first throughout. The general single-document request reuses the existing 7-language missing-document nudge (en, es, ht, fr, pt, zh, ar) when it names exactly one document. Every other draft is English only with the professional-facing label "English only — translation pending". No translation was invented.

## Verification

- `npx tsc --noEmit` — **exit 0** (no errors).
- `npx -y tsx scripts/smoke-dashboard-email.ts` — **165/165 assertions passed**, fake data only, no email sent:
  - SES unconfigured → `email_not_configured`, no network call.
  - Every checklist row on all 12 templates produces a draft (all rows, 0 unmapped).
  - All 8 missing-document letters exist and render.
  - All 5 lifecycle drafts render; `deadline_warning` + `interview_reminder` require attorney review.
  - Cover letters render for all 15 registry forms + bundle; all DRAFT-labelled for attorney review; none promises an approval; unknown form → honest error, no invented letter.
  - Every unanswered required field on every registry form produces a draft; sensitive fields get portal-only drafts.
  - No rendered draft (338 texts checked) contains a DOB / A-Number / SSN / passport value or an approval promise; the composer validator rejects an SSN body and an approval promise, accepts a clean email, rejects an empty subject.
  - BYO resolution: platform SES usable by default; BYO unusable unless connected + test passed.
  - Composer picker lists 32 templates.
- `npm run build` was **not** run, per the task (the coordinator runs one clean build at the end).
- No Vercel, Supabase live, Stripe live, GitHub, deploy, or push was touched. No keys/secrets in code or docs. `~/workspace/itfw-live/index.html` untouched. Locked prices / Stripe Price IDs in `src/lib/stripePrices.ts` untouched.

## What is still missing / honest limits

1. **BYO send path is not live.** A professional's own email (BYO Resend / BYO SES) can be selected, and the route checks `provider_settings` (connected + test passed), but the actual BYO send returns `not_configured` honestly: the key lives only as an encrypted vault reference and no vault-decrypt send path exists in this build. Platform SES is the working send path. The vault-backed BYO send is a later build; it should reuse the same `provider_settings` row and the same delivery recording.
2. **Non-English drafts are English-only except the single-document nudge.** The 5 lifecycle emails and the 7 specific missing-document letters are English only ("translation pending"). Translating them needs locked translations, not invented ones.
3. **No live end-to-end send test.** SES is unconfigured in this environment, so the smoke test proves the honest `not_configured` path, not a live SES delivery. A live send test (SES configured + verified sender) is still needed before claiming a real delivery.
4. **Composer is mounted with no real case in the example dashboard.** Sending needs a real open `caseId`; the PreparerDashboard mount passes none, so Send/Save/Preview stay disabled there until the tab loads a real case. The per-case mount point (pass `caseId`, `professionalId`, `missingItemIds`) is the component's props.
5. **Migration 0034 is written, not run live** (Supabase is not connected in this build). `dashboard_email_drafts` does not exist until it is applied.
6. **"Think before her" items deliberately NOT built:** no automatic sending (every draft needs the professional's one click + review); no auto-send on a deadline (a deadline email is drafted, never auto-sent); no AI-written legal argument in any letter; no approval language anywhere.
