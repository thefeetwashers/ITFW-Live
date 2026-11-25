-- ============================================================================
-- ITFW Live — Supabase migration 0017: Real Reviews + Refer-a-Family +
-- Renewal types + Booking decisions + Consultation requests
-- Run AFTER 0001–0016, in order (full run order 0001 -> 0020).
-- the founder / browser task says so. If any statement errors, STOP and
-- report the error verbatim.
--
-- RENUMBERING + MERGE (consolidation, Nov 19–20, 2026 — see DEPLOY.md):
--   * This file is the MERGE of the two 0016 files that existed in the
--     repo (0016_itfw_reviews_referrals_renewals_booking.sql and
--     0016_itfw_reviews_referrals_bookings.sql, written by concurrent
--     builders). Running both would have FAILED: both created
--     public.reviews (same table, different columns), both created
--     indexes reviews_professional_idx / reviews_case_idx, and both
--     widened the case_renewals CHECK with different value sets.
--     Neither file ran live, so the merge is safe: the two 0016 files
--     are deleted and this single 0017 replaces them.
--   * CANONICAL reviews schema = the renewals_booking file, because
--     the portal code matches it exactly (portal/src/lib/reviews.ts
--     ReviewRow + src/components/portal/ReviewsSection.tsx use
--     professional_account_id / client_account_id / service_form_code /
--     consent_given / display_name_choice / reply_text / visible).
--     The bookings file's schema (professional_id, permission_given,
--     status, professional_reply, display_name_style, service) matches
--     NO portal code and is NOT used.
--   * MERGED IN from the bookings file (its genuinely unique parts):
--     consultation_requests table; accounts.referral_code;
--     case_agency_numbers.medical_exam_date + panel_physician; and the
--     STRICTER moderation logic (a founder/admin may NOT edit a
--     review's content either — the renewals_booking trigger let an
--     admin change rating/body unchecked). The strict logic is adapted
--     here to the canonical column names.
--   * Renewal-type CHECK is the UNION of both files' sets, so neither
--     vocabulary is lost: ('ead', 'green_card', 'n400', 'i90', 'i751',
--     'conditional_green_card', 'tps', 'passport'). The portal code
--     (src/lib/renewals.ts RenewalType) writes 'conditional_green_card'
--     for I-751 and 'green_card' for I-90; 'i90' / 'i751' are accepted
--     aliases from the sibling file for the same two forms.
--   * Referral codes exist in TWO places (one per file, no conflict):
--     professional_profiles.referral_code (the storefront link code,
--     /r/<code> -> /p/<slug>) and accounts.referral_code
--     (account-level code). Both are kept; the storefront resolves the
--     profile code first.
--   * Booking exists in TWO complementary places (no conflict):
--     consultation_requests (the pre-booking REQUEST table) and
--     decision columns on preparer_appointments (Accept / Propose /
--     Decline on a collected request). The calendar is still NOT
--     connected: requests are collected, the professional confirms by
--     message. See portal/src/lib/booking.ts.
--
-- WHAT IS GENUINELY NEW HERE (nothing else in this file is a new table):
--   1. reviews — the ONLY new review table. One review per case: a
--      client may leave a review ONLY after a real case/order, with
--      their permission, tied to the professional they used. No seed
--      rows — the table starts empty and the UI shows "No reviews yet
--      — be our first." until a real row exists. NEVER invent a review,
--      a rating, a count, or a testimonial.
--   2. consultation_requests — the consultation REQUEST (not a booking).
--      No calendar event exists until the professional accepts.
--      Price is locked by CHECK: free 15-min ($0) or 30-min $99.
--   3. Referral columns on preparer_leads (0010) + referral codes on
--      professional_profiles (0001) and accounts (0001). No reward
--      amount is set anywhere: the reward is NOT in this migration
--      and no payout / discount column is created.
--   4. Renewal-type widening on case_renewals (0014) + form_to_file +
--      nudge timestamps. No second renewals table.
--   5. Booking-decision columns on preparer_appointments (0012).
--   6. medical_exam_date + panel_physician on case_agency_numbers
--      (0009/0010). No date is ever invented: null = not scheduled yet.
--
-- MODERATION (enforced in the database, not only in the UI):
--   * A professional may NEVER edit or delete a client's review: the
--     trigger reviews_enforce_moderation raises if a professional
--     changes anything except reply_text (replied_at / replied_by are
--     set by the trigger itself, never by the caller).
--   * A founder/admin may hide a review ONLY with a reason: the
--     trigger requires hidden_reason when visible flips true -> false
--     and writes the hide to audit_log (0001) with the reason. An
--     un-hide is also written to audit_log. A founder/admin may NOT
--     edit a review's rating / text / name / service / consent.
--   * A review is insertable only with consent_given = true and a
--     rating 1–5, and only by a participant on that case.
--   * Service-role (backend API) calls bypass the trigger guard
--     (auth.uid() IS NULL): the API route enforces the same rules.
--     This matches 0001's block_self_verification, which also lets
--     service-role writes through.
--   * There is NO client UPDATE policy and NO delete policy at all.
--
-- No seed rows, no keys, no passwords, no plaintext secrets anywhere.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. reviews — genuinely new table
-- ---------------------------------------------------------------------------
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  -- The professional the client used (accounts id of the assigned
  -- provider). The storefront shows reviews for this professional.
  professional_account_id uuid not null references public.accounts(id) on delete cascade,
  client_account_id uuid not null references public.accounts(id) on delete cascade,
  -- Real service, as filed: e.g. 'I-130', 'I-485', 'N-400'.
  service_form_code text not null,
  service_name text,
  rating integer not null check (rating between 1 and 5),
  body text not null check (char_length(trim(body)) > 0),
  -- Permission: the client must have agreed the review may be shown.
  consent_given boolean not null default false,
  -- Display name: the client chooses full real name, or first name +
  -- initial (e.g. "Maria G."). display_name is what is shown; it is
  -- stored as the client wrote it — never invented by the system.
  display_name_choice text not null default 'first_name_initial'
    check (display_name_choice in ('full_name', 'first_name_initial')),
  display_name text not null check (char_length(trim(display_name)) > 0),
  -- Professional reply (the ONLY thing a professional may change).
  reply_text text,
  replied_at timestamptz,
  replied_by uuid references public.accounts(id) on delete set null,
  -- Founder/admin hide, with a logged reason (see trigger below).
  visible boolean not null default true,
  hidden_by uuid references public.accounts(id) on delete set null,
  hidden_reason text,
  hidden_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One review per case: a client reviews a case once.
  constraint reviews_one_per_case unique (case_id),
  -- A review may be shown only with the client's permission.
  constraint reviews_visible_requires_consent check (
    visible = false or consent_given = true
  ),
  -- Hiding requires a reason.
  constraint reviews_hidden_requires_reason check (
    visible = true or hidden_reason is not null
  )
);
create index reviews_professional_idx
  on public.reviews (professional_account_id, created_at desc);
