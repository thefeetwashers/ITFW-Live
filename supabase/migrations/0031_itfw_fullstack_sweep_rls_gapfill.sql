-- ============================================================================
-- ITFW Live — Supabase migration 0031: full-stack expert sweep RLS gapfill
-- (founder's final expert sweep, Nov 28, 2026).
-- Run AFTER 0030. Do NOT run live until the founder / browser task says so.
--
-- NOTE ON NUMBERING (resolved by the coordinator, Nov 28, 2026): the
-- directory briefly held TWO files named 0030 and TWO named 0033.
-- Resolved by rename, no content changed: 0030_itfw_more_added.sql is
-- now 0035_itfw_more_added.sql and 0033_itfw_expert_tools.sql is now
-- 0036_itfw_expert_tools.sql. Migrations 0021–0036 are now unique and
-- sequential. This file is 0031 either way and is idempotent, so run
-- order between the renamed files and this one does not change its result.
--
-- AUDIT (migrations 0021-0030, read 2026-11-28) — what was already
-- correct and is NOT changed here:
--   * diy_drafts (0023), diy_unlocks (0024), daily_checkins (0026),
--     fee_waiver_checks (0029), biometrics_appointments /
--     address_changes / document_translations (0030),
--     google_connections / document_resends (0030 pro-discovery):
--     every table has RLS enabled and participant-only policies.
--   * Every new foreign key points at a real row: diy_drafts.account_id
--     -> accounts, diy_drafts.case_id -> cases; diy_unlocks.case_id ->
--     cases, client_id -> accounts; fee_waiver_checks.case_id -> cases,
--     checked_by -> accounts; daily_checkins.account_id -> accounts,
--     case_id -> cases; biometrics/address/translations case_id ->
--     cases, client_id -> accounts; google_connections.account_id ->
--     accounts; document_resends.document_id -> documents, case_id ->
--     cases, resent_by -> accounts, message_id -> messages;
--     quote_requests.account_id -> accounts, case_id -> cases (0025);
--     preparer_leads.case_id -> cases (0021);
--     case_family_members.account_id -> accounts (0022).
--     No FK is missing. Nothing here adds a new FK column.
--
-- GAPS FOUND AND FIXED HERE (additive / hardening only — no policy is
-- weakened, no policy is dropped without being recreated stricter):
--
-- 1. fee_waiver_checks (0029) select/insert used a DIRECT client-or-
--    provider check instead of public.is_case_participant(). A family
--    member linked by 0022 (case_family_members.account_id) therefore
--    could not read a check on their own case, although every other
--    case-scoped table lets them in. The 0029 comment also claimed
--    founder/admin read was "covered by 0003 section 7a" — but no
--    policy on THIS table grants it, so founder/admin could not read
--    checks at all. Fixed: both policies recreated on
--    is_case_participant() (insert still requires
--    checked_by = current_account_id()), plus a founder/admin SELECT.
--
-- 2. document_resends (0030 pro-discovery) insert required only
--    is_case_participant(case_id) — it did NOT require
--    resent_by = current_account_id(), so a participant could insert
--    a log row attributing the resend to a DIFFERENT account. Fixed:
--    insert now also requires resent_by = current_account_id().
--    The table stays append-only (no update/delete policy).
--
-- 3. UPDATE policies without a WITH CHECK let a participant move a
--    row to a different case/account on update (Postgres checks the
--    new row against WITH CHECK only when one exists):
--      * biometrics_appointments / address_changes /
--        document_translations (0030): update had USING only.
--      * diy_drafts (0023): update had USING only.
--    Fixed: each gains WITH CHECK (participant on the NEW case AND
--    client_id/account_id still their own). USING is unchanged.
--
-- 4. Two foreign keys were created WITHOUT an ON DELETE action, so
--    deleting an account would fail (or leave a row that can never be
--    cleaned up) instead of cascading like every sibling FK:
--      * diy_unlocks.client_id -> accounts (0024; case_id already
--        cascades, and unlock rows are payment history tied to the
--        payer — they go with the account).
--      * fee_waiver_checks.checked_by -> accounts (0029).
--    Fixed: each FK is dropped by constraint lookup (never by assumed
--    name) and re-added with ON DELETE CASCADE, only when the
--    existing definition lacks it. No data is deleted by this file
--    itself — the cascade only applies to a future account delete.
--
-- No DOB, A-Number, SSN, or passport number is stored here. No seed
-- rows. No keys. Nothing here sends email, charges Stripe, or files
-- anything with USCIS.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. fee_waiver_checks — participant read/write + founder/admin read.
-- ---------------------------------------------------------------------------
drop policy if exists fee_waiver_checks_select on public.fee_waiver_checks;
create policy fee_waiver_checks_select on public.fee_waiver_checks for select
  using (public.is_case_participant(case_id));

drop policy if exists fee_waiver_checks_insert_provider on public.fee_waiver_checks;
create policy fee_waiver_checks_insert_provider on public.fee_waiver_checks for insert
  with check (
    checked_by = public.current_account_id()
    and public.is_case_participant(case_id)
  );

drop policy if exists select_founder_admin_fee_waiver_checks on public.fee_waiver_checks;
create policy select_founder_admin_fee_waiver_checks on public.fee_waiver_checks for select
  using (public.current_account_role() in ('admin', 'founder'));

-- ---------------------------------------------------------------------------
-- 2. document_resends — insert must attribute the resend to the caller.
-- ---------------------------------------------------------------------------
drop policy if exists document_resends_insert on public.document_resends;
create policy document_resends_insert on public.document_resends for insert
  with check (
    public.is_case_participant(case_id)
    and resent_by = public.current_account_id()
  );

-- ---------------------------------------------------------------------------
-- 3. UPDATE WITH CHECK — a row cannot be moved to another case/account.
-- ---------------------------------------------------------------------------
drop policy if exists biometrics_appointments_update on public.biometrics_appointments;
create policy biometrics_appointments_update on public.biometrics_appointments for update
  using (public.is_case_participant(case_id))
  with check (
    public.is_case_participant(case_id)
    and client_id = public.current_account_id()
  );

drop policy if exists address_changes_update on public.address_changes;
create policy address_changes_update on public.address_changes for update
  using (public.is_case_participant(case_id))
  with check (
    public.is_case_participant(case_id)
    and client_id = public.current_account_id()
  );

drop policy if exists document_translations_update on public.document_translations;
create policy document_translations_update on public.document_translations for update
  using (public.is_case_participant(case_id))
  with check (
    public.is_case_participant(case_id)
    and client_id = public.current_account_id()
  );

drop policy if exists diy_drafts_update on public.diy_drafts;
create policy diy_drafts_update on public.diy_drafts for update
  using (
    public.is_case_participant(case_id)
    and account_id = public.current_account_id()
  )
  with check (
    public.is_case_participant(case_id)
    and account_id = public.current_account_id()
  );

-- ---------------------------------------------------------------------------
-- 4. ON DELETE CASCADE for the two FKs that were created without one.
--    Drop by lookup (constraint name is never assumed); re-add only
--    when the current definition has no ON DELETE CASCADE.
-- ---------------------------------------------------------------------------
do $$
declare
  c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.diy_unlocks'::regclass
      and contype = 'f'
      and pg_get_constraintdef(oid) ilike '%client_id%references%accounts%'
      and pg_get_constraintdef(oid) not ilike '%on delete cascade%'
  loop
    execute format('alter table public.diy_unlocks drop constraint %I', c.conname);
    execute 'alter table public.diy_unlocks add constraint diy_unlocks_client_id_fkey foreign key (client_id) references public.accounts(id) on delete cascade';
  end loop;

  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.fee_waiver_checks'::regclass
      and contype = 'f'
      and pg_get_constraintdef(oid) ilike '%checked_by%references%accounts%'
      and pg_get_constraintdef(oid) not ilike '%on delete cascade%'
  loop
    execute format('alter table public.fee_waiver_checks drop constraint %I', c.conname);
    execute 'alter table public.fee_waiver_checks add constraint fee_waiver_checks_checked_by_fkey foreign key (checked_by) references public.accounts(id) on delete cascade';
  end loop;
end $$;

-- ============================================================================
-- END OF 0031 — RLS gapfill only. No policy was weakened; the four
-- changes above only narrow who can write or widen read to the
-- participants the 0022 family-login migration already recognises.
-- ============================================================================
