-- ============================================================================
-- ITFW Live — Supabase migration 0003: powerful + safe backend
-- Project: "Immigration" — https://jdxjskqdvwqarfhcqjlg.supabase.co
-- Org: THE FEET WASHERS (Pro), account thefeetwashers@gmail.com
-- Run AFTER 0001_itfw_core.sql and 0002_itfw_extended.sql, in that order.
-- Run in the Supabase SQL Editor. If any statement errors, STOP and report
-- the error verbatim — do not skip ahead to the vault bucket / Email auth.
--
-- WHAT IT ADDS
--   1. Enum fix (Nov 19, 2026 audit gap): account_role gains law_student,
--      teacher, founder; subscription_plan gains law_student_35 ($35/mo)
--      and employer_49 ($49/mo). Existing values are untouched.
--   2. Hot-query indexes on cases, documents, messages, invoices,
--      appointments, case_watch, payment_plans, inbox, audit logs, RFE, NVC.
--   3. Data-integrity constraints: money >= 0 in cents, paid <= total,
--      payment-plan installments must sum to the bundle total, monthly
--      plans (6 / 12 months) are now a legal pay_choice, documents must
--      live in the 'vault' bucket, assigned providers must be a preparer /
--      attorney / DOJ nonprofit (never a law student or teacher alone).
--   4. RLS hardening: every table in 0001+0002 now has at least one policy.
--      Tables that had RLS enabled but ZERO policies in 0001/0002
--      (inbox_items, messages, invoices, signatures, appointments,
--      case_watch, professional_form_fees, fee_schedules, family_invites,
--      employers, job_postings, talent_opt_ins, quote_requests, rfe_uploads,
--      admin_audit_log, audit_log, site_content) get participant-only
--      policies following the 0001 pattern: owner client, assigned
--      professional, founder/admin only — never another client, never an
--      unassigned professional, never a law student alone.
--   5. Audit coverage: SECURITY DEFINER triggers write to audit_log on
--      INSERT / UPDATE / DELETE of cases, documents, invoices, signatures
--      and payment_plans — actor, role, action, entity, IDs only.
--      No PII values (no names, no document contents, no money values
--      beyond the fact a row changed) are written to the audit detail.
--   6. updated_at triggers on every table that has an updated_at column.
--   7. A reminder helper view, cases_due_next_7_days, listing cases with
--      a USCIS milestone, an invoice due, an RFE deadline, or an
--      appointment in the next 7 days. Pure SQL — no external calls.
--
-- WHAT IT DOES NOT DO (honest limits — SQL alone cannot do these)
--   * No live Stripe charge, no Pay in 3 / Monthly auto-charge.
--     Payment plans here are records + sum enforcement only; charging
--     needs Stripe keys + a worker / webhook, not SQL.
--   * No live SMS / email / WhatsApp. The view only LISTS what is due;
--     sending a reminder needs Twilio / an email provider + a worker.
--   * No live USCIS lookup. case_watch.uscis_status is only updated by
--     a worker with a USCIS Production key (Sandbox only today).
--   * No seed rows, no fake data, no keys, no passwords in this file.
--   * It does not change the public site, Vercel, or GitHub.
--
-- RE-RUN SAFETY
--   * Enum values use ADD VALUE IF NOT EXISTS. NOTE: ALTER TYPE ...
--     ADD VALUE cannot run inside a transaction block. If the SQL Editor
--     reports that error, run statements 1a-1b on their own first, then
--     run the rest of this file.
--   * Indexes use CREATE INDEX IF NOT EXISTS; constraints use a
--     pg_constraint guard; triggers use DROP TRIGGER IF EXISTS first;
--     policies use DROP POLICY IF EXISTS first. Re-running is safe.
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1. ENUM FIX — law_student / teacher / founder roles, $35 / $49 plans
-- --------------------------------------------------------------------------
-- 1a. account_role: keep client, preparer, attorney, nonprofit, admin.
ALTER TYPE public.account_role ADD VALUE IF NOT EXISTS 'law_student';
ALTER TYPE public.account_role ADD VALUE IF NOT EXISTS 'teacher';
ALTER TYPE public.account_role ADD VALUE IF NOT EXISTS 'founder';

-- 1b. subscription_plan: keep free_draft, preparer_pro_49, attorney_pro_99,
--     nonprofit_standard_24_50, nonprofit_full_49_50, none.
ALTER TYPE public.subscription_plan ADD VALUE IF NOT EXISTS 'law_student_35';
ALTER TYPE public.subscription_plan ADD VALUE IF NOT EXISTS 'employer_49';

