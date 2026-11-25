# Service-Level Permissions Matrix — Immigration with NIPTEI

**Source of truth.** This document and `src/lib/permissions.ts` (`CAPABILITIES`
+ `canDo()`) are the same matrix. Every UI gate in the Unified
Communication layer calls `canDo()` — no dashboard hardcodes a different
rule. If this document and a UI gate ever disagree, **this matrix wins**
and the gate is a bug. Tier features live in `src/lib/serviceTiers.ts`;
this document covers what a **role** can do, plus the tier limits that
sit on top of role limits.

**Scope note.** All rows below are EXAMPLE / build-time rules until
Supabase Auth is live. The database enforces the same shape through RLS
(`is_case_participant()` in 0001/0008, `is_assigned_student()` in 0011,
policies in 0001–0020). The UI hides what the database already refuses.

**Roles:** Client · Preparer · Attorney · DOJ Standard (Partial —
DHS/USCIS & NVC only) · DOJ Full (USCIS and Court) · Law Student
(supervised only) · Teacher · Founder / Admin.

**Service levels (locked prices only — see `src/lib/serviceTiers.ts`):**
Family Adjustment Bundle Basic $999 / Standard $1,799 / Premium $2,799
(locked, `src/lib/order.ts`); single-form tiers per form from the locked
list in `src/lib/formChecklists.ts` (I-130 $299/$499/$750 · I-485
$750/$1,200/$1,500 · I-821 $189/$295/$400 · I-765 $129/$249/$350 · N-400
$199/$400/$600 · I-589 $900/$1,050/$1,200 · I-90 $129/$240/$350 · I-864
$99/$175/$250 — flag: `bundles.ts` still marks I-765, I-90 and I-864
TO BE CONFIRMED, reconcile before quoting those three elsewhere);
DIY $25 / Review $99 / Human Review $199 / Member $9.80/mo — given in
the task brief 2026-11-19, not in an earlier repo locked list.
Payment plans (locked): Pay in Full / Pay in 3 / Monthly 6 / 12.
USCIS government fees are ALWAYS separate, never in the service price.

---

## 1. Role × capability

✓ = allowed · ✗ = locked · ◐ = conditional (condition in the Notes column)

| Capability | Client | Preparer | Attorney | DOJ Standard | DOJ Full | Law Student | Teacher | Founder/Admin |
|---|---|---|---|---|---|---|---|---|
| See own cases (client portal) | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| See cases assigned to you | ✗ | ✓ | ✓ | ✓ | ✓ | ◐ assigned only, supervisor-confirmed | ✗ | ✗ |
| Message a client in the unified thread | ✓ own cases only | ✓ | ✓ | ✓ | ✓ | ◐ supervisor visibility only | ✗ | ✗ |
| Read case messages | ✓ own cases | ✓ | ✓ | ✓ | ✓ | ◐ assigned, supervisor sees same thread | ✗ | ✗ |
| See case documents | ✓ own cases | ✓ | ✓ | ✓ | ✓ | ◐ assigned only | ✗ | ✗ (UI) — see §4 conflict |
| Upload documents | ✓ | ✓ | ✓ | ✓ | ✓ | ◐ assigned only | ✗ | ✗ |
| Accept / review documents | ✗ | ✓ | ✓ | ✓ | ✓ | ✗ provider-only | ✗ | ✗ |
| Request a document | ✗ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| Reject a document with a reason | ✗ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| See invoices | ✓ own cases | ✓ | ✓ | ✓ | ✓ | ✗ billing locked | ✗ | ✗ |
| Manage billing / retainer-trust | ✗ | ✓ prep-fee billing only | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| Send a payment reminder | ✗ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| Resend a payment receipt | ✗ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| See G-28 / EOIR-28 tools | ✗ | ✗ NEVER | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| Sign / file a G-28 | ✗ | ✗ NEVER | ◐ once verified | ◐ G-28 only, once verified | ◐ once verified | ✗ | ✗ | ✗ |
| See EOIR-28 (Immigration Court) | ✗ | ✗ NEVER | ✓ | ✗ NEVER (Partial) | ◐ Full + verified | ✗ | ✗ | ✗ |
| Give legal advice / legal strategy | ✗ | ✗ NEVER, any tier | ✓ | ✓ within accreditation | ✓ within accreditation | ✗ | ✗ | ✗ |
| E-Sign a packet | ◐ own packet, balance paid + audit 100% | ✗ (prepares, does not sign for client) | ◐ client signs; professional prepares | ◐ client signs | ◐ client signs | ✗ draft unlocks only after supervisor approval | ✗ | ✗ |
| File a packet with USCIS | ✗ | ✗ NEVER | ◐ verified only | ◐ verified, within accreditation | ◐ verified, within accreditation | ✗ | ✗ | ✗ |
| Assign / supervise a law student | ✗ | ✗ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| See the verification queue | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| See the audit log | ◐ own cases only | ◐ own cases only | ◐ own cases only | ◐ own cases only | ◐ own cases only | ✗ | ✗ | ✓ |
| Connect own integrations (BYO) | ✗ | ✓ | ✓ | ✓ | ✓ | ✗ supervisor's accounts | ✗ | ✗ |
| Write private case notes | ✗ | ✓ | ✓ | ✓ | ✓ | ✗ through supervisor | ✗ | ✗ |
| Book / reschedule / cancel appointments | ✓ own cases | ✓ | ✓ | ✓ | ✓ | ◐ assigned, supervisor-visible | ✗ | ✗ |

