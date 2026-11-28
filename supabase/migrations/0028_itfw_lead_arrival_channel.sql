-- 0028 — arrival channel on leads (ELEVENTH ADDITION, Nov 28, 2026).
--
-- WHY: the honest lead-finding loop (src/lib/leadLoop.ts) captures
-- people who ARRIVE — through search, a referral link, the intake
-- form, a quote request, the free Packet Health Check, or the
-- interview question of the day. preparer_leads (0010) records the
-- lead source and the referral, but not WHICH arrival point brought
-- them in, so the loop cannot show which door a lead came through.
-- This adds one nullable column for that, and nothing else.
--
-- HONESTY BOUNDARY (do not weaken): this column records only what the
-- lead themself did on our own pages (filled in a form, asked for a
-- quote, ran a health check, answered the question of the day). It
-- does NOT record — and the platform does NOT collect — anything
-- about people searching for immigration services online. Search
-- engines do not share who searched for what, and watching individual
-- searchers would violate their privacy. No column here, and no code
-- in this repo, tracks searchers.
--
-- Additive only: one nullable column + index. Existing rows keep
-- working (arrival_channel stays null = "not recorded"). No RLS
-- change — preparer_leads keeps its 0010 policies. No DOB, A-Number,
-- SSN, or passport number is stored here.
alter table public.preparer_leads
  add column if not exists arrival_channel text
    check (arrival_channel in (
      'intake',
      'quote',
      'packet_health_check',
      'interview_question',
      'referral',
      'storefront',
      'other'
    ));

comment on column public.preparer_leads.arrival_channel is
  'Which of our own arrival points brought this lead in: intake form, quote request, free Packet Health Check, interview question of the day, referral link, or a professional storefront. Null = not recorded. Records only what the lead did on our own pages — never anything about people searching online.';

create index if not exists preparer_leads_arrival_channel_idx
  on public.preparer_leads (preparer_id, arrival_channel);
