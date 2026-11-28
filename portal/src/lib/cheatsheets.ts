// Professional cheatsheets — "Start here" guides, one per role.
// ---------------------------------------------------------------------------
// Each cheatsheet is 5 steps, in the order a new person should do
// them. Every step links to a REAL page in this portal — a step that
// names a tab or section inside a dashboard links to that dashboard
// page and names the tab/section in the text (dashboards here have
// no deep-linkable tab URLs, so no invented anchor is linked).
//
// HONESTY RULES (do not weaken):
//  * No invented features. In particular, preparers do NOT set form
//    fees — prep fees are LOCKED platform-wide (src/lib/storefront.ts
//    / src/lib/formChecklists.ts). The preparer cheatsheet says so
//    instead of telling a preparer to "set form fees".
//  * Verification is never claimed: a step says to check the
//    verification banner / status on the dashboard, never that an
//    account is verified.
//  * Law students never see G-28, billing, or filing — the student
//    cheatsheet says what is LOCKED, not how to get around it.
//  * DOJ Standard (Partial) never sees EOIR-28 — only DOJ Full does
//    (src/lib/permissions.ts).
//
// Pages linked below — all verified to exist in src/app:
//   /portal, /portal/questionnaire, /portal/packet-audit,
//   /preparer-dashboard, /legal-back-office, /teacher-dashboard,
//   /admin/verifications, /register, /onboarding, /login,
//   /reviews/new, /back-office, /cheatsheets/<role> (this feature).
export type CheatsheetRole =
  | "client"
  | "preparer"
  | "attorney"
  | "doj"
  | "law_student"
  | "teacher";

export interface CheatsheetStep {
  title: string;
  detail: string;
  /** Real portal page — must exist. See header. */
  href: string;
  linkLabel: string;
}

export interface Cheatsheet {
  role: CheatsheetRole;
  title: string;
  intro: string;
  /** The dashboard this cheatsheet lives in. */
  dashboardHref: string;
  dashboardLabel: string;
  steps: [CheatsheetStep, CheatsheetStep, CheatsheetStep, CheatsheetStep, CheatsheetStep];
  footer: string;
}

export const CHEATSHEET_ROLES: { role: CheatsheetRole; label: string }[] = [
  { role: "client", label: "Client" },
  { role: "preparer", label: "Document Preparer" },
  { role: "attorney", label: "Licensed Attorney" },
  { role: "doj", label: "DOJ-Accredited Nonprofit" },
  { role: "law_student", label: "Law Student (supervised only)" },
  { role: "teacher", label: "Teacher / Clinic Director" },
];

