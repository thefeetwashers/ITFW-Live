# Full-Stack Expert Sweep — backend to frontend (Nov 28, 2026)

Founder's brief: "anything you want to add to your webapp and full stack,
from backend to front end … do not hold back, think if it was your own
platform." This sweep audited first, then built only what was honestly
missing. Nothing here was duplicated from another builder's work; where a
surface was already correct it is listed as verified, not rebuilt.

## Audit findings (what was already correct)

- **RLS on all new tables (0021–0030):** every new table has RLS enabled
  + participant-only policies (diy_drafts, diy_unlocks, daily_checkins,
  fee_waiver_checks, biometrics_appointments, address_changes,
  document_translations, google_connections, document_resends).
- **Foreign keys:** every new FK points at a real row (case_id → cases,
  account_id/client_id/checked_by/resent_by → accounts, document_id →
  documents, message_id → messages, quote_requests.account_id/case_id,
  preparer_leads.case_id, case_family_members.account_id). No FK column
  was missing.
- **Frontend states already present:** DIY flow (loading / save error /
  preview empty states, labelled controls, progressbar), /today (loading
  + error + empty states), pipeline table (overflow-x-auto, empty state),
  fee-waiver checker (labels, fieldsets, empty state), vault/renewal
  sections (empty states). These were verified, not rebuilt.
- **Locked prices:** `src/lib/stripePrices.ts` untouched. No prices changed.

## Backend — added

### 1. Migration 0031 — RLS gapfill (4 real gaps, no policy weakened)

`supabase/migrations/0031_itfw_fullstack_sweep_rls_gapfill.sql`

- **fee_waiver_checks (0029):** select/insert used a direct
  client-or-provider check instead of `is_case_participant()`, so a
  family member linked by 0022 could not read a check on their own case;
  the 0029 comment claimed founder/admin read was "covered by 0003 §7a"
  but no policy on this table granted it. Both policies recreated on
  `is_case_participant()` (insert still requires
  `checked_by = current_account_id()`), plus a founder/admin SELECT.
- **document_resends (0030):** insert required only
  `is_case_participant(case_id)` — a participant could attribute a resend
  to a different account. Now also requires
  `resent_by = current_account_id()`. Still append-only.
- **UPDATE without WITH CHECK:** biometrics_appointments, address_changes,
  document_translations (0030) and diy_drafts (0023) had USING-only update
  policies, so a participant could move a row to another case/account on
  update. Each now has a WITH CHECK (participant on the new case AND
  client_id/account_id still their own).
- **Bare FKs:** diy_unlocks.client_id and fee_waiver_checks.checked_by
  were created with no ON DELETE action. Each is dropped by constraint
  lookup (name never assumed) and re-added with ON DELETE CASCADE, only
  when the current definition lacks it.
- **Numbering warning (RESOLVED by the coordinator, Nov 28, 2026):** the
  directory held TWO files named 0030
  (`0030_itfw_more_added.sql` and
  `0030_itfw_pro_discovery_google_docresend.sql`). Renamed, no content
  changed: the more-added file is now `0035_itfw_more_added.sql`, and
  the expert-tools file is now `0036_itfw_expert_tools.sql` (it had
  collided with `0033_itfw_free_tool_attribution.sql`). Migrations
  0021–0036 are now unique and sequential.

### 2. Audit logging — `src/lib/auditLog.ts` (new)

`writeAuditLog()` + `scrubAuditDetail()`: best-effort inserts into
audit_log (0001); a failed insert never fails the user's request. The
scrubber drops any detail key matching PII/money patterns (ssn, a_number,
passport, dob, income, amount, price, fee, threshold, email, phone, name,
token, …) even if the caller passes one by mistake. Wired into:

- quote-requests POST — `quote_request_saved` (form_code + status only)
- leads POST — `lead_saved` (pipeline_stage only)
- diy/drafts POST / DELETE — `diy_draft_saved` / `diy_draft_deleted`
  (form_code + server-decided status; never the answers)
- waiver-checks POST — `fee_waiver_check_saved` (outcome code + region;
  never income, never the threshold amount)
- documents/resend POST — `document_resent` on email / vault-link /
  portal-chat success (channel + status; never file name/recipient/link)
- google-connections POST save_contact — `google_connection_updated`
  (ids only; never the email/phone)

Not wired (deliberately): /today/checkin — a streak-only write, not a
money/sensitive write under the brief; login-code attempts are already
counted in the login_codes table (0020).

### 3. Rate limiting — `src/lib/rateLimit.ts` (new)

In-memory, per (route + IP + optional email/account scope), no new
service. Honest 429 with a plain message + Retry-After header, never a
fake success. Documented limit: single-instance only; the login_codes
table's per-code lock remains the authoritative code-guessing control.

- POST /api/quote-requests — 10/min per IP
- POST /api/leads — 10/min per IP
- POST /api/auth/login — 5/min per IP + email
- POST /api/auth/verify-code — 5/min per IP + email (in addition to the
  existing 3-wrong-codes lock in the DB)

