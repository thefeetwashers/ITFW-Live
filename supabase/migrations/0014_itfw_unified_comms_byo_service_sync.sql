-- ============================================================================
-- ITFW Live — Supabase migration 0014: Unified Comms + BYO + case tools
-- Project: "Immigration" — https://jdxjskqdvwqarfhcqjlg.supabase.co
-- Run AFTER 0001–0013, in order (full run order 0001 -> 0020). Do NOT run live until the founder /
-- browser task says so. If any statement errors, STOP and report the
-- error verbatim.
--
-- RENUMBERING NOTE (consolidation, Nov 19–20, 2026 — see DEPLOY.md):
-- this file was 0013 and is now 0014; the sibling 0013 (public-profiles
-- view) keeps 0013. The renumber is safe: nothing in 0009+ had run
-- live, so no migration history breaks. Run order is now strictly
-- 0001 -> 0020 by filename. Within this file nothing else changed.
--
-- RECONCILIATION WITH 0012_itfw_preparer_gaps.sql (concurrent builder):
-- that file already created preparer_case_notes (private provider-only
-- notes) and preparer_case_todos (per-case to-dos) as PREPARER-scoped,
-- owner-only tables. This file deliberately does NOT create a second
-- case_notes / case_tasks table for the same purpose — the CaseTools
-- UI in this layer is local/example state until Supabase is live, and
-- when it is wired it must use the 0012 tables (or a founder decision
-- must widen them to all professional roles first: an attorney/DOJ
-- rep needs private notes too, and the 0012 tables are preparer_id
-- owner-only). What this file DOES add that 0012 does not:
-- provider_settings (cross-role BYO with key reference + last-4 —
-- 0012's preparer_byo_channels is status-only, preparer-only, 5
-- providers, no key handling), message_sends / translation flags,
-- contact preferences, renewals, general referral tracking, and
-- appointment reminders. preparer_attorney_referrals (0012) is an
-- escalation/handoff record with consent + access revocation — a
-- different purpose from case_referrals here (general referral
-- source/status tracking); both are kept and the difference is
-- recorded in docs/permissions-matrix.md.
--
-- SCOPE — genuinely NEW tables + genuinely MISSING policies only.
-- Migrations 0001–0012 are NOT edited. No existing table is ALTERed
-- and no existing policy is duplicated or replaced:
--  * messages (0001) already stores body_original, original_language,
--    body_translated, translated_language, sender/recipient, is_read.
--    It has NO channel and NO delivery status, so those live in the
--    NEW table message_sends (one row per send attempt) instead of
--    altering messages. Translation uncertainty lives in the NEW table
--    message_translation_flags.
--  * professional_profiles (0001) is the accounts system — extended,
--    NOT replaced, by the NEW table provider_settings (one row per
--    professional per provider).
--  * cases / documents / invoices / signatures / appointments /
--    inbox_items / service_orders already exist and are NOT recreated.
--  * RLS on the new tables reuses is_case_participant() (0001/0008)
--    and is_assigned_student() (0011 — this file DEPENDS on 0011
--    having run; if it has not, the student policies below fail and
--    the run must stop there).
--
-- WHAT 0014 ADDS:
--  1. provider_settings — BYO integrations (Resend, AWS SES, Twilio
--     SMS, WhatsApp Business, video, calendar, e-sign, storage,
--     Google Cloud Translation, own Stripe). Columns:
--     encrypted_key_reference (a vault reference ONLY — NEVER a
--     plaintext key; no plaintext key is ever written to this table),
--     key_last4 (last 4 chars only, the only key fragment ever shown
--     in the UI), connected_at, last_tested_at, test_status, config
--     (non-secret config only: sender email / phone number / account
--     label). RLS: owner-only on every operation. NO founder/admin
--     SELECT is created here on purpose: a founder sees the
--     verification queue + audit log only, never a professional's
--     credentials — and the 0003 founder SELECT pattern is deliberately
--     NOT extended to this table.
--  2. message_sends — channel + delivery status per message
--     (channel: portal_chat / sms / whatsapp / email; status: queued /
--     sent / failed / not_configured). Participant + assigned-student
--     SELECT; INSERT by a participant only (the send endpoint writes
--     it; clients never write a send row for a channel they did not use).
--  3. message_translation_flags — uncertain-translation flag +
--     human-confirmation requirement per message (uncertain,
--     needs_human_confirmation, reason, checked_by, checked_at).
--     Participant + assigned-student SELECT; participant INSERT.
--  4. case_contact_preferences — contact card: preferred language,
--     timezone, best contact time, preferred channel (one row per
--     case). Participant SELECT; assigned provider INSERT/UPDATE.
--  5. case_renewals — EAD / Green Card / N-400 eligibility-date
--     reminders (eligibility_or_expiry_date, remind_on, status).
--     Participant SELECT; assigned provider INSERT/UPDATE.
--  6. case_referrals — referral source + status only (no referred
--     person's private details without consent). Participant SELECT;
--     assigned provider INSERT/UPDATE. (Different from
--     preparer_attorney_referrals in 0012, which is an escalation /
--     handoff with client consent + attorney acceptance + access
--     revocation — see the numbering note above.)
--  7. appointment_reminders — 24h + 1h reminders for an appointment
--     (0001 appointments). Participant SELECT (via the appointment's
--     case); assigned provider INSERT/UPDATE. (Different from
--     preparer_appointments in 0012, which collects consultation
--     requests; it is not a reminder table.)
--  NOTE: case_notes and case_tasks are NOT created here — see the
--  numbering note: preparer_case_notes / preparer_case_todos (0012)
--  already cover private notes and per-case to-dos for preparers.
--  Widening them to attorneys/DOJ reps needs a founder decision.
-- 10. Student message access — the gap 0011 explicitly left open
--     ("Students have no access to messages / inbox_items on assigned
--     cases"). NEW policies, not duplicates:
--       messages_select_assigned_student, messages_insert_assigned_student
--       (insert requires sender_id = self; supervisor visibility is
--       enforced in the app layer — the supervisor sees the same
--       thread — and the student may never message alone),
--       message_sends_select_assigned_student,
--       message_translation_flags_select_assigned_student,
--       appointments_select_assigned_student (read-only: a student
--       sees appointments on assigned cases; booking stays provider /
--       client, supervisor-visible).
--     E-Sign / G-28 / billing / filing stay LOCKED for students: no
--     policy here touches signatures, invoices, or service_orders.
--
-- KNOWN GAP NOT FIXED HERE (needs a founder decision, not a policy):
--  * Migration 0003 §7a grants Founder/Admin a SELECT policy on every
--    case-scoped table (cases, messages, documents, invoices, …), so
--    in the database today a founder CAN read a client's documents.
--    The task rule is stricter — Founder/Admin sees the verification
--    queue + audit log ONLY, never a client's documents unless they
--    are the assigned provider. The UI in this layer enforces the
--    stricter rule (src/lib/isolation.ts canViewCase returns false for
--    founder_admin on case content; docs/permissions-matrix.md flags
--    it). Closing the database gap means dropping/replacing the 0003
--    select_founder_admin_* policies in a follow-up migration, after
--    the founder decides. This file does NOT extend that pattern to
--    any new table — in particular NOT to provider_settings (a
--    founder must never see a professional's credentials). Do NOT wire
--    Supabase Auth live until this is decided.
--  * 0011's other known gap is FIXED by migration 0019 (Nov 19-20
--    consolidation): a BEFORE UPDATE trigger now blocks role changes
--    by non-admins. Do NOT wire Supabase Auth live until 0019 runs.
--
-- No seed rows, no keys, no passwords, no plaintext secrets anywhere.
-- ============================================================================

-- --- 1. provider_settings (BYO) --------------------------------------------
create table public.provider_settings (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.professional_profiles(id) on delete cascade,
  provider_key text not null check (provider_key in (
    'resend', 'aws_ses', 'twilio', 'whatsapp_business', 'video_call',
    'calendar', 'esign', 'storage', 'google_translate', 'stripe_own'
  )),
  -- Vault reference ONLY (e.g. a Supabase Vault secret id). NEVER a
  -- plaintext key. The app writes this through the service role only.
  encrypted_key_reference text,
  -- Last 4 characters of the key ONLY — the only key fragment ever
  -- shown in the UI, logged, or stored in plain text.
  key_last4 text check (key_last4 is null or char_length(key_last4) = 4),
  -- Non-secret config only: sender email / phone number / account label.
  -- NEVER a key, token, or secret.
  config jsonb not null default '{}'::jsonb,
  status text not null default 'not_connected'
    check (status in ('connected', 'not_connected')),
  test_status text not null default 'not_tested'
    check (test_status in ('not_tested', 'passed', 'failed', 'not_configured')),
  connected_at timestamptz,
  last_tested_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, provider_key)
);
create index provider_settings_profile_idx
  on public.provider_settings (profile_id, provider_key);

alter table public.provider_settings enable row level security;

-- Owner-only on every operation. No founder/admin SELECT (see header).
create policy provider_settings_select_own on public.provider_settings for select
  using (exists (select 1 from public.professional_profiles p
                 where p.id = profile_id
                   and p.account_id = public.current_account_id()));
create policy provider_settings_insert_own on public.provider_settings for insert
  with check (exists (select 1 from public.professional_profiles p
                      where p.id = profile_id
                        and p.account_id = public.current_account_id()));
create policy provider_settings_update_own on public.provider_settings for update
  using (exists (select 1 from public.professional_profiles p
                 where p.id = profile_id
                   and p.account_id = public.current_account_id()))
  with check (exists (select 1 from public.professional_profiles p
                      where p.id = profile_id
                        and p.account_id = public.current_account_id()));
create policy provider_settings_delete_own on public.provider_settings for delete
  using (exists (select 1 from public.professional_profiles p
                 where p.id = profile_id
                   and p.account_id = public.current_account_id()));

-- --- 2. message_sends (channel + delivery status per message) --------------
create table public.message_sends (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  channel text not null check (channel in ('portal_chat', 'sms', 'whatsapp', 'email')),
  delivery_status text not null default 'not_configured'
    check (delivery_status in ('queued', 'sent', 'failed', 'not_configured')),
  provider text,
  provider_message_id text,
  error_message text,
  attempted_at timestamptz not null default now()
);
create index message_sends_message_idx on public.message_sends (message_id, attempted_at);

alter table public.message_sends enable row level security;

create policy message_sends_select on public.message_sends for select
  using (exists (select 1 from public.messages m
                 where m.id = message_id
                   and public.is_case_participant(m.case_id)));
create policy message_sends_select_assigned_student on public.message_sends for select
  using (exists (select 1 from public.messages m
                 where m.id = message_id
                   and public.is_assigned_student(m.case_id)));
create policy message_sends_insert on public.message_sends for insert
  with check (exists (select 1 from public.messages m
                      where m.id = message_id
                        and public.is_case_participant(m.case_id)));

-- --- 3. message_translation_flags ------------------------------------------
create table public.message_translation_flags (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  uncertain boolean not null default false,
  needs_human_confirmation boolean not null default false,
  reason text,
  checked_by uuid references public.accounts(id),
  checked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (message_id)
);
create index message_translation_flags_message_idx
  on public.message_translation_flags (message_id);

alter table public.message_translation_flags enable row level security;

create policy message_translation_flags_select on public.message_translation_flags for select
  using (exists (select 1 from public.messages m
                 where m.id = message_id
                   and public.is_case_participant(m.case_id)));
create policy message_translation_flags_select_assigned_student on public.message_translation_flags for select
  using (exists (select 1 from public.messages m
                 where m.id = message_id
                   and public.is_assigned_student(m.case_id)));
create policy message_translation_flags_insert on public.message_translation_flags for insert
  with check (exists (select 1 from public.messages m
                      where m.id = message_id
                        and public.is_case_participant(m.case_id)));

-- --- 4. case_contact_preferences (contact card) ----------------------------
create table public.case_contact_preferences (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  preferred_language text not null default 'en'
    check (preferred_language in ('en', 'es', 'ht', 'fr', 'pt', 'zh', 'ar')),
  timezone text not null default 'America/New_York',
  best_contact_time text,
  preferred_channel text not null default 'portal_chat'
    check (preferred_channel in ('portal_chat', 'sms', 'whatsapp', 'email')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (case_id)
);

alter table public.case_contact_preferences enable row level security;

create policy case_contact_preferences_select on public.case_contact_preferences for select
  using (public.is_case_participant(case_id));
create policy case_contact_preferences_upsert_provider on public.case_contact_preferences for insert
  with check (exists (select 1 from public.cases c
                      where c.id = case_id
                        and c.assigned_provider_id = public.current_account_id()));
create policy case_contact_preferences_update_provider on public.case_contact_preferences for update
  using (exists (select 1 from public.cases c
                 where c.id = case_id
                   and c.assigned_provider_id = public.current_account_id()));

-- --- 5. case_renewals ------------------------------------------------------
create table public.case_renewals (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  renewal_type text not null check (renewal_type in ('ead', 'green_card', 'n400')),
  eligibility_or_expiry_date date not null,
  remind_on date,
  status text not null default 'upcoming'
    check (status in ('upcoming', 'due', 'done')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index case_renewals_case_idx on public.case_renewals (case_id, remind_on);

alter table public.case_renewals enable row level security;

create policy case_renewals_select on public.case_renewals for select
  using (public.is_case_participant(case_id));
create policy case_renewals_insert_provider on public.case_renewals for insert
  with check (exists (select 1 from public.cases c
                      where c.id = case_id
                        and c.assigned_provider_id = public.current_account_id()));
create policy case_renewals_update_provider on public.case_renewals for update
  using (exists (select 1 from public.cases c
                 where c.id = case_id
                   and c.assigned_provider_id = public.current_account_id()));

-- --- 6. case_referrals -----------------------------------------------------
create table public.case_referrals (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  source text not null,
  status text not null default 'new'
    check (status in ('new', 'contacted', 'converted', 'closed')),
  referred_account_id uuid references public.accounts(id),
  created_by uuid not null references public.accounts(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index case_referrals_case_idx on public.case_referrals (case_id, status);

alter table public.case_referrals enable row level security;

create policy case_referrals_select on public.case_referrals for select
  using (public.is_case_participant(case_id));
create policy case_referrals_insert_provider on public.case_referrals for insert
  with check (created_by = public.current_account_id()
    and exists (select 1 from public.cases c
                where c.id = case_id
                  and c.assigned_provider_id = public.current_account_id()));
create policy case_referrals_update_provider on public.case_referrals for update
  using (exists (select 1 from public.cases c
                 where c.id = case_id
                   and c.assigned_provider_id = public.current_account_id()));

-- --- 7. appointment_reminders (24h + 1h) ----------------------------------
create table public.appointment_reminders (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  remind_at timestamptz not null,
  channel text not null check (channel in ('sms', 'whatsapp', 'email', 'portal_chat')),
  status text not null default 'queued'
    check (status in ('queued', 'sent', 'failed', 'not_configured')),
  created_at timestamptz not null default now()
);
create index appointment_reminders_appointment_idx
  on public.appointment_reminders (appointment_id, remind_at);

alter table public.appointment_reminders enable row level security;

create policy appointment_reminders_select on public.appointment_reminders for select
  using (exists (select 1 from public.appointments a
                 where a.id = appointment_id
                   and public.is_case_participant(a.case_id)));
create policy appointment_reminders_insert_provider on public.appointment_reminders for insert
  with check (exists (select 1 from public.appointments a
                      where a.id = appointment_id
                        and a.provider_id = public.current_account_id()));
create policy appointment_reminders_update_provider on public.appointment_reminders for update
  using (exists (select 1 from public.appointments a
                 where a.id = appointment_id
                   and a.provider_id = public.current_account_id()));

-- --- 8. Student message access (gap left open by 0011) --------------------
-- Assigned, supervisor-confirmed students only (is_assigned_student,
-- 0011). Supervisor visibility is enforced in the app layer: the
-- supervisor sees the same thread, and a student never messages alone.
-- No policy here touches signatures / invoices / service_orders:
-- E-Sign, G-28, billing, and filing stay LOCKED for students.
create policy messages_select_assigned_student on public.messages for select
  using (public.is_assigned_student(case_id));
create policy messages_insert_assigned_student on public.messages for insert
  with check (public.is_assigned_student(case_id)
    and sender_id = public.current_account_id());
create policy appointments_select_assigned_student on public.appointments for select
  using (public.is_assigned_student(case_id));

-- ============================================================================
-- END OF 0014 — after running 0001 → 0014 in order, RE-RUN the isolation
-- check before any real client document is stored: client sees 1 case,
-- assigned professional sees 1 case, unassigned professional sees 0 rows
-- on every case-scoped table, an assigned but UNCONFIRMED student sees
-- 0 cases / 0 documents / 0 messages, and a founder sees the verification
-- queue + audit log only in the UI (database founder-SELECT gap in 0003
-- §7a still open — see header; founder decision needed).
-- ============================================================================
