-- ITFW Live — Supabase migration 0001: core tables + RLS
-- Source: workspace/your_files/itfw-inbox-vault-api-sql/itfw-inbox-vault-api-sql.md
-- Run in the Supabase SQL Editor, in order, before migration 0002.
-- Changes vs the original spec (founder decisions, Nov 14, 2026):
--   * preferred_language now has 7 languages (added zh, ar).
--   * NO locks on forms for document preparers (Nov 14, 2026): the
--     professional_form_fees.is_locked column is kept for history only and
--     must NOT be used to block a preparer; every form shows the
--     "Get an attorney — an attorney can protect you" option instead.
--   * Money is integer cents; service fees and USCIS fees are separate
--     columns and are never combined into one total in storage.

create extension if not exists pgcrypto;
create extension if not exists citext;

create type account_role as enum
  ('client','preparer','attorney','nonprofit','admin');
create type verification_status as enum
  ('not_required','pending','verified','rejected','expired');
create type preferred_language as enum
  ('en','es','ht','fr','pt','zh','ar');
create type notification_preference as enum
  ('in_app','email','sms','all');
create type subscription_plan as enum
  ('free_draft','preparer_pro_49','attorney_pro_99',
   'nonprofit_standard_24_50','nonprofit_full_49_50','none');
create type subscription_status as enum
  ('none','trialing','active','past_due','canceled','unpaid');
create type accreditation_level as enum
  ('partial_uscis_only','full_uscis_and_court');
create type case_for_whom as enum
  ('myself','spouse','parent','child','sibling','employee');
create type service_option as enum
  ('diy','preparer','attorney','nonprofit');
create type case_status as enum
  ('intake','documents_pending','in_preparation','ready_to_sign',
   'filed','uscis_pending','rfe','interview','approved','denied','closed');
create type inbox_item_type as enum
  ('missing_document','message','payment','signature');
create type inbox_item_status as enum
  ('missing','uploaded','under_review','accepted','retake_requested',
   'paid','signed','read','unread','closed');
create type vault_category as enum
  ('Identity','Relationship Proof','Financial/Tax',
   'Medical/Police','USCIS Notices');
create type document_review_status as enum
  ('uploaded','under_review','accepted','retake_requested');
create type invoice_status as enum
  ('draft','open','pending','paid','void','refunded','past_due');
create type appointment_type as enum ('phone','video','in_person');
create type appointment_status as enum
  ('requested','confirmed','rescheduled','cancelled','completed','no_show');

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique,
  role account_role not null,
  full_name text not null,
  email citext not null unique,
  phone text,
  preferred_language preferred_language not null default 'en',
  notification_preference notification_preference not null default 'all',
  is_verified boolean not null default false,
  verification_status verification_status not null default 'not_required',
  verified_at timestamptz,
  verified_by uuid references public.accounts(id),
  verification_notes text,
  date_of_birth date,
  mailing_address jsonb,
  physical_address jsonb,
  address_updated_at timestamptz,
  is_active boolean not null default true,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint accounts_verified_consistency check (
    (is_verified = true and verification_status = 'verified')
    or is_verified = false)
);
create index accounts_role_idx on public.accounts (role);
create index accounts_verification_idx
  on public.accounts (verification_status) where role in ('attorney','nonprofit');

create table public.professional_profiles (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null unique references public.accounts(id) on delete cascade,
  role account_role not null check (role in ('preparer','attorney','nonprofit')),
  company_name text,
  slug citext not null unique,
  bio text,
  years_experience integer check (years_experience >= 0),
  languages_spoken preferred_language[] not null default '{}',
  service_area jsonb not null default '{}'::jsonb,
  amenities text[] not null default '{}',
  accepting_new_clients boolean not null default true,
  is_published boolean not null default false,
  bar_number text,
  bar_states text[] not null default '{}',
  practice_areas text[] not null default '{}',
  consultation_fee_cents integer check (consultation_fee_cents >= 0),
  agreed_24h_referral boolean not null default false,
  eoir_number text,
  accreditation_level accreditation_level,
  accreditation_expiry date,
  agreed_non_attorney boolean not null default false,
  subscription_plan subscription_plan not null default 'free_draft',
  subscription_status subscription_status not null default 'none',
  stripe_customer_id text,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_attorney_bar_required check (
    role <> 'attorney' or bar_number is not null),
  constraint profiles_nonprofit_eoir_required check (
    role <> 'nonprofit' or (eoir_number is not null and accreditation_level is not null)),
  constraint profiles_slug_format check (slug ~ '^[a-z0-9][a-z0-9-]{2,60}$')
);
create unique index professional_profiles_bar_idx
  on public.professional_profiles (bar_number) where bar_number is not null;
create unique index professional_profiles_eoir_idx
  on public.professional_profiles (eoir_number) where eoir_number is not null;
create index professional_profiles_published_idx
  on public.professional_profiles (is_published, accepting_new_clients);

