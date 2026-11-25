-- ============================================================================
-- ITFW Live — Supabase migration 0010: preparer leads, case lifecycle,
-- NVC extensions on case_agency_numbers, notification logs
-- Project: "Immigration" — https://jdxjskqdvwqarfhcqjlg.supabase.co
-- Run AFTER 0009. Schema only — do NOT run live until the founder /
-- browser task says so. No seed rows, no keys, no passwords.
-- Money is integer cents everywhere. No NUMERIC dollar columns.
--
-- CONVENTIONS FOLLOWED (0001 as fixed in 0008, 0002, 0003, 0009):
--   * FKs point at public.accounts(id) — never users(id).
--   * preferred_language is the existing 7-language enum from 0001
--     ('en','es','ht','fr','pt','zh','ar').
--   * RLS is participant-only via the SECURITY DEFINER helpers from
--     0001/0008 (current_account_id(), current_account_role(),
--     is_case_participant()), plus founder/admin read following the
--     0003 section 7a / 0009 pattern
--     (current_account_role() IN ('admin','founder')).
--   * updated_at is refreshed by the existing public.set_updated_at()
--     trigger function (defined in 0003).
--
-- LIFECYCLE CHOICE (documented, per task — exactly one approach):
--   A separate case_lifecycle HISTORY table, NOT a lifecycle_stage
--   column on cases. A column would overwrite history on every stage
--   change; the table keeps one row per stage change (who changed it,
--   when), with is_current marking the latest row, so the full
--   1–6 journey (including 5A/5B) is auditable. The app reads the
--   current stage as the row where is_current = true.
--
--   Stage numbers 1–6 are the intake-to-interview/approval journey;
--   sub_stage is '5A' / '5B' (nullable, only meaningful at stage 5).
--   The app layer must flip the old row's is_current to false when it
--   inserts the new current row (a later migration may enforce this
--   with a trigger; no trigger is added here to keep this file
--   schema-only and idempotent).
--
-- NVC NOTES:
--   * case_agency_numbers (0009) is the preparer-hub view of agency
--     numbers; these columns extend it for NVC rows only. They are
--     NULL on USCIS/EOIR/DOL rows. NVC has NO API — CEAC is manual
--     (link out, never store a CEAC password); nvc_trackers (0002)
--     still holds the encrypted NVC case/invoice IDs.
--   * Fee statuses use the NVC wording PAID / IN PROCESS / NOT PAID.
--   * medical_exam_status values are this migration's own checked set
--     (NOT SCHEDULED / SCHEDULED / COMPLETED / WAIVED) — no prior
--     migration defined one.
--
-- NOTIFICATION LOGS:
--   * Append-only delivery log. There is deliberately NO message-body
--     column: bodies can contain PII (names, case numbers, dates) and
--     must never be stored. stage_key + language + channel + status
--     is enough to prove what was sent, when, and in which language.
--   * recipient is either an account (recipient_account_id) or a
--     family member from case_family_members (0009)
--     (recipient_family_member_id); both are nullable so a log row can
--     also record a failed / not-configured attempt where no recipient
--     row could be resolved.
--
-- PAYMENT PLANS ON LEADS:
--   * payment_plan_offered is limited to the locked plans only:
--     'full_upfront', 'installments_3', 'monthly_6', 'monthly_12'.
--     There is NO '50/50 Split' value. (Note: payment_plans.pay_choice
--     in 0002/0003 spells the upfront option 'all_at_once'; leads use
--     the task-specified 'full_upfront' spelling because a lead quote
--     is pre-case and is not a payment_plans row. If the two are ever
--     unified, pick one spelling in a later migration — do not silently
--     rename either here.)
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1. preparer_leads — pre-case pipeline owned by one preparer.
--    A lead is NOT a case yet: no case_id, no client account required.
--    Contact details (name/email/phone) live here only until conversion;
--    on conversion the app creates the account + case and sets
--    pipeline_stage = 'converted'.
-- --------------------------------------------------------------------------
create table public.preparer_leads (
  id uuid primary key default gen_random_uuid(),
  preparer_id uuid not null references public.accounts(id) on delete cascade,
  full_name text not null,
  email citext not null,
  phone text,
  preferred_language preferred_language not null default 'en',
  lead_source text,
  service_interested text,
  quoted_fee_cents integer check (quoted_fee_cents >= 0),
  payment_plan_offered text
    check (payment_plan_offered in (
      'full_upfront', 'installments_3', 'monthly_6', 'monthly_12')),
  pipeline_stage text not null default 'new_lead'
    check (pipeline_stage in (
      'new_lead', 'quote_sent', 'payment_pending', 'converted', 'lost')),
  notes text,
  follow_up_date date,
  lost_reason text,
  quote_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint preparer_leads_lost_reason_only_when_lost check (
    lost_reason is null or pipeline_stage = 'lost')
);
create index preparer_leads_preparer_idx
  on public.preparer_leads (preparer_id, pipeline_stage);
create index preparer_leads_follow_up_idx
  on public.preparer_leads (preparer_id, follow_up_date)
  where follow_up_date is not null;

