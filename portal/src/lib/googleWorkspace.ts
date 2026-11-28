// Google Calendar + Google Drive connect — TWELFTH ADDITION (part B), Nov 28, 2026.
//
// WHAT THIS IS: the honest contract for connecting a professional's
// Google Calendar and Google Drive to the portal. It names the exact
// OAuth scopes, what each scope would let the portal do, and what is
// still missing. It does NOT connect anything.
//
// STATUS (do not overstate): NOT CONNECTED. Google SIGN-IN is wired
// (src/lib/googleAuth.ts — Supabase Auth, Google verifies the user),
// but sign-in is not Calendar and not Drive. The booking calendar
// today is NOT connected — consultation requests are collected, not
// auto-booked (src/lib/booking.ts, src/lib/byo.ts "calendar"). No
// Drive file has ever been read or written by this portal. Nothing
// here calls Google, stores a Google token, or claims a connection.
//
// WHAT THE FOUNDER MUST DO FIRST (NEEDS FOUNDER):
//   1. In Google Cloud Console, add the Calendar + Drive scopes below
//      to the SAME OAuth consent screen already used for Google
//      sign-in — do NOT create a second OAuth client.
//   2. Approve the consent-screen verification Google asks for when
//      sensitive scopes (Drive file access) are added. Until Google
//      approves, only test users can connect.
//   3. Decide per professional: is Calendar/Drive on by default, or
//      opt-in per professional? (Recommended: opt-in — a professional
//      connects THEIR OWN Google account, and only their own events
//      and files are touched, never another professional's.)
//   4. Decide the Drive rule: the portal reads/writes ONLY a folder
//      the professional names ("Immigration with NIPTEI"), never the
//      whole Drive. Whole-Drive access (drive.readonly) is NOT asked
//      for and must never be added.
//
// PRIVACY RULES (do not weaken):
//   * A Google token is NEVER logged, NEVER put in a URL, and NEVER
//     shown to another user. Tokens live server-side only.
//   * Calendar events created by the portal carry the client's case
//     reference only — never a full document, never a passport number.
//   * Drive files are the client's own vault documents, copied at the
//     client's instruction. The portal never shares a Drive file with
//     anyone the client did not name.
//   * Disconnect must delete the stored token the same day. A
//     professional who disconnects is fully disconnected — no silent
//     background access afterwards.

export type GoogleWorkspaceScope =
  | "calendar_events"
  | "drive_file";

export interface GoogleWorkspaceScopeDetail {
  scope: GoogleWorkspaceScope;
  /** Exact Google OAuth scope string. */
  oauthScope: string;
  /** What the portal would do with it, in plain English. */
  whatItDoes: string;
  /** What it deliberately does NOT do. */
  whatItDoesNotDo: string;
  /** Sensitive scopes need Google consent-screen verification. */
  needsGoogleVerification: boolean;
}

export const GOOGLE_WORKSPACE_SCOPES: GoogleWorkspaceScopeDetail[] = [
  {
    scope: "calendar_events",
    oauthScope: "https://www.googleapis.com/auth/calendar.events",
    whatItDoes:
      "Create, move, and cancel consultation and interview-reminder events on the professional's own Google Calendar, and read free/busy times so clients can pick a real open slot.",
    whatItDoesNotDo:
      "It does not read the professional's other calendars, does not invite anyone the client did not name, and never puts a document or a passport number in an event.",
    needsGoogleVerification: false,
  },
  {
    scope: "drive_file",
    oauthScope: "https://www.googleapis.com/auth/drive.file",
    whatItDoes:
      "Read and write ONLY files the portal itself created, or files the client opened with the portal, inside the folder the professional names — so a vault document can be saved to Drive at the client's instruction.",
    whatItDoesNotDo:
      "It does not see, list, or touch any other file in the professional's Drive. Whole-Drive access is never requested.",
    needsGoogleVerification: true,
  },
];

export type GoogleWorkspaceStatus =
  | "not_connected"
  | "needs_founder_consent"
  | "ready_to_connect";

export interface GoogleWorkspaceConnectState {
  status: GoogleWorkspaceStatus;
  calendarConnected: false;
  driveConnected: false;
  whatIsMissing: string[];
  founderSteps: string[];
}

/** The only honest state today: nothing is connected, and the founder
 *  consent steps are the blocker. */
export function googleWorkspaceConnectState(): GoogleWorkspaceConnectState {
  return {
    status: "needs_founder_consent",
    calendarConnected: false,
    driveConnected: false,
    whatIsMissing: [
      "Google OAuth consent screen does not list the Calendar or Drive scopes yet.",
      "No Google token is stored for any professional (none is stored until a professional connects).",
      "Consultation requests are still collected, not auto-booked (src/lib/booking.ts).",
      "No Drive folder is named and no Drive file has been read or written.",
    ],
    founderSteps: [
      "Add the calendar.events and drive.file scopes to the existing Google OAuth consent screen (same OAuth client as Google sign-in — do not create a second one).",
      "Complete Google's consent-screen verification for the Drive scope (sensitive scope).",
      "Decide: Calendar/Drive opt-in per professional (recommended) or on by default.",
      "Name the Drive rule: only the folder the professional names, never the whole Drive.",
    ],
  };
}

/** True only when BOTH connections are honestly live. Today: false. */
export function googleWorkspaceIsConnected(
  state: GoogleWorkspaceConnectState
): boolean {
  return state.calendarConnected && state.driveConnected;
}
