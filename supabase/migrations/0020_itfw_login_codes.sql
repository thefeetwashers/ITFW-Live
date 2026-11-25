-- ============================================================================
-- ITFW Live — Supabase migration 0020: login email codes (second factor)
-- Project: "Immigration" — https://jdxjskqdvwqarfhcqjlg.supabase.co
-- Run AFTER 0001–0019, in order (full run order 0001 -> 0020).
-- Do NOT run live until the founder / browser task says so. If any
-- statement errors, STOP and report the error verbatim.
--
-- WHAT THIS IS (see portal/src/lib/loginCodes.ts + /api/auth/login +
-- /api/auth/verify-code + /login):
--   Every login needs a 6-digit email code AFTER the password checks
--   out — including Founder/Admin, every time. Rules (enforced by the
--   API routes, constants in portal/src/lib/loginCodes.ts):
--     * Code is 6 digits, expires 10 minutes after issue, one use only
--       (used_at is set on first correct verification).
--     * 3 wrong codes lock the code for 15 minutes (locked_until).
--     * No "remember this device": no persistent trust is stored, and
--       no code row is ever reused across logins.
--     * The code itself is NEVER stored: only its SHA-256 hash
--       (code_hash). A database read leaks no usable code.
--     * Codes are SENT by email (Resend, RESEND_API_KEY — NOT
--       connected yet). Until email is connected the login route
--       returns 501 email_not_configured and no session is created.
--
-- RLS: enabled, with NO policies on purpose. A table with RLS on and
-- zero policies is unreadable/unwritable by every JWT-authenticated
-- caller; only the backend (service role, which bypasses RLS) reads
-- and writes login codes, through the two API routes. That is the
-- correct shape for a server-only table — do NOT add a client policy.
--
-- No seed rows, no keys, no passwords, no plaintext codes.
-- ============================================================================

create table public.login_codes (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  email citext not null,
  -- SHA-256 hex of the 6-digit code. NEVER a plaintext code.
  code_hash text not null,
  expires_at timestamptz not null,
  wrong_attempts integer not null default 0 check (wrong_attempts >= 0),
  locked_until timestamptz,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index login_codes_account_idx
  on public.login_codes (account_id, created_at desc);

alter table public.login_codes enable row level security;
-- No policies: service-role only (see header). Do not add one.

comment on table public.login_codes is
  'Email login codes (second factor). One row per issued code; only the SHA-256 hash is stored. Read/written by the backend API only (service role).';

-- ============================================================================
-- END OF 0020 — one server-only table. Full run order is now 0001 -> 0020.
-- After running, the login flow is still NOT live until: Vercel env vars
-- are set (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY /
-- SUPABASE_SERVICE_ROLE_KEY), the portal is deployed to itfw-live, and
-- Resend is connected (RESEND_API_KEY) so codes can actually be emailed.
-- ============================================================================
