-- ============================================================================
-- ITFW Live — Supabase migration 0026: daily check-ins (daily home)
-- Run AFTER 0025 (full run order 0001 -> 0026). Do NOT run live until the
-- founder / browser task says so.
--
-- WHY THIS MIGRATION EXISTS (founder addition, Nov 28, 2026 —
-- completeness sweep / daily home screen): the "Today" screen is where
-- a client lands every day, and a daily check-in ("I checked my case
-- today") with a streak is the honest mechanic that brings them back.
-- A streak is computed from STORED ROWS ONLY (computeStreak,
-- portal/src/lib/dailyHome.ts) — no check-in row, no streak.
--
-- WHAT THIS CREATES — one table only:
--   * public.daily_checkins — one row per account + calendar day
--     (+ case, when the check-in is for a specific case).
--
-- WHAT IS NEVER STORED:
--   * No SSN, A-Number, passport number, DOB, or any case detail —
--     only account id, case id, and the calendar date.
--   * No note / free text (nothing to leak, nothing to moderate).
--
-- UNIQUENESS: unique index on (account_id, checked_date, case_id)
-- NULLS NOT DISTINCT, so one check-in per account per day per case —
-- and a general (no-case) check-in can only happen once a day too.
-- The API route upserts on that conflict target, so a second tap the
-- same day returns { already: true } instead of a duplicate row.
--
-- RLS: participant-only, following 0001/0005 — a client sees and
-- inserts only their own rows; founder/admin may read (0003 §7a).
-- No keys, no passwords, no seed rows. Nothing here sends email,
-- charges Stripe, or files anything with USCIS.
-- ============================================================================

create table if not exists public.daily_checkins (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  case_id uuid references public.cases(id) on delete cascade,
  checked_date date not null,
  created_at timestamptz not null default now()
);

-- One check-in per account + day (+ case). NULLS NOT DISTINCT so a
-- NULL case_id still conflicts with another NULL case_id the same day.
create unique index if not exists daily_checkins_one_per_day_idx
  on public.daily_checkins (account_id, checked_date, case_id)
  nulls not distinct;

create index if not exists daily_checkins_account_idx
  on public.daily_checkins (account_id, checked_date desc);

comment on table public.daily_checkins is
  'Daily check-ins for the Today screen. One row per account + calendar day (+ case, when given). The streak on /today is computed from these rows only — no row, no streak. Stores no identifiers, no notes, no case detail.';

-- Row Level Security — own rows only.
alter table public.daily_checkins enable row level security;

drop policy if exists daily_checkins_select on public.daily_checkins;
create policy daily_checkins_select on public.daily_checkins for select
  using (account_id = public.current_account_id());

drop policy if exists daily_checkins_insert on public.daily_checkins;
create policy daily_checkins_insert on public.daily_checkins for insert
  with check (account_id = public.current_account_id());

-- No update/delete policy for clients: check-ins are append-only
-- history. Founder/admin read (0003 §7a pattern).
drop policy if exists select_founder_admin_daily_checkins on public.daily_checkins;
create policy select_founder_admin_daily_checkins on public.daily_checkins for select
  using (public.current_account_role() in ('admin', 'founder'));

-- ============================================================================
-- END OF 0026 — next: run in the SQL Editor only after 0024 is confirmed
-- live. Nothing here sends email, charges Stripe, or files anything
-- with USCIS.
-- ============================================================================
