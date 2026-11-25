-- ============================================================================
-- ITFW Live — Supabase migration 0013: public read for the public_profiles
-- view (the /p/<slug> directory page).
-- Run AFTER 0012, in order (0001 -> 0013; 0015 runs after this file).
-- Schema only — do NOT run live until the founder / browser task says so.
-- No seed rows, no keys, no passwords.
--
-- RENUMBERING NOTE (consolidation, Nov 19–20, 2026 — see DEPLOY.md):
-- two 0012 files, two 0013 files and two 0016 files existed in this
-- repo (concurrent builders). They were renumbered/merged so the run
-- order is now strictly 0001 -> 0020 by filename: this file KEEPS
-- 0013; the sibling 0013 (unified comms + BYO) is now 0014; the
-- storefront file is now 0015; the Next Step file is now 0016; the two
-- 0016 files were merged into a single 0017; Visa Bulletin is 0018.
-- Nothing in 0009+ had run live, so no migration history breaks.
--
-- WHY A VIEW, NOT A BASE-TABLE ANON POLICY:
--   * The public page (/p/<slug>, portal/src/app/p/[slug]/page.tsx) must
--     be readable by anonymous visitors. The base table
--     professional_profiles has only owner/admin SELECT policies (0001),
--     so an anon query returns zero rows and every slug shows "not found".
--   * A whole-row anon SELECT policy on professional_profiles would
--     technically permit requesting stripe_customer_id (and bar_number /
--     eoir_number) — the exact exposure migration 0015 flags as a
--     follow-up ("a later migration should move public reads behind a
--     view that omits it"). This file IS that view-based fix.
--   * An anon policy with an EXISTS check against public.accounts does
--     NOT work either: RLS applies inside policy expressions, anon has
--     no accounts SELECT policy, so the EXISTS check always evaluates
--     false for anon (same reason 0008 recreated the helpers as SECURITY
--     DEFINER). The view avoids the problem entirely: it runs as the
--     view owner (security_invoker = false, the Postgres 15 default made
--     explicit below), so base-table RLS is bypassed for the owner, and
--     the view's own WHERE clause is the listing gate.
--
-- WHAT THE VIEW EXPOSES (and what it NEVER exposes):
--   * Exposed: id, slug, account_id, full_name, company_name, role, bio,
--     languages_spoken, service_area, amenities, accepting_new_clients,
--     practice_areas, accreditation_level. account_id is an internal UUID
--     key (not PII) and is included ONLY so the public page can route a
--     quote request to the right professional's Lead Sheet
--     (preparer_leads.preparer_id, migration 0010/0015) without reading
--     accounts. full_name is included so the page can show the
--     professional's name without reading accounts.
--   * NEVER add to this view: email, phone, bar_number, eoir_number,
--     stripe_customer_id, subscription_plan, current_period_end, or any
--     other non-public column. If a future column is needed on the public
--     page, the founder decides it first — do not add it silently.
--   * Listing gate (unchanged from 0001): is_published = true AND
--     subscription_status = 'active' AND (role = 'preparer' OR the linked
--     account is_verified). is_published is only ever flipped by the
--     Stripe webhook once the subscription is active AND verification is
--     approved (see /api/register-role), so an unverified profile can
--     never satisfy the gate in practice.
--
-- FLAGGED FOR THE 0015 OWNER / BROWSER TASK (not fixed here — 0015 is
-- another builder's in-flight file, do not edit it from here):
--   * 0015's public policies (profiles_select_public_listed,
--     professional_form_fees_select_public_listed,
--     storefront_sections_select_public_listed,
--     professional_addons_select_public_listed) all evaluate an EXISTS
--     check against public.accounts inside the policy expression. Anon
--     has no accounts SELECT policy, so — by the RLS-inside-policy rule
--     above — those checks evaluate false for anon and the policies grant
--     nothing in practice. VERIFY with a real anonymous query after
--     running 0001 -> 0015: an anon SELECT on professional_profiles
--     must return a listed row. If it returns zero rows, the fix is a
--     SECURITY DEFINER helper (0008 pattern) for the listed-profile
--     check, not a wider policy. The view in this file works regardless:
--     an anon SELECT on public.public_profiles must return the listed
--     row after this file alone.
--   * 0015's preparer_leads_insert_public_new policy allows ANY anon
--     insert with pipeline_stage = 'new_lead' and no preparer_id check.
--     The public page always sends the viewed profile's account_id, but
--     the policy itself does not enforce it (spam risk noted in 0015).
--
-- VERIFY AFTER RUNNING (browser task, with the anon key):
--   select slug, full_name from public.public_profiles;
--   -> returns listed profiles only, with no email/phone/bar/stripe
--      columns available to select (they are not in the view).
-- ============================================================================

-- FIX Nov 24, 2026 (live run): CREATE OR REPLACE VIEW cannot add
-- account_id + full_name in position 3/4 — Postgres error 42P16,
-- "cannot change name of view column company_name to account_id".
-- The 0001 view has company_name 3rd. So DROP the view first, then
-- CREATE it with the new column order. No other view depends on it;
-- the portal queries it by name only.
drop view if exists public.public_profiles;
create view public.public_profiles as
  select p.id, p.slug, p.account_id, a.full_name, p.company_name, p.role,
         p.bio, p.languages_spoken, p.service_area, p.amenities,
         p.accepting_new_clients, p.practice_areas, p.accreditation_level
  from public.professional_profiles p
  join public.accounts a on a.id = p.account_id
  where p.is_published = true
    and p.subscription_status = 'active'
    and (p.role = 'preparer' or a.is_verified = true);

-- Explicit owner-context execution: the view runs as its owner
-- (postgres), so base-table RLS does not block anonymous reads; the
-- view's WHERE clause above is the only filter. (Postgres 15 default
-- is security_invoker = false; stated explicitly so a future
-- security_invoker = true change is a deliberate decision, not an
-- accident.)
alter view public.public_profiles set (security_invoker = false);

-- Anonymous + signed-in visitors may read the public projection.
grant select on public.public_profiles to anon, authenticated;

-- Column rule, on the record: this view is the ONLY public-safe
-- projection of professional_profiles. Never add email, phone,
-- bar_number, eoir_number, stripe_customer_id, subscription_plan, or
-- current_period_end to it without a founder decision.
comment on view public.public_profiles is
  'Public directory projection for /p/<slug>: listed profiles only (is_published + active subscription + preparer-or-verified). Safe columns only — never add email, phone, bar_number, eoir_number, stripe_customer_id, or subscription_plan. Anonymous reads work via security_invoker = false + GRANT SELECT to anon.';

-- ============================================================================
-- END OF 0013 — schema only. No seed rows, no keys, no passwords.
-- Nothing here runs live, touches Supabase/Vercel/GitHub, or edits
-- migrations 0001–0012 or 0015.
-- ============================================================================
