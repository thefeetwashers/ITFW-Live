-- 0034 — In-dashboard email composer: saved drafts (Nov 28, 2026).
--
-- The composer itself (POST /api/dashboard-email) sends via platform
-- AWS SES (src/lib/email.ts) and records delivery in the EXISTING
-- tables — notification_logs (migration 0010, stage_key
-- 'dashboard_email:<template>' or 'dashboard_email:free_form') and
-- message_sends (migration 0014, channel 'email'). No second send
-- log is created here.
--
-- This migration adds exactly ONE new table: dashboard_email_drafts,
-- where a professional saves a composed email to send later
-- (saveDraft). A saved draft is NOT a send: status stays 'draft'
-- until the professional sends it through the API route, which then
-- marks it 'sent' (or 'discarded'). The body IS stored here — unlike
-- notification_logs, which has no body column by design — because a
-- draft the professional wrote must be retrievable to edit and send.
-- The body never contains DOB / A-Number / SSN / passport numbers:
-- the API route rejects those before insert (validateComposerInput +
-- containsSensitiveIdentifier), and this table is case-scoped with
-- the same is_case_participant() RLS as messages (0001).
--
-- No real keys or secrets are stored here. BYO provider keys live
-- only as encrypted vault references in provider_settings (0014).

create table public.dashboard_email_drafts (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  professional_id uuid references public.accounts(id) on delete set null,
  -- Drafted-email template id (src/lib/draftedEmails.ts), cover-letter
  -- id ("cover_letter:<form>"), or null for a free-form compose.
  template_id text,
  sender_source text not null default 'platform_ses'
    check (sender_source in ('platform_ses', 'byo_resend', 'byo_aws_ses')),
  subject text not null,
  body text not null,
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'discarded')),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A sent draft was sent exactly once: sent_at is set only with
  -- status 'sent', never with status 'draft'.
  constraint dashboard_email_drafts_sent_at_consistency check (
    (status = 'sent' and sent_at is not null)
    or (status <> 'sent' and sent_at is null)
  )
);

create index dashboard_email_drafts_case_idx
  on public.dashboard_email_drafts (case_id, created_at desc);

alter table public.dashboard_email_drafts enable row level security;

create policy dashboard_email_drafts_select on public.dashboard_email_drafts for select
  using (public.is_case_participant(case_id));
create policy dashboard_email_drafts_insert on public.dashboard_email_drafts for insert
  with check (public.is_case_participant(case_id));
create policy dashboard_email_drafts_update on public.dashboard_email_drafts for update
  using (public.is_case_participant(case_id));
create policy dashboard_email_drafts_delete on public.dashboard_email_drafts for delete
  using (public.is_case_participant(case_id));

-- Founder/admin read on the new case-scoped table (0006 pattern).
do $$
begin
  execute format(
    'drop policy if exists %I on public.%I',
    'select_founder_admin_dashboard_email_drafts', 'dashboard_email_drafts');
  execute format(
    'create policy %I on public.%I for select using '
    '(public.current_account_role() in (''admin'', ''founder''))',
    'select_founder_admin_dashboard_email_drafts', 'dashboard_email_drafts');
end $$;

drop trigger if exists set_updated_at_dashboard_email_drafts on public.dashboard_email_drafts;
create trigger set_updated_at_dashboard_email_drafts before update on public.dashboard_email_drafts
  for each row execute function public.set_updated_at();