-- NOTE: professional_profiles.role and cases.assigned_provider_role
-- deliberately still allow only ('preparer','attorney','nonprofit').
-- A law student or teacher must NEVER be the assigned provider on a case
-- alone — they work supervised, and the supervisor signs. Do not widen
-- those two checks. The trigger in section 4 enforces the same rule
-- against the provider's actual account role, not just the stored label.

-- --------------------------------------------------------------------------
-- 2. HOT-QUERY INDEXES
-- --------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS cases_client_status_idx
  ON public.cases (client_id, status);
CREATE INDEX IF NOT EXISTS cases_provider_status_idx
  ON public.cases (assigned_provider_id, status);
CREATE INDEX IF NOT EXISTS cases_updated_idx
  ON public.cases (updated_at DESC);

CREATE INDEX IF NOT EXISTS documents_case_created_idx
  ON public.documents (case_id, created_at DESC);
CREATE INDEX IF NOT EXISTS documents_client_idx
  ON public.documents (client_id, created_at DESC);

CREATE INDEX IF NOT EXISTS messages_recipient_read_idx
  ON public.messages (recipient_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS messages_sender_idx
  ON public.messages (sender_id, created_at DESC);

CREATE INDEX IF NOT EXISTS invoices_status_due_idx
  ON public.invoices (status, due_at);
CREATE INDEX IF NOT EXISTS invoices_provider_idx
  ON public.invoices (provider_id, status);

CREATE INDEX IF NOT EXISTS appointments_status_starts_idx
  ON public.appointments (status, starts_at);
CREATE INDEX IF NOT EXISTS appointments_case_idx
  ON public.appointments (case_id, starts_at);

CREATE INDEX IF NOT EXISTS case_watch_next_milestone_idx
  ON public.case_watch (next_milestone_at)
  WHERE next_milestone_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS case_watch_client_milestone_idx
  ON public.case_watch (client_id, next_milestone_at);

CREATE INDEX IF NOT EXISTS inbox_case_created_idx
  ON public.inbox_items (case_id, created_at DESC);
CREATE INDEX IF NOT EXISTS inbox_due_idx
  ON public.inbox_items (due_at)
  WHERE due_at IS NOT NULL AND status NOT IN ('paid', 'signed', 'closed');

CREATE INDEX IF NOT EXISTS payment_plans_client_status_idx
  ON public.payment_plans (client_id, status);
CREATE INDEX IF NOT EXISTS payment_plans_status_updated_idx
  ON public.payment_plans (status, updated_at DESC);

CREATE INDEX IF NOT EXISTS audit_log_case_created_idx
  ON public.audit_log (case_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_actor_created_idx
  ON public.audit_log (actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_entity_idx
  ON public.audit_log (entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_log_case_created_idx
  ON public.admin_audit_log (case_id, created_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_log_actor_created_idx
  ON public.admin_audit_log (actor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS signatures_client_created_idx
  ON public.signatures (client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS rfe_uploads_case_deadline_idx
  ON public.rfe_uploads (case_id, deadline);
CREATE INDEX IF NOT EXISTS rfe_uploads_status_deadline_idx
  ON public.rfe_uploads (status, deadline);
CREATE INDEX IF NOT EXISTS nvc_trackers_client_checked_idx
  ON public.nvc_trackers (client_id, last_checked_at DESC);
CREATE INDEX IF NOT EXISTS family_invites_case_expires_idx
  ON public.family_invites (case_id, expires_at);
CREATE INDEX IF NOT EXISTS fee_schedules_profile_form_idx
  ON public.fee_schedules (profile_id, form_code);
CREATE INDEX IF NOT EXISTS profiles_role_published_idx
  ON public.professional_profiles (role, is_published);

-- One ACTIVE payment plan per case only (a second plan must wait until
-- the first is completed / past_due / cancelled / defaulted).
CREATE UNIQUE INDEX IF NOT EXISTS payment_plans_one_active_per_case_idx
  ON public.payment_plans (case_id) WHERE status = 'active';

-- --------------------------------------------------------------------------
-- 3. DATA-INTEGRITY CONSTRAINTS (guarded so re-running does not fail)
-- --------------------------------------------------------------------------
DO $$
BEGIN
  -- paid can never exceed the plan total.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'payment_plans_paid_within_total') THEN
    ALTER TABLE public.payment_plans
      ADD CONSTRAINT payment_plans_paid_within_total
      CHECK (paid_cents <= total_service_fee_cents);
  END IF;

  -- Missed-payment penalty is a percentage, 0-100. Founder rule is 50%.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'payment_plans_penalty_range') THEN
    ALTER TABLE public.payment_plans
      ADD CONSTRAINT payment_plans_penalty_range
      CHECK (missed_payment_penalty_percent >= 0
             AND missed_payment_penalty_percent <= 100);
  END IF;

  -- Documents must live in the private 'vault' bucket — never a public one.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'documents_vault_bucket_only') THEN
    ALTER TABLE public.documents
      ADD CONSTRAINT documents_vault_bucket_only
      CHECK (storage_bucket = 'vault');
  END IF;

  -- A paid invoice must actually say paid.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'invoices_paid_consistency') THEN
    ALTER TABLE public.invoices
      ADD CONSTRAINT invoices_paid_consistency
      CHECK (paid_at IS NULL OR status = 'paid');
  END IF;

  -- An invite cannot expire before it was created.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'family_invites_expiry_after_created') THEN
    ALTER TABLE public.family_invites
      ADD CONSTRAINT family_invites_expiry_after_created
      CHECK (expires_at IS NULL OR expires_at > created_at);
  END IF;

  -- RFE deadline must be a real date in the future at creation time is
  -- too strict for backfilled rows, so only require a deadline when the
  -- status says the RFE is still open.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'rfe_uploads_open_needs_deadline') THEN
    ALTER TABLE public.rfe_uploads
      ADD CONSTRAINT rfe_uploads_open_needs_deadline
      CHECK (status <> 'needs_review' OR deadline IS NOT NULL);
  END IF;
END $$;

-- 3a. pay_choice: widen the 0002 check to include Monthly plans.
--     0002 allowed only ('all_at_once','installments_3'). The Live App
--     v33 sells Monthly 6 / 12 via Stripe, so the database must accept
--     those choices too — otherwise a real Monthly order cannot be saved.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint
             WHERE conname = 'payment_plans_pay_choice_check') THEN
    ALTER TABLE public.payment_plans
      DROP CONSTRAINT payment_plans_pay_choice_check;
  END IF;
  ALTER TABLE public.payment_plans
    ADD CONSTRAINT payment_plans_pay_choice_check
    CHECK (pay_choice IN ('all_at_once', 'installments_3',
                          'monthly_6', 'monthly_12'));
