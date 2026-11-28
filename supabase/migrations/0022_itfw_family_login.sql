-- ============================================================================
-- ITFW Live — Supabase migration 0022: whole-family login + journey
-- Run AFTER 0021 (full run order 0001 -> 0022). Do NOT run live until the
-- founder / browser task says so.
--
-- WHY THIS MIGRATION EXISTS (Founder-approved standout feature #1,
-- "Whole Family In One Case", Nov 28, 2026):
--   * case_family_members (0009) had NO account_id. A family member
--     (petitioner, beneficiary, child, joint sponsor) had no link to
--     their own accounts row, so there was no "own login" to give them.
--   * is_case_participant() (0001, recreated SECURITY DEFINER in 0008)
--     only recognised cases.client_id / assigned_provider_id. A family
--     member passed NO RLS gate at all — every case-scoped policy that
--     uses is_case_participant() refused them.
--   * case_family_members had no can_view_messages flag, although
--     src/lib/isolation.ts already carries Viewer.canViewMessages and
--     family_invites.guest_upload_scope (0006) already has
--     sees_messages. The flag was missing only on the member row.
--   * family_invites.role (0002) only allowed ('spouse',
--     'joint_sponsor', 'relative_abroad') — no petitioner /
--     beneficiary / child invite could be created.
--
-- WHAT IS ADDED — additive columns + a widened CHECK + a recreated
-- helper, all guarded. No table is created, no column is renamed, no
-- existing CHECK is narrowed, no seed rows, no keys, no passwords.
--   1. case_family_members.account_id — the member's OWN accounts row
--      (role 'client', their own email). Null until they accept the
--      invite. Login itself is the EXISTING login: /login + the
--      6-digit email code (migration 0020, src/lib/loginCodes.ts).
--      No second account system is invented.
--   2. case_family_members.can_view_messages — default false, like
--      can_view_invoices. Messages stay hidden unless the inviter
--      explicitly grants them (src/lib/familyCase.ts reads the flags).
--   3. family_invites.role CHECK widened to ('spouse',
--      'joint_sponsor', 'relative_abroad', 'petitioner',
--      'beneficiary', 'child'). The old constraint is dropped by
--      definition (not by assumed name) so a renamed constraint in a
--      live database cannot silently keep blocking the new roles.
--   4. is_case_participant() recreated (same 0008 SECURITY DEFINER
--      pattern, search_path pinned) so a family member whose
--      account_id is linked to the case counts as a participant.
--
-- WHAT THIS MIGRATION DOES NOT DO (honest limits, enforced in the app
-- layer — src/lib/familyCase.ts scopeFamilyCaseView() + src/lib/
-- isolation.ts, the same pattern as the founder_admin UI rule noted
-- in isolation.ts):
--   * RLS now lets a linked family member READ case-scoped rows. The
--     FINER hiding — invoices unless can_view_invoices, messages
--     unless can_view_messages, never another member's payment
--     details — is enforced by scopeFamilyCaseView(), which returns a
--     redacted copy with the hidden data omitted entirely. RLS alone
--     does not hide invoice rows from a family participant; the API /
--     page layer must call scopeFamilyCaseView() before rendering.
--     Do not claim the database alone enforces the per-member hiding.
--   * No new account_role enum value is added. A family member's
--     accounts row is role 'client'; the "family" role exists only as
--     a viewer concept in src/lib/isolation.ts (Viewer.role), scoped
--     to the ONE invited case via familyCaseId.
--   * DOB / A-Number / SSN / passport: NO new columns. They live only
--     where migrations already provide them (accounts.date_of_birth,
--     accounts.alien_registration_number, 0009). No SSN column exists
--     and none is added here. Masking is in src/lib/familyCase.ts.
-- ============================================================================

-- 1. Own-login link on the family member row.
alter table public.case_family_members
  add column if not exists account_id uuid
    references public.accounts(id) on delete set null;

-- One accounts row is one member of one case (a joint sponsor for two
-- cases has two member rows, one per case — so the uniqueness is per
-- case, not global).
create unique index if not exists case_family_members_case_account_idx
  on public.case_family_members (case_id, account_id)
  where account_id is not null;
create index if not exists case_family_members_account_idx
  on public.case_family_members (account_id)
  where account_id is not null;

-- 2. Message visibility flag (default false, like can_view_invoices).
alter table public.case_family_members
  add column if not exists can_view_messages boolean not null default false;

-- 3. Widen the family_invites role CHECK to the four family roles.
-- Drop by definition, not by assumed constraint name.
do $$
declare
  r record;
begin
  for r in
    select conname
    from pg_constraint
    where conrelid = 'public.family_invites'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%spouse%'
  loop
    execute format(
      'alter table public.family_invites drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.family_invites
  add constraint family_invites_role_check
    check (role in (
      'spouse', 'joint_sponsor', 'relative_abroad',
      'petitioner', 'beneficiary', 'child'
    ));

-- 4. Family members count as case participants (0008 pattern:
-- SECURITY DEFINER, search_path pinned, so the lookup bypasses RLS
-- instead of recursing through it).
create or replace function public.is_case_participant(p_case_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.cases c
    where c.id = p_case_id
      and (c.client_id = public.current_account_id()
           or c.assigned_provider_id = public.current_account_id()))
  or exists (
    select 1 from public.case_family_members m
    where m.case_id = p_case_id
      and m.account_id = public.current_account_id())
$$;

-- ============================================================================
-- END OF 0022 — schema only. No seed rows, no keys, no passwords.
-- Nothing here runs live, touches Supabase/Vercel/GitHub, or edits
-- the public site. After running, re-run the isolation check: a
-- linked family member sees their ONE invited case; an unlinked
-- account sees 0 family rows; a child member's invoice rows are still
-- hidden by the app layer (scopeFamilyCaseView), not by this file.
-- ============================================================================
