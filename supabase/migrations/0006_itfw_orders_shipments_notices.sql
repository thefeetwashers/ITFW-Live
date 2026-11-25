-- ============================================================================
-- ITFW Live — Supabase migration 0006: service orders, split invoices,
-- shipments / USCIS notices, guest-invite extensions, activity-log view
-- Project: "Immigration" — https://jdxjskqdvwqarfhcqjlg.supabase.co
-- Run AFTER 0005. Do NOT run live until the founder / browser task says so.
--
-- CORRECTIONS APPLIED (do not re-introduce the pasted drafts):
--  * The pasted SQL used users(id) — WRONG. This project uses
--    public.accounts(id) everywhere (0001).
--  * NO duplicate competing invoice system: invoices (0001) is the
--    canonical invoice and payment_plans (0002, enforced in 0003) is
--    the payment-plan record. service_orders is the package/order
--    header for a case; order_invoices are milestone slices of that
--    order, each linked 1:1 to a row in public.invoices via invoice_id.
--    Their amounts sum to total_service_fee_cents; the USCIS
--    government fee is stored SEPARATELY (estimated_uscis_gov_fee_cents)
--    and is NEVER added to the service total.
--  * NO 50/50 split plan for immigration: payment_plan_type is
--    'full_upfront' / 'installments_3' / 'monthly_6' / 'monthly_12'
--    only (locked options). 50/50 belongs to the Florida Property
--    Compliance OS, a different business.
--  * NO third audit table: audit_log (0001) + admin_audit_log (0002) +
--    the 0003 audit trigger already exist. This file adds only a
--    client-visible VIEW over audit_log (security_invoker) — no new
--    audit table. New action types (signed_upl_notice, approved_draft,
--    paid_invoice, escalated_to_attorney) are written by the app into
--    audit_log.action; IP goes in audit_log.detail->>'ip_address'.
--  * NO competing guest-invite system: family_invites (0002) is
--    extended with allowed_document_types + guest_upload_scope.
--    A guest token sees only their own upload slot, never the
--    client's messages, invoices, or other cases.
-- Money is integer cents everywhere. No seed rows, no keys, no passwords.
-- ============================================================================

-- --- Service orders + milestone (split) invoices ---------------------------
create table public.service_orders (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  client_id uuid not null references public.accounts(id),
  provider_id uuid references public.accounts(id),
  package_title text not null,
  ordered_forms text[] not null default '{}',
  payment_plan_type text not null
    check (payment_plan_type in ('full_upfront', 'installments_3', 'monthly_6', 'monthly_12')),
  total_service_fee_cents integer not null check (total_service_fee_cents >= 0),
  estimated_uscis_gov_fee_cents integer not null default 0 check (estimated_uscis_gov_fee_cents >= 0),
  signed_agreement_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.order_invoices (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.service_orders(id) on delete cascade,
  invoice_id uuid references public.invoices(id) on delete set null,
  invoice_number text not null unique,
  milestone_step integer not null check (milestone_step > 0),
  milestone_label text not null,
  amount_cents integer not null check (amount_cents >= 0),
  status text not null default 'unpaid'
    check (status in ('paid', 'unpaid', 'overdue', 'void')),
  unlocks_stage text not null
    check (unlocks_stage in ('intake_and_docs', 'drafting', 'esign_and_download')),
  stripe_invoice_url text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index order_invoices_order_idx on public.order_invoices (order_id);

-- --- Shipments + USCIS notices (proof vault) -------------------------------
create table public.case_shipments_and_notices (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  client_id uuid not null references public.accounts(id),
  record_type text not null check (record_type in (
    'outgoing_packet', 'uscis_receipt', 'biometrics', 'rfe', 'approval')),
  tracking_or_receipt_number text not null,
  carrier_or_agency text not null check (carrier_or_agency in ('USPS', 'FedEx', 'UPS', 'USCIS')),
  document_url text,
  action_deadline date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index case_shipments_case_idx on public.case_shipments_and_notices (case_id, record_type);

-- --- Guest / co-sponsor invite extensions (reuse family_invites, 0002) -----
alter table public.family_invites
  add column if not exists allowed_document_types text[] not null default '{tax_transcript,w2,passport}',
  add column if not exists guest_upload_scope jsonb not null default '{"vault_upload_only": true, "sees_messages": false, "sees_invoices": false, "sees_other_cases": false}'::jsonb;

-- --- RLS: participant-only, following the 0001/0003 pattern -----------------
alter table public.service_orders enable row level security;
alter table public.order_invoices enable row level security;
alter table public.case_shipments_and_notices enable row level security;

create policy service_orders_select on public.service_orders for select
  using (public.is_case_participant(case_id));
create policy service_orders_insert on public.service_orders for insert
  with check (public.is_case_participant(case_id)
    and client_id = public.current_account_id());
create policy service_orders_update on public.service_orders for update
  using (public.is_case_participant(case_id));

create policy order_invoices_select on public.order_invoices for select
  using (exists (select 1 from public.service_orders o
                 where o.id = order_id and public.is_case_participant(o.case_id)));
create policy order_invoices_insert on public.order_invoices for insert
  with check (exists (select 1 from public.service_orders o
                      where o.id = order_id and public.is_case_participant(o.case_id)));

create policy case_shipments_select on public.case_shipments_and_notices for select
  using (public.is_case_participant(case_id));
create policy case_shipments_insert on public.case_shipments_and_notices for insert
  with check (public.is_case_participant(case_id)
    and client_id = public.current_account_id());
create policy case_shipments_update on public.case_shipments_and_notices for update
  using (public.is_case_participant(case_id));

-- Founder/admin read on the new case-scoped tables (0003 section 7a pattern).
do $$
declare
  t text;
begin
  foreach t in array array[
    'service_orders', 'order_invoices', 'case_shipments_and_notices'
  ] loop
    execute format(
      'drop policy if exists %I on public.%I',
      'select_founder_admin_' || t, t);
    execute format(
      'create policy %I on public.%I for select using '
      '(public.current_account_role() in (''admin'', ''founder''))',
      'select_founder_admin_' || t, t);
  end loop;
end $$;

-- --- Client-visible activity log: a VIEW over the existing audit_log ------
-- security_invoker = true so the view honours the caller's RLS on audit_log.
drop view if exists public.client_activity_log;
create view public.client_activity_log
with (security_invoker = true) as
select
  a.id,
  a.action,
  a.entity_type,
  a.entity_id,
  a.case_id,
  a.actor_id,
  a.actor_role,
  a.detail ->> 'ip_address' as ip_address,
  a.created_at
from public.audit_log a;

drop trigger if exists set_updated_at_service_orders on public.service_orders;
create trigger set_updated_at_service_orders before update on public.service_orders
  for each row execute function public.set_updated_at();
drop trigger if exists set_updated_at_order_invoices on public.order_invoices;
create trigger set_updated_at_order_invoices before update on public.order_invoices
  for each row execute function public.set_updated_at();
drop trigger if exists set_updated_at_case_shipments on public.case_shipments_and_notices;
create trigger set_updated_at_case_shipments before update on public.case_shipments_and_notices
  for each row execute function public.set_updated_at();

-- ============================================================================
-- END OF 0006 — next: run 0004 -> 0005 -> 0006 in the SQL Editor only
-- after 0003 is confirmed live. Stripe webhook, carrier API, USCIS
-- Production, Twilio, and refund-policy attorney review are all still
-- NOT live — see portal src/lib/stripe.ts and src/app/api/stripe/webhook/route.ts.
-- ============================================================================