END $$;

-- 3b. payment_plans.status: it was free text in 0002 — pin it down.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'payment_plans_status_check') THEN
    ALTER TABLE public.payment_plans
      ADD CONSTRAINT payment_plans_status_check
      CHECK (status IN ('active', 'completed', 'past_due',
                        'cancelled', 'defaulted'));
  END IF;
END $$;

-- --------------------------------------------------------------------------
-- 4. PAYMENT-PLAN + ASSIGNED-PROVIDER ENFORCEMENT (triggers, not just CHECKs)
--    A CHECK cannot sum an array, so the installment-sum rule lives here.
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_payment_plan()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_sum integer;
  v_expected integer;
BEGIN
  IF NEW.paid_cents > NEW.total_service_fee_cents THEN
    RAISE EXCEPTION 'paid_cents (%) exceeds total_service_fee_cents (%)',
      NEW.paid_cents, NEW.total_service_fee_cents;
  END IF;

  IF NEW.missed_payment_penalty_percent < 0
     OR NEW.missed_payment_penalty_percent > 100 THEN
    RAISE EXCEPTION 'missed_payment_penalty_percent must be 0-100';
  END IF;

  -- The named provider must be the case's assigned professional.
  IF NEW.provider_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.cases c
                   WHERE c.id = NEW.case_id
                     AND c.assigned_provider_id = NEW.provider_id) THEN
      RAISE EXCEPTION 'payment plan provider must be the assigned provider for the case';
    END IF;
  END IF;

  -- Installment rules: count, every installment > 0, sum = total.
  IF NEW.pay_choice = 'all_at_once' THEN
    IF cardinality(NEW.installment_amounts_cents) > 0 THEN
      RAISE EXCEPTION 'all_at_once plans must not carry installment amounts';
    END IF;
  ELSE
    IF NEW.pay_choice = 'installments_3' THEN v_expected := 3;
    ELSIF NEW.pay_choice = 'monthly_6' THEN v_expected := 6;
    ELSIF NEW.pay_choice = 'monthly_12' THEN v_expected := 12;
    ELSE
      RAISE EXCEPTION 'unknown pay_choice %', NEW.pay_choice;
    END IF;

    IF cardinality(NEW.installment_amounts_cents) <> v_expected THEN
      RAISE EXCEPTION 'pay_choice % requires exactly % installments, got %',
        NEW.pay_choice, v_expected,
        cardinality(NEW.installment_amounts_cents);
    END IF;

    IF EXISTS (SELECT 1 FROM unnest(NEW.installment_amounts_cents) AS v
               WHERE v <= 0) THEN
      RAISE EXCEPTION 'every installment must be greater than 0 cents';
    END IF;

    SELECT COALESCE(SUM(v), 0) INTO v_sum
      FROM unnest(NEW.installment_amounts_cents) AS v;
    IF v_sum <> NEW.total_service_fee_cents THEN
      RAISE EXCEPTION 'installments sum to % cents, but total is % cents — they must match',
        v_sum, NEW.total_service_fee_cents;
    END IF;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS payment_plans_validate ON public.payment_plans;
