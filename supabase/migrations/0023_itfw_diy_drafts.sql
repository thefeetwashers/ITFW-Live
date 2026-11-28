-- ============================================================================
-- ITFW Live — Supabase migration 0023: DIY drafts (save-and-resume)
-- Run AFTER 0022 (full run order 0001 -> 0023). Do NOT run live until the
-- founder / browser task says so.
--
-- WHY THIS MIGRATION EXISTS (founder addition, Nov 28, 2026 — save and
-- come back later): a client answering guided DIY questions must be
-- able to leave mid-form and return later to the EXACT question they
-- left off, on any device. The browser alone cannot do that — answers
-- must live in the database, per account + case + form, with the
-- resume position (section index + question index + field name)
-- stored alongside the answers.
--
-- NUMBERING NOTE: this file is 0023. The durable DIY payment
-- record lives in 0024_itfw_diy_unlocks.sql (the DIY builder moved
-- it there from 0022 while this build was in progress); 0022 is
-- 0022_itfw_family_login. This file creates ONLY diy_drafts and
-- does NOT re-create diy_unlocks.
--
-- WHAT ALREADY EXISTED (and why a new table is still needed):
--   * public.questionnaire_responses (0005) stores one row per
--     question, with no resume position and no draft status. It is
--     the engine's save target (portal
--     src/components/DynamicFormIntakeEngine.tsx saveAnswers) and
--     stays that way — this migration does NOT change it.
--   * src/lib/diyDrafts.ts (extras builder) wrote the pure sanitize /
--     summarize logic for a `diy_drafts` table, and
--     src/app/api/diy/drafts/route.ts (same builder) already serves
--     it — but the table never existed and the route was
--     accountId-based with no caller auth, no case_id and no resume
--     position. This migration creates the table in the shape the
--     EXTENDED route needs (case-scoped, resume position, server-
--     decided status); the route was extended in the same build.
--
-- WHAT IS NEVER STORED:
--   * NO SSN column anywhere. SSNs are never stored, in any table.
--   * diy_drafts.answers NEVER holds an SSN, A-Number, passport
--     number or green-card number. The rule is enforced in THREE
--     places: (1) src/lib/diyDrafts.ts sanitizeDraftAnswers() strips
--     those keys in code, (2) POST /api/diy/drafts sanitizes again
--     before saving, (3) the trigger below REJECTS any insert/update
--     whose answer keys match a sensitive pattern — the database is
--     the backstop. A client re-enters those numbers on the official
--     form itself; the draft never holds them.
--   * DOB IS stored (it is already held in accounts.date_of_birth,
--     migration 0001, and is needed to resume). It is masked in list
--     views, never logged, and never put in an email subject.
--
-- No keys, no passwords, no seed client rows.
-- ============================================================================

create table if not exists public.diy_drafts (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  case_id uuid not null references public.cases(id) on delete cascade,
  form_code text not null,
  -- Sanitized answers: flat map question_key -> form-ready value
  -- (mapped English, or the original where no mapping exists).
  -- Sensitive-identifier keys are rejected by the trigger below.
  answers jsonb not null default '{}'::jsonb,
  -- Resume position: the exact question the client left off.
  current_section_index integer not null default 0 check (current_section_index >= 0),
  current_question_index integer not null default 0 check (current_question_index >= 0),
  current_field_name text,
  -- Server-decided (POST /api/diy/drafts computes completion itself
  -- and never trusts a status claimed by the client):
  -- in_progress = still answering; completed = every required
  -- non-sensitive question answered; transferred = answers were
  -- transferred into the immigration form via /api/diy/transfer.
  status text not null default 'in_progress'
    check (status in ('in_progress', 'completed', 'transferred')),
  completed_at timestamptz,
  transferred_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint diy_drafts_one_per_case_form unique (account_id, case_id, form_code)
);

create index if not exists diy_drafts_account_idx on public.diy_drafts (account_id);
create index if not exists diy_drafts_case_idx on public.diy_drafts (case_id);

comment on table public.diy_drafts is
  'Guided DIY save-and-resume drafts. One row per account + case + form. answers holds sanitized (non-sensitive) answers only — SSNs, A-Numbers, passport and green-card numbers are rejected by the diy_drafts_no_sensitive_keys trigger. current_section_index / current_question_index / current_field_name record the exact question the client left off. A draft is NOT a filing: saving files nothing with USCIS.';
comment on column public.diy_drafts.answers is
  'Flat map question_key -> form-ready value (mapped English where it exists, otherwise the original). Sensitive-identifier keys (ssn, social_security, a_number, alien_number, passport, green_card) are rejected by trigger. DOB may be stored — it is already held in accounts.date_of_birth (0001).';
comment on column public.diy_drafts.status is
  'in_progress = still answering; completed = every required non-sensitive question answered (set server-side by /api/diy/drafts after its own completion check — never trusted from the client); transferred = answers were transferred into the immigration form via /api/diy/transfer.';

-- Backstop: reject any draft whose answer KEYS mention a sensitive
-- identifier. Matched against the KEY only, never the value, so an
-- answer whose VALUE mentions "passport" is not rejected.
create or replace function public.diy_drafts_reject_sensitive_keys()
returns trigger language plpgsql as $$
declare
  k text;
begin
  if new.answers is null then
    return new;
  end if;
  for k in select jsonb_object_keys(new.answers) loop
    if lower(k) like '%ssn%'
      or lower(k) like '%social_security%'
      or lower(k) like '%a_number%'
      or lower(k) like '%a-number%'
      or lower(k) like '%alien_number%'
      or lower(k) like '%passport%'
      or lower(k) like '%green_card%'
      or lower(k) like '%greencard%' then
      raise exception 'diy_drafts.answers key "%" is a sensitive identifier and must never be stored in a draft. Re-enter it on the official form itself.', k;
    end if;
  end loop;
  return new;
end;
$$;

drop trigger if exists diy_drafts_no_sensitive_keys on public.diy_drafts;
create trigger diy_drafts_no_sensitive_keys
  before insert or update on public.diy_drafts
  for each row execute function public.diy_drafts_reject_sensitive_keys();

drop trigger if exists set_updated_at_diy_drafts on public.diy_drafts;
create trigger set_updated_at_diy_drafts before update on public.diy_drafts
  for each row execute function public.set_updated_at();

-- Row Level Security — participant-only, following 0001/0005.
alter table public.diy_drafts enable row level security;

create policy diy_drafts_select on public.diy_drafts for select
  using (public.is_case_participant(case_id)
    and account_id = public.current_account_id());
create policy diy_drafts_insert on public.diy_drafts for insert
  with check (public.is_case_participant(case_id)
    and account_id = public.current_account_id());
create policy diy_drafts_update on public.diy_drafts for update
  using (public.is_case_participant(case_id)
    and account_id = public.current_account_id());
create policy diy_drafts_delete on public.diy_drafts for delete
  using (public.is_case_participant(case_id)
    and account_id = public.current_account_id());

-- Founder/admin read (0003 §7a pattern).
drop policy if exists select_founder_admin_diy_drafts on public.diy_drafts;
create policy select_founder_admin_diy_drafts on public.diy_drafts for select
  using (public.current_account_role() in ('admin', 'founder'));

-- ============================================================================
-- END OF 0023 — next: run in the SQL Editor only after 0022 is confirmed
-- live. Nothing here sends email, charges Stripe, or files anything
-- with USCIS.
-- ============================================================================