### 4. Error handling — `src/lib/apiErrors.ts` (new)

- `safeDbError()`: honest generic message + migration hint; the raw
  Postgres message (table/column/constraint names) never reaches the
  caller. `isMissingSchemaError()` detects missing tables/columns by
  Postgres error CODE (42P01/42703), not message regex.
- Applied to: waiver-checks, diy/drafts, quote-requests, documents/resend
  (404s now generic), leads (incl. the 0021 fallback), pipeline,
  google-connections, today/checkin.
- **200-on-failure fixed:** google-connections GET returned 200 with a
  warning when the DB read failed (the UI would show "not connected" for
  a product that may be connected). Now 502 with an honest message.

## Frontend — added

### 5. Retry buttons (error states were text-only)

- `src/components/pipeline/PipelinePageClient.tsx`: load error is now a
  separate `loadError` state (was conflated with the empty-state notice)
  rendered as a `role="alert"` with a **Try again** button. Empty list
  keeps the honest empty text with no retry.
- `src/app/today/page.tsx`: error banner is now a `role="alert"` with a
  **Try again** button (re-runs `load()`).

### 6. Fee-waiver save — dead end closed

`src/components/dashboard/FeeWaiverCheckerSection.tsx`: no UI ever POSTed
to /api/waiver-checks — a client check was computed in memory and thrown
away, so the professional view could never show a result. The client view
now offers **Save this result to my case** when the caller passes
`caseId` + `checkedByAccountId`, with saving / saved / error + retry
states (income is never sent — only household size, region, grounds,
outcome). Without a case it honestly says the result is not saved and no
case id is invented.

### 7. Arabic RTL — `src/lib/usePreferredDir.ts`, `src/components/DirRoot.tsx`

Gap: LanguagePicker kept its choice in local state only — picking Arabic
changed nothing, and no new page set `dir="rtl"`.
- LanguagePicker now persists to `localStorage["niptei-language"]`,
  applies `dir` + `lang` to `document.documentElement` immediately, and
  dispatches `niptei-language-change`.
- `usePreferredDir()` hook + `DirRoot` client wrapper apply `dir` per
  page (no global restyle): /today, /diy, pipeline, Journey Map
  (server-rendered, via DirRoot).

### 8. Mobile / accessibility — verified, no rebuild needed

- Pipeline table already `overflow-x-auto` with `min-w-[720px]`; TodayHome
  flex rows all wrap; DIY step rail wraps; no overflow/clipping found in
  the touched files at narrow width.
- All new controls already labelled (DIY intake engine uses
  `htmlFor` + `<label>`; fee-waiver uses `<label>` + `<fieldset>`/
  `<legend>`; pipeline role tabs are `role="tab"` buttons with
  `aria-selected`). No unlabeled control was found on the new surfaces.

## Verification

- `npx tsc --noEmit` — exit 0, no errors. (One transient error in
  `src/components/preparer/BusinessToolsPanel.tsx` appeared in an early
  run while a parallel builder was editing that file; a re-run after
  their edit landed was clean. That file was not touched by this sweep.)
- `npx -y tsx scripts/smoke-fullstack-sweep.ts` — **28 checks passed**:
  RLS enabled on all 9 new tables + 4 gapfill assertions; limiter allows
  exactly N then 429s with Retry-After; safeDbError leaks no schema
  names; code-based missing-schema detection; audit scrubber drops PII/
  money keys; loading/error/empty/RTL states present on the new surfaces.
- `npm run build` was NOT run (coordinator runs one clean build at the end).
- No Vercel / Supabase live / Stripe live / GitHub / deploy / push touched.
  `index.html` (frozen) and `src/lib/stripePrices.ts` untouched.

## Still missing / for the coordinator or founder

1. **Renumber one 0030 migration** (see §1) before any sequential run.
2. **Fee-waiver save wiring:** the save button only appears where a caller
   passes a case + account id. No dashboard passes a case yet (the client
   dashboard is a static front-door page with no signed-in case in scope),
   so wiring the signed-in case through the dashboards is still open.
3. **Rate limiting is per-instance** (in-memory). On a multi-instance
   deploy each instance keeps its own buckets; a shared limiter (e.g.
   Upstash) would be needed for a global limit — not added, per the
   no-new-service rule.
4. **Audit log via anon client:** document-resend and google-connections
   use the anon Supabase client, which normally cannot INSERT into
   audit_log — those audit writes are best-effort and will silently
   no-op until a service-role path exists for them. The document_resends
   / notification_logs records remain the authoritative log there.
5. **Live verification not possible in this sweep:** RLS policies,
   rate-limit 429s, and audit inserts are verified against code/SQL text
   only (smoke test). They need one live run after migrations 0021–0032
   are applied to confirm behaviour against the real database.