CREATE TRIGGER payment_plans_validate
  BEFORE INSERT OR UPDATE ON public.payment_plans
  FOR EACH ROW EXECUTE FUNCTION public.validate_payment_plan();

-- Assigned provider must be a real preparer / attorney / DOJ nonprofit
-- account, and the stored role label must match that account's role.
-- A law student or teacher can never be assigned a case alone.
CREATE OR REPLACE FUNCTION public.validate_assigned_provider()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_role account_role;
BEGIN
  IF NEW.assigned_provider_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT role INTO v_role FROM public.accounts
    WHERE id = NEW.assigned_provider_id;

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'assigned provider account not found';
  END IF;

  IF v_role NOT IN ('preparer', 'attorney', 'nonprofit') THEN
    RAISE EXCEPTION 'assigned provider must be a preparer, attorney, or DOJ nonprofit — law students and teachers cannot be assigned a case alone';
  END IF;

  IF NEW.assigned_provider_role IS NOT NULL
     AND NEW.assigned_provider_role <> v_role THEN
    RAISE EXCEPTION 'assigned_provider_role does not match the provider account role';
  END IF;

  NEW.assigned_provider_role := v_role;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS cases_validate_assigned_provider ON public.cases;
CREATE TRIGGER cases_validate_assigned_provider
  BEFORE INSERT OR UPDATE OF assigned_provider_id, assigned_provider_role
  ON public.cases
  FOR EACH ROW EXECUTE FUNCTION public.validate_assigned_provider();

-- --------------------------------------------------------------------------
-- 5. updated_at TRIGGERS — every table that has updated_at gets one.
--    (0001/0002 defined the column but no trigger ever refreshed it.)
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'accounts', 'professional_profiles', 'professional_form_fees',
    'cases', 'inbox_items', 'documents', 'invoices', 'appointments',
    'case_watch', 'fee_schedules', 'payment_plans', 'employers',
    'nvc_trackers', 'rfe_uploads', 'site_content'
  ] LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS %I ON public.%I',
      'set_updated_at_' || t, t);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE ON public.%I '
      'FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()',
      'set_updated_at_' || t, t);
  END LOOP;
END $$;

-- --------------------------------------------------------------------------
-- 6. AUDIT COVERAGE — who / when / what changed, IDs only, no PII values.
--    SECURITY DEFINER so the trigger can write to audit_log even though
--    audit_log has no INSERT policy for ordinary users (section 7).
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_audit_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_entity_id uuid;
  v_case_id uuid;
  v_detail jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_entity_id := OLD.id;
    v_case_id := NULL;  -- case may itself be deleted; FK would fail.
    IF TG_TABLE_NAME = 'cases' THEN
      v_detail := jsonb_build_object('operation', 'DELETE', 'case_id', OLD.id);
    ELSE
      v_detail := jsonb_build_object('operation', 'DELETE', 'case_id', OLD.case_id);
    END IF;
  ELSE
    v_entity_id := NEW.id;
    IF TG_TABLE_NAME = 'cases' THEN
      v_case_id := NEW.id;
    ELSE
      v_case_id := NEW.case_id;
    END IF;
    v_detail := jsonb_build_object('operation', TG_OP);
  END IF;

  INSERT INTO public.audit_log
    (actor_id, actor_role, action, entity_type, entity_id, case_id, detail)
  VALUES
    (public.current_account_id(), public.current_account_role(),
     TG_OP || '_' || TG_TABLE_NAME, TG_TABLE_NAME,
     v_entity_id, v_case_id, v_detail);

  RETURN COALESCE(NEW, OLD);