create index reviews_case_idx on public.reviews (case_id);

alter table public.reviews enable row level security;

-- Anyone who is a participant on the case may read its review; the
-- professional's public storefront reads visible reviews for that
-- professional (the storefront query filters visible = true).
create policy reviews_select_participant on public.reviews for select
  using (public.is_case_participant(case_id));
create policy reviews_select_visible_for_professional on public.reviews for select
  using (visible = true);

-- The client on the case inserts their own review, with consent.
create policy reviews_insert_client on public.reviews for insert
  with check (
    client_account_id = public.current_account_id()
    and consent_given = true
    and public.is_case_participant(case_id)
  );

-- The assigned professional may UPDATE only to reply (enforced by the
-- trigger below, which raises on any other column change by a
-- professional). Founder/admin UPDATE is for hiding with a reason
-- (also enforced by the trigger + the CHECK above).
create policy reviews_update_professional on public.reviews for update
  using (professional_account_id = public.current_account_id())
  with check (professional_account_id = public.current_account_id());
create policy reviews_update_founder_admin on public.reviews for update
  using (public.current_account_role() in ('admin', 'founder'))
  with check (public.current_account_role() in ('admin', 'founder'));

-- NO delete policy: nobody deletes a review through the API. A
-- founder/admin hides it (visible = false + hidden_reason), and the
-- hide is logged to audit_log by the trigger.