export const CHEATSHEETS: Record<CheatsheetRole, Cheatsheet> = {
  client: {
    role: "client",
    title: "Start here — Client",
    intro:
      "You are the client. Do these 5 things in order. Everything happens inside your portal — you never file anything yourself, and the system never files for you.",
    dashboardHref: "/portal",
    dashboardLabel: "Client Portal",
    steps: [
      {
        title: "Complete your intake questionnaire",
        detail:
          "Answer the Smart Forms questionnaire first — it decides which forms you need and starts your checklist. Save-and-resume is allowed for drafts.",
        href: "/portal/questionnaire",
        linkLabel: "Open the intake questionnaire",
      },
      {
        title: "Check your packet audit score",
        detail:
          "The audit shows what is still blocking your packet (signature, unexpired passport, translated documents, missing items). It reaches 100% only when every blocking item is cleared.",
        href: "/portal/packet-audit",
        linkLabel: "Open your packet audit",
      },
      {
        title: "Upload the missing documents from your checklist",
        detail:
          "Work through the checklist in your portal, top to bottom. A foreign document needs a certified translation ($45 per page, locked). Do not guess a date you do not remember — tell your preparer.",
        href: "/portal",
        linkLabel: "Open your portal checklist",
      },
      {
        title: "Ask a question — get an instant answer in the case chat",
        detail:
          "Ask in the chat and the system answers right away from the locked guides, with its source. If it does not know, it says so and flags your professional. Legal questions go to an attorney or DOJ-accredited representative — the system never decides them.",
        href: "/portal",
        linkLabel: "Ask in your portal case chat",
      },
      {
        title: "Review and E-Sign only when the audit is 100% and the balance is paid",
        detail:
          "At 100% you generate the DRAFT packet for review, then you review it, E-Sign it, and submit it yourself (or via your attorney). Until you do that, nothing has been filed.",
        href: "/portal/packet-audit",
        linkLabel: "Check your packet audit again",
      },
    ],
    footer:
      "Educational information only, not legal advice. Only a licensed attorney or DOJ-accredited representative gives legal advice or represents you (8 CFR 292.1).",
  },
  preparer: {
    role: "preparer",
    title: "Start here — Document Preparer",
    intro:
      "You are a document preparer. Clerical / educational help only — not a law firm, no approval guarantee, never legal advice, never G-28, never file. Do these 5 things in order.",
    dashboardHref: "/preparer-dashboard",
    dashboardLabel: "Document Preparer Command Center",
    steps: [
      {
        title: "Verify your profile — My Public Profile tab",
        detail:
          "Open your profile, check your verification status and that your UPL agreement is signed, and set your public page slug, languages, service area, and services. Unverified profiles are NOT listed in the directory. Listing fee is locked at $49/mo — you do not set it.",
        href: "/preparer-dashboard",
        linkLabel: "Open your Command Center — My Public Profile tab",
      },
      {
        title: "Know the locked fees — you never set form fees",
        detail:
          "Prep fees are LOCKED platform-wide (Basic / Standard / Premium per form; Family Adjustment Bundle $999 / $1,799 / $2,799). Government fees are a separate line, paid to the U.S. Department of Homeland Security. Check the Service Catalog in the Command Center tab — never quote a fee you invented.",
        href: "/preparer-dashboard",
        linkLabel: "Open your Command Center — Service Catalog",
      },
      {
        title: "Open your pipeline — Command Center tab",
        detail:
          "Daily Command first, then your cases: client identity, to-dos, missing items, RFE tracker, billing pipeline, and invoices. Work the missing-items list — that is what moves a packet toward 100%.",
        href: "/preparer-dashboard",
        linkLabel: "Open your Command Center pipeline",
      },
      {
        title: "Answer flagged questions in the unified thread",
        detail:
          "One thread per case (Portal Chat, SMS, WhatsApp, Email). Questions the instant-answer system could not answer, or had to escalate, are flagged for you at the top of the thread — answer those first.",
        href: "/preparer-dashboard",
        linkLabel: "Open your Command Center — unified thread",
      },
      {
        title: "Escalate legal questions — Escalation & Handoff tab",
        detail:
          "Anything about eligibility, relief, evidence strength, or safe-to-travel goes to a licensed attorney or DOJ-accredited representative via Attorney Handoff. You never give legal advice, never sign G-28, and never file. If a client asks the system a legal question, it escalates the same way.",
        href: "/preparer-dashboard",
        linkLabel: "Open Escalation & Handoff",
      },
    ],
    footer:
      "Clerical help only (8 CFR 292.1). A preparer NEVER sees G-28 / EOIR-28, legal strategy, or retainer-trust tools — those are attorney / DOJ only.",
  },
  attorney: {
    role: "attorney",
    title: "Start here — Licensed Attorney",
    intro:
      "You are a licensed immigration attorney (Role 3, $99/mo). Do these 5 things in order. Your real role always comes from your logged-in account — never from a demo switcher.",
    dashboardHref: "/legal-back-office",
    dashboardLabel: "Legal Back Office",
    steps: [
      {
        title: "Get verified — Overview & Verification",
        detail:
          "Enter your State Bar # and jurisdiction. An admin approves before your public listing and G-28 tools go live — your bar number is never shown as verified until then.",
        href: "/legal-back-office",
        linkLabel: "Open Overview & Verification",
      },
      {
        title: "Open the G-28 workspace — G-28 / EOIR-28 Forms",
        detail:
          "Form G-28 (DHS/USCIS & NVC) and EOIR-28 drafts live here, once you are verified. Draft only — nothing is ever auto-filed.",
        href: "/legal-back-office",
        linkLabel: "Open G-28 / EOIR-28 Forms",
      },
      {
        title: "Check the supervision hub — Student Supervision",
        detail:
          "Confirm or reject the law students assigned to you, and approve (or send back) their drafts. A student draft unlocks for client E-Sign / G-28 filing only after you approve it.",
        href: "/legal-back-office",
        linkLabel: "Open Student Supervision",
      },
      {
        title: "Answer escalated questions in the unified thread",
        detail:
          "One thread per case. Questions the instant-answer system escalated — eligibility, relief, evidence strength, safe-to-travel — are flagged for you at the top of the thread. Only you (or a DOJ-accredited representative) answer those.",
        href: "/legal-back-office",
        linkLabel: "Open Overview — unified thread",
      },
      {
        title: "Set up billing & retainers — Billing & Retainers",
        detail:
          "Retainer / trust billing is a draft here, not a ledger. Review the Review $99 per form / Human Review $199 locked offers the system points escalated clients to — those prices are locked, you do not change them.",
        href: "/legal-back-office",
        linkLabel: "Open Billing & Retainers",
      },
    ],
    footer:
      "Only a licensed attorney or DOJ-accredited representative gives legal advice or represents a client (8 CFR 292.1).",
  },
  doj: {
    role: "doj",
    title: "Start here — DOJ-Accredited Nonprofit",
    intro:
      "You are a DOJ-accredited nonprofit representative (Role 4: Standard $24.50/mo / Full $49.50/mo). You act under your organization's DOJ recognition, within your accreditation. Do these 5 things in order.",
    dashboardHref: "/legal-back-office",
    dashboardLabel: "Legal Back Office",
    steps: [
      {
        title: "Get verified — Overview & Verification",
        detail:
          "Submit your DOJ recognition for the EOIR roster check. An admin approves before your public listing and G-28 tools go live. Check all three official EOIR roster links before any DOJ credential is approved.",
        href: "/legal-back-office",
        linkLabel: "Open Overview & Verification",
      },
      {
        title: "Know your accreditation level — Standard vs Full",
        detail:
          "Standard (Partial) covers DHS/USCIS & NVC only — EOIR-28 stays LOCKED. Full covers USCIS and Court, including EOIR-28, once verified. Never act outside your accreditation.",
        href: "/legal-back-office",
        linkLabel: "Open Overview & Verification",
      },
      {
        title: "Open the G-28 workspace — G-28 / EOIR-28 Forms",
        detail:
          "G-28 (DHS/USCIS & NVC) for Standard and Full, once verified. EOIR-28 only if you hold Full accreditation. Draft only — nothing is ever auto-filed.",
        href: "/legal-back-office",
        linkLabel: "Open G-28 / EOIR-28 Forms",
      },
      {
        title: "Check the supervision hub — Student Supervision",
        detail:
          "Confirm or reject the law students assigned to you, and approve (or send back) their drafts. A student draft unlocks for client E-Sign / G-28 filing only after you approve it.",
        href: "/legal-back-office",
        linkLabel: "Open Student Supervision",
      },
      {
        title: "Answer escalated questions in the unified thread",
        detail:
          "One thread per case. Questions the instant-answer system escalated — eligibility, relief, evidence strength, safe-to-travel — are flagged for you at the top of the thread. Answer only within your accreditation.",
        href: "/legal-back-office",
        linkLabel: "Open Overview — unified thread",
      },
    ],
    footer:
      "Only a licensed attorney or DOJ-accredited representative gives legal advice or represents a client (8 CFR 292.1). A partial (Standard) representative NEVER sees EOIR-28.",
  },
  law_student: {
    role: "law_student",
    title: "Start here — Law Student (supervised only)",
    intro:
      "You are a supervised law student (Role 5, $35/mo). You work supervised only, on assigned cases only, and your supervisor sees everything you do. Do these 5 things in order.",
    dashboardHref: "/legal-back-office",
    dashboardLabel: "Legal Back Office",
    steps: [
      {
        title: "Confirm your supervisor — get confirmed first",
        detail:
          "Your teacher / clinic director confirms you in the Teacher Dashboard, and an admin verifies your account. Until then, directory listing and live client assignments stay locked. You cannot confirm yourself.",
        href: "/teacher-dashboard",
        linkLabel: "How confirmation works — Teacher Dashboard",
      },
      {
        title: "Open ONLY your assigned cases — Assigned Cases (Student Queue)",
        detail:
          "You see a case only when the case's verified attorney or DOJ provider assigns it to you. Never open a case that was not assigned to you, and never look for cases outside your queue.",
        href: "/legal-back-office",
        linkLabel: "Open Assigned Cases (Student Queue)",
      },
      {
        title: "Draft only — submit every draft for supervisor review",
        detail:
          "Write the draft, then submit it. It unlocks for client E-Sign / G-28 filing ONLY after your supervisor approves it. If they ask for changes, make them and resubmit — do not send a draft to a client yourself.",
        href: "/legal-back-office",
        linkLabel: "Open Assigned Cases (Student Queue)",
      },
      {
        title: "Message only with supervisor visibility",
        detail:
          "Your supervisor sees every message in the unified thread. You cannot message a client without supervisor visibility, and you never message a client alone.",
        href: "/legal-back-office",
        linkLabel: "Open Overview — unified thread",
      },
      {
        title: "Know what is LOCKED for you — and do not work around it",
        detail:
          "G-28 / EOIR-28 (cannot sign or generate), Billing & Retainers, independent legal advice, and direct filing with USCIS / Court are all LOCKED for law students at every tier. Document review stays provider-only. If you are asked to do any of these, stop and tell your supervisor.",
        href: "/legal-back-office",
        linkLabel: "Open Overview — locked-for-students list",
      },
    ],
    footer:
      "A law student works supervised only. Student drafts need supervisor review + approval before they unlock for client E-Sign / G-28 filing.",
  },
  teacher: {
    role: "teacher",
    title: "Start here — Teacher / Clinic Director",
    intro:
      "You confirm the law students who named you at registration. Confirming a student records only that you confirmed them — it does not activate their account. Do these 5 things in order.",
    dashboardHref: "/teacher-dashboard",
    dashboardLabel: "Teacher Dashboard",
    steps: [
      {
        title: "Wait for founder approval of your teacher account",
        detail:
          "You can SEE your students before approval, but Confirm / Reject stay disabled until a founder approves your teacher account. No example students are shown — the list is empty until real students name you.",
        href: "/teacher-dashboard",
        linkLabel: "Check your approval status",
      },
      {
        title: "Check the students waiting for your confirmation",
        detail:
          "A student appears here once they register as a law student and name you (by your email) as their teacher. Pending students are listed first.",
        href: "/teacher-dashboard",
        linkLabel: "Open students waiting for confirmation",
      },
      {
        title: "Confirm or reject each student",
        detail:
          "Confirm records only your confirmation (with the date and who confirmed). Reject records a rejection a founder can review. Either way, the student's account still flips to active only when an admin verifies them.",
        href: "/teacher-dashboard",
        linkLabel: "Open your student list",
      },
      {
        title: "Know what confirming does NOT do",
        detail:
          "Confirming a student does NOT flip their onboarding status and does NOT give them cases. Admin verification (bar / EOIR roster / supervisor confirmation) is a separate step in the admin verification queue.",
        href: "/admin/verifications",
        linkLabel: "Admin verification queue (admins only)",
      },
      {
        title: "Know how your students get cases",
        detail:
          "Your confirmed students see a case only when the case's verified attorney or DOJ provider assigns it to them. You confirm STUDENTS, never cases — if a student asks you for a case, send them to their supervising attorney.",
        href: "/legal-back-office",
        linkLabel: "Legal Back Office — where assigned cases live",
      },
    ],
    footer:
      "Immigration with NIPTEI is not a law firm and is not affiliated with USCIS. Only a licensed attorney or a DOJ-accredited representative can give legal advice or represent a client (8 CFR 292.1).",
  },
};

export function getCheatsheet(role: CheatsheetRole): Cheatsheet {
  return CHEATSHEETS[role];
}

export function isCheatsheetRole(value: string): value is CheatsheetRole {
  return (CHEATSHEET_ROLES as { role: string }[]).some((r) => r.role === value);
}