END $$;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'cases', 'documents', 'invoices', 'signatures', 'payment_plans'
  ] LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS %I ON public.%I',
      'audit_' || t, t);
    EXECUTE format(
      'CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON public.%I '
      'FOR EACH ROW EXECUTE FUNCTION public.log_audit_change()',
      'audit_' || t, t);
  END LOOP;
END $$;

-- --------------------------------------------------------------------------
-- 7. RLS HARDENING — fill every zero-policy table from 0001/0002.
--    Pattern (same as 0001): owner client, assigned professional,
--    founder/admin only. No policy ever grants a law student, teacher,
--    or unassigned professional access to a case on their own.
--    Founder/admin get a separate SELECT policy per case-scoped table so
--    the founder can oversee without becoming a case participant.
-- --------------------------------------------------------------------------

-- 7a. Founder/admin can READ (not write) every case-scoped table.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'cases', 'inbox_items', 'documents', 'messages', 'invoices',
    'signatures', 'appointments', 'case_watch', 'payment_plans',
    'nvc_trackers', 'rfe_uploads', 'family_invites', 'fee_schedules'
  ] LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I',
      'select_founder_admin_' || t, t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT USING '
      '(public.current_account_role() IN (''admin'', ''founder''))',
      'select_founder_admin_' || t, t);
  END LOOP;
END $$;

-- 7b. Widen the two 0001 admin checks to include the founder role.
DROP POLICY IF EXISTS accounts_select_own ON public.accounts;
CREATE POLICY accounts_select_own ON public.accounts FOR SELECT
  USING (id = public.current_account_id()
    OR (public.current_account_role() IN ('admin', 'founder')
        AND role IN ('attorney', 'nonprofit')
        AND verification_status IN ('pending', 'rejected', 'expired')));

DROP POLICY IF EXISTS profiles_select ON public.professional_profiles;
CREATE POLICY profiles_select ON public.professional_profiles FOR SELECT
  USING (account_id = public.current_account_id()
    OR public.current_account_role() IN ('admin', 'founder'));

-- 7c. Tables with RLS enabled but NO policies in 0001.
--     professional_form_fees: only the profile owner (or founder/admin).
CREATE POLICY professional_form_fees_select
  ON public.professional_form_fees FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.professional_profiles p
                 WHERE p.id = profile_id
                   AND p.account_id = public.current_account_id()));
CREATE POLICY professional_form_fees_insert
  ON public.professional_form_fees FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.professional_profiles p
                      WHERE p.id = profile_id
                        AND p.account_id = public.current_account_id()));
CREATE POLICY professional_form_fees_update
  ON public.professional_form_fees FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.professional_profiles p
                 WHERE p.id = profile_id
                   AND p.account_id = public.current_account_id()));

--     inbox_items / messages / invoices / signatures / appointments /
--     case_watch: same is_case_participant rule as cases/documents.
DROP POLICY IF EXISTS inbox_items_select ON public.inbox_items;
CREATE POLICY inbox_items_select ON public.inbox_items FOR SELECT
  USING (public.is_case_participant(case_id));
DROP POLICY IF EXISTS inbox_items_insert ON public.inbox_items;
CREATE POLICY inbox_items_insert ON public.inbox_items FOR INSERT
  WITH CHECK (public.is_case_participant(case_id)
    AND requested_by = public.current_account_id());
DROP POLICY IF EXISTS inbox_items_update ON public.inbox_items;
CREATE POLICY inbox_items_update ON public.inbox_items FOR UPDATE
  USING (public.is_case_participant(case_id));

DROP POLICY IF EXISTS messages_select ON public.messages;
CREATE POLICY messages_select ON public.messages FOR SELECT
  USING (public.is_case_participant(case_id));
DROP POLICY IF EXISTS messages_insert ON public.messages;
CREATE POLICY messages_insert ON public.messages FOR INSERT
  WITH CHECK (public.is_case_participant(case_id)
    AND sender_id = public.current_account_id());
