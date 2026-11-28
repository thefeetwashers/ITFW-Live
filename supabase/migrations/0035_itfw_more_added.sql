-- 0035 — "more added" storage: biometrics tracker, AR-11 helper,
-- document translation tracker (LAST ADDITION, Nov 28, 2026).
--
-- WHY: the "more added" build (portal/src/lib/moreAdded.ts) adds three
-- features whose values the portal computes but cannot store:
--   * Biometrics tracker — the backbone guide (lib/backbone.ts
--     BIOMETRICS_GUIDE) is static text; no table holds the appointment
--     date, ASC location, or outcome, so nothing can count days-until
--     or flag a missed appointment from a stored date.
--   * AR-11 helper — no table records a move date, the 10-day
--     deadline, or which address updates were done, so the helper
--     could only compute from a date typed on the day.
--   * Translation tracker — no table holds per-document page counts
--     or translation status, so the $45/page estimate had no record
--     behind it.
-- The payment plan dashboard needs NO new table: it reads the
-- payment_plans rows from 0002 + the locked splitter in lib/stripe.ts.
-- The emergency guide and the sponsor calculator need no storage:
-- the guide is fixed content and the calculator runs on numbers the
-- visitor types (nothing typed there is sent or saved).
--
-- All columns are NULLABLE where the value may legitimately be
-- unknown (notice-received date, rescheduled-from date, filed dates);
-- the platform NEVER files Form AR-11 — uscis_filed_at is a manual
-- confirmation the client filed it themself. No DOB, A-Number, SSN,
-- passport number, or full receipt number is stored here. Address
-- changes store city / state / ZIP only — never a full street
-- address. RLS follows the 0002/0006 case-scoped pattern:
-- is_case_participant(case_id) + founder/admin select.

-- --- Biometrics appointments ---------------------------------------------
create table if not exists public.biometrics_appointments (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  client_id uuid not null references public.accounts(id),
  -- Date on the I-797C notice, entered manually from the notice itself.
  appointment_date date not null,
  -- Application Support Center as printed on the notice (free text).
  asc_location text not null default '',
  -- Date the notice itself arrived; null = not recorded, never guessed.
  notice_received_at date,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'attended', 'missed', 'rescheduled')),
  -- Previous date when this appointment was rescheduled, if any.
  rescheduled_from_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists biometrics_appointments_case_idx
  on public.biometrics_appointments (case_id, appointment_date);
create index if not exists biometrics_appointments_status_idx
  on public.biometrics_appointments (status, appointment_date);

-- --- Address changes (AR-11 helper) ---------------------------------------
create table if not exists public.address_changes (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  client_id uuid not null references public.accounts(id),
  moved_at date not null,
  -- City / state / ZIP only — never a full street address.
  new_city text not null default '',
  new_state text not null default '',
  new_zip text not null default '',
  -- 10-day deadline computed in the app (lib/moreAdded.ts ar11Deadline);
  -- stored here so the record stays true even if the rule text changes.
  deadline date not null,
  -- Checklist state (see lib/moreAdded.ts AR11_CHECKLIST ids).
  uscis_ar11_done boolean not null default false,
  -- Manual confirmation the CLIENT filed AR-11 themself at uscis.gov.
  -- The platform never files it; null = not filed / not confirmed.
  uscis_filed_at date,
  nvc_ceac_done boolean not null default false,
  platform_profile_done boolean not null default false,
  preparer_told boolean not null default false,
  notices_checked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists address_changes_case_idx
  on public.address_changes (case_id, moved_at);

-- --- Document translations -------------------------------------------------
create table if not exists public.document_translations (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  client_id uuid not null references public.accounts(id),
  -- One of lib/moreAdded.ts TRANSLATION_DOCUMENT_TYPES ids
  -- (birth / marriage / divorce-death / police / other).
  document_type text not null
    check (document_type in ('birth', 'marriage', 'divorce-death', 'police', 'other')),
  -- Page count as entered; 0 = not counted yet, never guessed.
  pages integer not null default 0 check (pages >= 0),
  status text not null default 'needed'
    check (status in ('needed', 'in-progress', 'done', 'not-needed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (case_id, document_type)
);
create index if not exists document_translations_case_idx
  on public.document_translations (case_id, document_type);

-- --- RLS: case-scoped, same pattern as 0002/0006 ---------------------------
alter table public.biometrics_appointments enable row level security;
alter table public.address_changes enable row level security;
alter table public.document_translations enable row level security;

create policy biometrics_appointments_select on public.biometrics_appointments for select
  using (public.is_case_participant(case_id));
create policy biometrics_appointments_insert on public.biometrics_appointments for insert
  with check (public.is_case_participant(case_id)
    and client_id = public.current_account_id());
create policy biometrics_appointments_update on public.biometrics_appointments for update
  using (public.is_case_participant(case_id));

create policy address_changes_select on public.address_changes for select
  using (public.is_case_participant(case_id));
create policy address_changes_insert on public.address_changes for insert
  with check (public.is_case_participant(case_id)
    and client_id = public.current_account_id());
create policy address_changes_update on public.address_changes for update
  using (public.is_case_participant(case_id));

create policy document_translations_select on public.document_translations for select
  using (public.is_case_participant(case_id));
create policy document_translations_insert on public.document_translations for insert
  with check (public.is_case_participant(case_id)
    and client_id = public.current_account_id());
create policy document_translations_update on public.document_translations for update
  using (public.is_case_participant(case_id));

-- Founder/admin read on the new case-scoped tables (0006 pattern).
do $$
declare
  t text;
begin
  foreach t in array array[
    'biometrics_appointments', 'address_changes', 'document_translations'
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

-- --- updated_at triggers (0006 pattern) ------------------------------------
drop trigger if exists set_updated_at_biometrics_appointments on public.biometrics_appointments;
create trigger set_updated_at_biometrics_appointments before update on public.biometrics_appointments
  for each row execute function public.set_updated_at();
drop trigger if exists set_updated_at_address_changes on public.address_changes;
create trigger set_updated_at_address_changes before update on public.address_changes
  for each row execute function public.set_updated_at();
drop trigger if exists set_updated_at_document_translations on public.document_translations;
create trigger set_updated_at_document_translations before update on public.document_translations
  for each row execute function public.set_updated_at();

-- ============================================================================
-- END OF 0035 — code only, no live apply. The coordinator applies
-- migrations; nothing here connects to USCIS, NVC, CEAC, Stripe live,
-- or any SMS/video service.
-- ============================================================================