-- --- Moderation trigger ----------------------------------------------------
-- MERGED + STRICTER (see header): the renewals_booking version let a
-- founder/admin change rating/body unchecked; the bookings version
-- blocked that. This version blocks content edits for EVERYONE except
-- the backend itself, and is adapted to the canonical column names.
--   * Service role (auth.uid() IS NULL, i.e. a backend API route using
--     SUPABASE_SERVICE_ROLE_KEY) bypasses the guard — the API route
--     enforces the same rules. JWT-authenticated callers never do.
--   * Founder/admin: may ONLY hide (visible true -> false, with a
--     reason, logged) or un-hide (logged). May NOT edit rating, text,
--     name, service, consent, reply, or any id. May edit hidden_reason
--     on an already-hidden review.
--   * Professional: may ONLY change reply_text. replied_at and
--     replied_by are set BY THIS TRIGGER (now + caller id), never by
--     the caller. Every other column change raises.
--   * Anyone else (including the client who wrote it): blocked — there
--     is no client UPDATE policy either, so this is defense in depth.
create or replace function public.reviews_enforce_moderation()
returns trigger language plpgsql as $$
declare
  v_role text := public.current_account_role()::text;
begin
  -- Backend (service role) calls bypass: the API route enforces the
  -- same rules. Matches 0001 block_self_verification.
  if auth.uid() is null then
    return new;
  end if;

  if v_role in ('admin', 'founder') then
    -- Content is never editable, not even by a founder/admin.
    if old.rating is distinct from new.rating
      or old.body is distinct from new.body
      or old.display_name is distinct from new.display_name
      or old.display_name_choice is distinct from new.display_name_choice
      or old.service_form_code is distinct from new.service_form_code
      or old.service_name is distinct from new.service_name
      or old.consent_given is distinct from new.consent_given
      or old.reply_text is distinct from new.reply_text
      or old.replied_at is distinct from new.replied_at
      or old.replied_by is distinct from new.replied_by
      or old.case_id is distinct from new.case_id
      or old.client_account_id is distinct from new.client_account_id
      or old.professional_account_id is distinct from new.professional_account_id
    then
      raise exception 'Reviews are never edited — a founder/admin may only hide a review with a reason.';
    end if;
    if old.visible = true and new.visible = false then
      if new.hidden_reason is null or trim(new.hidden_reason) = '' then
        raise exception 'Hiding a review requires a reason (hidden_reason).';
      end if;
      new.hidden_by := public.current_account_id();
      new.hidden_at := now();
      insert into public.audit_log
        (actor_id, actor_role, action, entity_type, entity_id, case_id, detail)
      values (
        public.current_account_id(),
        public.current_account_role(),
        'review_hidden',
        'reviews',
        old.id,
        old.case_id,
        jsonb_build_object('hidden_reason', new.hidden_reason)
      );
    elsif old.visible = false and new.visible = true then
      new.hidden_by := null;
      new.hidden_at := null;
      insert into public.audit_log
        (actor_id, actor_role, action, entity_type, entity_id, case_id, detail)
      values (
        public.current_account_id(),
        public.current_account_role(),
        'review_unhidden',
        'reviews',
        old.id,
        old.case_id,
        jsonb_build_object('hidden_reason', old.hidden_reason)
      );
    end if;
    return new;
  end if;
  -- Professional (or any other role): reply only. IS DISTINCT FROM
  -- (not <>) so a caller with no accounts row is also blocked here.
  if old.professional_account_id is distinct from public.current_account_id() then
    raise exception 'Only the professional (reply) or a founder/admin (hide with reason) may change a review.';
  end if;
  if old.rating is distinct from new.rating
    or old.body is distinct from new.body
    or old.display_name is distinct from new.display_name
    or old.display_name_choice is distinct from new.display_name_choice
    or old.service_form_code is distinct from new.service_form_code
    or old.service_name is distinct from new.service_name
    or old.consent_given is distinct from new.consent_given
    or old.visible is distinct from new.visible
    or old.hidden_reason is distinct from new.hidden_reason
    or old.hidden_by is distinct from new.hidden_by
    or old.hidden_at is distinct from new.hidden_at
    or old.case_id is distinct from new.case_id
    or old.client_account_id is distinct from new.client_account_id
    or old.professional_account_id is distinct from new.professional_account_id
    or old.replied_by is distinct from new.replied_by
  then
    raise exception 'A professional may only reply to a review — a client''s review (rating, text, name, service, consent, visibility) cannot be edited or deleted by the professional.';
  end if;
  if new.reply_text is distinct from old.reply_text then
    new.replied_at := now();
    new.replied_by := public.current_account_id();
  end if;
  return new;
end;
$$;

