-- ============================================================================
-- ITFW Live — Supabase migration 0009: agency numbers, family members,
-- payment arrangements, A-Number column
-- Project: "Immigration" — https://jdxjskqdvwqarfhcqjlg.supabase.co
-- Run AFTER 0008. Do NOT run live until the founder / browser task says so.
--
-- CORRECTIONS APPLIED (do not re-introduce the pasted drafts):
--  * The pasted SQL used users(id) — WRONG. This project uses
--    public.accounts(id) everywhere (0001).
--  * accounts ALREADY has phone + preferred_language (7-language enum)
--    in 0001 — no duplicate columns are added. Only the genuinely
--    missing A-Number column is added (sensitive: mask in the UI as
--    A-***-***-123, never show in full in lists, never log it).
--  * REUSE, do not duplicate trackers: case_watch (0001) already tracks
--    USCIS receipt numbers + milestones; nvc_trackers (0002) already
--    stores NVC case/invoice IDs (encrypted by the API layer); rfe_uploads
--    (0002) already holds RFE deadlines. case_agency_numbers is the
--    PREPARER HUB view of those numbers in one place — one row per
--    agency+form/stage, with a plain-English "missing from agency"
--    note and visibility flags — it does not replace case_watch /
--    nvc_trackers / rfe_uploads.
--  * REUSE, do not duplicate invites: family_invites (0002, extended
--    in 0005/0006) is the invite system. case_family_members is the
--    per-person access record linked to it (invite_id FK), with
--    scoped permissions (can_view_status / can_upload_docs /
--    can_view_invoices default false).
--  * REUSE, do not duplicate payments: payment_plans (0002, enforced
--    in 0003) is the payment-plan record and order_invoices (0006)
--    are the milestone invoice slices. payment_arrangements is the
--    auto-draft SCHEDULE (one row per scheduled draft) whose amounts
--    sum to the order total; it mirrors order_invoices, it does not
--    create a second total.
-- Money is integer cents everywhere. No seed rows, no keys, no passwords.
-- NVC has NO API — CEAC is manual (link out, never store a CEAC password).
-- USCIS live status needs the Production key + worker — not built.
-- ============================================================================

-- A-Number (sensitive — mask in UI, never log, never show in full in lists).
alter table public.accounts
  add column if not exists alien_registration_number text;

create table public.case_agency_numbers (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  agency text not null check (agency in ('USCIS', 'NVC', 'EOIR', 'DOL')),
  form_or_stage text not null,
  case_number text not null,
  nvc_invoice_id text,
  agency_status text,
  missing_from_agency text,
  agency_deadline date,
  visible_to_client boolean not null default true,
  visible_to_family boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index case_agency_numbers_case_idx
  on public.case_agency_numbers (case_id, agency);

create table public.case_family_members (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  invite_id uuid references public.family_invites(id) on delete set null,
  full_name text not null,
  relationship text not null check (relationship in (
    'Spouse', 'Beneficiary', 'Petitioner', 'Joint Sponsor', 'Child')),
  email citext,
  phone text,
  can_view_status boolean not null default true,
  can_upload_docs boolean not null default false,
  can_view_invoices boolean not null default false,
  invite_token text not null unique,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index case_family_members_case_idx on public.case_family_members (case_id);

create table public.payment_arrangements (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.service_orders(id) on delete cascade,
  installment_number integer not null check (installment_number > 0),
  due_date date not null,
  amount_cents integer not null check (amount_cents >= 0),
  status text not null default 'scheduled'
    check (status in ('scheduled', 'paid', 'overdue')),
  stripe_payment_link text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id, installment_number)
);
create index payment_arrangements_order_idx on public.payment_arrangements (order_id, due_date);

alter table public.case_agency_numbers enable row level security;
alter table public.case_family_members enable row level security;
alter table public.payment_arrangements enable row level security;

-- Participant-only, following the 0001/0003 pattern.
create policy case_agency_numbers_select on public.case_agency_numbers for select
  using (public.is_case_participant(case_id));
create policy case_agency_numbers_insert on public.case_agency_numbers for insert
  with check (public.is_case_participant(case_id));
create policy case_agency_numbers_update on public.case_agency_numbers for update
  using (public.is_case_participant(case_id));

create policy case_family_members_select on public.case_family_members for select
  using (public.is_case_participant(case_id));
create policy case_family_members_insert on public.case_family_members for insert
  with check (public.is_case_participant(case_id));
create policy case_family_members_update on public.case_family_members for update
  using (public.is_case_participant(case_id));

create policy payment_arrangements_select on public.payment_arrangements for select
  using (exists (select 1 from public.service_orders o
                 where o.id = order_id and public.is_case_participant(o.case_id)));
create policy payment_arrangements_insert on public.payment_arrangements for insert
  with check (exists (select 1 from public.service_orders o
                      where o.id = order_id and public.is_case_participant(o.case_id)));

-- Founder/admin read on the new case-scoped tables (0003 section 7a pattern).
do $$
declare
  t text;
begin
  foreach t in array array[
    'case_agency_numbers', 'case_family_members', 'payment_arrangements'
  ] loop
    execute format(
      'drop policy if exists %I on public.%I',
      'select_founder_admin_' || t, t);
    execute format(
      'create policy %I on public.%I for select using '
      '(public.current_account_role() in (''admin'', ''founder''))',
      'select_founder_admin_' || t, t);
  end loop;
end $$;

drop trigger if exists set_updated_at_case_agency_numbers on public.case_agency_numbers;
create trigger set_updated_at_case_agency_numbers before update on public.case_agency_numbers
  for each row execute function public.set_updated_at();
drop trigger if exists set_updated_at_case_family_members on public.case_family_members;
create trigger set_updated_at_case_family_members before update on public.case_family_members
  for each row execute function public.set_updated_at();
drop trigger if exists set_updated_at_payment_arrangements on public.payment_arrangements;
create trigger set_updated_at_payment_arrangements before update on public.payment_arrangements
  for each row execute function public.set_updated_at();

-- ============================================================================
-- END OF 0009 — run 0004 -> 0009 in the SQL Editor only after 0003 is
-- confirmed live AND 0008 has run (0008 fixes the RLS recursion the
-- isolation check found). Re-run the isolation check after 0008 before
-- any real client document is stored.
-- ============================================================================