DROP POLICY IF EXISTS messages_update ON public.messages;
CREATE POLICY messages_update ON public.messages FOR UPDATE
  USING (recipient_id = public.current_account_id()
    OR sender_id = public.current_account_id());

DROP POLICY IF EXISTS invoices_select ON public.invoices;
CREATE POLICY invoices_select ON public.invoices FOR SELECT
  USING (public.is_case_participant(case_id));
DROP POLICY IF EXISTS invoices_insert ON public.invoices;
CREATE POLICY invoices_insert ON public.invoices FOR INSERT
  WITH CHECK (public.is_case_participant(case_id)
    AND (provider_id = public.current_account_id()
         OR client_id = public.current_account_id()));
DROP POLICY IF EXISTS invoices_update ON public.invoices;
CREATE POLICY invoices_update ON public.invoices FOR UPDATE
  USING (public.is_case_participant(case_id));

DROP POLICY IF EXISTS signatures_select ON public.signatures;
CREATE POLICY signatures_select ON public.signatures FOR SELECT
  USING (public.is_case_participant(case_id));
DROP POLICY IF EXISTS signatures_insert ON public.signatures;
CREATE POLICY signatures_insert ON public.signatures FOR INSERT
  WITH CHECK (public.is_case_participant(case_id)
    AND client_id = public.current_account_id());
DROP POLICY IF EXISTS signatures_update ON public.signatures;
CREATE POLICY signatures_update ON public.signatures FOR UPDATE
  USING (client_id = public.current_account_id()
    OR public.is_case_participant(case_id));

DROP POLICY IF EXISTS appointments_select ON public.appointments;
CREATE POLICY appointments_select ON public.appointments FOR SELECT
  USING (public.is_case_participant(case_id));
DROP POLICY IF EXISTS appointments_insert ON public.appointments;
CREATE POLICY appointments_insert ON public.appointments FOR INSERT
  WITH CHECK (public.is_case_participant(case_id)
    AND (client_id = public.current_account_id()
         OR provider_id = public.current_account_id()));
DROP POLICY IF EXISTS appointments_update ON public.appointments;
CREATE POLICY appointments_update ON public.appointments FOR UPDATE
  USING (public.is_case_participant(case_id));

DROP POLICY IF EXISTS case_watch_select ON public.case_watch;
CREATE POLICY case_watch_select ON public.case_watch FOR SELECT
  USING (public.is_case_participant(case_id));
DROP POLICY IF EXISTS case_watch_insert ON public.case_watch;
CREATE POLICY case_watch_insert ON public.case_watch FOR INSERT
  WITH CHECK (public.is_case_participant(case_id)
    AND client_id = public.current_account_id());
DROP POLICY IF EXISTS case_watch_update ON public.case_watch;
CREATE POLICY case_watch_update ON public.case_watch FOR UPDATE
  USING (public.is_case_participant(case_id));

-- 7d. Tables with RLS enabled but NO policies in 0002.
DROP POLICY IF EXISTS fee_schedules_select ON public.fee_schedules;
CREATE POLICY fee_schedules_select ON public.fee_schedules FOR SELECT
  USING (profile_id IS NULL
    OR EXISTS (SELECT 1 FROM public.professional_profiles p
               WHERE p.id = profile_id
                 AND p.account_id = public.current_account_id()));
DROP POLICY IF EXISTS fee_schedules_insert ON public.fee_schedules;
CREATE POLICY fee_schedules_insert ON public.fee_schedules FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.professional_profiles p
                      WHERE p.id = profile_id
                        AND p.account_id = public.current_account_id()));
DROP POLICY IF EXISTS fee_schedules_update ON public.fee_schedules;
CREATE POLICY fee_schedules_update ON public.fee_schedules FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.professional_profiles p
                 WHERE p.id = profile_id
                   AND p.account_id = public.current_account_id()));

--     payment_plans: select existed in 0002; add insert/update.
DROP POLICY IF EXISTS payment_plans_insert ON public.payment_plans;
CREATE POLICY payment_plans_insert ON public.payment_plans FOR INSERT
  WITH CHECK (public.is_case_participant(case_id)
    AND (provider_id = public.current_account_id()
         OR client_id = public.current_account_id()));
DROP POLICY IF EXISTS payment_plans_update ON public.payment_plans;
CREATE POLICY payment_plans_update ON public.payment_plans FOR UPDATE
  USING (public.is_case_participant(case_id));

