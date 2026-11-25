-- ============================================================================
-- ITFW Live — Supabase migration 0015: professional storefronts
-- (/p/<slug> on immigration.niptei.com)
-- Run AFTER 0014 (full run order 0001 -> 0020; 0013 is the public
-- profiles view). Schema only — do NOT run live until the founder /
-- browser task says so. No seed rows, no keys, no passwords. Money is
-- integer cents everywhere.
--
-- WHAT THIS ADDS (only what is genuinely missing):
--   1. storefront_sections — free-form front-page sections the
--      professional adds/edits/reorders from their dashboard
--      (professional_id -> public.accounts(id), per the storefront spec).
--      Sections live on the professional's OWN profile; there is no
--      second profile table. `is_published` gates what visitors see;
--      drafts are visible to the owner only, in edit/preview mode.
--   2. professional_addons — the professional's own additional services
--      (professional_id -> public.accounts(id)). Locked platform prices
--      (translation $45/page, Packet Rescue $199, consultation $99/30
--      min, RFE $399/$799/$1,499, FBI prep $149, FOIA prep $149, mock
--      interview $199) are enforced by CHECK when is_locked_price is
--      true; anything else is a custom add-on (is_locked_price = false)
--      and is labelled on the storefront as the professional's own
--      service, not a platform price.
--   3. Storefront display columns on public.professional_profiles that
--      did not exist: display_name, photo_storage_path (private 'vault'
--      bucket path — NEVER a public URL; the page mints a signed URL),
--      public_phone / public_email / whatsapp_number (owner-chosen
--      PUBLIC contact — accounts.phone/email stay private),
--      public_address_text + show_address (default false — a home
--      address is NEVER published unless the professional opts in),
--      office_hours, is_law_student + supervising_attorney_name
--      ("Law Student — Supervised Only" badge; account_role has no
--      law-student value, so this is a flag on the preparer role).
--      Reused as-is: bio, languages_spoken, years_experience,
--      service_area (jsonb), company_name, slug, is_published,
--      updated_at (drives the storefront "Edited [date]" note).
--   4. Public-read path, built ON migration 0013 (not around it):
--      0013's public_profiles VIEW is the ONLY public projection of
--      professional_profiles (safe columns only — never email, phone,
--      bar_number, eoir_number, stripe_customer_id, subscription_plan).
--      This file deliberately does NOT add a whole-row anon SELECT
--      policy on professional_profiles: that would let anon request
--      stripe_customer_id and defeat the view. Instead:
--        * public.is_profile_listed(profile_id) — SECURITY DEFINER
--          helper (0008 pattern) returning true only for a listed
--          profile (is_published + active subscription + preparer or
--          verified account). A plain EXISTS against public.accounts
--          inside a policy does NOT work for anon (RLS applies inside
--          policy expressions and anon has no accounts SELECT policy,
--          so the check always evaluates false) — the SECURITY DEFINER
--          helper is the fix, per 0013's flag.
--        * public.listed_profile_storefront(profile_id) — SECURITY
--          DEFINER RPC returning ONLY the owner-chosen public
--          storefront columns (display name, photo path, public
--          contact, address-if-opted-in, office hours, law-student
--          flag, years, bar states, updated_at) for a listed profile,
--          else zero rows. The page calls this after reading the 0013
--          view; it never reads the base table as a visitor.
--        * Public SELECT policies on professional_form_fees,
--          storefront_sections, and professional_addons that use
--          is_profile_listed() — so they actually evaluate true for
--          anon visitors of a listed profile.
--   5. Public-insert policy for preparer_leads (new_lead rows only):
--      0010's insert policy requires preparer_id = current_account_id(),
--      so a storefront visitor could never place an order, and 0003's
--      quote_requests_insert requires auth.uid() IS NOT NULL, so an
--      anonymous visitor could not even request a quote — and
--      quote_requests_select is founder/admin-only, so the professional
--      could not read their own quote requests anyway. Storefront
--      orders AND quote requests therefore insert into preparer_leads
--      (the professional's Lead Sheet, readable by them), with
--      pipeline_stage forced to 'new_lead'. The WITH CHECK references
--      only the row being inserted, so it evaluates fine for anon. No
--      public select/update/delete on leads. A case row is created only
--      when the professional converts the lead (0010 pattern) — the
--      storefront never claims a case exists at order time. Spam risk
--      is noted: the professional triages new leads in their Lead Sheet.
--
-- ISOLATION: every storefront query is scoped by slug -> profile ->
-- account_id. A storefront shows ONLY that professional's services,
-- sections, add-ons, reviews, and contact. Ordering inserts a lead
-- with preparer_id = THAT profile's account_id only.
--
-- CONVENTIONS FOLLOWED (0001 as fixed in 0008, 0002, 0003, 0009, 0010):
--   * FKs point at public.accounts(id) — never users(id).
--   * preferred_language is the existing 7-language enum
--     ('en','es','ht','fr','pt','zh','ar').
--   * RLS is participant-only via SECURITY DEFINER helpers
--     (current_account_id(), current_account_role()).
--   * updated_at is refreshed by public.set_updated_at() (0003).
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1. storefront_sections — free-form front-page sections.
--    Reviews: ONLY real reviews the professional has permission to show.
--    There is deliberately NO review-count column — counts are never
--    invented. Empty state on the storefront: "No reviews yet".
-- --------------------------------------------------------------------------
create table public.storefront_sections (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.accounts(id) on delete cascade,
  section_type text not null check (section_type in (
    'how_i_work', 'reviews', 'faqs', 'documents_needed',
    'office_hours', 'custom')),
  title text not null check (char_length(title) between 1 and 120),
  body text not null default '',
  sort_order integer not null default 0,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index storefront_sections_professional_idx
  on public.storefront_sections (professional_id, sort_order);

-- --------------------------------------------------------------------------
-- 2. professional_addons — the professional's own additional services.
--    Locked prices are enforced by CHECK when is_locked_price is true.
--    Translation is $45 PER PAGE (price_cents = 4500 per page).
-- --------------------------------------------------------------------------
create table public.professional_addons (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.accounts(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  description text not null default '',
  price_cents integer not null check (price_cents >= 0),
  is_locked_price boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint professional_addons_locked_price_matches check (
    is_locked_price = false or (name, price_cents) in (
      ('Certified Translation (per page)', 4500),
      ('Packet Rescue', 19900),
      ('Consultation — 30 min', 9900),
      ('RFE Response — Basic', 39900),
      ('RFE Response — Standard', 79900),
      ('RFE Response — Premium', 149900),
      ('FBI Background Check Prep', 14900),
      ('FOIA Request Prep', 14900),
      ('Mock Interview', 19900)
    ))
);
create index professional_addons_professional_idx
  on public.professional_addons (professional_id, sort_order);

-- --------------------------------------------------------------------------
-- 3. Storefront display columns on professional_profiles.
--    photo_storage_path is a PRIVATE 'vault' bucket path
--    (e.g. storefront-photos/<profile_id>/<file>); the page mints a
--    short-lived signed URL. Never store a public photo URL here and
--    never invent a photo.
--    public_address_text is shown ONLY when show_address is true; the
--    default is false, so a home address is never published by default.
-- --------------------------------------------------------------------------
alter table public.professional_profiles
  add column if not exists display_name text,
  add column if not exists photo_storage_path text,
  add column if not exists public_phone text,
  add column if not exists public_email citext,
  add column if not exists whatsapp_number text,
  add column if not exists public_address_text text,
  add column if not exists show_address boolean not null default false,
  add column if not exists office_hours text,
  add column if not exists is_law_student boolean not null default false,
  add column if not exists supervising_attorney_name text,
  add constraint profiles_law_student_preparer_only check (
    is_law_student = false or role = 'preparer'),
  add constraint profiles_law_student_needs_supervisor check (
    is_law_student = false or supervising_attorney_name is not null);

-- --------------------------------------------------------------------------
-- 4. SECURITY DEFINER helpers — the public-read path (0013's view plus
--    these; no whole-row anon policy on professional_profiles, so
--    stripe_customer_id / bar_number / eoir_number stay unreadable).
--    Same listing gate as the 0013 view: is_published + active
--    subscription + (preparer OR verified account).
-- --------------------------------------------------------------------------
create or replace function public.is_profile_listed(p_profile_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.professional_profiles p
    join public.accounts a on a.id = p.account_id
    where p.id = p_profile_id
      and p.is_published = true
      and p.subscription_status = 'active'
      and (p.role = 'preparer' or a.is_verified = true)
  );
$$;

-- Public storefront columns for ONE listed profile, else zero rows.
-- Safe columns only: never email/phone from accounts, never bar_number,
-- eoir_number, stripe_customer_id, or subscription_plan. public_phone /
-- public_email / public_address_text are owner-chosen PUBLIC fields.
create or replace function public.listed_profile_storefront(p_profile_id uuid)
returns table (
  display_name text,
  photo_storage_path text,
  public_phone text,
  public_email citext,
  whatsapp_number text,
  public_address_text text,
  show_address boolean,
  office_hours text,
  is_law_student boolean,
  supervising_attorney_name text,
  years_experience integer,
  bar_states text[],
  updated_at timestamptz
)
language sql stable security definer
set search_path = public
as $$
  select p.display_name, p.photo_storage_path, p.public_phone,
         p.public_email, p.whatsapp_number, p.public_address_text,
         p.show_address, p.office_hours, p.is_law_student,
         p.supervising_attorney_name, p.years_experience,
         p.bar_states, p.updated_at
  from public.professional_profiles p
  where p.id = p_profile_id
    and public.is_profile_listed(p.id);
$$;
grant execute on function public.is_profile_listed(uuid) to anon, authenticated;
grant execute on function public.listed_profile_storefront(uuid) to anon, authenticated;

-- --------------------------------------------------------------------------
-- 5. RLS — new tables: owner-only write, public read of listed rows
--    (via the SECURITY DEFINER helper, so anon evaluation works).
-- --------------------------------------------------------------------------
alter table public.storefront_sections enable row level security;
alter table public.professional_addons enable row level security;

-- Sections: owner manages their own rows (slug-owner check in the app
-- + this policy server-side).
create policy storefront_sections_select_own on public.storefront_sections for select
  using (professional_id = public.current_account_id());
create policy storefront_sections_insert_own on public.storefront_sections for insert
  with check (professional_id = public.current_account_id());
create policy storefront_sections_update_own on public.storefront_sections for update
  using (professional_id = public.current_account_id())
  with check (professional_id = public.current_account_id());
create policy storefront_sections_delete_own on public.storefront_sections for delete
  using (professional_id = public.current_account_id());

-- Sections: anyone may read PUBLISHED sections of a LISTED professional.
-- Drafts stay owner-only.
create policy storefront_sections_select_public_listed on public.storefront_sections for select
  using (is_published = true and exists (
    select 1 from public.professional_profiles p
    where p.account_id = storefront_sections.professional_id
      and public.is_profile_listed(p.id)
  ));

-- Add-ons: owner manages their own rows.
create policy professional_addons_select_own on public.professional_addons for select
  using (professional_id = public.current_account_id());
create policy professional_addons_insert_own on public.professional_addons for insert
  with check (professional_id = public.current_account_id());
create policy professional_addons_update_own on public.professional_addons for update
  using (professional_id = public.current_account_id())
  with check (professional_id = public.current_account_id());
create policy professional_addons_delete_own on public.professional_addons for delete
  using (professional_id = public.current_account_id());

-- Add-ons: anyone may read ACTIVE add-ons of a LISTED professional.
create policy professional_addons_select_public_listed on public.professional_addons for select
  using (is_active = true and exists (
    select 1 from public.professional_profiles p
    where p.account_id = professional_addons.professional_id
      and public.is_profile_listed(p.id)
  ));

-- Form fees: anyone may read OFFERED fees of a LISTED professional.
-- (0003's policy is owner-only, so anon reads failed before this.)
create policy professional_form_fees_select_public_listed
  on public.professional_form_fees for select
  using (is_offered = true and public.is_profile_listed(profile_id));

-- --------------------------------------------------------------------------
-- 6. Storefront orders / quote requests land in the Lead Sheet.
--    Public (including anonymous visitors) may INSERT new_lead rows
--    only — no public select / update / delete. The professional reads
--    their own leads via 0010's preparer_leads_select_own.
-- --------------------------------------------------------------------------
create policy preparer_leads_insert_public_new on public.preparer_leads for insert
  with check (pipeline_stage = 'new_lead');

-- --------------------------------------------------------------------------
-- 7. Grants (explicit, so the policies above are reachable via the API).
-- --------------------------------------------------------------------------
grant select on public.professional_form_fees to anon, authenticated;
grant select on public.storefront_sections to anon, authenticated;
grant insert, update, delete on public.storefront_sections to authenticated;
grant select on public.professional_addons to anon, authenticated;
grant insert, update, delete on public.professional_addons to authenticated;
grant insert on public.preparer_leads to anon, authenticated;

-- --------------------------------------------------------------------------
-- 8. updated_at triggers (public.set_updated_at() from 0003).
-- --------------------------------------------------------------------------
drop trigger if exists set_updated_at_storefront_sections on public.storefront_sections;
create trigger set_updated_at_storefront_sections before update on public.storefront_sections
  for each row execute function public.set_updated_at();
drop trigger if exists set_updated_at_professional_addons on public.professional_addons;
create trigger set_updated_at_professional_addons before update on public.professional_addons
  for each row execute function public.set_updated_at();

-- ============================================================================
-- END OF 0015 — after running 0001 -> 0015 in order, verify with the anon
-- key (browser task): an anon SELECT on public.public_profiles returns
-- the listed row; listed_profile_storefront(<listed id>) returns the
-- public storefront columns; anon SELECTs on professional_form_fees /
-- storefront_sections / professional_addons return that profile's rows;
-- an anon SELECT on professional_profiles returns zero rows (base table
-- stays owner/admin-only — the 0013 view is the public path); an order
-- from /p/<slug> inserts exactly one preparer_leads row with
-- preparer_id = that profile's account_id and pipeline_stage =
-- 'new_lead'; a signed-in professional can edit ONLY their own slug's
-- storefront.
-- NOT live after this migration alone: Stripe checkout (no keys), calendar
-- booking (not connected — requests are collected), E-Sign (not connected).
-- Photo upload also needs the private 'vault' Storage bucket plus a
-- storage policy letting the profile owner upload under
-- storefront-photos/<profile_id>/ — that is a dashboard step, not SQL.
-- ============================================================================
