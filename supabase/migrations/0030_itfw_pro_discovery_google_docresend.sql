-- ITFW Live — Supabase migration 0030: professional discovery +
-- Google integrations (status-only) + client document resend log.
-- Run AFTER 0029. Nov 28, 2026 (twelfth addition, part A).
--
-- SCOPE — genuinely NEW + genuinely MISSING only. Migrations
-- 0001–0029 are NOT edited, and no existing table is recreated:
--   * professional_profiles (0001) gains ONLY the professional's
--     OWN Google contact details (google_email / google_phone),
--     entered by the professional in their own profile. These are
--     the professional's own contact details — NEVER scraped,
--     never bought, never copied from a client. They are NOT shown
--     on the public directory (public_profiles view, 0013, is
--     untouched and still exposes no email/phone).
--   * google_connections — NEW, status-only table for Google
--     Calendar / Drive / Gmail. It records connection STATUS and
--     the scopes requested — it holds NO OAuth token, NO refresh
--     token, NO Google password, and NO plaintext credential of
--     any kind. Google API access needs a Google Cloud OAuth
--     client + consent-screen approval, which is NOT set up yet:
--     every row starts (and stays) 'not_connected' /
--     'awaiting_founder_setup' until the founder completes the
--     setup in docs/pro-discovery-google-2026-11-28.md. No code
--     in this repo may ever write 'connected' here without a real
--     Google OAuth token exchange having succeeded.
--   * family_invites (0002, extended 0005/0006/0022) — REUSED for
--     professional-to-client invitations. No new invite mechanism
--     is invented: the same magic invite_token + 6-digit
--     invite_code system is used, with a new invite_purpose
--     ('family' | 'client_onboarding') and role 'client' added to
--     the role CHECK. A client invite has no case_id at creation
--     time (the case is created when the client registers), so
--     case_id becomes nullable — existing family invites always
--     have a case_id; only client_onboarding invites may omit it.
--     The referral system (0017, /r/<code>) is ALSO reused and
--     unchanged: a professional's referral link still lands on
--     their storefront.
--   * document_resends — NEW append-only log for the client
--     document resend flow (POST /api/documents/resend). One row
--     per resend attempt, with channel + delivery status. There
--     is NO message-body column (PII rule, same as
--     notification_logs 0010): subjects/bodies are built in
--     src/lib/docResend.ts and never stored. DOB, A-Number, SSN
--     and passport numbers are never logged here, never in email
--     subjects, and never in a vault share link.
--   * notification_logs (0010) is REUSED for email + SMS resend
--     attempts (its channel CHECK already allows sms/whatsapp/
--     email and its status CHECK already allows sent/failed/
--     not_configured). message_sends (0014) is REUSED for the
--     in-app copy (portal_chat) and for email attempts tied to a
--     messages row. vault_link resends have no notification_logs
--     channel, so they are recorded ONLY in document_resends.
--
-- HONESTY RULES (do not weaken):
--   * No Google product is 'connected' until the founder approves
--     the Google Cloud OAuth setup AND a real OAuth exchange
--     succeeds. The UI shows 'Not connected' until then.
--   * SMS resend needs the professional's OWN Twilio account
--     (BYO, 0014 provider_settings) — Twilio is NOT connected, so
--     SMS resends are recorded as 'not_configured', never 'sent'.
--   * Email resend goes through the platform AWS SES sender
--     (src/lib/email.ts) with a vault signed URL in the body —
--     never a raw file attachment. When SES is not configured the
--     attempt is recorded as 'not_configured', never 'sent'.
--   * Only a licensed attorney or DOJ-accredited representative
--     gives legal advice (8 CFR 292.1). This migration grants no
--     legal-advice capability to anyone.

-- ---------------------------------------------------------------------------
-- 1. Professional's own Google contact details (profile-entered only).
-- ---------------------------------------------------------------------------
alter table public.professional_profiles
  add column if not exists google_email citext,
  add column if not exists google_phone text,
  add column if not exists google_contact_updated_at timestamptz;

-- ---------------------------------------------------------------------------
-- 2. google_connections — status-only. NO tokens, NO passwords, ever.
-- ---------------------------------------------------------------------------
create table if not exists public.google_connections (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  product text not null check (product in ('calendar', 'drive', 'gmail')),
  status text not null default 'not_connected'
    check (status in ('not_connected', 'awaiting_founder_setup', 'connected')),
  -- Scopes REQUESTED for this product (exact strings, see
  -- src/lib/googleIntegrations.ts GOOGLE_SCOPES). 'connected' must
  -- never be written unless the OAuth exchange granted them.
  scopes text[] not null default '{}',
  -- The Google account the professional connected with (their own
  -- Google email, entered/shown after OAuth — never scraped).
  google_account_email citext,
  connected_at timestamptz,
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, product)
);
create index if not exists google_connections_account_idx
  on public.google_connections (account_id);

