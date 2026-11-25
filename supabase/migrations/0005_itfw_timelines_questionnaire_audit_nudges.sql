-- ============================================================================
-- ITFW Live — Supabase migration 0005: timelines, questionnaire, audit,
-- nudges, co-sponsor invites
-- Project: "Immigration" — https://jdxjskqdvwqarfhcqjlg.supabase.co
-- Run AFTER 0004. Do NOT run live until the founder / browser task says so.
--  * address_history / employment_history: 5-year timelines. DB enforces
--    valid dates and no overlapping entries for the same case+kind;
--    CONTIGUITY (no gaps) is enforced on submit by the client validator
--    (portal src/lib/validator.ts) and by timeline_gaps() below, because
--    save-and-resume drafts are legitimately incomplete.
--  * questionnaire_responses + form_field_mappings: answers stored in the
--    original language + the mapped English value for the USCIS form.
--  * packet_audit_items: pre-filing audit rows; filing is ready only when
--    every blocking item is cleared (see portal src/lib/audit.ts).
--  * reminder_nudges: 48h SMS/WhatsApp nudge queue. LOGIC ONLY — Twilio
--    is NOT connected, so no message is actually sent by SQL.
--  * family_invites (0002) gains form_code + scope so a co-sponsor invite
--    can be scoped to I-864 and to vault uploads only.
-- No seed client rows, no keys, no passwords. Mapping rows are form
-- metadata (public USCIS field names), not client data.
-- ============================================================================

create table public.address_history (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  client_id uuid not null references public.accounts(id),
  label text not null,
  start_date date not null,
  end_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint address_history_dates check (end_date is null or end_date >= start_date)
);
create table public.employment_history (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  client_id uuid not null references public.accounts(id),
  label text not null,
  start_date date not null,
  end_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employment_history_dates check (end_date is null or end_date >= start_date)
);
-- No overlapping entries for the same case + kind (Postgres exclusion
-- needs btree_gist; use a plain guard function instead — overlap is
-- also checked by the client validator on submit).
create or replace function public.timeline_has_overlap(
  p_case_id uuid, p_kind text, p_start date, p_end date, p_exclude uuid default null)
returns boolean language sql stable as $$
  select exists (
    select 1 from public.address_history h
    where p_kind = 'address' and h.case_id = p_case_id
      and (p_exclude is null or h.id <> p_exclude)
      and h.start_date <= coalesce(p_end, current_date)
      and coalesce(h.end_date, current_date) >= p_start
    union all
    select 1 from public.employment_history h
    where p_kind = 'employment' and h.case_id = p_case_id
      and (p_exclude is null or h.id <> p_exclude)
      and h.start_date <= coalesce(p_end, current_date)
      and coalesce(h.end_date, current_date) >= p_start
  );
$$;

-- List gaps in a 5-year timeline (address or employment) for a case.
-- Returns one row per gap; zero rows = contiguous (submittable).
create or replace function public.timeline_gaps(
  p_case_id uuid, p_kind text, p_as_of date default current_date)
returns table (gap_start date, gap_end date) language sql stable as $$
  with bounds as (
    select (p_as_of - interval '5 years')::date as win_start, p_as_of as win_end
  ),
  rows as (
    select start_date, coalesce(end_date, p_as_of) as end_date
    from public.address_history
    where p_kind = 'address' and case_id = p_case_id
    union all
    select start_date, coalesce(end_date, p_as_of) as end_date
    from public.employment_history
    where p_kind = 'employment' and case_id = p_case_id
  ),
  ordered as (
    select start_date, end_date,
      lag(end_date) over (order by start_date) as prev_end
    from rows
  ),
  gaps_between as (
    select greatest(win_start, coalesce(prev_end + 1, win_start))::date as gap_start,
           (start_date - 1)::date as gap_end
    from ordered, bounds
    where start_date > coalesce(prev_end + 1, win_start)
  ),
  final_gap as (
    select greatest(win_start, coalesce((select max(end_date) from rows), win_start - 1) + 1)::date as gap_start,
           win_end as gap_end
    from bounds
    where coalesce((select max(end_date) from rows), win_start - 1) < win_end
  )
  select gap_start, gap_end from gaps_between
  union all
  select gap_start, gap_end from final_gap;
$$;

