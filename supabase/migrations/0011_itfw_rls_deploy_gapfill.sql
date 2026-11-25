-- ============================================================================
-- ITFW Live — Supabase migration 0011: RLS deploy gap-fill (audit of 0001–0010)
-- Project: "Immigration" — https://jdxjskqdvwqarfhcqjlg.supabase.co
-- Run AFTER 0001–0010, in order. 0010 IS present in the repo
-- (0010_itfw_leads_nvc_lifecycle_notifications.sql — landed Nov 19,
-- 2026 from another builder while this file was written; read, not
-- edited here). 0010 creates preparer_leads + case_lifecycle +
-- notification_logs and extends case_agency_numbers with NVC columns,
-- with owner-only leads policies and participant policies on the new
-- case tables — see the already-covered list below. This file does NOT
-- depend on 0010's objects (it only touches 0001 accounts/cases/
-- documents, 0003 founder enum value, 0004 case_student_assignments/
-- student_profiles, 0006 service_orders, and 0009
-- case_agency_numbers), but the audit below was reconciled against
-- 0010 after it landed, so no policy here duplicates one there.
-- Do NOT run live until the founder / browser task says so. If any
-- statement errors, STOP and report the error verbatim.
--
-- DO NOT RUN the pasted rls_policies.sql draft this file replaces. It is
-- WRONG for this project (verified by reading 0001–0009):
--  * It uses tables users / leads / case_documents, which DO NOT EXIST
--    here. Ours are accounts / quote_requests / documents (0001–0002).
--    A policy on a nonexistent table errors the whole run.
--  * It compares auth.uid() directly to account ids. Ours resolves the
--    caller through public.current_account_id() — accounts.auth_user_id
--    = auth.uid() — SECURITY DEFINER since 0008 (plain-SQL helpers
--    recursed through accounts RLS and crashed every authenticated
--    read; see 0008). Every policy below uses that helper.
--  * It grants family access by matching an email to a users table.
--    Ours uses family_invites.invite_token + case_family_members.
--    invite_token (0002/0009) and a server-side guest-upload endpoint:
--    an unauthenticated guest token CANNOT get RLS access via
--    auth.uid(), so NO anon/guest policy is created here, deliberately
--    (same decision as 0007). Family view/upload goes through the
--    family-portal token check + service-role insert (endpoint not
--    built yet — see portal/src/app/api, only stripe/webhook,
--    reminders, pdf/autofill exist; the guest-upload endpoint is
--    still TO BUILD, and must check invite_token + expiry +
--    allowed_document_types, then insert into documents with
--    storage_bucket = 'vault').
--
-- AUDIT OF 0001–0009 — ALREADY COVERED, NOT duplicated here:
--  * accounts SELECT own + UPDATE own (0001; widened to founder in
--    0003). Founder/admin SELECT on attorney/nonprofit verification
--    rows (0001/0003). block_self_verification trigger (0001).
--  * cases SELECT / INSERT (client) / UPDATE participant (0001).
--  * documents SELECT / INSERT / UPDATE participant (0001).
--  * service_orders SELECT / INSERT (client creates own order at
--    checkout) (0006); order_invoices SELECT / INSERT participant
--    (0006). order_invoices has NO user UPDATE policy ON PURPOSE
--    (0007): status flips to 'paid' only via the Stripe webhook
--    (service role). Client "view + pay" is SELECT + Stripe
--    checkout — already covered, no policy added.
--  * case_agency_numbers SELECT participant (0009) — client view.
--    Family view is via the family-portal token endpoint, not RLS.
--  * case_student_assignments SELECT (student / participant /
--    founder-admin) + DELETE (assigner / founder-admin) (0004/0007).
--  * Founder/admin SELECT on every case-scoped table (0003 §7a,
--    0006, 0009) — read-only by design; writes go via service role.
--  * preparer_leads: EXISTS — created in 0010 with owner-only
--    SELECT / INSERT / UPDATE / DELETE (preparer_id =
--    current_account_id()) + founder/admin SELECT. Intent
--    "preparer_leads owner-only" is already covered; no policy
--    added here. (An earlier draft of this audit said the table did
--    not exist — that was true when first checked, and 0010 landed
--    concurrently; re-verified before this file was finished.)
--    quote_requests (0002; SELECT/INSERT in 0003) remains the
--    pre-case quote record for non-preparer flows.
--  * case_lifecycle SELECT / INSERT / UPDATE participant +
--    notification_logs SELECT / INSERT participant, append-only
--    (0010) — already covered, no policy added here.
--  * No DELETE policy exists on any user table except
--    preparer_leads_delete_own (0010): with RLS enabled that is
--    fail-closed (deletes denied for all non-service-role callers).
--    Deliberate — no DELETE policy added here.
--
-- WHAT 0011 ADDS (only the genuinely missing pieces):
--  1. accounts_insert_own — NEW. No accounts INSERT policy existed,
--     so a newly signed-up user could not create their own accounts
--     row through the anon client (only service role could). WITH
--     CHECK (auth_user_id = auth.uid() AND role::text NOT IN
--     ('admin','founder')): auth_user_id IS the auth id, so this
--     comparison is correct here (unlike comparing auth.uid() to a
--     plain account id), and self-registration can never mint an
--     admin/founder row. role::text avoids an enum-coercion error
--     if this file ever ran before 0003 added 'founder'.
--  2. is_assigned_student(p_case_id) — NEW SECURITY DEFINER helper
--     (0008 pattern, search_path pinned): true only when a row
--     exists in case_student_assignments for this case + the caller
--     AND the student's student_profiles.confirmation_status =
--     'confirmed' (0004: supervisor confirmation lives on the
--     student profile, NOT on the assignment row — the assignment
--     table has no confirmation column). SECURITY DEFINER so the
--     lookups bypass RLS instead of recursing through it.
--  3. cases_select_assigned_student — NEW. is_case_participant()
--     (0001/0008) is client OR assigned provider only, so an
--     assigned student could see their assignment row (0004) but
--     NOT the case itself. Permissive policies OR together, so this
--     adds student read without touching cases_select.
--  4. documents_select_assigned_student + documents_insert_assigned_
--     student — NEW. Same gap on documents: an assigned, confirmed
--     student can now read and upload documents on their case
--     (uploaded_by must be themself). Document REVIEW stays
--     provider-only (documents_update_provider_review, 0001) —
--     students do not review/accept documents.
--  5. case_agency_numbers_insert / _update — REPLACED (DROP +
--     CREATE, same names). 0009 let ANY case participant (client
--     included) insert/update agency numbers. Intent is
--     provider-manage: now the assigned provider only. Client view
--     is unchanged (SELECT stays participant). Founder/admin keep
--     SELECT via select_founder_admin_case_agency_numbers; their
--     corrections go via service role / SQL Editor, as elsewhere.
--  6. service_orders_update — REPLACED (DROP + CREATE, same name).
--     0006 let ANY participant update an order (a client could edit
--     package/price after checkout). Intent is provider-manage:
--     now the assigned provider only. Client creation (INSERT,
--     client_id = self) and client view (SELECT) are unchanged.
--  7. case_student_assignments_insert — REPLACED (DROP + CREATE,
--     same name). 0004 let ANY case participant (client included)
--     create an assignment with assigned_by = self, contradicting
--     its own comment ("assignment made by the case's verified
--     attorney / DOJ provider"). Now the assigner must be the
--     case's assigned provider. Supervisor confirmation is still
--     enforced separately by is_assigned_student() (item 2).
--
-- KNOWN GAP NOT FIXED HERE (needs a founder decision, not a policy):
--  * accounts_update_own (0001) lets an owner change ANY column on
--    their own row, including role — a client could set role =
--    'admin' and then pass every admin/founder RLS check. Fixing it
--    needs a BEFORE UPDATE trigger (same shape as 0001's
--    block_self_verification, exempting service role where
--    auth.uid() IS NULL), not a policy, and is out of this file's
--    "policies only" scope. Do NOT wire Supabase Auth live until
--    this is decided: either add that trigger — now migration 0019 (Nov 19-20
--    consolidation) — or restrict role changes to service role. Flagged
--    here so it is not silently left open.
--  * Students have no access to messages / inbox_items on assigned
--    cases (out of the listed scope — a future migration if student
--    chat is needed). Students also cannot be the assigned provider
--    (validate_assigned_provider trigger, 0003) — unchanged.
--
-- No seed rows, no keys, no passwords. No tables created.
-- ============================================================================

-- --- 2. Assigned-student helper (SECURITY DEFINER, 0008 pattern) -----------
create or replace function public.is_assigned_student(p_case_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.case_student_assignments a
    join public.student_profiles sp on sp.account_id = a.student_id
    where a.case_id = p_case_id
      and a.student_id = public.current_account_id()
      and sp.confirmation_status = 'confirmed'
  )
$$;

-- --- 1. accounts: self-registration insert (was missing entirely) ----------
drop policy if exists accounts_insert_own on public.accounts;
create policy accounts_insert_own on public.accounts for insert
  with check (
    auth_user_id = auth.uid()
    and role::text not in ('admin', 'founder')
  );

-- --- 3. cases: assigned, supervisor-confirmed student may read -------------
drop policy if exists cases_select_assigned_student on public.cases;
create policy cases_select_assigned_student on public.cases for select
  using (public.is_assigned_student(id));

-- --- 4. documents: assigned, supervisor-confirmed student read + upload ----
drop policy if exists documents_select_assigned_student on public.documents;
create policy documents_select_assigned_student on public.documents for select
  using (public.is_assigned_student(case_id));

drop policy if exists documents_insert_assigned_student on public.documents;
create policy documents_insert_assigned_student on public.documents for insert
  with check (public.is_assigned_student(case_id)
    and uploaded_by = public.current_account_id());

-- --- 5. case_agency_numbers: provider-manage (was any participant) ---------
drop policy if exists case_agency_numbers_insert on public.case_agency_numbers;
create policy case_agency_numbers_insert on public.case_agency_numbers for insert
  with check (exists (
    select 1 from public.cases c
    where c.id = case_id
      and c.assigned_provider_id = public.current_account_id()
  ));

drop policy if exists case_agency_numbers_update on public.case_agency_numbers;
create policy case_agency_numbers_update on public.case_agency_numbers for update
  using (exists (
    select 1 from public.cases c
    where c.id = case_id
      and c.assigned_provider_id = public.current_account_id()
  ))
  with check (exists (
    select 1 from public.cases c
    where c.id = case_id
      and c.assigned_provider_id = public.current_account_id()
  ));

-- --- 6. service_orders: provider-manage on update (was any participant) ----
drop policy if exists service_orders_update on public.service_orders;
create policy service_orders_update on public.service_orders for update
  using (exists (
    select 1 from public.cases c
    where c.id = case_id
      and c.assigned_provider_id = public.current_account_id()
  ))
  with check (exists (
    select 1 from public.cases c
    where c.id = case_id
      and c.assigned_provider_id = public.current_account_id()
  ));

-- --- 7. case_student_assignments: only the case's provider may assign ------
drop policy if exists case_student_assignments_insert on public.case_student_assignments;
create policy case_student_assignments_insert on public.case_student_assignments for insert
  with check (assigned_by = public.current_account_id()
    and exists (
      select 1 from public.cases c
      where c.id = case_id
        and c.assigned_provider_id = public.current_account_id()
    ));

-- ============================================================================
-- END OF 0011 — after running 0001 → 0011 in order (0008 before the
-- isolation check), RE-RUN the isolation check before any real client
-- document is stored: client sees 1 case, assigned professional sees 1
-- case, unassigned professional sees 0 rows on every case-scoped table,
-- and an assigned but UNCONFIRMED student sees 0 cases / 0 documents.
-- ============================================================================
