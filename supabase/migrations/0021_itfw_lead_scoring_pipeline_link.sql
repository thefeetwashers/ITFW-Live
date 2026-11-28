-- ============================================================================
-- ITFW Live — Supabase migration 0021: Lead Generator scoring + pipeline link
-- Run AFTER 0020 (full run order 0001 -> 0021). Do NOT run live until the
-- founder / browser task says so.
--
-- WHY THIS MIGRATION EXISTS (Lead Generator + Client Pipeline build):
-- preparer_leads (0010) has no columns for the inputs the lead-scoring
-- rules need, and no link to the case a lead converts into:
--   * No lead score / score reasons — the score must be stored, not
--     recomputed from thin air, and every point must be explainable.
--   * No beneficiary location (inside US / outside US) — the intake
--     funnel asks it, and the route (adjustment vs consular) depends
--     on it. cases.pathfinder_route holds it only AFTER a case exists;
--     a lead has no case yet.
--   * No documents-ready / interview-date / urgency — the three
--     scoring inputs the founder brief names.
--   * No case_id — confirm-intake-order (portal/src/app/api/
--     confirm-intake-order/route.ts) notes this as a known gap and
--     carries the case id in preparer_leads.notes instead. The
--     pipeline joins lead -> case, so the link belongs here.
--
-- WHAT IS ADDED — additive columns only, all nullable, all guarded
-- with IF NOT EXISTS. No table is created, no column is renamed, no
-- existing CHECK is changed, no RLS policy is added (the existing
-- preparer_leads policies from 0010 already cover the table).
-- DOB is NOT added here: accounts.date_of_birth (0001) already holds
-- it, and the pipeline reads it from there (masked in the UI, never
-- in full). NO SSN column is added anywhere — SSNs are never stored.
-- Payment status is NOT added here: it is derived from invoices /
-- order_invoices (0001 / 0006) at read time, never stored as a flag.
-- ============================================================================

-- 1. Link a converted lead to its case (fixes the known gap noted in
--    confirm-intake-order/route.ts). Null until conversion; set by
--    POST /api/leads/convert together with pipeline_stage='converted'.
alter table public.preparer_leads
  add column if not exists case_id uuid
    references public.cases(id) on delete set null;

create index if not exists preparer_leads_case_idx
  on public.preparer_leads (case_id) where case_id is not null;

comment on column public.preparer_leads.case_id is
  'Case created from this lead (via Smart Intake / confirm-intake-order). Null until converted. Set together with pipeline_stage = ''converted''; never invented — a lead with no case keeps case_id null.';

-- 2. Beneficiary location, asked by the intake funnel: inside the US
--    (adjustment of status) or outside the US (consular / NVC).
alter table public.preparer_leads
  add column if not exists beneficiary_location text
    check (beneficiary_location is null or beneficiary_location in ('inside_us', 'outside_us'));

comment on column public.preparer_leads.beneficiary_location is
  'Where the beneficiary is: inside_us (adjustment) or outside_us (consular / NVC). Asked on the intake form; null when the lead did not say.';

-- 3. Lead-scoring inputs (founder brief: documents ready / interview
--    date / urgency). Stored so the score is auditable, not a black box.
alter table public.preparer_leads
  add column if not exists documents_ready boolean not null default false,
  add column if not exists interview_date date,
  add column if not exists urgency text
    check (urgency is null or urgency in ('low', 'normal', 'high', 'urgent'));

comment on column public.preparer_leads.documents_ready is
  'Lead said their documents are ready (intake funnel). One of the lead-score inputs — see portal/src/lib/leadScoring.ts.';
comment on column public.preparer_leads.interview_date is
  'Interview date the lead already has, if any. One of the lead-score inputs. Null = no interview date yet. This is the LEAD''s interview date; the case interview date lives on case_agency_numbers (0010).';
comment on column public.preparer_leads.urgency is
  'How urgent the lead says their case is: low / normal / high / urgent. One of the lead-score inputs. Null = not stated.';

-- 4. Lead score (0-100) + the reason for every point, stored with the
--    lead. Rules live in portal/src/lib/leadScoring.ts and are shown to
--    the professional next to the score — never a black-box number.
alter table public.preparer_leads
  add column if not exists lead_score integer
    check (lead_score is null or (lead_score >= 0 and lead_score <= 100)),
  add column if not exists lead_score_reasons text[] not null default '{}';

comment on column public.preparer_leads.lead_score is
  'Transparent lead score 0-100 from portal/src/lib/leadScoring.ts. Null = not scored yet.';
comment on column public.preparer_leads.lead_score_reasons is
  'One plain-English reason per scoring rule, e.g. "+30 — documents ready". Shown with the score; an empty array means unscored.';