-- --------------------------------------------------------------------------
-- 2. case_lifecycle — stage-change history, one row per change.
--    stage 1–6; sub_stage '5A'/'5B' only (nullable, stage 5 only).
-- --------------------------------------------------------------------------
create table public.case_lifecycle (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  stage integer not null check (stage between 1 and 6),
  sub_stage text check (sub_stage in ('5A', '5B')),
  is_current boolean not null default true,
  stage_changed_at timestamptz not null default now(),
  stage_changed_by uuid references public.accounts(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint case_lifecycle_sub_stage_only_at_stage_5 check (
    sub_stage is null or stage = 5)
);
-- At most one current row per case; history rows keep is_current = false.
create unique index case_lifecycle_one_current_per_case_idx
  on public.case_lifecycle (case_id) where is_current = true;
create index case_lifecycle_case_history_idx
  on public.case_lifecycle (case_id, stage_changed_at desc);

-- --------------------------------------------------------------------------
-- 3. NVC extensions on case_agency_numbers (0009).
--    ADD COLUMN IF NOT EXISTS guards: safe to re-run.
-- --------------------------------------------------------------------------
alter table public.case_agency_numbers
  add column if not exists embassy_post_name text;
alter table public.case_agency_numbers
  add column if not exists nvc_aos_fee_status text
    check (nvc_aos_fee_status in ('PAID', 'IN PROCESS', 'NOT PAID'));
alter table public.case_agency_numbers
  add column if not exists nvc_iv_fee_status text
    check (nvc_iv_fee_status in ('PAID', 'IN PROCESS', 'NOT PAID'));
alter table public.case_agency_numbers
  add column if not exists ceac_dq_date date;
alter table public.case_agency_numbers
  add column if not exists interview_date date;
alter table public.case_agency_numbers
  add column if not exists medical_exam_status text
    check (medical_exam_status in (
      'NOT SCHEDULED', 'SCHEDULED', 'COMPLETED', 'WAIVED'));

-- --------------------------------------------------------------------------
-- 4. notification_logs — append-only, NO message-body column (PII).
-- --------------------------------------------------------------------------
create table public.notification_logs (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  recipient_account_id uuid references public.accounts(id) on delete set null,
  recipient_family_member_id uuid
    references public.case_family_members(id) on delete set null,
  channel text not null check (channel in ('sms', 'whatsapp', 'email')),
  stage_key text not null,
  language preferred_language not null default 'en',
  status text not null default 'not_configured'
    check (status in ('sent', 'failed', 'not_configured')),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  constraint notification_logs_sent_at_consistency check (
    (status = 'sent' and sent_at is not null)
    or status <> 'sent')
);
create index notification_logs_case_idx
  on public.notification_logs (case_id, created_at desc);
create index notification_logs_recipient_idx
  on public.notification_logs (recipient_account_id, created_at desc);

-- --------------------------------------------------------------------------
-- 5. RLS — enable on the new tables, then policies.
--    Leads: only the owning preparer (founder/admin may read).
--    Lifecycle + logs: case participants only (founder/admin may read).
-- --------------------------------------------------------------------------
alter table public.preparer_leads enable row level security;
alter table public.case_lifecycle enable row level security;
alter table public.notification_logs enable row level security;

-- preparer_leads: preparer-owns-leads only.
create policy preparer_leads_select_own on public.preparer_leads for select
  using (preparer_id = public.current_account_id());
create policy preparer_leads_insert_own on public.preparer_leads for insert
  with check (preparer_id = public.current_account_id());
create policy preparer_leads_update_own on public.preparer_leads for update
  using (preparer_id = public.current_account_id())
  with check (preparer_id = public.current_account_id());
create policy preparer_leads_delete_own on public.preparer_leads for delete
  using (preparer_id = public.current_account_id());

-- case_lifecycle: participant-only (0001/0003 pattern).
create policy case_lifecycle_select on public.case_lifecycle for select
  using (public.is_case_participant(case_id));
create policy case_lifecycle_insert on public.case_lifecycle for insert
  with check (public.is_case_participant(case_id));
create policy case_lifecycle_update on public.case_lifecycle for update
  using (public.is_case_participant(case_id));

-- notification_logs: participant-only; logs are append-only, so no
-- update/delete policy is granted to participants (only insert/select).
create policy notification_logs_select on public.notification_logs for select
  using (public.is_case_participant(case_id));
create policy notification_logs_insert on public.notification_logs for insert
  with check (public.is_case_participant(case_id));

-- Founder/admin read on the new tables (0003 section 7a / 0009 pattern).
do $$
declare
  t text;
begin
  foreach t in array array[
    'preparer_leads', 'case_lifecycle', 'notification_logs'
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

-- --------------------------------------------------------------------------
-- 6. updated_at triggers (existing set_updated_at() from 0003).
--    notification_logs is append-only and has no updated_at: no trigger.
-- --------------------------------------------------------------------------
drop trigger if exists set_updated_at_preparer_leads on public.preparer_leads;
create trigger set_updated_at_preparer_leads before update on public.preparer_leads
  for each row execute function public.set_updated_at();
drop trigger if exists set_updated_at_case_lifecycle on public.case_lifecycle;
create trigger set_updated_at_case_lifecycle before update on public.case_lifecycle
  for each row execute function public.set_updated_at();

-- ============================================================================
-- END OF 0010 — schema only. No seed rows, no keys, no passwords.
-- Nothing here runs live, touches Supabase/Vercel/GitHub, or edits
-- migrations 0001–0009.
-- ============================================================================
