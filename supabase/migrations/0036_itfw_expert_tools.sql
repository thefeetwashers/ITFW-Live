-- ITFW Live — Supabase migration 0036: expert tools (Nov 28, 2026).
--
-- Founder's question: "what else other tool you want to add".
-- Seven tools; this migration adds ONLY what did not already exist:
--
--   1. E-signature (signatures, 0001) — the table already had case_id,
--      client_id, form_code, document_id, signer_full_name,
--      signature_method, digital_review_confirmed, signed_at,
--      ip_address. Added: packet_ref + packet_version_hash (WHAT was
--      signed), intent_confirmed (the intent checkbox), signed_from
--      (how: "typed name + intent checkbox"), provider
--      ('in_platform_typed_electronic' — NO outside provider is
--      connected; BYO slot "esign" in portal src/lib/byo.ts).
--   2. Video meetings — preparer_appointments (0012/0017) gains
--      video_link + video_link_source ('none' | 'manual' |
--      'google_meet'); appointments (0001) gains meeting_link +
--      meeting_link_source. A Meet link is NEVER generated here — a
--      'google_meet' value may only be stored when it came from a real
--      Google Calendar event. Google OAuth setup is NOT done.
--   3. OCR — NO schema change. documents.ocr_extracted (jsonb, 0001)
--      already exists for when OCR lands. See portal
--      src/lib/expertTools.ts OCR_STATUS for why pinning is not safely
--      achievable in this build (tesseract.js fetches worker +
--      traineddata from a CDN at runtime by default).
--   4. Translation orders — NEW table public.translation_orders.
--      Price is LOCKED $45/page (addon_translation_page, 4500 cents,
--      portal src/lib/stripePrices.ts). Page counts come only from
--      document_translations rows (0030) — 0 = not counted, never
--      guessed. Status stays 'pending' until Google Cloud Translation
--      (BYO slot google_translate, NOT connected) delivers a real
--      translation. payment_status flips to 'paid' only via the Stripe
--      webhook (checkout.session.completed, metadata
--      .translation_order_id).
--   5. Invoicing & receipts — NO schema change. invoices (0001)
--      already has service_fee_cents + uscis_fee_cents (always
--      separate) and stripe_invoice_id; the receipt view is
--      portal src/lib/expertTools.ts buildReceipt() + GET
--      /api/invoices/[id]/receipt.
--   6. Founder analytics — NO schema change. Reporting already
--      aggregated real rows (portal src/lib/reporting.ts); the
--      founder roll-up is portal src/lib/expertTools.ts
--      summarizeFounderAnalytics(). No subscriptions table exists,
--      so subscription revenue is NOT reported (never invented).
--   7. Backup & export — NO schema change. Reuses packet generation
--      + printable pages; every export writes an audit_log entry
--      (action 'case_exported', ids only).
--
-- Do NOT run live until the founder / browser task says so. If any
-- statement errors, STOP and report the error verbatim.

-- ---------------------------------------------------------------------------
-- 1. signatures — what was signed + intent (0001 table, extended)
-- ---------------------------------------------------------------------------
alter table public.signatures
  add column if not exists packet_ref text,
  add column if not exists packet_version_hash text,
  add column if not exists intent_confirmed boolean not null default false,
  add column if not exists signed_from text,
  add column if not exists provider text not null default 'in_platform_typed_electronic';

-- A signed row must have the intent checkbox confirmed (same shape as
-- the 0001 signed-consistency check: signed_at null unless reviewed).
alter table public.signatures
  drop constraint if exists signatures_intent_consistency;
alter table public.signatures
  add constraint signatures_intent_consistency check (
    signed_at is null or intent_confirmed = true);

-- ---------------------------------------------------------------------------
-- 2. Video meeting links — manual paste, or a real Google Meet link only
-- ---------------------------------------------------------------------------
alter table public.preparer_appointments
  add column if not exists video_link text,
  add column if not exists video_link_source text not null default 'none'
    check (video_link_source in ('none', 'manual', 'google_meet'));

alter table public.appointments
  add column if not exists meeting_link text,
  add column if not exists meeting_link_source text not null default 'none'
    check (meeting_link_source in ('none', 'manual', 'google_meet'));

-- ---------------------------------------------------------------------------
-- 4. translation_orders — NEW
-- ---------------------------------------------------------------------------
create table if not exists public.translation_orders (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  client_id uuid not null references public.accounts(id),
  -- Document types from lib/moreAdded.ts TRANSLATION_DOCUMENT_TYPES
  -- that are billable on this order (birth / marriage /
  -- divorce-death / police / other).
  document_types text[] not null default '{}',
  -- Total billable pages, counted from document_translations rows
  -- only (0030). 0 = not counted yet — never guessed.
  total_pages integer not null default 0 check (total_pages >= 0),
  -- Locked $45/page: total_cents = total_pages * 4500.
  total_cents integer not null default 0 check (total_cents >= 0),
  price_per_page_cents integer not null default 4500 check (price_per_page_cents = 4500),
  status text not null default 'pending'
    check (status in ('pending', 'delivered', 'cancelled')),
  provider text not null default 'google_cloud_translation',
  provider_connected boolean not null default false,
  payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid', 'paid', 'refunded')),
  stripe_checkout_session_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists translation_orders_case_idx
  on public.translation_orders (case_id, status);

-- --- RLS: case-scoped, same pattern as 0030 document_translations -----
alter table public.translation_orders enable row level security;

create policy translation_orders_select on public.translation_orders for select
  using (public.is_case_participant(case_id));
create policy translation_orders_insert on public.translation_orders for insert
  with check (public.is_case_participant(case_id)
    and client_id = public.current_account_id());
create policy translation_orders_update on public.translation_orders for update
  using (public.is_case_participant(case_id));

-- Founder/admin read on the new case-scoped table (0006 pattern).
do $$
begin
  execute format(
    'drop policy if exists %I on public.%I',
    'select_founder_admin_translation_orders', 'translation_orders');
  execute format(
    'create policy %I on public.%I for select using '
    '(public.current_account_role() in (''admin'', ''founder''))',
    'select_founder_admin_translation_orders', 'translation_orders');
end $$;

drop trigger if exists set_updated_at_translation_orders on public.translation_orders;
create trigger set_updated_at_translation_orders before update on public.translation_orders
  for each row execute function public.set_updated_at();
