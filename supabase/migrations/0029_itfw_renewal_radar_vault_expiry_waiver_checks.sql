-- ============================================================================
-- ITFW Live — Supabase migration 0029: renewal radar + vault expiry +
-- fee-waiver checks (founder expert features, Nov 28, 2026).
-- Run AFTER 0028 (full run order 0001 -> 0029). Do NOT run live until the
-- founder / browser task says so.
--
-- WHY THIS MIGRATION EXISTS: the founder asked what an immigration
-- expert would add to a platform that services clients, and for all
-- of it to live INSIDE the dashboards. Three of the four additions
-- need a column or a table the schema does not have yet:
--
-- 1. RENEWAL & EXPIRY RADAR — case_renewals (0014, widened 0017)
--    tracks green card / EAD / TPS / passport / N-400 only. This file
--    widens the renewal_type CHECK with the two missing kinds:
--      'advance_parole' — advance parole / travel document renewal
--        (Form I-131, 180-day window)
--      'visa'           — visa expiry (180-day window; no USCIS
--        renewal form — the radar says to check with the preparer)
--    The 180/90/30/7-day reminder ladder itself is DERIVED in
--    portal/src/lib/renewals.ts (renewalReminderRungs) — no new
--    column: the ladder is computed from eligibility_or_expiry_date,
--    and due reminders queue into the existing reminder_nudges table
--    (0005, 48h repeat) and send via AWS SES (portal/src/lib/email.ts).
--    Until SES is connected the API answers 501 and nothing is sent.
--
-- 2. DOCUMENT VAULT EXPIRY TRACKING — public.documents (0001) has no
--    expiry date column (only ocr_expiry_warning). This file adds:
--      expires_on  date — the expiry date recorded from the document
--        itself (passport) or the exam / clearance paperwork
--        (medical exam, police clearance). NULL = no date on file.
--      expiry_kind text — 'passport' | 'medical_exam' |
--        'police_clearance' | 'birth_certificate_translation' |
--        'other'. Birth certificate translations DO NOT EXPIRE —
--        the vault lib (portal/src/lib/vaultExpiry.ts) always
--        reports them as never_expires.
--      expiry_note text — free text about the date's source (never
--        a document number, A-Number, SSN, or passport number).
--    No new RLS policy is needed: the 0001 documents policies already
--    govern the table, and these columns carry no new access.
--
-- 3. FEE WAIVER CHECKER (I-912) — a guided check result per case, so
--    professionals see each client's result in the pipeline
--    (portal/src/components/dashboard/FeeWaiverCheckerSection.tsx).
--    New table public.fee_waiver_checks. WHAT IS NEVER STORED:
--      * The household income figure the client typed — the check
--        compares it in memory and stores only the 150% threshold
--        it was compared against. No income amount is ever stored.
--      * No DOB, A-Number, SSN, or passport number.
--    result is one of 'may_qualify' | 'no_ground_indicated' |
--    'cannot_tell'. There is deliberately NO 'qualified' value: this
--    platform NEVER decides eligibility — only USCIS decides, and
--    the UI always says "You may qualify — an attorney/DOJ rep
--    should confirm."
--
-- WHAT IS NOT CREATED HERE:
--   * No total-cost table: the estimator reads the locked prices
--     already in the codebase (portal/src/lib/totalCostEstimator.ts).
--   * No seed rows. No keys, no passwords. Nothing here sends email,
--     charges Stripe, or files anything with USCIS.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Renewal types — widen case_renewals CHECK with advance_parole
--    and visa. Same drop-by-lookup pattern as 0017, so this file does
--    not depend on the constraint name.
-- ---------------------------------------------------------------------------
do $$
declare
  c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.case_renewals'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%renewal_type%'
  loop
    execute 'alter table public.case_renewals drop constraint ' || quote_ident(c.conname);
  end loop;
end $$;

alter table public.case_renewals
  add constraint case_renewals_renewal_type_check
    check (renewal_type in (
      'ead', 'green_card', 'n400', 'i90', 'i751',
      'conditional_green_card', 'tps', 'passport',
      'advance_parole', 'visa'
    ));

comment on constraint case_renewals_renewal_type_check on public.case_renewals is
  'Renewal kinds the radar tracks (0017 set + 0029 advance_parole / visa). The 180/90/30/7-day reminder ladder is derived in portal/src/lib/renewals.ts from eligibility_or_expiry_date — no ladder column exists.';

-- ---------------------------------------------------------------------------
-- 2. Vault expiry — columns on public.documents (0001).
-- ---------------------------------------------------------------------------
alter table public.documents
  add column if not exists expires_on date,
  add column if not exists expiry_kind text
    check (expiry_kind in (
      'passport', 'medical_exam', 'police_clearance',
      'birth_certificate_translation', 'other'
    )),
  add column if not exists expiry_note text;

comment on column public.documents.expires_on is
  'Expiry date recorded from the document itself (passport) or the exam / clearance paperwork (medical exam, police clearance). NULL = no date on file — never guessed. Birth certificate translations do not expire.';
comment on column public.documents.expiry_kind is
  'Which kind of document this expiry belongs to. birth_certificate_translation never expires (see portal/src/lib/vaultExpiry.ts).';
comment on column public.documents.expiry_note is
  'Free text about the expiry date source. Never a document number, A-Number, SSN, or passport number.';

create index if not exists documents_expires_on_idx
  on public.documents (case_id, expires_on)
  where expires_on is not null;

-- ---------------------------------------------------------------------------
-- 3. Fee-waiver checks — one row per guided I-912 check, per case.
-- ---------------------------------------------------------------------------
create table if not exists public.fee_waiver_checks (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  checked_by uuid not null references public.accounts(id),
  household_size integer not null check (household_size >= 1),
  region text not null check (region in ('contiguous', 'alaska', 'hawaii')),
  grounds text[] not null default '{}',
  result text not null check (result in ('may_qualify', 'no_ground_indicated', 'cannot_tell')),
  threshold_150_cents integer not null check (threshold_150_cents >= 0),
  created_at timestamptz not null default now()
);

comment on table public.fee_waiver_checks is
  'Guided Form I-912 fee-waiver check results, one row per check. NEVER stores the household income figure — only the 150% threshold it was compared against. result is never "qualified": only USCIS decides eligibility. Stores no DOB, A-Number, SSN, or passport number.';

create index if not exists fee_waiver_checks_case_idx
  on public.fee_waiver_checks (case_id, created_at desc);

-- Row Level Security — participants on the case only, following
-- 0001/0005: a client sees their own case's checks; the assigned
-- provider sees them too; a provider may insert a check for a case
-- they are assigned to. Founder/admin read is covered by 0003 §7a
-- (public.current_account_id / is_founder_or_admin pattern used by
-- the other case tables).
alter table public.fee_waiver_checks enable row level security;

drop policy if exists fee_waiver_checks_select on public.fee_waiver_checks;
create policy fee_waiver_checks_select on public.fee_waiver_checks for select
  using (
    exists (
      select 1 from public.cases c
      where c.id = fee_waiver_checks.case_id
        and (
          c.client_id = public.current_account_id()
          or c.assigned_provider_id = public.current_account_id()
        )
    )
  );

drop policy if exists fee_waiver_checks_insert_provider on public.fee_waiver_checks;
create policy fee_waiver_checks_insert_provider on public.fee_waiver_checks for insert
  with check (
    checked_by = public.current_account_id()
    and exists (
      select 1 from public.cases c
      where c.id = fee_waiver_checks.case_id
        and (
          c.client_id = public.current_account_id()
          or c.assigned_provider_id = public.current_account_id()
        )
    )
  );
