-- ============================================================================
-- ITFW Live — Supabase migration 0012: Document Preparer gap-fill
-- (preparer dashboard audit, Nov 19, 2026)
--
-- RENUMBERING NOTE (consolidation, Nov 19–20, 2026 — see DEPLOY.md):
-- migrations 0001–0011 exist in this repo. This file KEEPS 0012; the
-- duplicate 0012/0013/0016 files were renumbered/merged so the run
-- order is now strictly 0001 -> 0020 by filename. It creates ONLY
-- genuinely new tables — it does NOT edit 0001–0013 and does NOT alter
-- any existing table. preparer_leads already has quote_expires_at and
-- lost_reason (0010); professional_profiles already covers the public
-- /p/<slug> directory (0001/0002) — neither is duplicated here.
--
-- Tables created (all preparer-owned, RLS on, owner-only policies via
-- public.current_account_id() — the same helper as 0007/0008/0010/0011):
--   1. preparer_profiles        — preparer public-profile fields the
--      dashboard editor writes (slug, bio, languages, service area,
--      services/forms). Listing fee is LOCKED at $49/mo (4900 cents,
--      CHECK). Verification is UPL-agreement-signed ONLY — a preparer is
--      NEVER bar-verified or attorney-verified (CHECK on
--      verification_status: 'upl_signed' | 'pending_review' only).
--   2. preparer_case_todos      — per-case to-do list + due dates.
--   3. preparer_case_notes      — PRIVATE provider-only case notes.
--      No client/family policy exists on purpose: notes are never
--      readable by the client or family.
--   4. preparer_rfe_items       — RFE clerical checklist + deadline.
--      Legal response content is NOT stored here: a preparer never
--      writes an RFE/NOID legal brief; that belongs to an attorney.
--   5. preparer_attorney_referrals — escalation / handoff. Transfer
--      requires BOTH client_consent AND attorney_accepted (CHECK);
--      access_revoked_after_transfer defaults true: the preparer loses
--      access on transfer unless the attorney re-assigns them.
--   6. preparer_appointments    — consultation requests COLLECTED only.
--      Booking calendar is NOT connected: no auto-booking, no calendar
--      event is created by this table.
--   7. preparer_byo_channels    — BYO Resend / AWS SES / Twilio / phone /
--      sender-email status. Status defaults 'not_connected' and NOTHING
--      here claims a message was sent.
--   8. preparer_student_help_requests — a preparer may request CLERICAL
--      help from a law student ONLY when the student was assigned +
--      supervised by a VERIFIED attorney/DOJ representative on that case.
--      supervisor_account_id is REQUIRED; the request never creates a
--      student assignment (that is migration 0004, attorney/DOJ-only)
--      and never approves legal content.
--
-- Do NOT run live until the founder / browser task says so. If any
-- statement errors, STOP and report the error verbatim.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. preparer_profiles
-- ---------------------------------------------------------------------------
create table public.preparer_profiles (
  id uuid primary key default gen_random_uuid(),
  preparer_id uuid not null unique references public.accounts(id) on delete cascade,
  slug text not null unique
    check (slug ~ '^[a-z0-9][a-z0-9-]{2,60}$'),
  bio text,
  languages_spoken text[] not null default array['en'],
  service_area text,
  services_offered text[] not null default array[]::text[],
  -- UPL agreement: signed = the preparer accepted the clerical-only
  -- agreement at /register (see /api/register-role, uplAgreed).
  upl_agreement_signed boolean not null default false,
  -- NEVER 'bar_verified' / 'attorney_verified' for a preparer.
  verification_status text not null default 'pending_review'
    check (verification_status in ('pending_review', 'upl_signed')),
  -- LOCKED $49/mo listing (preparer_pro_49). Never change by editing a row.
  listing_fee_cents integer not null default 4900
    check (listing_fee_cents = 4900),
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint preparer_profiles_published_requires_upl check (
    is_published = false or (upl_agreement_signed = true and verification_status = 'upl_signed')
  )
);

create index preparer_profiles_preparer_idx
  on public.preparer_profiles (preparer_id);
create index preparer_profiles_slug_idx
  on public.preparer_profiles (slug);

alter table public.preparer_profiles enable row level security;

create policy preparer_profiles_select_own on public.preparer_profiles for select
  using (preparer_id = public.current_account_id());
create policy preparer_profiles_insert_own on public.preparer_profiles for insert
  with check (preparer_id = public.current_account_id());
create policy preparer_profiles_update_own on public.preparer_profiles for update
  using (preparer_id = public.current_account_id())
  with check (preparer_id = public.current_account_id());
create policy preparer_profiles_delete_own on public.preparer_profiles for delete
  using (preparer_id = public.current_account_id());

