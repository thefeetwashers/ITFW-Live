-- ============================================================================
-- ITFW Live — Supabase migration 0016: Next Step + Stage + Payment +
-- Communication engine (post-submission tracker, route changes, next steps)
-- Run AFTER 0015 (full run order 0001 -> 0020). Do NOT run live until the founder / browser task says so.
--
-- ONLY genuinely missing tables are created here. Everything else is
-- REUSED, not duplicated:
--   * cases.pathfinder_route (0001, jsonb) already stores the Path Finder
--     answers — the route is READ from it (see parsePathfinderRoute in
--     portal/src/lib/nextStepEngine.ts). case_post_submission.route is the
--     structured, professional-confirmed route; it does not replace the
--     jsonb, it records the decision made from it.
--   * case_watch (0001) already tracks USCIS receipt numbers + milestones.
--   * case_agency_numbers (0009, extended 0010) already stores
--     interview_date, medical_exam_status, embassy_post_name,
--     ceac_dq_date, and the NVC AOS/IV fee statuses — NOT duplicated here.
--   * case_lifecycle (0010) already stores stage-change history (stages
--     1–6, sub-stages 5A/5B).
--   * payment_plans (0002, pay_choice widened in 0003 to include
--     monthly_6 / monthly_12) + payment_arrangements (0009, auto-draft
--     schedule) already hold plans and drafts — NOT duplicated. The
--     arrangement editor in the portal writes to those two tables.
--   * reminder_nudges (0005) already queues the 48h past-due nudges;
--     notification_logs (0010) already logs sends (no message body).
--   * message_sends (0014) already records per-channel delivery status
--     (queued / sent / failed / not_configured) for the unified thread.
--   * audit_log (0001) already exists — a trigger below writes every
--     route switch into it, with the reason, so a switch is never silent.
--   * documents.review_status (0001 enum) already exists — the colour
--     system (green/amber/red/blue/grey) is a UI mapping of that enum
--     (see colourForReviewStatus), not a new column.
-- Money is integer cents everywhere. No seed rows, no keys, no passwords.
-- NVC has NO API — CEAC is manual (link out, never store a CEAC password).
-- USCIS live status needs the Production key + worker — not built.
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1. case_post_submission — ONE row per case: the post-submission tracker.
--    Holds ONLY what no table holds yet: the structured route, the USCIS
--    stage (Receipt → Biometrics → Review → RFE → Approval / Denial),
--    the VAC biometrics appointment, the $235 USCIS Immigrant Fee status,
--    and the flight + arrival / binder checklists. Receipt number,
--    service center, interview date, medical exam, and NVC fee statuses
--    live in case_watch / case_agency_numbers (see header) — read them
--    from there, do not copy them here.
-- --------------------------------------------------------------------------
create table public.case_post_submission (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  -- Route: inside_us = adjustment of status; outside_us = consular / NVC.
  -- The two flows NEVER mix in the UI; this column decides which one shows.
  route text not null check (route in ('inside_us', 'outside_us')),
  route_source text not null default 'pathfinder'
    check (route_source in ('pathfinder', 'professional')),
  -- USCIS stage, as entered by the professional (manual entry + Sandbox
  -- only — live USCIS lookup needs the Production key, NOT built).
  uscis_stage text
    check (uscis_stage in ('receipt', 'biometrics', 'review', 'rfe', 'approval', 'denial')),
  -- VAC biometrics appointment (consular only). No date is invented:
  -- null means "not scheduled yet".
  vac_date date,
  vac_location text,
  -- $235 USCIS Immigrant Fee (consular only): paid online BEFORE flying.
  immigrant_fee_status text not null default 'NOT PAID'
    check (immigrant_fee_status in ('NOT PAID', 'IN PROCESS', 'PAID')),
  immigrant_fee_paid_at timestamptz,
  -- Flight + arrival checklist and original-documents binder checklist.
  -- JSON arrays of { id, label, status } where status is one of the
  -- document colour statuses (approved / pending_review / in_progress /
  -- missing / rejected / overdue / uploaded_awaiting / not_started).
  flight_checklist jsonb not null default '[]'::jsonb,
  binder_checklist jsonb not null default '[]'::jsonb,
  updated_by uuid references public.accounts(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (case_id)
);
create index case_post_submission_case_idx
  on public.case_post_submission (case_id);

-- --------------------------------------------------------------------------
-- 2. case_route_changes — structured route-switch history. A professional
--    may switch the route ONLY with a reason; the reason is NOT NULL here
--    and the trigger below also writes the switch to audit_log.
-- --------------------------------------------------------------------------
create table public.case_route_changes (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  previous_route text check (previous_route in ('inside_us', 'outside_us')),
  new_route text not null check (new_route in ('inside_us', 'outside_us')),
  reason text not null check (char_length(trim(reason)) > 0),
  changed_by uuid references public.accounts(id) on delete set null,
  created_at timestamptz not null default now()
);
create index case_route_changes_case_idx
  on public.case_route_changes (case_id, created_at desc);

-- Every route switch is also written to audit_log (0001), with the reason,
-- so it is visible in the audit trail even if this table is filtered.
create or replace function public.log_case_route_change()
returns trigger language plpgsql security definer as $$
begin
  insert into public.audit_log
    (actor_id, actor_role, action, entity_type, entity_id, case_id, detail)
  values (
    new.changed_by,
    public.current_account_role(),
    'case_route_changed',
    'case_route_changes',
    new.id,
    new.case_id,
    jsonb_build_object(
      'previous_route', new.previous_route,
      'new_route', new.new_route,
      'reason', new.reason
    )
  );
  return new;
end;
$$;

drop trigger if exists log_case_route_change_trigger
  on public.case_route_changes;
create trigger log_case_route_change_trigger
  after insert on public.case_route_changes
  for each row execute function public.log_case_route_change();

-- --------------------------------------------------------------------------
-- 3. case_next_steps — the professional-set "Next Step" for a case.
--    One current row per case; history rows keep is_current = false.
--    When no current row exists, the UI derives the next step from the
--    case (deriveNextStep in portal/src/lib/nextStepEngine.ts) — it never
--    invents one. by_when / after_text are plain-English text, not dates
--    the system cannot verify; a real deadline goes in by_when as written
--    on the notice (e.g. "By the deadline on the RFE letter: 2026-12-20").
-- --------------------------------------------------------------------------
create table public.case_next_steps (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  is_current boolean not null default true,
  what text not null check (char_length(trim(what)) > 0),
  detail text,
  by_when text,
  after_text text,
  actor text not null default 'client' check (actor in ('client', 'provider')),
  language preferred_language not null default 'en',
  set_by uuid references public.accounts(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- At most one current next step per case.
create unique index case_next_steps_one_current_per_case_idx
  on public.case_next_steps (case_id) where is_current = true;
create index case_next_steps_case_history_idx
  on public.case_next_steps (case_id, created_at desc);

-- --------------------------------------------------------------------------
-- 4. RLS — participant-only, following the 0001 / 0003 pattern.
--    Assigned students may READ the tracker + next step (supervisor
--    visibility), but may not write either.
-- --------------------------------------------------------------------------
alter table public.case_post_submission enable row level security;
alter table public.case_route_changes enable row level security;
alter table public.case_next_steps enable row level security;

-- case_post_submission
create policy case_post_submission_select on public.case_post_submission for select
  using (public.is_case_participant(case_id));
create policy case_post_submission_select_assigned_student on public.case_post_submission for select
  using (public.is_assigned_student(case_id));
create policy case_post_submission_insert on public.case_post_submission for insert
  with check (public.is_case_participant(case_id));
create policy case_post_submission_update on public.case_post_submission for update
  using (public.is_case_participant(case_id));

-- case_route_changes (append-only: no update / delete policies)
create policy case_route_changes_select on public.case_route_changes for select
  using (public.is_case_participant(case_id));
create policy case_route_changes_select_assigned_student on public.case_route_changes for select
  using (public.is_assigned_student(case_id));
create policy case_route_changes_insert on public.case_route_changes for insert
  with check (public.is_case_participant(case_id));

-- case_next_steps
create policy case_next_steps_select on public.case_next_steps for select
  using (public.is_case_participant(case_id));
create policy case_next_steps_select_assigned_student on public.case_next_steps for select
  using (public.is_assigned_student(case_id));
create policy case_next_steps_insert on public.case_next_steps for insert
  with check (public.is_case_participant(case_id));
create policy case_next_steps_update on public.case_next_steps for update
  using (public.is_case_participant(case_id));

-- --------------------------------------------------------------------------
-- 5. updated_at triggers (same public.set_updated_at() from migration 0003).
-- --------------------------------------------------------------------------
drop trigger if exists set_updated_at_case_post_submission on public.case_post_submission;
create trigger set_updated_at_case_post_submission before update on public.case_post_submission
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_case_next_steps on public.case_next_steps;
create trigger set_updated_at_case_next_steps before update on public.case_next_steps
  for each row execute function public.set_updated_at();
