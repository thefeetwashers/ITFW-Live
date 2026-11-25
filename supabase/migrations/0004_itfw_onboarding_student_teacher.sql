-- ============================================================================
-- ITFW Live — Supabase migration 0004: onboarding + student / teacher
-- Project: "Immigration" — https://jdxjskqdvwqarfhcqjlg.supabase.co
-- Run AFTER 0003. Do NOT run live until the founder / browser task says so.
-- Adds: onboarding_status on accounts, student_profiles, teacher_profiles,
-- and case_student_assignments (supervised students only see cases a
-- verified attorney / DOJ rep explicitly assigned them).
-- A law student / teacher can NEVER be the assigned provider on a case
-- alone — migration 0003's validate_assigned_provider() trigger already
-- rejects preparer/attorney/nonprofit-only assignment, and nothing here
-- widens it.
-- No seed rows, no keys, no passwords.
-- ============================================================================

create type onboarding_status as enum
  ('role_selected', 'profile_completed', 'pending_verification', 'active');

alter table public.accounts
  add column if not exists onboarding_status onboarding_status
    not null default 'role_selected';

create type student_confirmation_status as enum
  ('pending', 'confirmed', 'rejected');

create table public.student_profiles (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null unique references public.accounts(id) on delete cascade,
  law_school text not null,
  year text not null check (year in ('1L', '2L', '3L')),
  school_id text not null,
  supervising_attorney_name text not null,
  supervising_attorney_bar_number text,
  clinic_name text,
  teacher_name text,
  teacher_email citext not null,
  confirmation_status student_confirmation_status not null default 'pending',
  confirmed_at timestamptz,
  confirmed_by uuid references public.accounts(id),
  subscription_plan subscription_plan not null default 'law_student_35',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.teacher_profiles (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null unique references public.accounts(id) on delete cascade,
  school_name text not null,
  clinic_name text,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A supervised student sees a case ONLY through an explicit assignment
-- made by the case's verified attorney / DOJ provider.
create table public.case_student_assignments (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  student_id uuid not null references public.accounts(id) on delete cascade,
  assigned_by uuid not null references public.accounts(id),
  supervisor_name text,
  created_at timestamptz not null default now(),
  unique (case_id, student_id)
);
create index case_student_assignments_student_idx
  on public.case_student_assignments (student_id);

alter table public.student_profiles enable row level security;
alter table public.teacher_profiles enable row level security;
alter table public.case_student_assignments enable row level security;

-- Student: own row only. Founder/admin may read (verification queue).
create policy student_profiles_select_own on public.student_profiles for select
  using (account_id = public.current_account_id()
    or public.current_account_role() in ('admin', 'founder'));
create policy student_profiles_insert_own on public.student_profiles for insert
  with check (account_id = public.current_account_id());
create policy student_profiles_update_own on public.student_profiles for update
  using (account_id = public.current_account_id())
  with check (account_id = public.current_account_id());

-- Teacher: own row only. Founder/admin may read.
create policy teacher_profiles_select_own on public.teacher_profiles for select
  using (account_id = public.current_account_id()
    or public.current_account_role() in ('admin', 'founder'));
create policy teacher_profiles_insert_own on public.teacher_profiles for insert
  with check (account_id = public.current_account_id());
create policy teacher_profiles_update_own on public.teacher_profiles for update
  using (account_id = public.current_account_id())
  with check (account_id = public.current_account_id());

-- Assignments: the assigned student, the case participants, founder/admin.
create policy case_student_assignments_select on public.case_student_assignments for select
  using (student_id = public.current_account_id()
    or public.is_case_participant(case_id)
    or public.current_account_role() in ('admin', 'founder'));
create policy case_student_assignments_insert on public.case_student_assignments for insert
  with check (public.is_case_participant(case_id)
    and assigned_by = public.current_account_id());

-- updated_at triggers (same set_updated_at() from migration 0003).
drop trigger if exists set_updated_at_student_profiles on public.student_profiles;
create trigger set_updated_at_student_profiles before update on public.student_profiles
  for each row execute function public.set_updated_at();
drop trigger if exists set_updated_at_teacher_profiles on public.teacher_profiles;
create trigger set_updated_at_teacher_profiles before update on public.teacher_profiles
  for each row execute function public.set_updated_at();

-- ============================================================================
-- END OF 0004 — next: migration 0005 (timelines, questionnaire, audit,
-- nudges, co-sponsor invites). Run 0004 + 0005 in the SQL Editor only
-- after 0003 is confirmed live; report any error verbatim and stop.
-- ============================================================================