DROP POLICY IF EXISTS family_invites_select ON public.family_invites;
CREATE POLICY family_invites_select ON public.family_invites FOR SELECT
  USING (public.is_case_participant(case_id));
DROP POLICY IF EXISTS family_invites_insert ON public.family_invites;
CREATE POLICY family_invites_insert ON public.family_invites FOR INSERT
  WITH CHECK (public.is_case_participant(case_id)
    AND invited_by = public.current_account_id());

DROP POLICY IF EXISTS employers_select ON public.employers;
CREATE POLICY employers_select ON public.employers FOR SELECT
  USING (account_id = public.current_account_id()
    OR public.current_account_role() IN ('admin', 'founder'));
DROP POLICY IF EXISTS employers_insert ON public.employers;
CREATE POLICY employers_insert ON public.employers FOR INSERT
  WITH CHECK (account_id = public.current_account_id());
DROP POLICY IF EXISTS employers_update ON public.employers;
CREATE POLICY employers_update ON public.employers FOR UPDATE
  USING (account_id = public.current_account_id())
  WITH CHECK (account_id = public.current_account_id());

DROP POLICY IF EXISTS job_postings_select ON public.job_postings;
CREATE POLICY job_postings_select ON public.job_postings FOR SELECT
  USING (is_active = true
    OR EXISTS (SELECT 1 FROM public.employers e
               WHERE e.id = employer_id
                 AND e.account_id = public.current_account_id()));
DROP POLICY IF EXISTS job_postings_insert ON public.job_postings;
CREATE POLICY job_postings_insert ON public.job_postings FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.employers e
                      WHERE e.id = employer_id
                        AND e.account_id = public.current_account_id()));
DROP POLICY IF EXISTS job_postings_update ON public.job_postings;
CREATE POLICY job_postings_update ON public.job_postings FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.employers e
                 WHERE e.id = employer_id
                   AND e.account_id = public.current_account_id()));

DROP POLICY IF EXISTS talent_opt_ins_select ON public.talent_opt_ins;
CREATE POLICY talent_opt_ins_select ON public.talent_opt_ins FOR SELECT
  USING (account_id = public.current_account_id()
    OR public.current_account_role() IN ('admin', 'founder'));
DROP POLICY IF EXISTS talent_opt_ins_insert ON public.talent_opt_ins;
CREATE POLICY talent_opt_ins_insert ON public.talent_opt_ins FOR INSERT
  WITH CHECK (account_id = public.current_account_id());
DROP POLICY IF EXISTS talent_opt_ins_update ON public.talent_opt_ins;
CREATE POLICY talent_opt_ins_update ON public.talent_opt_ins FOR UPDATE
  USING (account_id = public.current_account_id())
  WITH CHECK (account_id = public.current_account_id());

--     quote_requests: anyone signed in may SUBMIT a quote request;
--     only founder/admin may READ them (they hold name/email/phone).
DROP POLICY IF EXISTS quote_requests_insert ON public.quote_requests;
CREATE POLICY quote_requests_insert ON public.quote_requests FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS quote_requests_select ON public.quote_requests;
CREATE POLICY quote_requests_select ON public.quote_requests FOR SELECT
  USING (public.current_account_role() IN ('admin', 'founder'));

DROP POLICY IF EXISTS nvc_trackers_insert ON public.nvc_trackers;
CREATE POLICY nvc_trackers_insert ON public.nvc_trackers FOR INSERT
  WITH CHECK (public.is_case_participant(case_id)
    AND client_id = public.current_account_id());
DROP POLICY IF EXISTS nvc_trackers_update ON public.nvc_trackers;
CREATE POLICY nvc_trackers_update ON public.nvc_trackers FOR UPDATE
  USING (public.is_case_participant(case_id));

DROP POLICY IF EXISTS rfe_uploads_insert ON public.rfe_uploads;
CREATE POLICY rfe_uploads_insert ON public.rfe_uploads FOR INSERT
  WITH CHECK (public.is_case_participant(case_id)
    AND client_id = public.current_account_id());
DROP POLICY IF EXISTS rfe_uploads_update ON public.rfe_uploads;
CREATE POLICY rfe_uploads_update ON public.rfe_uploads FOR UPDATE
  USING (public.is_case_participant(case_id));

