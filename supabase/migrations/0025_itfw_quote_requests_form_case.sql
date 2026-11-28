-- 0025 — quote_requests: tie a pricing-quote request to a form + case.
--
-- WHY: migration 0002 created public.quote_requests with only
-- (id, name, email, phone, description, status, created_at). The
-- sixth addition (Nov 28, 2026) lets a client request a pricing
-- quote for an unpriced form (I-526E / I-526 / I-829 / I-693 — quoted
-- individually, never priced by invention) from inside the service
-- catalog. The request must record WHICH form was quoted and, when
-- known, whose case it belongs to — otherwise the professional
-- cannot answer it.
--
-- All three columns are NULLABLE and the change is additive only:
-- existing rows keep working, and /api/quote-requests still saves a
-- request on the pre-0025 schema by falling back to the 0002 columns
-- (form code written into the description). No price, quote amount,
-- or quote expiry is stored here — a quote is a reply from a
-- professional, never a number this platform invents.
-- RLS: the existing 0003 policies (any signed-in user may INSERT;
-- SELECT is founder/admin-only) are untouched; these columns add no
-- new access. No DOB, A-Number, SSN or passport number is ever
-- stored in a quote request.

alter table public.quote_requests
  add column if not exists form_code text,
  add column if not exists account_id uuid references public.accounts(id) on delete set null,
  add column if not exists case_id uuid references public.cases(id) on delete set null;

create index if not exists quote_requests_form_code_idx
  on public.quote_requests (form_code);

create index if not exists quote_requests_case_id_idx
  on public.quote_requests (case_id);

comment on column public.quote_requests.form_code is
  'Unpriced form the quote was requested for (I-526E / I-526 / I-829 / I-693). Quoted individually — no price is stored here.';
comment on column public.quote_requests.account_id is
  'Requesting account, when the client was signed in. Null for a guest request.';
comment on column public.quote_requests.case_id is
  'Case the quote relates to, when known. Null when the request is not tied to a case.';
