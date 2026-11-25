-- ITFW Live — Supabase migration 0002: extended tables
-- Run AFTER 0001. These tables support the Live App features built Nov 13–14, 2026:
-- fee schedules / payment plans (assignment = professional named on a payment
-- plan), Sponsor/Family Door invites, Employer Door, custom quotes, NVC/CEAC
-- manual tracker, RFE uploads, founder/admin audit log, site content/news.

create table public.fee_schedules (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.professional_profiles(id) on delete cascade,
  form_code text not null,
  tier text not null check (tier in ('basic','standard','premium')),
  fee_cents integer not null check (fee_cents >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, form_code, tier)
);

create table public.payment_plans (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  client_id uuid not null references public.accounts(id),
  provider_id uuid references public.accounts(id),
  -- provider named here is the assigned professional for the case
  total_service_fee_cents integer not null check (total_service_fee_cents >= 0),
  pay_choice text not null default 'all_at_once'
    check (pay_choice in ('all_at_once','installments_3')),
  installment_amounts_cents integer[] not null default '{}',
  paid_cents integer not null default 0 check (paid_cents >= 0),
  missed_payment_penalty_percent integer not null default 50,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payment_plans_case_idx on public.payment_plans (case_id);
create index payment_plans_provider_idx on public.payment_plans (provider_id);

create table public.family_invites (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  invited_by uuid not null references public.accounts(id),
  role text not null check (role in ('spouse','joint_sponsor','relative_abroad')),
  invite_code text not null,
  invite_token text not null unique,
  expires_at timestamptz,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.employers (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  company_name text not null,
  subscription_plan text not null default 'none',
  subscription_status subscription_status not null default 'none',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.job_postings (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid not null references public.employers(id) on delete cascade,
  title text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.talent_opt_ins (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  work_authorized boolean not null default false,
  created_at timestamptz not null default now(),
  unique (account_id)
);

create table public.quote_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email citext not null,
  phone text,
  description text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create table public.nvc_trackers (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  client_id uuid not null references public.accounts(id),
  -- NVC Case Number + Invoice ID are stored encrypted by the API layer;
  -- never store them in plain text in a client-side table.
  nvc_case_number_enc text,
  invoice_id_enc text,
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (case_id)
);

create table public.rfe_uploads (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  client_id uuid not null references public.accounts(id),
  document_id uuid references public.documents(id) on delete set null,
  deadline date,
  checklist jsonb not null default '[]'::jsonb,
  status text not null default 'needs_review',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.admin_audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.accounts(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  case_id uuid references public.cases(id),
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.site_content (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  content jsonb not null default '{}'::jsonb,
  updated_by uuid references public.accounts(id),
  updated_at timestamptz not null default now()
);

alter table public.fee_schedules enable row level security;
alter table public.payment_plans enable row level security;
alter table public.family_invites enable row level security;
alter table public.employers enable row level security;
alter table public.job_postings enable row level security;
alter table public.talent_opt_ins enable row level security;
alter table public.quote_requests enable row level security;
alter table public.nvc_trackers enable row level security;
alter table public.rfe_uploads enable row level security;
alter table public.admin_audit_log enable row level security;
alter table public.site_content enable row level security;

-- Payment plans / NVC trackers / RFE uploads are case-scoped: same
-- is_case_participant(case_id) rule as migration 0001.
create policy payment_plans_select on public.payment_plans for select
  using (public.is_case_participant(case_id));
create policy nvc_trackers_select on public.nvc_trackers for select
  using (public.is_case_participant(case_id));
create policy rfe_uploads_select on public.rfe_uploads for select
  using (public.is_case_participant(case_id));
