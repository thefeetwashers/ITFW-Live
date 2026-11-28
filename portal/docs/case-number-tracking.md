# Case-number tracking + NVC / consular — EIGHTH ADDITION, Nov 28, 2026

## What it is

Once the client gives their case / receipt number, the client and the
professional see the same view of the case: what is done, what is
missing, whether the file is complete. Built in
`portal/src/lib/caseTracking.ts` + `portal/src/components/nextstep/CaseTracker.tsx`,
wired into the case page via `CaseCommandPanel` (right after the
existing `PostSubmissionTracker`).

## The honest boundary (read first)

- **USCIS gives no platform a view inside an officer's file.** There
  is NO API showing what an officer touched, changed, or noted. The
  USCIS Case Status API is Sandbox-approved only; Production is NOT
  granted (needs 5 days of Sandbox traffic + a demo + approval). So
  there is **no live USCIS lookup** in this build. Statuses are the
  public words USCIS shows on Case Status Online, entered manually
  after checking uscis.gov (or from a USCIS notice), or Sandbox/mock
  values — always labelled with their source. The tracker carries the
  note verbatim: *"We show your case status from USCIS public status
  and from your own file with us. We cannot see inside the officer's
  file."*
- **NVC has no API.** CEAC is manual only — a link out to
  https://ceac.state.gov/IV/Login.aspx. **A CEAC password is never
  stored and never asked for**; there is no password field anywhere
  in this module. No embassy email address is stored either —
  embassy contact details change, so the tracker links the official
  U.S. embassy directory (usembassy.gov) and says so. The only email
  listed is NVC's own public inquiry address
  (NVCquery@state.gov, 1-603-334-0700), labelled as NVC's, published
  by the U.S. Department of State — confirm on the linked
  travel.state.gov NVC page.
- **Nothing promises an approval.** Only USCIS (or the consulate)
  decides a case. The platform is a document-preparation service,
  not a law firm, not USCIS affiliated (8 CFR 292.1).

## What was built

| Piece | Where | Reuses |
|---|---|---|
| Receipt entry + validation (IOE/EAC/WAC/LIN/SRC/NBC/MSC) + masking (prefix + last 4) | `caseTracking.ts` (`validateReceiptNumber`, `maskReceiptNumber`) | `parseUscisReceipt` in `lib/nvc.ts` |
| Public USCIS status vocabulary (12 real Case Status Online strings) with plain-English meaning + next step; unknown text is never guessed | `PUBLIC_USCIS_STATUSES`, `explainPublicStatus` | — |
| Status-change log (date + meaning + next step + source label); same status is not logged twice; `case_watch.milestones` jsonb shape for persistence | `buildStatusLogEntry`, `appendStatusChange`, `buildCaseWatchMilestone` | `case_watch` (0001), `case_lifecycle` (0010), `audit_log` (0001) |
| Completeness view: packet items vs form checklist — submitted / missing / receipted, every row labelled "Our records with Immigration with NIPTEI — not USCIS's internal file" | `buildCompletenessView` | `auditItemsForTemplate` / `readinessForTemplate` (`lib/formChecklists.ts`), `computePacketReadiness` (`lib/audit.ts`) |
| RFE / NOID decoder (notice words → plain English + clerical next step; NOID always flags attorney review) | `decodeRfeNotice`, `RFE_DECODE_RULES` | `RfeTracker` + `rfe_uploads` (0002) |
| Deadline urgency from stored dates only | `deadlineUrgency` | `daysUntil` (`lib/shipments.ts`), `EXAMPLE_DEADLINES` (`lib/nvc.ts`) |
| NVC / consular checklist: what to submit online to the embassy (fees $120 AOS + $325 IV, DS-260, I-864, civil docs, DQ → interview), CEAC link, NVC page, embassy directory | `buildConsularChecklist` | `CEAC_STEPS`, `CEAC_FEE_AMOUNTS`, `parseNvcCaseNumber`, `lookupNvcPost` (`lib/nvc.ts`) |
| Client-facing panel | `src/components/nextstep/CaseTracker.tsx`, mounted in `CaseCommandPanel` | `PostSubmissionTracker`, `EXAMPLE_USCIS`, `EXAMPLE_DEADLINES` |

## What was NOT built (deliberately)

- **Officer-file view** — no such API exists; building one would
  mean inventing officer actions. The honest note says so on the page.
- **Live USCIS lookup** — Production key not granted; Sandbox/mock
  only, labelled.
- **No migration.** Checked first: `case_watch` (0001) already has
  `receipt_number` + `uscis_status` + `uscis_status_at` +
  `milestones` jsonb; `case_lifecycle` (0010) already logs stage
  history; `audit_log` (0001) already logs changes; `nvc_trackers`
  (0002) already stores NVC case + Invoice ID; `case_agency_numbers`
  (0009/0010) already holds NVC fee/DQ/interview columns; `documents`
  (0001) already has `review_status`. No column was genuinely
  missing, so no `0025` migration was written.
- **No embassy emails** — none could be verified from official
  guidance in the codebase; the directory link is shown instead.

## Still missing / follow-ups

- Persisting the log: the component currently holds the status log
  in local state (the established pattern in this repo until the API
  is wired). The `buildCaseWatchMilestone()` shape is ready for the
  `/api/case-status` route owner to append to
  `case_watch.milestones` — that wiring is not done here, to avoid
  colliding with the case-status sync builder working in parallel.
- The completeness view's submitted / receipted flags are props the
  professional records from the I-797C receipt notices on file; no
  automatic receipt detection exists (and none is possible without a
  live USCIS feed).
- Interview prep is linked from the tracker text; the full banks live
  in `lib/interviewPrep.ts` and are already surfaced elsewhere.
- Embassy email addresses per post remain unlisted by design — add
  one only with a cited travel.state.gov source for that post.

## Verification

- `npx tsc --noEmit` — exit 0.
- `npx -y tsx scripts/smoke-case-tracking.ts` — fake data only;
  asserts invalid-prefix rejection, status log with date + meaning,
  completeness source labelling, the honest note, no CEAC password
  field, NOID attorney-review flag, consular fees + no stored embassy
  email, and masked-only milestones.