**Hard rules (no exceptions at any tier):**
- A preparer NEVER sees G-28 / EOIR-28 / legal strategy / retainer-trust
  tools, and cannot give legal advice or sign G-28 at any tier.
  Clerical help only (8 CFR 292.1).
- A partial DOJ representative NEVER sees EOIR-28. Partial =
  DHS/USCIS & NVC only; EOIR Court tools unlock only with Full
  accreditation AND verification.
- A law student cannot message a client without supervisor visibility,
  at any tier. E-Sign, G-28, billing, and filing are locked for law
  students at every tier. A student draft unlocks for client E-Sign /
  G-28 filing only after supervisor approval.
- A family member sees ONLY the case they were invited to, ONLY the
  slots they were given, never other cases, never messages (unless the
  invite explicitly allows messages — default is hidden), never
  invoices unless `can_view_invoices` is true. Family access goes
  through the token-gated family portal, not RLS (see 0011 header).
- Founder/Admin sees the verification queue + audit log only — never a
  client's documents unless they are the assigned provider. See §4.

---

## 2. Service level × what the client gets

| Service level | Price | Assigned professional | Client CAN | Client CANNOT (locked at this tier) |
|---|---|---|---|---|
| DIY | $25 (brief-given) | None — Preparer section stays blank | Self-serve forms, document checklist, packet audit | No assigned professional, no messaging, no provider review, no human review, no provider E-Sign packet |
| Review | $99 (brief-given) | Preparer (one review pass) | DIY features + one provider document-review pass, findings shown in portal | No live messaging, no human drafting, no assigned professional for ongoing help, no provider E-Sign packet |
| Human Review | $199 (brief-given) | Preparer (human review) | Review features + human review + messaging in the unified thread | No full preparation or filing, no assigned professional for ongoing case work, no provider E-Sign packet |
| Basic | $999 (locked bundle) | Preparer by default; attorney/nonprofit if client chooses that service option | Full case: assigned professional, messaging, document review, human review, interview prep, E-Sign (after balance paid + audit 100%), payment plan, family invites, renewal reminders | USCIS gov fees separate; no Premium-tier services |
| Standard | $1,799 (locked bundle) | Same as Basic | Same feature set as Basic (locked definitions differ by price only) | USCIS gov fees separate; no Premium-tier services; no Premium-only feature is defined — none invented |
| Premium | $2,799 (locked bundle) | Same as Basic | Same feature set as Basic | USCIS gov fees separate; Premium extras are TO BE CONFIRMED by the founder — none invented |
| Single-form tiers | Per-form locked list (see header) | Preparer by default; attorney/nonprofit if chosen | Checklist + features of the equivalent tier (Basic/Standard/Premium) for that form | Same tier limits as above; no locked combined price for I-130+NVC or I-821+I-765 bundles — TO BE CONFIRMED |
| Member | $9.80/mo (brief-given) | None by membership alone | Self-serve forms and checklists | Everything else TO BE CONFIRMED; no assigned professional, messaging, review, or E-Sign unless the founder confirms it |

