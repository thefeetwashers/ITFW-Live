-- 0033 — free-tool attribution on leads (SEO + lead generator, Nov 28, 2026).
--
-- WHY: the free-tools hub (/free-tools) offers an optional follow-up
-- capture after a tool is used (src/components/leads/ToolLeadCapture.tsx),
-- stored through the existing /api/leads route. migration 0028 records
-- WHICH arrival point brought the lead in (arrival_channel), but the
-- three newer tools (fee calculator, sponsor income checker, Visa
-- Bulletin date checker) share arrival_channel 'other' — so this adds
-- one nullable column for the precise free-tool id, and nothing else.
--
-- Values are the five ids in src/lib/freeTools.ts FREE_TOOLS
-- (packet_health_check, fee_calculator, interview_question,
-- sponsor_income, visa_bulletin). The route validates them in
-- src/lib/leadScoring.ts validateLeadCapture and also writes the tool
-- id into the lead notes, so a lead is still attributed even before
-- this migration runs (the route retries without the column, as it
-- already does for 0021/0028 columns).
--
-- HONESTY BOUNDARY (do not weaken): this column records only what the
-- lead themself did on our own pages (used a free tool, then chose to
-- leave their details). It does NOT record — and the platform does
-- NOT collect — anything about people searching for immigration
-- services online. Search engines do not share who searched for what,
-- and watching individual searchers would violate their privacy.
-- No column here, and no code in this repo, tracks searchers.
--
-- Additive only: one nullable column + index. Existing rows keep
-- working (tool_used stays null = "did not come from a free tool"
-- or "not recorded"). No RLS change — preparer_leads keeps its 0010
-- policies. No DOB, A-Number, SSN, passport number, income figure,
-- or priority date is stored here — the tools run in the browser and
-- never post those values.
alter table public.preparer_leads
  add column if not exists tool_used text
    check (tool_used in (
      'packet_health_check',
      'fee_calculator',
      'interview_question',
      'sponsor_income',
      'visa_bulletin'
    ));

comment on column public.preparer_leads.tool_used is
  'Which free tool the lead used before leaving their details (src/lib/freeTools.ts FREE_TOOLS). Null = did not come from a free tool, or not recorded. Records only what the lead did on our own pages — never anything about people searching online.';

create index if not exists preparer_leads_tool_used_idx
  on public.preparer_leads (preparer_id, tool_used);
