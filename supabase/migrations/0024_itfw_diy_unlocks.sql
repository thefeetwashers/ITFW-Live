-- ITFW Live — Supabase migration 0024: DIY unlock records
-- Run AFTER 0023. Creates public.diy_unlocks, the durable per-form
-- record for Guided DIY payments (DIY $25/form, DIY Bundle $99).
--
-- WHY THIS TABLE EXISTS: the Stripe webhook (/api/stripe/webhook)
-- records a paid DIY purchase in public.invoices with
-- description = "<price_key> — <plan>" (e.g. "diy_form — full") and
-- does NOT write invoices.form_code, so a paid diy_form invoice
-- cannot by itself prove WHICH form was paid for. The DIY unlock
-- reader (src/lib/diy.ts) therefore reads DIY payments case-scoped
-- (cases.forms) from invoices as a fallback. This table is the
-- durable fix: one row per paid DIY purchase, naming the form (or
-- the bundle). Until the webhook writes it, the reader checks BOTH
-- this table AND the invoices fallback — nothing invents a row.
--
-- WEBHOOK CHANGE STILL NEEDED (not done by this migration, belongs
-- to the webhook owner): on checkout.session.completed, when
-- metadata price_key is "diy_form" or "diy_bundle", insert into
-- public.diy_unlocks (case_id, client_id, form_code, is_bundle,
-- price_key, price_id, amount_cents, stripe_checkout_session_id,
-- status 'paid', paid_at). The checkout metadata does not carry a
-- form_code today, so the webhook (or the checkout route) must also
-- start recording which form the DIY payment was for — until then,
-- a diy_form row can only be written case-scoped (form_code NULL
-- with the case's forms as the scope), and the reader treats a
-- case-scoped diy_form invoice as unlocking the case's forms.
-- Do NOT backfill rows from Stripe by hand without a matching
-- checkout session id.
--
-- No SSNs, no DOBs, no A-Numbers, no passport numbers in this table.

create table public.diy_unlocks (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  client_id uuid not null references public.accounts(id),
  -- Form this payment unlocks. NULL = case-scoped (see header) or bundle.
  form_code text,
  is_bundle boolean not null default false,
  price_key text not null check (price_key in ('diy_form', 'diy_bundle')),
  price_id text not null,
  amount_cents integer not null check (amount_cents >= 0),
  stripe_checkout_session_id text,
  status text not null default 'paid'
    check (status in ('paid', 'refunded', 'void')),
  paid_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index diy_unlocks_case_idx on public.diy_unlocks (case_id, status);
create index diy_unlocks_client_idx on public.diy_unlocks (client_id, status);

-- RLS: participant-only, following the 0001/0003 pattern.
alter table public.diy_unlocks enable row level security;

create policy diy_unlocks_select on public.diy_unlocks for select
  using (public.is_case_participant(case_id));

create policy diy_unlocks_insert on public.diy_unlocks for insert
  with check (public.is_case_participant(case_id)
    and client_id = public.current_account_id());

-- Founder/admin read on the new case-scoped table (0003 section 7a pattern:
-- public.current_account_role() IN ('admin', 'founder')).
create policy diy_unlocks_admin_select on public.diy_unlocks for select
  using (public.current_account_role() in ('admin', 'founder'));
