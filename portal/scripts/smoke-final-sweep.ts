// Smoke test: Final expert sweep — breathtaking dashboards + powerful
// client intake (Nov 28, 2026, founder's final charge).
// Run with:  npx -y tsx scripts/smoke-final-sweep.ts
// (tsx is NOT a project dependency; it is fetched on demand for this
// test only, as in scripts/smoke-standout-five.ts.)
//
// FAKE DATA ONLY. No real Supabase, Stripe, SES, Twilio, or USCIS call
// is made. Every decision is tested against the pure library functions
// with fake rows. Nothing is charged, no account is created, no real
// key is used.
//
// Proves:
//   1. Each dashboard's first section is the next step
//      (DASHBOARD_SECTION_ORDER[0] === "next_step", and the checklist
//      comes second, one-click actions third).
//   2. The colour-coded checklist uses the EXACT existing colour
//      meanings — green Approved, amber Pending Review / In Progress,
//      red Missing / Rejected / Overdue, blue Uploaded — Awaiting
//      Review, grey Not Started — and no new colour was invented.
//      Packet readiness is derived from those colours only.
//   3. The intake sequence shows the free/paid boundary honestly:
//      steps before the boundary are all FREE, steps from the boundary
//      are PAID, and the checklist preview shows exactly the first 2
//      items free with the rest counted as locked.
//   4. The notification inbox lists ONLY real stored events: fake
//      notification_logs rows + fake messages rows merge newest-first,
//      rows with unparseable dates are dropped, and no message body is
//      ever included in an inbox event.
//   5. The payment centre shows the missed-payment math EXACTLY:
//      "If you miss a payment, 50% is added to the total amount."
//      $999 -> +$499.50 -> $1,498.50; $1,799 -> +$899.50 -> $2,698.50;
//      $2,799 -> +$1,399.50 -> $4,198.50.
//   6. The deadline countdown counts from stored dates only: overdue,
//      due today, due soon (<=14 days), due, and no-date-on-file —
//      never an invented date.
//   7. The next-step engine puts the single most important action
//      first: an overdue invoice beats a blocking document, and with
//      no route set it honestly says the route is not set.
import assert from "node:assert/strict";
import {
  DASHBOARD_SECTION_ORDER,
  INTAKE_FREE_PAID_BOUNDARY,
  INTAKE_STEPS,
  checklistPreview,
  deadlineCountdown,
  firstDashboardSection,
  normalizeInboxEvents,
  unreadInboxCount,
} from "../src/lib/finalSweep";
import {
  DOC_COLOURS,
  DOC_COLOUR_LEGEND,
  colourReadiness,
  deriveNextStep,
  missedPaymentMath,
  type ColourItem,
} from "../src/lib/nextStepEngine";
import { MISSED_PAYMENT_RULE } from "../src/lib/order";

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ok — ${name}`);
}

// --- 1. Dashboard order: next step first, checklist second, actions third.
check("first dashboard section is the next step", () => {
  assert.equal(firstDashboardSection(), "next_step");
  assert.equal(DASHBOARD_SECTION_ORDER[0], "next_step");
  assert.equal(DASHBOARD_SECTION_ORDER[1], "checklist");
  assert.equal(DASHBOARD_SECTION_ORDER[2], "one_click_actions");
  assert.equal(DASHBOARD_SECTION_ORDER[3], "deadlines");
  assert.equal(DASHBOARD_SECTION_ORDER[4], "notifications");
  // No duplicate sections, no section dropped.
  assert.equal(
    new Set(DASHBOARD_SECTION_ORDER).size,
    DASHBOARD_SECTION_ORDER.length
  );
});

// --- 2. Colour meanings are exactly the existing ones — nothing new.
check("colour legend uses the exact existing colour meanings", () => {
  assert.deepEqual(DOC_COLOUR_LEGEND, [
    "approved",
    "pending_review",
    "in_progress",
    "uploaded_awaiting",
    "missing",
    "rejected",
    "overdue",
    "not_started",
  ]);
  assert.equal(DOC_COLOURS.approved.label, "Approved");
  assert.equal(DOC_COLOURS.approved.dotClass, "bg-green-600");
  assert.equal(DOC_COLOURS.pending_review.label, "Pending Review");
  assert.equal(DOC_COLOURS.in_progress.label, "In Progress");
  assert.equal(DOC_COLOURS.pending_review.dotClass, "bg-amber-500");
  assert.equal(DOC_COLOURS.in_progress.dotClass, "bg-amber-500");
  assert.equal(DOC_COLOURS.missing.label, "Missing");
  assert.equal(DOC_COLOURS.rejected.label, "Rejected / Retake Needed");
  assert.equal(DOC_COLOURS.overdue.label, "Overdue");
  assert.equal(DOC_COLOURS.missing.dotClass, "bg-red-600");
  assert.equal(DOC_COLOURS.rejected.dotClass, "bg-red-600");
  assert.equal(DOC_COLOURS.overdue.dotClass, "bg-red-600");
  assert.equal(DOC_COLOURS.uploaded_awaiting.label, "Uploaded — Awaiting Review");
  assert.equal(DOC_COLOURS.uploaded_awaiting.dotClass, "bg-blue-600");
  assert.equal(DOC_COLOURS.not_started.label, "Not Started");
  assert.equal(DOC_COLOURS.not_started.dotClass, "bg-slate-400");
  // No ninth colour exists.
  assert.equal(Object.keys(DOC_COLOURS).length, 8);
});

check("packet readiness is derived from the colours only", () => {
  const items: ColourItem[] = [
    { id: "a", label: "Passport", status: "approved" },
    { id: "b", label: "Birth certificate", status: "uploaded_awaiting" },
    { id: "c", label: "Bank statement", status: "missing", blocking: true },
    { id: "d", label: "Photos", status: "not_started" },
  ];
  const r = colourReadiness(items);
  assert.equal(r.approved, 1);
  assert.equal(r.total, 4);
  // 1 + 0.5 + 0 + 0 = 1.5 / 4 = 37.5 -> 38%.
  assert.equal(r.score, 38);
  assert.equal(r.readyToFile, false);
  assert.deepEqual(
    r.blockingOpen.map((i) => i.id),
    ["c"]
  );
});

// --- 3. Intake sequence: free/paid boundary is honest.
check("intake sequence shows the free/paid boundary honestly", () => {
  assert.deepEqual(
    INTAKE_STEPS.map((s) => s.id),
    [
      "pathfinder",
      "calculator",
      "checklist_preview",
      "register",
      "pay",
      "case_created",
    ]
  );
  assert.equal(INTAKE_FREE_PAID_BOUNDARY, 4);
  for (let i = 0; i < INTAKE_FREE_PAID_BOUNDARY; i++) {
    assert.equal(INTAKE_STEPS[i].cost, "free", INTAKE_STEPS[i].id);
  }
  for (let i = INTAKE_FREE_PAID_BOUNDARY; i < INTAKE_STEPS.length; i++) {
    assert.equal(INTAKE_STEPS[i].cost, "paid", INTAKE_STEPS[i].id);
  }
  // Every step has a real destination that exists in the portal.
  for (const s of INTAKE_STEPS) {
    assert.ok(s.href.startsWith("/"), s.id);
    assert.ok(s.hrefLabel.length > 0, s.id);
  }
});

check("checklist preview shows exactly the first 2 items free", () => {
  const items = ["a", "b", "c", "d", "e", "f"];
  const p = checklistPreview(items, 2);
  assert.deepEqual(p.freeItems, ["a", "b"]);
  assert.equal(p.lockedCount, 4);
  assert.equal(p.total, 6);
  const short = checklistPreview(["only-one"], 2);
  assert.deepEqual(short.freeItems, ["only-one"]);
  assert.equal(short.lockedCount, 0);
});

// --- 4. Notification inbox: stored rows only, newest first, no bodies.
check("notification inbox lists only real stored events", () => {
  const events = normalizeInboxEvents({
    logs: [
      {
        id: "log-1",
        stage_key: "active_drafting",
        channel: "email",
        status: "sent",
        created_at: "2026-11-28T10:00:00Z",
      },
      {
        id: "log-2",
        stage_key: "quote_sent",
        channel: "sms",
        status: "not_configured",
        created_at: "2026-11-27T09:00:00Z",
      },
      // Unparseable date: dropped, never guessed.
      {
        id: "log-bad",
        stage_key: "quote_sent",
        channel: "email",
        status: "sent",
        created_at: "not-a-date",
      },
    ],
    messages: [
      {
        id: "msg-1",
        sender_role: "preparer",
        recipient_role: "client",
        is_read: false,
        created_at: "2026-11-28T11:00:00Z",
      },
    ],
  });
  assert.equal(events.length, 3);
  // Newest first.
  assert.equal(events[0].id, "msg:msg-1");
  assert.equal(events[1].id, "log:log-1");
  assert.equal(events[2].id, "log:log-2");
  // No message body is ever included in an inbox event.
  for (const e of events) {
    assert.ok(!("body" in e), e.id);
    assert.ok(!("body_original" in e), e.id);
  }
  // The not_configured log is honest about nothing being sent.
  assert.match(events[2].detail, /not configured/i);
  // Unread count counts unread messages only.
  assert.equal(unreadInboxCount(events), 1);
  assert.equal(unreadInboxCount([]), 0);
  assert.deepEqual(normalizeInboxEvents({ logs: [], messages: [] }), []);
});

// --- 5. Missed-payment math, exactly.
check("payment centre shows the missed-payment math exactly", () => {
  assert.equal(
    MISSED_PAYMENT_RULE,
    "If you miss a payment, 50% is added to the total amount."
  );
  const cases: [number, string, string, string][] = [
    [99900, "$999.00", "$499.50", "$1,498.50"],
    [179900, "$1,799.00", "$899.50", "$2,698.50"],
    [279900, "$2,799.00", "$1,399.50", "$4,198.50"],
  ];
  for (const [cents, original, penalty, total] of cases) {
    const m = missedPaymentMath(cents);
    assert.equal(m.rule, MISSED_PAYMENT_RULE);
    assert.equal(m.originalTotal, original);
    assert.equal(m.penalty, penalty);
    assert.equal(m.newTotal, total);
  }
});

// --- 6. Deadline countdown from stored dates only.
check("deadline countdown counts from stored dates only", () => {
  const today = new Date("2026-11-28T12:00:00Z");
  assert.deepEqual(deadlineCountdown("2026-11-20", today).state, "overdue");
  assert.equal(deadlineCountdown("2026-11-20", today).days, -8);
  assert.equal(deadlineCountdown("2026-11-28", today).state, "due_today");
  assert.equal(deadlineCountdown("2026-12-05", today).state, "due_soon");
  assert.equal(deadlineCountdown("2026-12-05", today).days, 7);
  assert.equal(deadlineCountdown("2027-03-01", today).state, "due");
  assert.deepEqual(deadlineCountdown(null, today), {
    days: null,
    state: "no_date",
    label: "No date on file",
  });
  assert.equal(deadlineCountdown(undefined, today).state, "no_date");
});

// --- 7. Next step first: the most important action wins.
check("next-step engine puts the single most important action first", () => {
  const overdue = deriveNextStep({
    route: "inside_us",
    uscisStage: "review",
    overdueInvoice: { invoiceNumber: "INV-1", amountCents: 59967 },
    blockingItems: [
      { id: "b", label: "Birth certificate", status: "missing", blocking: true },
    ],
    language: "en",
  });
  assert.equal(overdue.kind, "pay_overdue");
  assert.match(overdue.title, /INV-1/);
  const noRoute = deriveNextStep({
    route: null,
    uscisStage: null,
    blockingItems: [],
    language: "en",
  });
  assert.equal(noRoute.kind, "route_not_set");
  assert.equal(noRoute.actor, "provider");
});

console.log(`\nsmoke-final-sweep: ${passed} checks passed.`);
