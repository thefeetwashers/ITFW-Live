-- ============================================================================
-- ITFW Live — Supabase migration 0018: Visa Bulletin months/cutoffs +
-- USCIS template registry
-- Project: "Immigration" — https://jdxjskqdvwqarfhcqjlg.supabase.co
-- Run AFTER 0001–0017, in order (full run order 0001 -> 0020). Schema only — do NOT run live until the founder /
-- browser task says so. No seed rows, no keys, no passwords.
--
-- RENUMBERING NOTE (consolidation, Nov 19–20, 2026 — see DEPLOY.md):
-- this file was 0012 and is now 0018 (the duplicate 0012/0013/0016
-- files were renumbered/merged; run order is now strictly 0001 -> 0020
-- by filename). Nothing in 0009+ had run live, so no migration history
-- breaks. The tables are the ones the task named
-- (visa_bulletin_months + visa_bulletin_cutoffs), plus uscis_templates
-- (the registry the template upload + verification workflow records
-- into). If a later builder needs a new migration, they take the next
-- free number after 0020.
--
-- VISA BULLETIN:
--  * Cutoffs are ENTERED by a professional from the official Visa
--    Bulletin at travel.state.gov (see src/lib/visaBulletin.ts and
--    src/components/preparer/VisaBulletinManager.tsx). NOTHING here
--    seeds a cutoff date. A missing row means "no cutoff entered" —
--    the matcher says so and never guesses.
--  * "C" = is_current, "U" = is_unavailable, otherwise cutoff_date.
--    Exactly one of the three applies (enforced by CHECK).
--  * chargeability_country: WORLDWIDE = "All Chargeability Areas
--    Except Those Listed"; CHINA = mainland born; INDIA; MEXICO;
--    PHILIPPINES. Chargeability is country of BIRTH.
--  * chart_kind: 'dates_for_filing' (adjustment of status, per USCIS)
--    or 'final_action' (consular, per the Department of State).
--
-- USCIS TEMPLATES:
--  * One row per (form_code, edition) actually uploaded to the private
--    `vault` bucket at templates/<form-code>/<edition>.pdf.
--  * field_count / matched_field_count come from the field-check
--    (POST /api/templates/check) against the uploaded PDF only.
--  * verified stays false until a mapping is confirmed against the
--    real PDF for that edition; the app never flips it from a guess.
--    field_check stores the full check result (matched / unmatched /
--    unverified lists) as JSONB for audit.
--
-- RLS follows the 0001/0003/0010 pattern: participant + founder/admin
-- read via current_account_role() IN ('admin','founder'); professionals
-- (preparer/attorney/nonprofit) may read and insert their own uploads;
-- updates go through the app with the same role check. No anon access.
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1. visa_bulletin_months — one row per bulletin month entered.
-- --------------------------------------------------------------------------
create table public.visa_bulletin_months (
  id uuid primary key default gen_random_uuid(),
  bulletin_month text not null unique check (bulletin_month ~ '^[0-9]{4}-[0-9]{2}$'),
  source_url text not null,
  entered_by uuid references public.accounts(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- --------------------------------------------------------------------------
-- 2. visa_bulletin_cutoffs — one row per category x chargeability x chart.
-- --------------------------------------------------------------------------
create table public.visa_bulletin_cutoffs (
  id uuid primary key default gen_random_uuid(),
  bulletin_month_id uuid not null references public.visa_bulletin_months(id) on delete cascade,
  category text not null check (category in (
    'F1', 'F2A', 'F2B', 'F3', 'F4',
    'EB-1', 'EB-2', 'EB-3', 'EB-3 Other Workers', 'EB-4',
    'EB-5 Unreserved', 'EB-5 Rural', 'EB-5 High Unemployment',
    'EB-5 Infrastructure')),
  chargeability_country text not null check (chargeability_country in (
    'WORLDWIDE', 'CHINA', 'INDIA', 'MEXICO', 'PHILIPPINES')),
  chart_kind text not null check (chart_kind in ('dates_for_filing', 'final_action')),
  cutoff_date date,
  is_current boolean not null default false,
  is_unavailable boolean not null default false,
  source_url text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint visa_bulletin_cutoffs_one_state check (
    (is_current and not is_unavailable and cutoff_date is null)
    or (is_unavailable and not is_current and cutoff_date is null)
    or (not is_current and not is_unavailable and cutoff_date is not null)),
  unique (bulletin_month_id, category, chargeability_country, chart_kind)
);
create index visa_bulletin_cutoffs_month_idx
  on public.visa_bulletin_cutoffs (bulletin_month_id, chart_kind);

-- --------------------------------------------------------------------------
-- 3. uscis_templates — registry of official USCIS PDFs uploaded to vault.
-- --------------------------------------------------------------------------
create table public.uscis_templates (
  id uuid primary key default gen_random_uuid(),
  form_code text not null,
  edition text not null,
  source_url text not null,
  storage_path text not null unique,
  uploaded_by uuid references public.accounts(id) on delete set null,
  uploaded_at timestamptz not null default now(),
  field_count integer not null default 0 check (field_count >= 0),
  matched_field_count integer not null default 0 check (matched_field_count >= 0),
  verified boolean not null default false,
  field_check jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (form_code, edition),
  constraint uscis_templates_matched_within_total check (matched_field_count <= field_count)
);
create index uscis_templates_form_idx on public.uscis_templates (form_code);

-- --------------------------------------------------------------------------
-- 4. RLS.
-- --------------------------------------------------------------------------
alter table public.visa_bulletin_months enable row level security;
alter table public.visa_bulletin_cutoffs enable row level security;
alter table public.uscis_templates enable row level security;

-- Read: founder/admin + any verified professional role. Clients do NOT
-- read these tables directly; the client portal shows only the match
-- result for the client's own case, via the app layer.
create policy visa_bulletin_months_select on public.visa_bulletin_months for select
  using (public.current_account_role() in ('admin', 'founder', 'preparer', 'attorney', 'nonprofit'));
create policy visa_bulletin_cutoffs_select on public.visa_bulletin_cutoffs for select
  using (public.current_account_role() in ('admin', 'founder', 'preparer', 'attorney', 'nonprofit'));
create policy uscis_templates_select on public.uscis_templates for select
  using (public.current_account_role() in ('admin', 'founder', 'preparer', 'attorney', 'nonprofit'));

-- Insert/update: founder/admin + professionals (the uploader records
-- their own account id in entered_by / uploaded_by).
create policy visa_bulletin_months_insert on public.visa_bulletin_months for insert
  with check (public.current_account_role() in ('admin', 'founder', 'preparer', 'attorney', 'nonprofit'));
create policy visa_bulletin_months_update on public.visa_bulletin_months for update
  using (public.current_account_role() in ('admin', 'founder', 'preparer', 'attorney', 'nonprofit'));
create policy visa_bulletin_cutoffs_insert on public.visa_bulletin_cutoffs for insert
  with check (public.current_account_role() in ('admin', 'founder', 'preparer', 'attorney', 'nonprofit'));
create policy visa_bulletin_cutoffs_update on public.visa_bulletin_cutoffs for update
  using (public.current_account_role() in ('admin', 'founder', 'preparer', 'attorney', 'nonprofit'));
create policy uscis_templates_insert on public.uscis_templates for insert
  with check (public.current_account_role() in ('admin', 'founder', 'preparer', 'attorney', 'nonprofit'));
create policy uscis_templates_update on public.uscis_templates for update
  using (public.current_account_role() in ('admin', 'founder', 'preparer', 'attorney', 'nonprofit'));

-- --------------------------------------------------------------------------
-- 5. updated_at triggers (existing set_updated_at() from 0003).
-- --------------------------------------------------------------------------
drop trigger if exists set_updated_at_visa_bulletin_months on public.visa_bulletin_months;
create trigger set_updated_at_visa_bulletin_months before update on public.visa_bulletin_months
  for each row execute function public.set_updated_at();
drop trigger if exists set_updated_at_visa_bulletin_cutoffs on public.visa_bulletin_cutoffs;
create trigger set_updated_at_visa_bulletin_cutoffs before update on public.visa_bulletin_cutoffs
  for each row execute function public.set_updated_at();
drop trigger if exists set_updated_at_uscis_templates on public.uscis_templates;
create trigger set_updated_at_uscis_templates before update on public.uscis_templates
  for each row execute function public.set_updated_at();

-- ============================================================================
-- END OF 0018 — schema only. No seed rows, no cutoff dates, no templates.
-- Nothing here runs live, touches Supabase/Vercel/GitHub, or edits
-- migrations 0001–0017.
-- ============================================================================