drop trigger if exists reviews_enforce_moderation on public.reviews;
create trigger reviews_enforce_moderation before update on public.reviews
  for each row execute function public.reviews_enforce_moderation();

drop trigger if exists set_updated_at_reviews on public.reviews;
create trigger set_updated_at_reviews before update on public.reviews
  for each row execute function public.set_updated_at();

-- Founder/admin read (0003 section 7a / 0010 pattern) — for the
-- verification queue / audit log only, never a client's documents.
drop policy if exists select_founder_admin_reviews on public.reviews;
create policy select_founder_admin_reviews on public.reviews for select
  using (public.current_account_role() in ('admin', 'founder'));

-- ---------------------------------------------------------------------------
-- 2. Refer-a-Family — columns on existing tables (no new table)
-- ---------------------------------------------------------------------------
-- Referral code for the professional's link:
-- immigration.niptei.com/r/<code> and their storefront link.
-- MERGED: professional_profiles.referral_code is the storefront link
-- code; accounts.referral_code (from the sibling 0016) is the
-- account-level code. Both are kept; the storefront resolves the
-- profile code first. No reward amount is set anywhere.
alter table public.professional_profiles
  add column if not exists referral_code text
    check (referral_code is null or referral_code ~ '^[a-z0-9][a-z0-9-]{2,60}$');
create unique index if not exists professional_profiles_referral_code_idx
  on public.professional_profiles (referral_code) where referral_code is not null;

alter table public.accounts
  add column if not exists referral_code text;
create unique index if not exists accounts_referral_code_idx
  on public.accounts (referral_code) where referral_code is not null;

comment on column public.accounts.referral_code is
  'Refer-a-Family code for /r/<code>. Random code generated by the app; no reward amount is set — see portal/src/lib/referrals.ts.';

-- The referred lead: referral_source = 'Referral' + who referred them.
alter table public.preparer_leads
  add column if not exists referral_source text
    check (referral_source is null or referral_source in
      ('Referral', 'Storefront', 'Walk-in', 'Other')),
  add column if not exists referrer_account_id uuid
    references public.accounts(id) on delete set null,
  add column if not exists referral_code text;
create index if not exists preparer_leads_referrer_idx
  on public.preparer_leads (referrer_account_id, pipeline_stage)
  where referrer_account_id is not null;

comment on column public.preparer_leads.referrer_account_id is
  'Account that referred this lead (via /r/<code>). Set together with lead_source = ''Referral''. Counts on the referral card come from real rows only.';

-- ---------------------------------------------------------------------------
-- 3. Renewal types — widen case_renewals (0014), no new table
--    Old CHECK allowed only ('ead','green_card','n400'). New types:
--    'conditional_green_card' (I-751, 90-day filing window),
--    'tps' (TPS / EAD renewal, 180-day window),
--    'passport' (passport expiry).
--    'ead' stays the EAD renewal type; 'green_card' stays the I-90
--    10-year card (file 6 months before expiry).
--    MERGED: the set below is the UNION of both 0016 files — the
--    sibling file also accepted 'i90' / 'i751' as aliases for the same
--    two forms. The portal writes 'conditional_green_card' / 'green_card'
--    (see portal/src/lib/renewals.ts). The CHECK is dropped by finding
--    whichever constraint currently guards renewal_type, so this file
--    does not depend on the auto-generated constraint name.
-- ---------------------------------------------------------------------------
do $$
declare
  c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.case_renewals'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%renewal_type%'
  loop
    execute 'alter table public.case_renewals drop constraint ' || quote_ident(c.conname);
  end loop;
end $$;

alter table public.case_renewals
  add constraint case_renewals_renewal_type_check
    check (renewal_type in (
      'ead', 'green_card', 'n400', 'i90', 'i751',
      'conditional_green_card', 'tps', 'passport'
    ));
alter table public.case_renewals
  add column if not exists form_to_file text,
  add column if not exists nudge_language preferred_language not null default 'en',
  add column if not exists last_nudged_at timestamptz,
  add column if not exists next_nudge_at timestamptz;

