-- 0027 — backbone tracking: RFE/NOID kind + notice dates, NVC embassy
-- post + DQ/interview dates, immigrant fee + U.S. entry on cases.
--
-- WHY: the backbone check (NINTH ADDITION, Nov 28, 2026) found three
-- fields the portal computes but cannot store:
--   * rfe_uploads (0002) has a deadline + checklist but no KIND
--     (RFE vs NOID), no notice date, and no response window — so the
--     RFE/NOID decoder (lib/caseTracking.ts) + deadline countdown
--     (lib/backbone.ts rfeNoidDeadlineCountdown) have nowhere to
--     persist the notice they decoded.
--   * nvc_trackers (0002) stores the NVC case number + Invoice ID
--     (encrypted) but not the embassy post code, the CEAC step, the
--     DQ date, or the interview date — so the embassy directory
--     (lib/backbone.ts EMBASSY_POSTS) cannot be linked to a case.
--   * cases (0001) has no immigrant-fee or entry fields — so the
--     $235 USCIS Immigrant Fee (paid BEFORE flying) and the 30–90 day
--     Green Card / SSN window after entry cannot be tracked per case.
--
-- All columns are NULLABLE (except the two with defaults) and the
-- change is additive only; existing rows keep working. No live
-- government connection is implied by these columns: every value is
-- entered manually from an official notice or letter.
-- RLS: untouched — rfe_uploads / nvc_trackers keep their 0002
-- is_case_participant policies, cases keeps its 0001 policies.
-- NEVER store a CEAC password, a full receipt number, a DOB,
-- A-Number, SSN, or passport number in these columns. Receipt
-- numbers stay masked (lib/caseTracking.ts maskReceiptNumber);
-- the NVC case number + Invoice ID stay encrypted per 0002.

-- RFE vs NOID: the decoder needs the kind. Default 'rfe' keeps
-- existing rows (all RFE uploads) valid.
alter table public.rfe_uploads
  add column if not exists kind text not null default 'rfe'
    check (kind in ('rfe', 'noid')),
  add column if not exists notice_date date,
  add column if not exists response_window_days integer
    check (response_window_days is null or response_window_days > 0);

-- NVC: which embassy post, which CEAC step, when DQ happened,
-- when the interview is. Post code is validated in the app by
-- lookupNvcPost (lib/nvc.ts) — BGT is Bogotá, BOG is not.
alter table public.nvc_trackers
  add column if not exists embassy_post_code text
    check (embassy_post_code is null or embassy_post_code ~ '^[A-Z]{3}$'),
  add column if not exists ceac_step text,
  add column if not exists dq_at date,
  add column if not exists interview_at date;

-- Cases: immigrant fee + entry. The fee is $235 (locked value in
-- lib/lifecycle.ts Stage 6 + lib/nvc.ts); the amount is NOT stored
-- here — only whether it was paid and when — so a future fee change
-- cannot make stored rows wrong.
alter table public.cases
  add column if not exists embassy_post_code text
    check (embassy_post_code is null or embassy_post_code ~ '^[A-Z]{3}$'),
  add column if not exists immigrant_fee_paid boolean not null default false,
  add column if not exists immigrant_fee_paid_at date,
  add column if not exists us_entry_at date;

create index if not exists rfe_uploads_case_kind_idx
  on public.rfe_uploads (case_id, kind);
