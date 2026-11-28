-- ITFW Live — Supabase migration 0037: webhook subscription records
-- Run AFTER 0036.
--
-- WHY THIS MIGRATION EXISTS: the Stripe webhook gap found Nov 28, 2026.
-- On checkout.session.completed the webhook wrote NO invoices.form_code
-- and NO subscription record for a payer with no case:
--   * A DIY $25/form payment could not prove WHICH form was paid for
--     (invoices.form_code exists since 0001 but was never written;
--     diy_unlocks, migration 0024, was never written either).
--   * A Member ($9.80/mo) or Law Student ($35/mo) checkout carries no
--     case_id, so NO invoices row could be written at all (invoices
--     .case_id is NOT NULL) — and there is NO subscriptions table.
--     accounts has no subscription columns, student_profiles has a
--     subscription_plan but no subscription_status, and the Member
--     plan has no value in the subscription_plan enum. A paying
--     member/student was therefore invisible to the paywall
--     (src/lib/paywall.ts) and could be denied after paying.
--
-- WHAT THIS MIGRATION ADDS:
--   * public.subscriptions — one row per paid Stripe subscription:
--     account, locked price key/id, plan (locked price key as text —
--     deliberately NOT the subscription_plan enum, which has no
--     Member value), status, Stripe subscription/customer/checkout
--     ids, current_period_end. The webhook upserts it by
--     stripe_subscription_id (idempotent on replay).
--   * student_profiles.subscription_status — the column the paywall
--     gap note said was missing. Law Student $35/mo now has a
--     status the webhook can set to 'active'.
-- The webhook (src/app/api/stripe/webhook/route.ts, via
-- src/lib/webhookRecords.ts) writes both. The paywall reader
-- (src/lib/paywall.ts getPaidAccessForAccount) reads them. Nothing
-- here invents a subscription: rows are written only by the webhook
-- from a verified Stripe event. No SSNs, no DOBs, no A-Numbers,
-- no passport numbers in this table.

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  -- Locked Stripe price key, e.g. 'member_monthly',
  -- 'subscription_law_student', 'subscription_preparer'.
  price_key text not null,
  price_id text not null,
  -- Same value as price_key (kept as a separate column so a future
  -- reader does not have to parse the key to know the plan).
  plan text not null,
  status subscription_status not null default 'active',
  stripe_subscription_id text,
  stripe_customer_id text,
  stripe_checkout_session_id text,
  current_period_end timestamptz,
  paid_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index subscriptions_stripe_sub_idx
  on public.subscriptions (stripe_subscription_id)
  where stripe_subscription_id is not null;
create index subscriptions_account_idx on public.subscriptions (account_id, status);

alter table public.subscriptions enable row level security;

-- An account reads only its own subscription rows.
create policy subscriptions_select_own on public.subscriptions for select
  using (account_id = public.current_account_id());

-- Founder/admin read (0003 section 7a pattern).
create policy subscriptions_admin_select on public.subscriptions for select
  using (public.current_account_role() in ('admin', 'founder'));

-- No client insert/update policy: rows are written only by the
-- webhook with the service-role key, never from a client claim.

-- Law Student subscription status (the paywall gap): student_profiles
-- had subscription_plan ('law_student_35') but no status column.
alter table public.student_profiles
  add column if not exists subscription_status subscription_status
    not null default 'none';