-- ---------------------------------------------------------------------------
-- 4. Booking decisions — columns on preparer_appointments (0012)
--    Calendar is NOT connected: these columns record the request and
--    the professional's decision (Accept / Propose another time /
--    Decline). No calendar event is created by this table.
-- ---------------------------------------------------------------------------
alter table public.preparer_appointments
  add column if not exists consultation_mode text
    check (consultation_mode is null or consultation_mode in
      ('phone', 'video', 'in_person')),
  add column if not exists time_preference text
    check (time_preference is null or time_preference in
      ('weekday', 'evening', 'weekend', 'any')),
  add column if not exists language preferred_language,
  add column if not exists timezone text,
  add column if not exists price_cents integer check (price_cents is null or price_cents >= 0),
  add column if not exists decision text not null default 'pending'
    check (decision in ('pending', 'accepted', 'proposed', 'declined')),
  add column if not exists proposed_time text,
  add column if not exists declined_reason text;

-- ---------------------------------------------------------------------------
-- 5. consultation_requests — the consultation REQUEST (not a booking).
--    MERGED IN from the sibling 0016 file (its genuinely unique table).
--    No calendar is connected: a request is collected here with the
--    client's mode / language / timezone / preferred time as free text,
--    and the professional answers Accept / Propose another time /
--    Decline. Accepting creates a real appointments row (0001) — it
--    never claims a calendar sync.
--    Price is locked by CHECK: free 15-min ($0) or 30-min $99
--    (9900 cents). The 30-min consultation is NOT legal advice.
-- ---------------------------------------------------------------------------
create table public.consultation_requests (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.accounts(id) on delete cascade,
  client_id uuid references public.accounts(id) on delete set null,
  requester_name text not null check (char_length(requester_name) between 1 and 120),
  requester_email text,
  requester_phone text,
  mode text not null check (mode in ('phone', 'video', 'in_person')),
  duration_minutes integer not null check (duration_minutes in (15, 30)),
  price_cents integer not null check (price_cents in (0, 9900)),
  preferred_language preferred_language not null default 'en',
  timezone text not null default 'America/New_York',
  requested_time_text text,
  evening_or_weekend boolean not null default false,
  status text not null default 'requested'
    check (status in ('requested', 'accepted', 'proposed', 'declined')),
  proposed_starts_at timestamptz,
  professional_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint consultation_price_matches_duration
    check ((duration_minutes = 15 and price_cents = 0)
        or (duration_minutes = 30 and price_cents = 9900))
);
create index consultation_requests_professional_idx
  on public.consultation_requests (professional_id, status, created_at desc);
create index consultation_requests_client_idx
  on public.consultation_requests (client_id, created_at desc)
  where client_id is not null;

alter table public.consultation_requests enable row level security;

-- Anyone may REQUEST (public storefront form, same as the lead path);
-- only the professional (or the requesting client) may read it, and
-- only the professional may answer it.
create policy consultation_requests_insert_public on public.consultation_requests for insert
  with check (professional_id is not null);
create policy consultation_requests_select_participant on public.consultation_requests for select
  using (
    professional_id = public.current_account_id()
    or client_id = public.current_account_id()
    or public.current_account_role() in ('admin', 'founder')
  );
create policy consultation_requests_update_professional on public.consultation_requests for update
  using (
    professional_id = public.current_account_id()
    or public.current_account_role() in ('admin', 'founder')
  );

drop trigger if exists set_updated_at_consultation_requests on public.consultation_requests;
create trigger set_updated_at_consultation_requests before update on public.consultation_requests
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 6. case_agency_numbers — add ONLY the genuinely missing columns for
--    the Interview & Medical Exam appointment card (MERGED IN from the
--    sibling 0016 file):
--      medical_exam_date  date of the panel-physician medical exam
--      panel_physician    name/clinic of the panel physician (free text)
--    embassy_post_name, interview_date, medical_exam_status, ceac_dq_date
--    and the NVC fee statuses already exist (0009/0010) — NOT duplicated.
--    VAC biometrics lives in case_post_submission (0016) — NOT duplicated.
--    No date is ever invented: null means "not scheduled yet".
-- ---------------------------------------------------------------------------
alter table public.case_agency_numbers
  add column if not exists medical_exam_date date;
alter table public.case_agency_numbers
  add column if not exists panel_physician text;

-- ============================================================================
-- END OF 0017 — schema only. No seed rows, no keys, no passwords.
-- Nothing here runs live, touches Supabase/Vercel/GitHub, or edits
-- migrations 0001–0016. Run order: 0001 → 0017, then 0018, then 0019,
-- then 0020. This file REPLACES both 0016 files (see header); the old
-- 0016 filenames must not be re-created.
-- ============================================================================
