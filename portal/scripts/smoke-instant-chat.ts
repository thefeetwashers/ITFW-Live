// Code-level smoke test for the instant-answer chat — run with:
//   npx -y tsx scripts/smoke-instant-chat.ts
// (tsx is NOT a project dependency; it is fetched on demand for this
// test only. Fake data only: the three test questions below are
// invented for the test, no real client, no real case, no network
// call, no key, no Supabase, no Stripe. The engine answers ONLY from
// the platform's locked data — nothing is invented as official.)
import assert from "node:assert/strict";
import {
  answerInstantly,
  buildInstantSystemMessage,
  isQuestionLike,
  SYSTEM_LABEL,
  UNKNOWN_ANSWER_EXACT,
} from "../src/lib/instantChat";
import { POST as askNipteiPost } from "../src/app/api/ask-niptei/route";

let passed = 0;
function ok(name: string, cond: boolean) {
  assert.equal(cond, true, name);
  passed += 1;
  console.log(`  PASS ${name}`);
}

async function main() {
  // Test question 1 — KNOWN: locked I-485 fees.
  // Q: "What are the fees for I-485?"
  console.log("1) known question — What are the fees for I-485?");
  const known = answerInstantly("What are the fees for I-485?");
  console.log(`   answer (first 200 chars): ${known.answer.slice(0, 200)}`);
  ok("known: not escalated", known.escalated === false);
  ok("known: not unknown", known.unknown === false);
  ok("known: no human follow-up required", known.needsProfessional === false);
  ok("known: not flagged for the professional", known.flaggedForProfessional === false);
  ok("known: carries the system label", known.systemLabel === SYSTEM_LABEL);
  ok(
    "known: label is the exact required wording",
    known.systemLabel ===
      "Ask NIPTEI — answered by the system, not a person — educational information only, not legal advice, not USCIS"
  );
  ok("known: carries at least one source", known.sources.length >= 1);
  ok(
    "known: a source is uscis.gov/fees or the locked prices",
    known.sources.some((s) => s.url.includes("uscis.gov") || s.url.includes("niptei.com"))
  );
  ok(
    "known: answer names the locked I-485 prep fee",
    known.answer.includes("I-485") && known.answer.includes("$")
  );
  const sysMsg = buildInstantSystemMessage(known, "test-msg-1");
  ok("known: thread message is from the system", sysMsg.sender === "system");
  ok("known: thread message carries the label", sysMsg.systemLabel === SYSTEM_LABEL);

  // Test question 2 — UNKNOWN: processing time (never invented).
  // Q: "How long will my case take?"
  console.log("2) unknown question — How long will my case take?");
  const unknown = answerInstantly("How long will my case take?");
  console.log(`   answer: ${unknown.answer}`);
  ok("unknown: answer is EXACTLY the required sentence", unknown.answer === UNKNOWN_ANSWER_EXACT);
  ok(
    "unknown: exact sentence is 'I do not know — check uscis.gov / ask your preparer / ask an attorney'",
    unknown.answer === "I do not know — check uscis.gov / ask your preparer / ask an attorney"
  );
  ok("unknown: flagged for the professional", unknown.flaggedForProfessional === true);
  ok("unknown: needs a human follow-up", unknown.needsProfessional === true);
  ok("unknown: not a legal escalation", unknown.escalated === false);
  ok("unknown: no escalation log entry", unknown.escalation === null);
  ok("unknown: still carries the system label", unknown.systemLabel === SYSTEM_LABEL);
  ok("unknown: still carries a source", unknown.sources.length >= 1);

  // Test question 3 — LEGAL: eligibility (must escalate, no legal answer).
  // Q: "Am I eligible for asylum?"
  console.log("3) legal question — Am I eligible for asylum?");
  const legal = answerInstantly("Am I eligible for asylum?");
  console.log(`   answer (first 200 chars): ${legal.answer.slice(0, 200)}`);
  ok("legal: escalated", legal.escalated === true);
  ok("legal: flagged for the professional", legal.flaggedForProfessional === true);
  ok("legal: needs a human follow-up", legal.needsProfessional === true);
  ok("legal: escalation log entry exists", legal.escalation !== null);
  ok(
    "legal: escalation routes to Find Attorney / Find DOJ",
    (legal.escalation?.routedTo ?? "").includes("Find Attorney / Find DOJ")
  );
  ok(
    "legal: escalation offers Review $99 and Human Review $199",
    (legal.escalation?.offers.join(" ") ?? "").includes("$99") &&
      (legal.escalation?.offers.join(" ") ?? "").includes("$199")
  );
  ok(
    "legal: answer points to a licensed attorney / DOJ representative",
    legal.answer.includes("licensed attorney or DOJ-accredited representative")
  );
  ok(
    "legal: answer gives NO eligibility decision",
    !/you are eligible/i.test(legal.answer) && !/you qualify/i.test(legal.answer)
  );
  ok(
    "legal: answer says it does not give legal advice",
    legal.answer.includes("do not give legal advice")
  );
  ok(
    "legal: answer points to the DOJ roster",
    legal.answer.includes("justice.gov/eoir")
  );

  // Question-gate: greetings do NOT trigger an instant answer in the
  // general thread (they are normal chat messages).
  console.log("4) question gate (isQuestionLike)");
  ok("gate: 'hello' is not a question", isQuestionLike("hello") === false);
  ok("gate: 'thanks!' is not a question", isQuestionLike("thanks!") === false);
  ok("gate: 'What are the fees?' is a question", isQuestionLike("What are the fees?") === true);
  ok("gate: 'How long will my case take?' is a question", isQuestionLike("How long will my case take?") === true);

  // API route: POST /api/ask-niptei with instantChat:true returns
  // 501 "AI not configured" BY DESIGN, with the instant result in
  // the body (clients treat 501 + body as a normal answer).
  console.log("5) POST /api/ask-niptei — instantChat mode");
  {
    const res = await askNipteiPost(
      new Request("http://localhost/api/ask-niptei", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: "What are the fees for I-485?", instantChat: true, caseId: "fake-case-1" }),
      })
    );
    ok("route: instant mode still returns 501 (AI not configured)", res.status === 501);
    const data = (await res.json()) as {
      error?: string;
      answer?: { answer?: string };
      instant?: { answer: string; systemLabel: string; escalated: boolean; flaggedForProfessional: boolean };
    };
    ok("route: 501 body names AI not configured", (data.error ?? "").includes("AI not configured"));
    ok("route: instant result is present", typeof data.instant?.answer === "string");
    ok("route: instant result carries the system label", data.instant?.systemLabel === SYSTEM_LABEL);
    ok("route: instant known answer is not escalated", data.instant?.escalated === false);
    ok("route: plain answer is still present for existing callers", typeof data.answer?.answer === "string");
  }
  {
    const res = await askNipteiPost(
      new Request("http://localhost/api/ask-niptei", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: "How long will my case take?", instantChat: true, caseId: "fake-case-1" }),
      })
    );
    ok("route: unknown via API also returns 501", res.status === 501);
    const data = (await res.json()) as { instant?: { answer: string; flaggedForProfessional: boolean } };
    ok("route: unknown via API is the exact sentence", data.instant?.answer === UNKNOWN_ANSWER_EXACT);
    ok("route: unknown via API is flagged", data.instant?.flaggedForProfessional === true);
  }

  console.log(`\nsmoke-instant-chat: ${passed} checks passed.`);
}

main().catch((err) => {
  console.error("smoke-instant-chat FAILED:", err);
  process.exit(1);
});
