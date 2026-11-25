-- ============================================================================
-- ITFW Live — Supabase migration 0008: fix RLS recursion (isolation check)
-- Project: "Immigration" — https://jdxjskqdvwqarfhcqjlg.supabase.co
-- Run AFTER 0001–0007, in that order (it only replaces helper functions,
-- so it can run after the later migrations). Run in the Supabase SQL Editor.
-- If any statement errors, STOP and report the error verbatim.
--
-- PROBLEM (found by the isolation check, Nov 19, 2026):
--   An authenticated read of a case-scoped table failed with
--   "ERROR: 54001: stack depth limit exceeded ... SQL function
--   current_account_id during startup", repeated for
--   current_account_role. Cause: public.current_account_id() and
--   public.current_account_role() in 0001 are plain SQL functions that
--   query the RLS-protected public.accounts table. The accounts RLS
--   policy (accounts_select_own) calls those same functions, so the
--   lookup recurses until the stack overflows. In practice an
--   authenticated read of cases / documents / etc. could not run at all.
--   The database was left clean (0 accounts, 0 cases, no test rows).
--
-- FIX:
--   Recreate the three helper functions as SECURITY DEFINER, so the
--   account lookup bypasses RLS instead of recursing through it, with
--   search_path pinned to public. No policy, table, enum, or data is
--   changed by this file. The helpers return only the caller's own
--   account id / role for auth.uid() — they do not grant access to
--   anyone else's rows; every policy still checks the returned id/role.
--   SECURITY DEFINER is the standard Supabase pattern for RLS helpers.
--
--   * current_account_id()   — id from accounts where auth_user_id = auth.uid()
--   * current_account_role() — role for that account id
--   * is_case_participant()  — same SECURITY DEFINER treatment, so its
--     lookup on cases does not recurse through case RLS either.
--
-- WHAT IT DOES NOT DO:
--   * No tables, columns, enums, policies, or rows are added/removed.
--   * No keys, passwords, or seed data. No live Stripe / SMS / USCIS.
--   * Does not change the public site, Vercel, or GitHub.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.current_account_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.accounts WHERE auth_user_id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.current_account_role()
RETURNS account_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.accounts WHERE id = public.current_account_id()
$$;

CREATE OR REPLACE FUNCTION public.is_case_participant(p_case_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.cases c
    WHERE c.id = p_case_id
      AND (c.client_id = public.current_account_id()
           OR c.assigned_provider_id = public.current_account_id()))
$$;

-- ============================================================================
-- END OF 0008 — next: re-run the isolation check (client sees 1 case,
-- assigned professional sees 1 case, unassigned professional sees 0 rows)
-- before any real client document is stored.
-- ============================================================================
