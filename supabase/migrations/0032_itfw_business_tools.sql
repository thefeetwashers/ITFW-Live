-- 0032 — Business tools indexes + canonical-calendar documentation
-- (Nov 28, 2026, founder's strengths/weaknesses review).
--
-- NO new table is created here. The business-tools build deliberately
-- reuses the tables that already exist:
--   * appointments (0001) — the CONFIRMED appointment, the calendar's
--     source of truth once a request is accepted.
--   * preparer_appointments (0012 + decision columns 0017) — requests.
--   * consultation_requests (0017) — requests, locked $0 / $99 prices.
--   * signatures (0001) — POST /api/signatures/request inserts an
--     UNSIGNED request row (signed_at null); no outside e-signature
--     provider is connected.
--   * invoices (0001) — GET/POST /api/invoices lists the professional's
--     invoices and sends one via platform AWS SES (501 when SES is not
--     configured; never claims sent).
--   * messages (0001, is_read) — unread counts per case are computed in
--     src/lib/businessTools.ts countUnreadByCase; no new column.
--   * provider_settings (0014) — BYO keys: encrypted_key_reference
--     ONLY, key_last4 only. No plaintext key is ever stored here.
-- Google Calendar is NOT connected (google_connections, 0030, is
-- status-only, no tokens) — no calendar sync is claimed anywhere.
--
-- This migration adds ONLY the missing indexes the new reads need.
-- All are IF NOT EXISTS so re-running is safe. No policy is changed:
-- the existing RLS on each table already limits reads to the owning
-- professional / case participants.
create index if not exists invoices_provider_created_idx
  on public.invoices (provider_id, created_at desc);
create index if not exists invoices_provider_status_idx
  on public.invoices (provider_id, status);
create index if not exists signatures_client_signed_idx
  on public.signatures (client_id, signed_at);
create index if not exists messages_case_unread_idx
  on public.messages (case_id) where is_read = false;

comment on index public.invoices_provider_created_idx is
  'Business tools (0032): professional invoice list, newest first (GET /api/invoices).';
comment on index public.signatures_client_signed_idx is
  'Business tools (0032): signature requests per client, unsigned (signed_at null) until the client signs in-platform. No e-signature provider is connected.';