create table public.professional_form_fees (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.professional_profiles(id) on delete cascade,
  form_code text not null,
  is_offered boolean not null default true,
  custom_fee_cents integer not null check (custom_fee_cents >= 0),
  -- DO NOT use is_locked to block a preparer (founder, Nov 14, 2026).
  is_locked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, form_code)
);

create table public.cases (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.accounts(id),
  assigned_provider_id uuid references public.accounts(id),
  assigned_provider_role account_role
    check (assigned_provider_role in ('preparer','attorney','nonprofit')),
  case_for case_for_whom not null default 'myself',
  help_needed service_option not null default 'preparer',
  service_option service_option not null default 'preparer',
  forms text[] not null default '{}',
  status case_status not null default 'intake',
  pathfinder_route jsonb,
  assigned_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index cases_client_idx on public.cases (client_id);
create index cases_provider_idx on public.cases (assigned_provider_id);
create index cases_status_idx on public.cases (status);

create table public.inbox_items (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  client_id uuid not null references public.accounts(id),
  provider_id uuid references public.accounts(id),
  type inbox_item_type not null,
  status inbox_item_status not null default 'missing',
  title text not null,
  instructions text,
  language preferred_language not null default 'en',
  vault_category vault_category,
  document_id uuid,
  invoice_id uuid,
  signature_id uuid,
  requested_by uuid not null references public.accounts(id),
  requested_at timestamptz not null default now(),
  due_at timestamptz,
  is_read_by_client boolean not null default false,
  is_read_by_provider boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inbox_missing_doc_category check (
    type <> 'missing_document' or vault_category is not null)
);
create index inbox_client_unread_idx
  on public.inbox_items (client_id, status) where is_read_by_client = false;
create index inbox_provider_idx on public.inbox_items (provider_id, status);
create index inbox_case_idx on public.inbox_items (case_id, type, status);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  client_id uuid not null references public.accounts(id),
  inbox_item_id uuid references public.inbox_items(id) on delete set null,
  vault_category vault_category not null,
  file_name text not null,
  mime_type text not null
    check (mime_type in ('image/jpeg','image/png','application/pdf')),
  file_size_bytes bigint check (file_size_bytes > 0),
  storage_bucket text not null,
  storage_path text not null unique,
  storage_encrypted boolean not null default true,
  signed_url_expires_at timestamptz,
  uploaded_by uuid not null references public.accounts(id),
  uploaded_by_role account_role not null,
  review_status document_review_status not null default 'uploaded',
  retake_note text,
  reviewed_by uuid references public.accounts(id),
  reviewed_at timestamptz,
  ocr_extracted jsonb,
  ocr_expiry_warning boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index documents_case_category_idx on public.documents (case_id, vault_category);
create index documents_review_idx on public.documents (review_status);
alter table public.inbox_items
  add constraint inbox_items_document_fk
  foreign key (document_id) references public.documents(id) on delete set null;

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  sender_id uuid not null references public.accounts(id),
  sender_role account_role not null,
  recipient_id uuid not null references public.accounts(id),
  recipient_role account_role not null,
  body_original text not null,
  original_language preferred_language not null default 'en',
  body_translated text,
  translated_language preferred_language,
  audio_available boolean not null default false,
  attachment_document_id uuid references public.documents(id) on delete set null,
  is_read boolean not null default false,
  read_at timestamptz,
  notified_via text[] not null default '{}',
  created_at timestamptz not null default now()
);
create index messages_case_idx on public.messages (case_id, created_at);
create index messages_recipient_unread_idx
  on public.messages (recipient_id) where is_read = false;

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  client_id uuid not null references public.accounts(id),
  provider_id uuid references public.accounts(id),
  description text not null,
  form_code text,
  service_fee_cents integer not null default 0 check (service_fee_cents >= 0),
  uscis_fee_cents integer not null default 0 check (uscis_fee_cents >= 0),
  status invoice_status not null default 'draft',
  stripe_invoice_id text unique,
  stripe_checkout_url text,
  due_at timestamptz,
  paid_at timestamptz,
  receipt_pdf_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index invoices_client_idx on public.invoices (client_id, status);
create index invoices_case_idx on public.invoices (case_id, status);
alter table public.inbox_items
  add constraint inbox_items_invoice_fk
  foreign key (invoice_id) references public.invoices(id) on delete set null;