-- ---------------------------------------------------------------------------
-- 2. preparer_case_todos — per-case to-do list + due dates
-- ---------------------------------------------------------------------------
create table public.preparer_case_todos (
  id uuid primary key default gen_random_uuid(),
  preparer_id uuid not null references public.accounts(id) on delete cascade,
  case_id uuid not null references public.cases(id) on delete cascade,
  label text not null,
  due_date date,
  is_done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index preparer_case_todos_case_idx
  on public.preparer_case_todos (case_id, due_date);

alter table public.preparer_case_todos enable row level security;

create policy preparer_case_todos_select_own on public.preparer_case_todos for select
  using (preparer_id = public.current_account_id());
create policy preparer_case_todos_insert_own on public.preparer_case_todos for insert
  with check (preparer_id = public.current_account_id());
create policy preparer_case_todos_update_own on public.preparer_case_todos for update
  using (preparer_id = public.current_account_id())
  with check (preparer_id = public.current_account_id());
create policy preparer_case_todos_delete_own on public.preparer_case_todos for delete
  using (preparer_id = public.current_account_id());

-- ---------------------------------------------------------------------------
-- 3. preparer_case_notes — PRIVATE provider-only notes.
--    Deliberately NO client/family read policy: notes are never shown
--    to the client or family. Notes must stay clerical (what was
--    received / missing / sent) — never legal advice or legal strategy.
-- ---------------------------------------------------------------------------
create table public.preparer_case_notes (
  id uuid primary key default gen_random_uuid(),
  preparer_id uuid not null references public.accounts(id) on delete cascade,
  case_id uuid not null references public.cases(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index preparer_case_notes_case_idx
  on public.preparer_case_notes (case_id, created_at desc);

alter table public.preparer_case_notes enable row level security;

create policy preparer_case_notes_select_own on public.preparer_case_notes for select
  using (preparer_id = public.current_account_id());
create policy preparer_case_notes_insert_own on public.preparer_case_notes for insert
  with check (preparer_id = public.current_account_id());
create policy preparer_case_notes_delete_own on public.preparer_case_notes for delete
  using (preparer_id = public.current_account_id());

-- ---------------------------------------------------------------------------
-- 4. preparer_rfe_items — RFE clerical checklist + deadline countdown.
--    Clerical only: which documents USCIS asked for, collected or not.
--    NO legal-response content is stored here.
-- ---------------------------------------------------------------------------
create table public.preparer_rfe_items (
  id uuid primary key default gen_random_uuid(),
  preparer_id uuid not null references public.accounts(id) on delete cascade,
  case_id uuid not null references public.cases(id) on delete cascade,
  rfe_label text not null,
  deadline date not null,
  checklist_item text not null,
  is_collected boolean not null default false,
  documents_uploaded boolean not null default false,
  attorney_referral_suggested boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index preparer_rfe_items_case_idx
  on public.preparer_rfe_items (case_id, deadline);

alter table public.preparer_rfe_items enable row level security;

create policy preparer_rfe_items_select_own on public.preparer_rfe_items for select
  using (preparer_id = public.current_account_id());
create policy preparer_rfe_items_insert_own on public.preparer_rfe_items for insert
  with check (preparer_id = public.current_account_id());
create policy preparer_rfe_items_update_own on public.preparer_rfe_items for update
  using (preparer_id = public.current_account_id())
  with check (preparer_id = public.current_account_id());
create policy preparer_rfe_items_delete_own on public.preparer_rfe_items for delete
  using (preparer_id = public.current_account_id());

-- ---------------------------------------------------------------------------
-- 5. preparer_attorney_referrals — escalation / handoff.
--    Transfer requires BOTH explicit client consent AND attorney
--    acceptance (CHECK). Documents move only within the case; the
--    preparer loses access on transfer unless the attorney re-assigns
--    them (access_revoked_after_transfer defaults true).
-- ---------------------------------------------------------------------------
create table public.preparer_attorney_referrals (
  id uuid primary key default gen_random_uuid(),
  preparer_id uuid not null references public.accounts(id) on delete cascade,
  case_id uuid not null references public.cases(id) on delete cascade,
  reason text not null,
  attorney_account_id uuid references public.accounts(id) on delete set null,
  client_consent boolean not null default false,
  attorney_accepted boolean not null default false,
  transferred_at timestamptz,
  access_revoked_after_transfer boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint preparer_attorney_referrals_transfer_requires_both check (
    transferred_at is null or (client_consent = true and attorney_accepted = true)
  )
);

create index preparer_attorney_referrals_case_idx
  on public.preparer_attorney_referrals (case_id, created_at desc);

alter table public.preparer_attorney_referrals enable row level security;

create policy preparer_attorney_referrals_select_own on public.preparer_attorney_referrals for select
  using (preparer_id = public.current_account_id());
create policy preparer_attorney_referrals_insert_own on public.preparer_attorney_referrals for insert
  with check (preparer_id = public.current_account_id());
create policy preparer_attorney_referrals_update_own on public.preparer_attorney_referrals for update
  using (preparer_id = public.current_account_id())
  with check (preparer_id = public.current_account_id());

-- ---------------------------------------------------------------------------
-- 6. preparer_appointments — consultation requests COLLECTED only.
--    Booking calendar is NOT connected: no auto-booking, no calendar
--    event is created by this table. The preparer confirms the time.
-- ---------------------------------------------------------------------------
create table public.preparer_appointments (
  id uuid primary key default gen_random_uuid(),
  preparer_id uuid not null references public.accounts(id) on delete cascade,
  case_id uuid references public.cases(id) on delete set null,
  requester_name text not null,
  requester_email text,
  consultation_type text not null default 'video'
    check (consultation_type in ('phone', 'video')),
  preferred_time text,
  status text not null default 'request_collected'
    check (status in ('request_collected', 'confirmed_by_preparer', 'done', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index preparer_appointments_preparer_idx
  on public.preparer_appointments (preparer_id, created_at desc);

alter table public.preparer_appointments enable row level security;

create policy preparer_appointments_select_own on public.preparer_appointments for select
  using (preparer_id = public.current_account_id());
create policy preparer_appointments_insert_own on public.preparer_appointments for insert
  with check (preparer_id = public.current_account_id());
create policy preparer_appointments_update_own on public.preparer_appointments for update
  using (preparer_id = public.current_account_id())
  with check (preparer_id = public.current_account_id());
create policy preparer_appointments_delete_own on public.preparer_appointments for delete
  using (preparer_id = public.current_account_id());

-- ---------------------------------------------------------------------------
-- 7. preparer_byo_channels — BYO Resend / AWS SES / Twilio / phone /
--    sender-email status. Defaults 'not_connected'. NOTHING here claims
--    a message was sent.
-- ---------------------------------------------------------------------------
create table public.preparer_byo_channels (
  id uuid primary key default gen_random_uuid(),
  preparer_id uuid not null references public.accounts(id) on delete cascade,
  provider text not null
    check (provider in ('resend', 'aws_ses', 'twilio', 'phone_number', 'sender_email')),
  status text not null default 'not_connected'
    check (status in ('not_connected', 'connected', 'not_verified', 'verification_pending')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint preparer_byo_channels_one_row_per_provider unique (preparer_id, provider)
);

alter table public.preparer_byo_channels enable row level security;

create policy preparer_byo_channels_select_own on public.preparer_byo_channels for select
  using (preparer_id = public.current_account_id());
create policy preparer_byo_channels_insert_own on public.preparer_byo_channels for insert
  with check (preparer_id = public.current_account_id());
create policy preparer_byo_channels_update_own on public.preparer_byo_channels for update
  using (preparer_id = public.current_account_id())
  with check (preparer_id = public.current_account_id());
create policy preparer_byo_channels_delete_own on public.preparer_byo_channels for delete
  using (preparer_id = public.current_account_id());

-- ---------------------------------------------------------------------------
-- 8. preparer_student_help_requests — clerical help from a supervised
--    law student ONLY. supervisor_account_id (a VERIFIED attorney/DOJ
--    representative who assigned + supervises the student on this case)
--    is REQUIRED. This table never creates a student assignment (0004,
--    attorney/DOJ-only) and never approves legal content.
-- ---------------------------------------------------------------------------
create table public.preparer_student_help_requests (
  id uuid primary key default gen_random_uuid(),
  preparer_id uuid not null references public.accounts(id) on delete cascade,
  case_id uuid not null references public.cases(id) on delete cascade,
  supervisor_account_id uuid not null references public.accounts(id) on delete restrict,
  help_requested text not null,
  status text not null default 'requested'
    check (status in ('requested', 'done', 'declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index preparer_student_help_requests_case_idx
  on public.preparer_student_help_requests (case_id, created_at desc);

alter table public.preparer_student_help_requests enable row level security;

create policy preparer_student_help_requests_select_own on public.preparer_student_help_requests for select
  using (preparer_id = public.current_account_id());
create policy preparer_student_help_requests_insert_own on public.preparer_student_help_requests for insert
  with check (preparer_id = public.current_account_id());
create policy preparer_student_help_requests_update_own on public.preparer_student_help_requests for update
  using (preparer_id = public.current_account_id())
  with check (preparer_id = public.current_account_id());