**Service-linked sync** (`src/lib/serviceTiers.ts` `createCaseFromOrder()`):
ordering a bundle/single form at a tier automatically (a) creates the
case with the correct `ordered_forms` + tier, (b) loads the correct form
checklist from `lib/formChecklists`, (c) sets the correct payment plan +
invoice from locked prices only, (d) sets the dashboard features for
that tier, (e) assigns the correct professional type for that service,
(f) shows the client exactly what their tier includes and does NOT
include, in plain English, in their language (translation via the
translate route when connected — never a fake translation).

---

## 3. Unified thread + translation rules

- One thread per case, in every professional dashboard and in the
  Client Portal. Channels: Portal Chat, SMS, WhatsApp, Email, plus a
  phone-number text composer and an email composer. Sends happen from
  INSIDE the professional's own dashboard, through their own connected
  provider account — never from a personal phone/email. Client replies
  from inside the portal (or by SMS/WhatsApp/email reply, which lands
  back in the same thread).
- Every message is stored in `messages` (0001) + `message_sends`
  (0014): sender, role, channel, original language + original text +
  English translation, timestamp, delivery status (queued / sent /
  failed / not_configured). A send needing a not-connected integration
  returns "not configured" — never a fake "sent".
- Translation (locked): exactly 7 languages — English, Español,
  Kreyòl Ayisyen, Français, Português, 中文, العربية (RTL for Arabic).
  Original text is ALWAYS shown alongside the translation. Numbers /
  dates / prices are NEVER altered (digit-sequence check in
  `src/lib/translate.ts`). Uncertain translations are flagged; human
  confirmation is required for quotes / contracts / prices / deadlines.
  Translation is NEVER used to decide relief / eligibility / evidence
  strength / safe-to-leave. Provider: Google Cloud Translation, env
  name only `GOOGLE_TRANSLATE_API_KEY` — NOT connected; the route
  returns 501 / "translation not configured" until set, and shows the
  original untranslated text with a label.

## 4. KNOWN CONFLICT — Founder/Admin database access (needs a decision)

The task rule is: Founder/Admin sees the verification queue + audit log
ONLY, never a client's documents unless they are the assigned provider.
The UI in this layer enforces that (`src/lib/isolation.ts`
`canViewCase()` returns false for `founder_admin` on case content, and
the back-office hides the thread/tools from the admin view).

**But migration 0003 §7a grants Founder/Admin a SELECT policy on every
case-scoped table** (cases, messages, documents, invoices, …), so in the
database today a founder CAN read a client's documents. This layer does
NOT extend that pattern to any new table (no founder SELECT on any
0014 table — `provider_settings`, `message_sends`,
`case_contact_preferences`, `case_renewals`, `case_referrals`,
`appointment_reminders`), but it cannot close the
0003 gap by itself: closing it means dropping/replacing the 0003
`select_founder_admin_*` policies in a follow-up migration, after the
founder decides. Do NOT wire Supabase Auth live until this is decided.
The same gap existed for `accounts_update_own` (0001), which let an
owner change any column on their own row, including role — that one
is FIXED by migration 0019 (BEFORE UPDATE trigger, founder/admin
only). Do NOT wire Supabase Auth live until 0019 has run either.

## 5. BYO integrations (summary)

Each professional connects their OWN accounts from inside their
dashboard: Resend, AWS SES, Twilio (SMS + WhatsApp — phone number,
Account SID, Auth Token), their own phone number, their own sender
email, WhatsApp Business number, video-call account, calendar,
e-signature provider, storage, Google Cloud Translation, their own
Stripe. Keys are encrypted at rest (vault reference only in
`provider_settings.encrypted_key_reference`, migration 0014), only the
last 4 characters are ever shown, never in logs, never in chat.
Every integration is labelled CONNECTED / NOT CONNECTED. The platform
NEVER holds money, NEVER splits legal fees, NEVER takes a percentage —
flat subscription only (preparer $49/mo, attorney $99/mo, DOJ Standard
$24.50/mo, DOJ Full $49.50/mo, law student $35/mo).