create table public.signatures (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  client_id uuid not null references public.accounts(id),
  form_code text not null,
  document_id uuid references public.documents(id),
  signer_full_name text not null,
  signature_method text not null default 'typed_electronic',
  digital_review_confirmed boolean not null default false,
  signed_at timestamptz,
  ip_address inet,
  created_at timestamptz not null default now(),
  constraint signatures_signed_consistency check (
    signed_at is null or digital_review_confirmed = true)
);
create index signatures_case_idx on public.signatures (case_id, form_code);
alter table public.inbox_items
  add constraint inbox_items_signature_fk
  foreign key (signature_id) references public.signatures(id) on delete set null;

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  client_id uuid not null references public.accounts(id),
  provider_id uuid not null references public.accounts(id),
  type appointment_type not null,
  status appointment_status not null default 'requested',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  timezone text not null default 'America/New_York',
  location_or_link text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint appointments_time_order check (ends_at > starts_at)
);
create index appointments_provider_idx on public.appointments (provider_id, starts_at);
create index appointments_client_idx on public.appointments (client_id, starts_at);

create table public.case_watch (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  client_id uuid not null references public.accounts(id),
  receipt_number text not null,
  form_code text,
  uscis_status text,
  uscis_status_at timestamptz,
  milestones jsonb not null default '[]'::jsonb,
  next_milestone_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (case_id, receipt_number)
);
create index case_watch_client_idx on public.case_watch (client_id);

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.accounts(id),
  actor_role account_role,
  action text not null,
  entity_type text not null,
  entity_id uuid not null,
  case_id uuid references public.cases(id),
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- RLS: client sees only their own rows; a professional sees only cases
-- where assigned_provider_id = their account id; unassigned = zero rows.
create or replace function public.current_account_id()
returns uuid language sql stable as $$
  select id from public.accounts where auth_user_id = auth.uid()
$$;
create or replace function public.current_account_role()
returns account_role language sql stable as $$
  select role from public.accounts where id = public.current_account_id()
$$;
create or replace function public.is_case_participant(p_case_id uuid)
returns boolean language sql stable as $$
  select exists (
    select 1 from public.cases c
    where c.id = p_case_id
      and (c.client_id = public.current_account_id()
           or c.assigned_provider_id = public.current_account_id()))
$$;

alter table public.accounts enable row level security;
alter table public.professional_profiles enable row level security;
alter table public.professional_form_fees enable row level security;
alter table public.cases enable row level security;
alter table public.inbox_items enable row level security;
alter table public.documents enable row level security;
alter table public.messages enable row level security;
alter table public.invoices enable row level security;
alter table public.signatures enable row level security;
alter table public.appointments enable row level security;
alter table public.case_watch enable row level security;
alter table public.audit_log enable row level security;

create policy accounts_select_own on public.accounts for select
  using (id = public.current_account_id()
    or (public.current_account_role() = 'admin'
        and role in ('attorney','nonprofit')
        and verification_status in ('pending','rejected','expired')));
create policy accounts_update_own on public.accounts for update
  using (id = public.current_account_id())
  with check (id = public.current_account_id());
create policy profiles_select on public.professional_profiles for select
  using (account_id = public.current_account_id()
    or (public.current_account_role() = 'admin'));
create policy profiles_update_own on public.professional_profiles for update
  using (account_id = public.current_account_id())
  with check (account_id = public.current_account_id());
create policy profiles_insert_own on public.professional_profiles for insert
  with check (account_id = public.current_account_id());

create view public.public_profiles as
  select p.id, p.slug, p.company_name, p.role, p.bio, p.languages_spoken,
         p.service_area, p.amenities, p.accepting_new_clients,
         p.practice_areas, p.accreditation_level
  from public.professional_profiles p
  join public.accounts a on a.id = p.account_id
  where p.is_published = true
    and p.subscription_status = 'active'
    and (p.role = 'preparer' or a.is_verified = true);

create or replace function public.block_self_verification()
returns trigger language plpgsql as $$
begin
  if (new.is_verified is distinct from old.is_verified
      or new.verification_status is distinct from old.verification_status)
     and public.current_account_role() <> 'admin' then
    raise exception 'Verification fields can only be changed by an admin';
  end if;
  return new;
end $$;
create trigger accounts_block_self_verification
  before update on public.accounts
  for each row execute function public.block_self_verification();

create policy cases_select on public.cases for select
  using (client_id = public.current_account_id()
    or assigned_provider_id = public.current_account_id());
create policy cases_insert_client on public.cases for insert
  with check (client_id = public.current_account_id());
create policy cases_update_participant on public.cases for update
  using (client_id = public.current_account_id()
    or assigned_provider_id = public.current_account_id());
create policy documents_select on public.documents for select
  using (public.is_case_participant(case_id));
create policy documents_insert on public.documents for insert
  with check (public.is_case_participant(case_id)
    and uploaded_by = public.current_account_id());
create policy documents_update_provider_review on public.documents for update
  using (
    exists (select 1 from public.cases c
            where c.id = case_id
              and c.assigned_provider_id = public.current_account_id())
    or client_id = public.current_account_id());
-- Apply the same is_case_participant(case_id) select / participant insert
-- pattern to inbox_items, messages, invoices, signatures, appointments,
-- and case_watch (see the full spec in
-- workspace/your_files/itfw-inbox-vault-api-sql/itfw-inbox-vault-api-sql.md).
