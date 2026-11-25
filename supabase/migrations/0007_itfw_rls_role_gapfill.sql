-- ============================================================================
-- ITFW Live — Supabase migration 0007: RLS gap-fill for roles (audit)
-- Project: "Immigration" — https://jdxjskqdvwqarfhcqjlg.supabase.co
-- Run AFTER 0006. Do NOT run live until the founder / browser task says so.
--
-- AUDIT OF 0001–0006 (what is ALREADY covered — NOT duplicated here):
--  * service_orders / order_invoices / case_shipments_and_notices:
--    participant-only SELECT/INSERT/UPDATE in 0006. Already covered.
--  * case_student_assignments: SELECT (student / participant / founder-
--    admin) + INSERT (participant, assigned_by = self) in 0004.
--    A law student therefore sees ONLY cases explicitly assigned by a
--    verified attorney/DOJ supervisor. Already covered for read/insert.
--  * Admin verification queue: accounts SELECT for founder/admin on
--    pending/rejected/expired attorney/nonprofit rows in 0001, widened
--    to founder in 0003; block_self_verification trigger in 0001.
--    Already covered.
--  * family_invites: SELECT + INSERT (participant) in 0003. Already
--    covered for read/insert.
--  * G-28: there is NO g28 table in this schema. A preparer can never
--    "see G-28 data" in the database because G-28 rows are only created
--    for attorney/nonprofit cases by the app, and 0003's
--    validate_assigned_provider() trigger rejects a preparer being the
--    assigned provider on an attorney matter. RLS policies are
--    permissive (OR-combined), so a new "restrictive" policy could NOT
--    subtract access — do NOT add one claiming it does. G-28 hiding is
--    enforced in the UI (portal/back-office hide the G-28 workspace
--    unless the assigned provider is attorney/nonprofit) + by the
--    trigger above. This is an honest, documented gap: a dedicated
--    g28_signatures table with attorney-only policies is a future
--    migration if G-28 is ever stored separately.
--
-- WHAT 0007 ADDS (only the missing pieces):
--  * family_invites UPDATE (inviter only) + a guest-upload note: an
--    unauthenticated guest token CANNOT be granted RLS access by a
--    policy on auth.uid() — guest uploads must go through a server-side
--    / service-role endpoint that checks family_invites.invite_token
--    + expiry + allowed_document_types, then inserts into documents
--    with storage_bucket='vault'. No anon policy is created here,
--    deliberately.
--  * case_student_assignments DELETE (assigner / founder-admin only).
--  * reminder_nudges UPDATE (participant — stop a nudge when the item
--    is cleared) + packet_audit_items UPDATE (participant).
--  * order_invoices: NO user UPDATE policy on purpose — status flips
--    to 'paid' only via the Stripe webhook (service role). Documented.
--  * form_field_mappings INSERT/UPDATE founder/admin only (read is
--    any signed-in user, 0005).
-- No seed rows, no keys, no passwords.
-- ============================================================================

-- family_invites: inviter may update (e.g. extend expiry, set allowed types).
create policy family_invites_update on public.family_invites for update
  using (public.is_case_participant(case_id)
    and invited_by = public.current_account_id())
  with check (public.is_case_participant(case_id)
    and invited_by = public.current_account_id());

-- case_student_assignments: assigner or founder/admin may remove an assignment.
create policy case_student_assignments_delete on public.case_student_assignments for delete
  using (assigned_by = public.current_account_id()
    or public.current_account_role() in ('admin', 'founder'));

-- reminder_nudges: participant may update (stop when the action item is cleared).
create policy reminder_nudges_update on public.reminder_nudges for update
  using (public.is_case_participant(case_id));

-- packet_audit_items: participant may update (provider marks items cleared).
create policy packet_audit_items_update on public.packet_audit_items for update
  using (public.is_case_participant(case_id));

-- form_field_mappings: founder/admin only may change the mapping metadata.
create policy form_field_mappings_insert on public.form_field_mappings for insert
  with check (public.current_account_role() in ('admin', 'founder'));
create policy form_field_mappings_update on public.form_field_mappings for update
  using (public.current_account_role() in ('admin', 'founder'))
  with check (public.current_account_role() in ('admin', 'founder'));

-- ============================================================================
-- END OF 0007 — run 0004 -> 0005 -> 0006 -> 0007 in the SQL Editor only
-- after 0003 is confirmed live. Realtime subscriptions are NOT enabled
-- by SQL: the portal and back-office share the same Supabase tables
-- (cases, documents, invoices, payment_plans, service_orders /
-- order_invoices, messages, case_shipments_and_notices, audit_log),
-- so they share state; label any sync "shared Supabase state —
-- realtime subscription to be enabled", never "live sync".
-- ============================================================================
