-- ============================================================================
-- ITFW Live — Supabase migration 0019: block account role escalation
-- Project: "Immigration" — https://jdxjskqdvwqarfhcqjlg.supabase.co
-- Run AFTER 0001–0018, in order (full run order 0001 -> 0020).
-- Do NOT run live until the founder / browser task says so. If any
-- statement errors, STOP and report the error verbatim.
--
-- THE FLAW (found in the 0011 audit, still open until this file runs):
--   0001's accounts_update_own policy lets an owner UPDATE any column
--   on their OWN accounts row — including role. A client could set
--   role = 'admin' and then pass every admin/founder RLS check.
--   0001's block_self_verification trigger only guards is_verified /
--   verification_status, and only for callers whose CURRENT role is
--   not 'admin' — a role-only update does not touch those columns, so
--   it sails through, and a second update (now as 'admin') then passes
--   the verification guard too. A policy cannot fix this (policies are
--   permissive / OR-combined); only a BEFORE UPDATE trigger can.
--
-- THE FIX (this file, one trigger):
--   accounts_block_role_escalation — BEFORE UPDATE on public.accounts.
--   If NEW.role differs from OLD.role and the caller is not an
--   admin/founder, the update is rejected. The caller's role is read
--   through public.current_account_role() (SECURITY DEFINER, 0008),
--   which reads the STORED row — the pre-update role — so a client
--   cannot smuggle the new role into the check itself.
--   Service-role calls (auth.uid() IS NULL, i.e. the backend API using
--   SUPABASE_SERVICE_ROLE_KEY) pass: current_account_role() is NULL
--   and NULL NOT IN (...) is not true, so the IF does not fire — the
--   same shape as 0001's block_self_verification. Role changes must go
--   through the service-role API (register route, Stripe webhook,
--   admin verification route); no JWT caller changes anyone's role.
--
-- ALSO FIXED HERE (same theme, one line, cannot help an attacker):
--   0001's block_self_verification exempted ONLY role 'admin' from the
--   verification-field guard. A founder signed in with their own JWT
--   (role 'founder') was therefore BLOCKED from changing
--   verification_status directly, even though every RLS policy treats
--   founder like admin. This file recreates that function exempting
--   'admin' AND 'founder'. A client is neither, so nothing widens for
--   clients. The service-role API path is unchanged and remains the
--   intended way verification changes happen.
--
-- DO NOT WIRE SUPABASE AUTH LIVE UNTIL THIS MIGRATION HAS RUN.
-- No seed rows, no keys, no passwords.
-- ============================================================================

create or replace function public.block_role_escalation()
returns trigger language plpgsql as $$
begin
  if new.role is distinct from old.role
     and public.current_account_role()::text not in ('admin', 'founder') then
    raise exception 'Account role can only be changed by an admin/founder (service role).';
  end if;
  return new;
end $$;

drop trigger if exists accounts_block_role_escalation on public.accounts;
create trigger accounts_block_role_escalation
  before update on public.accounts
  for each row execute function public.block_role_escalation();

-- Founder consistency fix for 0001's verification guard (see header).
create or replace function public.block_self_verification()
returns trigger language plpgsql as $$
begin
  if (new.is_verified is distinct from old.is_verified
      or new.verification_status is distinct from old.verification_status)
     and public.current_account_role()::text not in ('admin', 'founder') then
    raise exception 'Verification fields can only be changed by an admin';
  end if;
  return new;
end $$;

-- The 0001 trigger accounts_block_self_verification already exists and
-- calls block_self_verification(), so recreating the function above is
-- enough — no new trigger is created for it.

-- ============================================================================
-- END OF 0019 — one trigger + one function fix. No tables created.
-- After running 0001 -> 0019, verify with a signed-in test client:
--   update public.accounts set role = 'admin' where id = <own id>;
--   -> must raise 'Account role can only be changed by an admin/founder'.
-- ============================================================================
