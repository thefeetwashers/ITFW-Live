# Professional discovery + Google integrations + client document flow
## Twelfth addition, part A — Nov 28, 2026

## What already existed (reused, NOT rebuilt)

| Piece | Existing location | How it was reused |
|---|---|---|
| Verified directory | `src/lib/verifiedDirectory.ts`, `src/app/professionals/page.tsx`, `public_profiles` view (migration 0013), `/p/[slug]` storefronts | Extended only: a link to `/for-professionals` was added to the directory header. The verified-only gate is untouched. |
| family_invites magic invite + 6-digit code | `src/lib/invites.ts`, `family_invites` (0002/0005/0006/0022) | Reused for professional-to-client invites (`invite_purpose='client_onboarding'`, role `'client'`, 0030). No new invite mechanism invented. |
| Referral system | `src/lib/referrals.ts`, `/api/referrals`, `/r/<code>` (0017) | Untouched; the client invite also surfaces the professional's referral link. |
| Google sign-in | `src/lib/googleAuth.ts`, `/auth/callback`, `/api/auth/login` | Untouched. Verified from code — see "Google sign-in state" below. |
| BYO integrations | `src/lib/byo.ts`, `provider_settings` (0014) | Untouched; Google Calendar/Drive/Gmail follow the same BYO shape (professional's own account). The existing BYO `calendar` entry is the status-only predecessor. |
| Platform email (AWS SES) | `src/lib/email.ts` | Untouched; document resend-by-email calls `sendEmail()`. |
| In-app message thread | `src/lib/caseStatusSync.ts` (`insertCaseThreadMessage`), `messages` + `message_sends` (0001/0014) | Reused for the portal_chat resend channel. |
| Logging | `notification_logs` (0010, email/sms only), `message_sends` (0014) | Reused. New `document_resends` (0030) is the per-attempt resend log. |
| Locked prices | `src/lib/stripePrices.ts` | Untouched — the landing page reads the locked map, never retypes amounts. |

## What was added

### Migration 0030 — `supabase/migrations/0030_itfw_pro_discovery_google_docresend.sql`
- `professional_profiles.google_email` / `google_phone` / `google_contact_updated_at` — the professional's OWN Google contact details, profile-entered, never scraped. Not in the public view.
- `google_connections` — status-only table (account, product calendar/drive/gmail, status, scopes, google_account_email, connected_at). **No token, refresh token, password, or secret is ever stored here.** Owner-only RLS, like `provider_settings`.
- `family_invites`: new `invite_purpose` (`family` | `client_onboarding`), role CHECK widened to add `client`, `case_id` nullable (a client invite exists before the client has a case; family invites still must have one — enforced by CHECK).
- `document_resends` — append-only resend log, one row per attempt (document, case, resender, channel, recipient, status sent/failed/not_configured, provider, provider_message_id, error, message_id, share_token + 7-day expiry). **No body column** (PII rule). Participant-only RLS, append-only.

### Professional discovery
- `src/lib/proDiscovery.ts` — landing content (why join, verification steps), locked subscription prices read from the map, `buildClientInvite()` (reuses `generateInviteCode`/`inviteLink`).
- `src/app/for-professionals/page.tsx` — public professional landing page: why join, flat locked prices, verification process, BYO tools, Google honest state, links to `/register` and `/professionals`. Honest empty states via the directory (no professionals invented).
- `src/components/pro/ClientInviteCard.tsx` — dashboard card creating a client invite (link + 6-digit code + referral link).
- `src/app/api/professionals/invite-client/route.ts` — POST creates the `family_invites` row (purpose `client_onboarding`, role `client`); 501 when Supabase is not connected.

### Google integrations
- `src/lib/googleIntegrations.ts` — exact scopes, product defs, status helpers, `GOOGLE_SIGNIN_STATE` (verified from code), `GOOGLE_OAUTH_SETUP_STEPS`, `validateGoogleContact()`, `maskGoogleEmail()`.
- `src/components/google/GoogleConnectionsPanel.tsx` — dashboard panel: connect buttons, scope lists, "Not connected" states, Google email/phone form. Wired into `src/components/preparer/PreparerDashboard.tsx` (command tab, after `FamilyInviteManager`).
- `src/app/api/google-connections/route.ts` — GET status (stored rows honoured only when really connected; a stored `connected` without `connected_at` is downgraded), POST `save_contact` (own details only) and `connect` (always honest 501 until setup is done).

### Client document flow
- `src/lib/docResend.ts` — channel availability (pure, smoke-testable), identifier guards (A-Number/SSN/passport/DOB → 400), subject built from form label only, SES body with vault link (never an attachment), `maskRecipient()`, share-link builder (7-day expiry), `buildResendLogRow()`.
- `src/app/api/documents/resend/route.ts` — POST. Email via SES with a signed vault URL when Storage can make one (else portal vault link); SMS always 501/not_configured (no Twilio); portal_chat via `insertCaseThreadMessage`; vault_link creates a share token. Every attempt logged to `document_resends` + `notification_logs` (email/sms) / `message_sends` (portal_chat/email).
- `src/app/vault/shared/[token]/page.tsx` — resolves a share token to one document (7-day expiry, unknown/expired → honest message, signed download URL when Storage works).
- `src/components/pro/DocumentResendPanel.tsx` — dashboard panel with the four resend buttons and masked recipients.

## Google sign-in state (verified from code, Nov 28, 2026)
- Code path complete and **unchanged by the SES change**: `signInWithOAuth({provider:"google"})` → Supabase callback → `/auth/callback` → account lookup → `/api/auth/login` with `{email, oauthAccessToken}` issues the 6-digit code → `/login` step 2. New Google users go to `/onboarding?google=1`, pick one role, complete the profile. No role auto-assigned, no professional auto-verified. Founder/Admin: email + code only, no Google.
- The 6-digit code is sent by SES (`src/lib/email.ts`); the callback already handles the SES 501 honestly.
- Google sign-in is enabled in the live Supabase "Immigration" project (verified Nov 19, 2026). It works once Supabase env vars are set in Vercel and the portal is deployed; it does **not** work on the static live site, and the button renders disabled with that explanation until then.
- **Not tested live end-to-end from this repo** (no live Supabase/Vercel in this build). "Works" = code path complete + provider enabled in Supabase.

## Exact Google OAuth scopes + setup steps still needing the founder

**Scopes (least privilege — nothing broader):**
- Google Calendar: `https://www.googleapis.com/auth/calendar.events` (create/read events only — NOT full `.../auth/calendar`)
- Google Drive: `https://www.googleapis.com/auth/drive.file` (only files this app creates or the user opens with it — NOT `drive` / `drive.readonly`)
- Gmail: `https://www.googleapis.com/auth/gmail.send` (send only — never reads the inbox; NOT `gmail.readonly`, `gmail.modify`, or full Gmail access)
- Sign-in (already live, separate Supabase Auth client): `openid`, `email`, `profile`

**Setup steps (all still undone — see `GOOGLE_OAUTH_SETUP_STEPS` in `src/lib/googleIntegrations.ts`):**
1. Create (or reuse) a Google Cloud project. Do NOT create a second sign-in OAuth client — Supabase Auth already has one. This is a SECOND client, for API scopes only.
2. Enable the Calendar, Drive, and Gmail APIs in that project.
3. Configure the OAuth consent screen (External user type; app name "Immigration with NIPTEI"; exactly the three scopes above). `gmail.send` is a restricted scope — Google verification is needed before Production; add the founder as a test user while in Testing.
4. Create an OAuth client (Web application) with redirect URI `https://immigration.niptei.com/api/google/oauth/callback` — DIFFERENT from the Supabase Auth callback (`https://jdxjskqdvwqarfhcqjlg.supabase.co/auth/v1/callback`); do not reuse it.
5. Store `GOOGLE_OAUTH_CLIENT_ID` + `GOOGLE_OAUTH_CLIENT_SECRET` in Vercel env vars (server-only, never `NEXT_PUBLIC_`, never in code/docs).
6. Build the token exchange + the three API call paths (create calendar event, save file to Drive, send via Gmail), each gated on `isGoogleProductConnected()`.
7. Founder approves; one professional connects their own Google account and tests to themselves first (same rule as BYO test-send). Only then may a product show as connected.

**Never store a Google password. OAuth only. No token/secret in this repo.**

## Verification
- `npx tsc --noEmit` — exit 0 (see report).
- Smoke test `portal/scripts/smoke-pro-discovery-google.ts` (fake data only, run with `npx -y tsx scripts/smoke-pro-discovery-google.ts`): directory lists verified professionals only; Google UI shows "not connected" with the exact scopes and no claim of connection; email resend via SES when configured, 501 when not; SMS resend 501/not_configured with no Twilio connected.

## What is still missing
- Google Cloud OAuth client + consent screen (7 steps above) — founder only.
- Live end-to-end Google sign-in test once Supabase env vars are in Vercel and the portal is deployed.
- Live SES sender verification (niptei.com domain identity + DKIM in IONOS; SES sandbox recipient rules) — until then email resends return `sender_not_verified` / `recipient_not_verified`, never fake "sent".
- A professional's own Twilio connection (BYO) before any SMS can send.
- Real professional account/profile ids plumbed into the dashboard panels (they currently render with empty ids in the example build and show the signed-in prompt; the panels take `accountId`/`profileId` props).
- The Google OAuth callback route (`/api/google/oauth/callback`) and per-product API call paths — step 6 above, blocked on steps 1–5.
- No migration 0030 has been applied to live Supabase (no live access in this build; coordinator applies).