create table public.questionnaire_responses (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  client_id uuid not null references public.accounts(id),
  question_key text not null,
  original_language preferred_language not null default 'en',
  original_value text not null,
  mapped_english_value text not null,
  form_code text not null,
  field_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.form_field_mappings (
  id uuid primary key default gen_random_uuid(),
  question_key text not null unique,
  form_code text not null,
  field_name text not null,
  created_at timestamptz not null default now()
);
insert into public.form_field_mappings (question_key, form_code, field_name) values
  ('petitioner_full_name', 'I-130', 'Part 1, Item 1 — Petitioner''s full legal name'),
  ('beneficiary_full_name', 'I-130', 'Part 2, Item 1 — Beneficiary''s full legal name'),
  ('petitioner_address_history_5y', 'I-130', 'Part 1 — Address history (last 5 years)'),
  ('marriage_date_place', 'I-130', 'Part 2 — Date and place of marriage'),
  ('beneficiary_passport_number', 'I-130', 'Part 2 — Beneficiary passport number')
on conflict (question_key) do nothing;

create table public.packet_audit_items (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  rule text not null check (rule in (
    'missing_signature', 'expired_passport', 'untranslated_foreign_document',
    'missing_document', 'incomplete_form_section')),
  label text not null,
  weight integer not null default 0 check (weight >= 0),
  status text not null default 'fail' check (status in ('pass', 'fail', 'warning')),
  blocking boolean not null default true,
  detail text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.reminder_nudges (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  client_id uuid not null references public.accounts(id),
  action_item_id text not null,
  channel text not null check (channel in ('sms', 'whatsapp')),
  interval_hours integer not null default 48 check (interval_hours > 0),
  next_due_at timestamptz not null,
  last_sent_at timestamptz,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'sent', 'stopped_cleared', 'stopped_opted_out')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index reminder_nudges_due_idx
  on public.reminder_nudges (next_due_at) where status = 'scheduled';

-- Co-sponsor invites: scope the existing family_invites table (0002).
alter table public.family_invites
  add column if not exists form_code text,
  add column if not exists scope jsonb not null default '{"vault_upload_only": true}'::jsonb;

alter table public.address_history enable row level security;
alter table public.employment_history enable row level security;
alter table public.questionnaire_responses enable row level security;
alter table public.form_field_mappings enable row level security;
alter table public.packet_audit_items enable row level security;
alter table public.reminder_nudges enable row level security;

-- Participant-only, following the 0001/0003 pattern.
create policy address_history_select on public.address_history for select
  using (public.is_case_participant(case_id));
create policy address_history_insert on public.address_history for insert
  with check (public.is_case_participant(case_id)
    and client_id = public.current_account_id());
create policy address_history_update on public.address_history for update
  using (public.is_case_participant(case_id));

create policy employment_history_select on public.employment_history for select
  using (public.is_case_participant(case_id));
create policy employment_history_insert on public.employment_history for insert
  with check (public.is_case_participant(case_id)
    and client_id = public.current_account_id());
create policy employment_history_update on public.employment_history for update
  using (public.is_case_participant(case_id));

create policy questionnaire_responses_select on public.questionnaire_responses for select
  using (public.is_case_participant(case_id));
create policy questionnaire_responses_insert on public.questionnaire_responses for insert
  with check (public.is_case_participant(case_id)
    and client_id = public.current_account_id());

-- Field mappings are public form metadata: any signed-in user may read.
create policy form_field_mappings_select on public.form_field_mappings for select
  using (auth.uid() is not null);

create policy packet_audit_items_select on public.packet_audit_items for select
  using (public.is_case_participant(case_id));
create policy packet_audit_items_insert on public.packet_audit_items for insert
  with check (public.is_case_participant(case_id));

create policy reminder_nudges_select on public.reminder_nudges for select
  using (public.is_case_participant(case_id)
    or public.current_account_role() in ('admin', 'founder'));
create policy reminder_nudges_insert on public.reminder_nudges for insert
  with check (public.is_case_participant(case_id));

-- Founder/admin read on the new case-scoped tables (0003 §7a pattern).
do $$
declare
  t text;
begin
  foreach t in array array[
    'address_history', 'employment_history', 'questionnaire_responses',
    'packet_audit_items', 'reminder_nudges'
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

drop trigger if exists set_updated_at_address_history on public.address_history;
create trigger set_updated_at_address_history before update on public.address_history
  for each row execute function public.set_updated_at();
drop trigger if exists set_updated_at_employment_history on public.employment_history;
create trigger set_updated_at_employment_history before update on public.employment_history
  for each row execute function public.set_updated_at();
drop trigger if exists set_updated_at_questionnaire_responses on public.questionnaire_responses;
create trigger set_updated_at_questionnaire_responses before update on public.questionnaire_responses
  for each row execute function public.set_updated_at();
drop trigger if exists set_updated_at_packet_audit_items on public.packet_audit_items;
create trigger set_updated_at_packet_audit_items before update on public.packet_audit_items
  for each row execute function public.set_updated_at();
drop trigger if exists set_updated_at_reminder_nudges on public.reminder_nudges;
create trigger set_updated_at_reminder_nudges before update on public.reminder_nudges
  for each row execute function public.set_updated_at();

-- ============================================================================
-- END OF 0005 — next: run 0004 then 0005 in the SQL Editor only after
-- 0003 is confirmed live; then vault bucket, Email auth, Google provider,
-- isolation check. Nothing here sends SMS, charges Stripe, or looks up
-- USCIS — those need Twilio / Stripe / USCIS Production + a worker.
-- ============================================================================