alter table public.google_connections enable row level security;

-- Owner-only, like provider_settings (0014): a founder sees the
-- verification queue + audit log only, never a professional's
-- connected-account details. No founder/admin SELECT is created.
drop policy if exists google_connections_select_own on public.google_connections;
create policy google_connections_select_own on public.google_connections for select
  using (account_id = public.current_account_id());
drop policy if exists google_connections_insert_own on public.google_connections;
create policy google_connections_insert_own on public.google_connections for insert
  with check (account_id = public.current_account_id());
drop policy if exists google_connections_update_own on public.google_connections;
create policy google_connections_update_own on public.google_connections for update
  using (account_id = public.current_account_id())
  with check (account_id = public.current_account_id());
drop policy if exists google_connections_delete_own on public.google_connections;
create policy google_connections_delete_own on public.google_connections for delete
  using (account_id = public.current_account_id());

-- ---------------------------------------------------------------------------
-- 3. family_invites — reuse for professional-to-client invitations.
--    invite_purpose distinguishes a family/co-sponsor invite from a
--    professional inviting their own client onto the platform.
--    case_id becomes nullable: a client invite is created BEFORE the
--    client has a case. Family invites still always carry a case_id
--    (enforced by the CHECK below).
-- ---------------------------------------------------------------------------
alter table public.family_invites
  add column if not exists invite_purpose text not null default 'family'
    check (invite_purpose in ('family', 'client_onboarding'));

-- case_id: drop the NOT NULL so a client invite can exist before a
-- case exists. Family invites must still have one (CHECK below).
alter table public.family_invites alter column case_id drop not null;

-- Widen the role CHECK to add 'client' (professional invites their
-- own client). Drop by definition, not by assumed name (0022 pattern).
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
      'petitioner', 'beneficiary', 'child', 'client'
    ));

-- A family invite needs a case; a client invite must NOT carry one
-- yet (the case is created when the invited client registers).
alter table public.family_invites
  add constraint family_invites_case_for_purpose_check
    check (
      (invite_purpose = 'family' and case_id is not null)
      or (invite_purpose = 'client_onboarding' and case_id is null)
    );

create index if not exists family_invites_purpose_idx
  on public.family_invites (invite_purpose, invited_by);

-- ---------------------------------------------------------------------------
-- 4. document_resends — append-only resend log. NO body column.
-- ---------------------------------------------------------------------------
create table if not exists public.document_resends (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  case_id uuid not null references public.cases(id) on delete cascade,
  resent_by uuid not null references public.accounts(id),
  channel text not null check (channel in ('email', 'sms', 'portal_chat', 'vault_link')),
  -- Recipient as addressed (client contact already on file — the
  -- professional does not type a new address here). Masked in UI
  -- via src/lib/docResend.ts maskRecipient(); never logged raw
  -- outside this row.
  recipient_email citext,
  recipient_phone text,
  status text not null default 'not_configured'
    check (status in ('sent', 'failed', 'not_configured')),
  provider text,
  provider_message_id text,
  error_message text,
  -- The messages row for the in-app copy (portal_chat channel only).
  message_id uuid references public.messages(id) on delete set null,
  -- The share token for the vault_link channel. The link itself is
  -- /vault/shared/<token>; the token is random (gen_random_uuid)
  -- and expires after 7 days. It grants read access to ONE
  -- document only, never to the whole vault.
  share_token text unique,
  share_expires_at timestamptz,
  created_at timestamptz not null default now(),
  constraint document_resends_channel_recipient_check check (
    (channel = 'email' and recipient_email is not null)
    or (channel = 'sms' and recipient_phone is not null)
    or (channel = 'portal_chat')
    or (channel = 'vault_link' and share_token is not null)
  ),
  constraint document_resends_share_expiry_check check (
    share_token is null or share_expires_at is not null
  )
);
create index if not exists document_resends_document_idx
  on public.document_resends (document_id, created_at desc);
create index if not exists document_resends_case_idx
  on public.document_resends (case_id, created_at desc);
create index if not exists document_resends_share_token_idx
  on public.document_resends (share_token) where share_token is not null;

alter table public.document_resends enable row level security;

-- Participant-only (0001/0008 pattern): the client and the assigned
-- professional on the case may read the resend log; only a
-- participant may insert. Append-only: no update/delete policy.
drop policy if exists document_resends_select on public.document_resends;
create policy document_resends_select on public.document_resends for select
  using (public.is_case_participant(case_id));
drop policy if exists document_resends_insert on public.document_resends;
create policy document_resends_insert on public.document_resends for insert
  with check (public.is_case_participant(case_id));