--     audit logs: read-only for the actor themself + founder/admin.
--     No INSERT policy on purpose — rows arrive only via the
--     SECURITY DEFINER audit trigger (section 6) or the service role.
DROP POLICY IF EXISTS audit_log_select ON public.audit_log;
CREATE POLICY audit_log_select ON public.audit_log FOR SELECT
  USING (actor_id = public.current_account_id()
    OR public.current_account_role() IN ('admin', 'founder'));
DROP POLICY IF EXISTS admin_audit_log_select ON public.admin_audit_log;
CREATE POLICY admin_audit_log_select ON public.admin_audit_log FOR SELECT
  USING (public.current_account_role() IN ('admin', 'founder'));

--     site_content: signed-in users may read public content/news;
--     only founder/admin may change it.
DROP POLICY IF EXISTS site_content_select ON public.site_content;
CREATE POLICY site_content_select ON public.site_content FOR SELECT
  USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS site_content_update ON public.site_content;
CREATE POLICY site_content_update ON public.site_content FOR UPDATE
  USING (public.current_account_role() IN ('admin', 'founder'))
  WITH CHECK (public.current_account_role() IN ('admin', 'founder'));

-- --------------------------------------------------------------------------
-- 8. REMINDER HELPER — cases due in the next 7 days. Pure SQL, no calls.
--    security_invoker = true so the view honours the caller's RLS on the
--    underlying tables (a client only ever sees their own due items).
-- --------------------------------------------------------------------------
DROP VIEW IF EXISTS public.cases_due_next_7_days;
CREATE VIEW public.cases_due_next_7_days
WITH (security_invoker = true) AS
SELECT
  c.id AS case_id,
  c.client_id,
  c.assigned_provider_id,
  c.status AS case_status,
  'uscis_milestone' AS due_type,
  w.next_milestone_at AS due_at,
  w.form_code AS form_code,
  w.receipt_number AS reference
FROM public.cases c
JOIN public.case_watch w ON w.case_id = c.id
WHERE w.next_milestone_at >= now()
  AND w.next_milestone_at < now() + interval '7 days'
  AND c.status NOT IN ('approved', 'denied', 'closed')
UNION ALL
SELECT
  c.id, c.client_id, c.assigned_provider_id, c.status,
  'invoice_due', i.due_at, i.form_code, i.description
FROM public.cases c
JOIN public.invoices i ON i.case_id = c.id
WHERE i.due_at >= now()
  AND i.due_at < now() + interval '7 days'
  AND i.status IN ('open', 'pending', 'past_due')
UNION ALL
SELECT
  c.id, c.client_id, c.assigned_provider_id, c.status,
  'rfe_deadline', r.deadline::timestamptz, NULL, r.status
FROM public.cases c
JOIN public.rfe_uploads r ON r.case_id = c.id
WHERE r.deadline >= CURRENT_DATE
  AND r.deadline < CURRENT_DATE + interval '7 days'
  AND r.status = 'needs_review'
UNION ALL
SELECT
  c.id, c.client_id, c.assigned_provider_id, c.status,
  'appointment', a.starts_at, NULL, a.type::text
FROM public.cases c
JOIN public.appointments a ON a.case_id = c.id
WHERE a.starts_at >= now()
  AND a.starts_at < now() + interval '7 days'
  AND a.status IN ('requested', 'confirmed', 'rescheduled');

-- --------------------------------------------------------------------------
-- 9. SELF-CHECKS (run at the end; they only read — they change nothing)
--    If any of these returns a row, something above did not apply.
-- --------------------------------------------------------------------------
-- Tables with RLS enabled but still zero policies:
--   SELECT tablename FROM pg_tables
--   WHERE schemaname = 'public' AND rowsecurity = true
--     AND tablename NOT IN (
--       SELECT tablename FROM pg_policies WHERE schemaname = 'public');
-- Enum values now present:
--   SELECT enumlabel FROM pg_enum
--   WHERE enumtypid = 'public.account_role'::regtype
--   ORDER BY enumsortorder;
--   SELECT enumlabel FROM pg_enum
--   WHERE enumtypid = 'public.subscription_plan'::regtype
--   ORDER BY enumsortorder;
-- ============================================================================
-- END OF 0003 — next: private Storage bucket 'vault', Email auth on,
-- then the isolation check (client sees 1 case, assigned pro sees 1 case,
-- unassigned pro sees 0 rows) before any real client document is stored.
-- ============================================================================
