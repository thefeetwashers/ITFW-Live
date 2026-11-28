// The Backbone — USCIS · NVC · Embassy (NINTH ADDITION, Nov 28, 2026).
//
// One page for the whole immigration journey. Everything on it is
// either locked data already in the codebase or official government
// guidance linked out — nothing is a live government connection.
// The receipt check, the RFE / NOID decoder, and the post lookup run
// entirely in the browser on what the visitor types; nothing typed
// here is sent anywhere or saved.
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  BACKBONE_COVERAGE,
  BACKBONE_MANUAL_TRACKING_NOTICE,
  BACKBONE_NOT_AFFILIATED_NOTICE,
  BACKBONE_NO_ENDORSEMENT_NOTICE,
  BIOMETRICS_GUIDE,
  DQ_AND_INTERVIEW,
  EMBASSY_POSTS,
  EMBASSY_WHAT_TO_BRING,
  I864_GUIDE,
  MEDICAL_EXAM_GUIDE,
  NVC_CIVIL_DOCUMENTS,
  POST_ARRIVAL_WINDOW_DAYS,
  TRAVEL_PREP,
  USCIS_FILING_GUIDE,
  USCIS_FILING_GUIDE_SOURCE,
  USCIS_IMMIGRANT_FEE_USD,
  backboneCoverageSummary,
  decisionNextSteps,
  embassyPostForNvcCase,
  lookupEmbassyPost,
  rfeNoidDeadlineCountdown,
  type BackboneSection,
} from "@/lib/backbone";
import {
  CEAC_LOGIN_URL,
  NVC_PAGE_URL,
  USEMBASSY_DIRECTORY_URL,
  USCIS_FEE_SCHEDULE_URL,
} from "@/lib/backbone";
import {
  buildConsularChecklist,
  decodeRfeNotice,
  validateReceiptNumber,
  CEAC_PASSWORD_RULE,
} from "@/lib/caseTracking";
import { CEAC_FEE_AMOUNTS } from "@/lib/nvc";

const SECTION_LABEL: Record<BackboneSection, string> = {
  uscis: "USCIS",
  nvc: "National Visa Center (NVC)",
  embassy: "Embassy / Consulate",
};

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
      {children}
    </p>
  );
}

export default function BackbonePage() {
  const [receiptInput, setReceiptInput] = useState("IOE0928374651");
  const [nvcInput, setNvcInput] = useState("PHP2026144009");
  const [postCode, setPostCode] = useState("PHP");
  const [decoderKind, setDecoderKind] = useState<"rfe" | "noid">("rfe");
  const [noticeDate, setNoticeDate] = useState("");
  const [windowDays, setWindowDays] = useState("");
  const [noticeText, setNoticeText] = useState("");

  const receipt = useMemo(() => validateReceiptNumber(receiptInput), [receiptInput]);
  const consular = useMemo(() => buildConsularChecklist(nvcInput), [nvcInput]);
  const post = useMemo(() => lookupEmbassyPost(postCode), [postCode]);
  const postFromCase = useMemo(() => embassyPostForNvcCase(nvcInput), [nvcInput]);
  const decoded = useMemo(
    () => (noticeText.trim() ? decodeRfeNotice(noticeText) : null),
    [noticeText]
  );
  const countdown = useMemo(
    () =>
      rfeNoidDeadlineCountdown({
        noticeDateIso: noticeDate || null,
        responseWindowDays: windowDays ? Number(windowDays) : null,
      }),
    [noticeDate, windowDays]
  );
  const decision = useMemo(() => decisionNextSteps("consular"), []);
  const summary = useMemo(() => backboneCoverageSummary(), []);

  return (
    <div className="min-h-screen bg-slate-50 p-4 text-slate-900">
      <div className="mx-auto max-w-3xl">
        <Notice>
          <strong>The backbone — USCIS, NVC, and the embassy, in one place.</strong>{" "}
          {BACKBONE_MANUAL_TRACKING_NOTICE}
        </Notice>
        <p className="mt-2 text-xs text-slate-600">{BACKBONE_NOT_AFFILIATED_NOTICE}</p>
        <p className="mt-1 text-xs text-slate-600">{BACKBONE_NO_ENDORSEMENT_NOTICE}</p>

        <h1 className="mt-4 text-xl font-bold">
          The Backbone — USCIS · NVC · Embassy
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          <Link href="/portal" className="underline">← Back to Portal</Link>
          {" · "}
          <Link href="/journey" className="underline">Your Journey timeline</Link>
          {" · "}
          <Link href="/diy" className="underline">Do-it-yourself forms</Link>
        </p>

        <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
          {summary.map((s) => (
            <div key={s.section} className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="font-semibold">{SECTION_LABEL[s.section]}</p>
              <p className="mt-1 text-slate-600">
                {s.total} items — {s.covered} already covered, {s.gapFilled} filled by this check
                {s.manual > 0 ? `, ${s.manual} stays manual` : ""}
              </p>
            </div>
          ))}
        </div>

        {/* ================= USCIS ================= */}
        <section aria-labelledby="uscis-heading" className="mt-6">
          <h2 id="uscis-heading" className="text-lg font-bold">1 — USCIS</h2>

          <h3 className="mt-4 text-base font-semibold">How to file — paper vs online</h3>
          <ol className="mt-2 space-y-2">
            {USCIS_FILING_GUIDE.map((step) => (
              <li key={step.id} className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
                <strong>{step.title}</strong>
                <span className="mt-1 block text-slate-700">{step.detail}</span>
              </li>
            ))}
          </ol>
          <p className="mt-1 text-xs text-slate-500">{USCIS_FILING_GUIDE_SOURCE}</p>
          <p className="mt-1 text-sm">
            <a href={USCIS_FEE_SCHEDULE_URL} target="_blank" rel="noopener noreferrer" className="font-semibold text-blue-700 underline">
              Confirm the current USCIS fee at uscis.gov/fees
            </a>{" "}
            before you pay anything to the government. Our preparation fee and the USCIS fee are always separate — never combined into one total.
          </p>

          <h3 className="mt-5 text-base font-semibold">Check a receipt number</h3>
          <p className="mt-1 text-sm text-slate-600">
            Type the 13-character receipt number from the receipt notice (Form I-797C). The format is checked here; the status itself is checked on the official USCIS site, then entered here manually. Nothing typed here is sent or saved.
          </p>
          <label className="mt-2 block text-sm">
            <span className="font-medium">USCIS receipt number</span>
            <input
              value={receiptInput}
              onChange={(e) => setReceiptInput(e.target.value)}
              className="mt-1 w-full max-w-sm rounded border border-slate-300 bg-white px-2 py-1 text-sm"
              placeholder="IOE0928374651"
            />
          </label>
          {receipt.valid ? (
            <p className="mt-2 text-sm">
              Format OK — shown masked: <strong>{receipt.masked}</strong>.{" "}
              <a href="https://egov.uscis.gov/casestatus/landing.do" target="_blank" rel="noopener noreferrer" className="font-semibold text-blue-700 underline">
                Check the public status on USCIS Case Status Online
              </a>
              , then give the exact status words to your preparer.
            </p>
          ) : (
            <ul className="mt-2 text-sm text-red-700">
              {receipt.errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}

          <h3 className="mt-5 text-base font-semibold">RFE / NOID decoder + deadline countdown</h3>
          <p className="mt-1 text-sm text-slate-600">
            A Request for Evidence (RFE) is not a denial — it means USCIS needs more before it can decide. A Notice of Intent to Deny (NOID) is more serious: USCIS plans to deny unless you answer, and the reply is legal work. The decoder below translates the words on the notice into plain English and clerical next steps only. It never decides whether evidence is strong enough and never writes a legal response.
          </p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="font-medium">Notice type</span>
              <select
                value={decoderKind}
                onChange={(e) => setDecoderKind(e.target.value as "rfe" | "noid")}
                className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1 text-sm"
              >
                <option value="rfe">Request for Evidence (RFE)</option>
                <option value="noid">Notice of Intent to Deny (NOID)</option>
              </select>
            </label>
            <label className="block text-sm">
              <span className="font-medium">Notice date (from the letter)</span>
              <input
                type="date"
                value={noticeDate}
                onChange={(e) => setNoticeDate(e.target.value)}
                className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1 text-sm"
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium">Response window in days (printed on the letter)</span>
              <input
                type="number"
                min={1}
                value={windowDays}
                onChange={(e) => setWindowDays(e.target.value)}
                className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1 text-sm"
                placeholder="e.g. 84"
              />
            </label>
          </div>
          {countdown.deadlineIso ? (
            <p className={`mt-2 text-sm font-semibold ${countdown.daysLeft !== null && countdown.daysLeft <= 14 ? "text-red-700" : ""}`}>
              Deadline: {countdown.deadlineIso}
              {countdown.daysLeft !== null && countdown.daysLeft >= 0
                ? ` — ${countdown.daysLeft} day(s) left.`
                : " — deadline passed. Contact your preparer and an attorney at once."}
            </p>
          ) : (
            <p className="mt-2 text-sm text-slate-600">{countdown.deadlineUnknownReason}</p>
          )}
          <label className="mt-2 block text-sm">
            <span className="font-medium">Words from the notice (paste them here — nothing is sent or saved)</span>
            <textarea
              value={noticeText}
              onChange={(e) => setNoticeText(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1 text-sm"
              placeholder="e.g. bona fide marriage evidence, birth certificate, affidavit of support…"
            />
          </label>
          {decoded && (
            <div className="mt-2 rounded-lg border border-slate-200 bg-white p-3 text-sm">
              {decoderKind === "noid" || decoded.needsAttorneyReview ? (
                <p className="font-semibold text-red-700">
                  Attorney review needed — show this notice to a licensed attorney or DOJ-accredited representative right away.
                </p>
              ) : null}
              {decoded.recognised ? (
                <ul className="mt-2 space-y-2">
                  {decoded.matched.map((m) => (
                    <li key={m.meaning}>
                      <strong>{m.meaning}</strong>
                      <span className="block text-slate-700">{m.clericalNextStep}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-slate-700">{decoded.guidance}</p>
              )}
            </div>
          )}

          <h3 className="mt-5 text-base font-semibold">Biometrics appointment</h3>
          <div className="mt-2 rounded-lg border border-slate-200 bg-white p-3 text-sm">
            <p>{BIOMETRICS_GUIDE.whatItIs}</p>
            <p className="mt-2 font-medium">Bring:</p>
            <ul className="list-disc pl-5">
              {BIOMETRICS_GUIDE.bring.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
            <p className="mt-2">{BIOMETRICS_GUIDE.whatHappens}</p>
            <p className="mt-2">{BIOMETRICS_GUIDE.reschedule}</p>
            <p className="mt-2">{BIOMETRICS_GUIDE.missed}</p>
            <p className="mt-2 text-xs text-slate-500">{BIOMETRICS_GUIDE.feeNote}</p>
          </div>

          <h3 className="mt-5 text-base font-semibold">What happens after filing — decision steps</h3>
          <ol className="mt-2 space-y-2">
            {decision.stages.map((s) => (
              <li key={s.id} className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
                <strong>{s.label}</strong>
                <span className="mt-1 block text-slate-700">{s.plainEnglish}</span>
              </li>
            ))}
          </ol>
          <p className="mt-2 text-sm text-slate-700">{decision.denialNote}</p>
          <p className="mt-2 text-sm">
            <Link href="/interview-prep" className="font-semibold text-blue-700 underline">
              Interview preparation
            </Link>{" "}
            — question banks built only from official USCIS guidance (civics sample: 25 of the official 100 — study all 100 on uscis.gov).
          </p>
        </section>

        {/* ================= NVC ================= */}
        <section aria-labelledby="nvc-heading" className="mt-8">
          <h2 id="nvc-heading" className="text-lg font-bold">2 — National Visa Center (NVC)</h2>
          <p className="mt-1 text-sm text-slate-600">{CEAC_PASSWORD_RULE}</p>

          <h3 className="mt-4 text-base font-semibold">Your NVC case</h3>
          <label className="mt-2 block text-sm">
            <span className="font-medium">NVC case number (13 characters)</span>
            <input
              value={nvcInput}
              onChange={(e) => setNvcInput(e.target.value)}
              className="mt-1 w-full max-w-sm rounded border border-slate-300 bg-white px-2 py-1 text-sm"
              placeholder="PHP2026144009"
            />
          </label>
          {consular.nvcCaseValid && consular.post ? (
            <p className="mt-2 text-sm">
              Valid case number — post: <strong>{consular.post.city}, {consular.post.country}</strong>
              {postFromCase.embassy ? " — see the embassy section below for that post." : ""}
            </p>
          ) : (
            <p className="mt-2 text-sm text-red-700">
              That case number is not valid. It must be 13 characters: 3-letter post + 4-digit year + 3-digit Julian day + 3-digit sequence.
            </p>
          )}

          <h3 className="mt-4 text-base font-semibold">What to submit online to the embassy (CEAC)</h3>
          <p className="mt-1 text-sm">
            <a href={CEAC_LOGIN_URL} target="_blank" rel="noopener noreferrer" className="font-semibold text-blue-700 underline">
              Log in to CEAC
            </a>{" "}
            yourself, with the NVC case number and Invoice ID from the welcome letter. NVC has no API — CEAC tracking here is manual.
          </p>
          <ol className="mt-2 space-y-2">
            {consular.submitOnline.map((s) => (
              <li key={s.id} className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
                <strong>{s.title}</strong>
                <span className="mt-1 block text-slate-700">{s.detail}</span>
              </li>
            ))}
          </ol>
          <p className="mt-2 rounded border border-slate-200 bg-white p-3 text-sm">
            <strong>DOS fees, shown separately:</strong> Affidavit of Support (AOS) fee{" "}
            <strong>${CEAC_FEE_AMOUNTS.aos}</strong> per case + Immigrant Visa (IV) fee{" "}
            <strong>${CEAC_FEE_AMOUNTS.iv}</strong> per applicant — paid in CEAC, separate from the
            preparation fee and separate from USCIS fees. K-1 fiancé(e) cases are different: no
            DS-260, no I-864, and no CEAC fees — the fiancé(e) completes Form DS-160 and the
            petitioner completes Form I-134.
          </p>
          <p className="mt-2 text-sm">
            NVC&apos;s own public contact (from the State Department&apos;s NVC page):{" "}
            <a href={NVC_PAGE_URL} target="_blank" rel="noopener noreferrer" className="font-semibold text-blue-700 underline">
              NVC page on travel.state.gov
            </a>
            . This is NVC&apos;s contact, not an embassy&apos;s.
          </p>

          <h3 className="mt-5 text-base font-semibold">Civil documents — what each one is</h3>
          <ul className="mt-2 space-y-2">
            {NVC_CIVIL_DOCUMENTS.map((d) => (
              <li key={d.id} className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
                <strong>{d.document}</strong> <span className="text-slate-500">— {d.who}</span>
                <span className="mt-1 block text-slate-700">{d.note}</span>
              </li>
            ))}
          </ul>

          <h3 className="mt-5 text-base font-semibold">I-864 Affidavit of Support</h3>
          <div className="mt-2 rounded-lg border border-slate-200 bg-white p-3 text-sm">
            <p>{I864_GUIDE.whatItIs}</p>
            <p className="mt-2">{I864_GUIDE.thresholdNote}</p>
            <ul className="mt-2 list-disc pl-5">
              {I864_GUIDE.documents.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
            <p className="mt-2">{I864_GUIDE.jointSponsorNote}</p>
            <p className="mt-2 text-slate-600">{I864_GUIDE.notDecidedHere}</p>
          </div>

          <h3 className="mt-5 text-base font-semibold">Documentarily Qualified (DQ) → interview</h3>
          <div className="mt-2 rounded-lg border border-slate-200 bg-white p-3 text-sm">
            <p>{DQ_AND_INTERVIEW.whoSchedules}</p>
            <ul className="mt-2 list-disc pl-5">
              {DQ_AND_INTERVIEW.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
            <p className="mt-2">{DQ_AND_INTERVIEW.oneYearRule}</p>
            <p className="mt-2">{DQ_AND_INTERVIEW.failureToAppear}</p>
          </div>
        </section>

        {/* ================= EMBASSY ================= */}
        <section aria-labelledby="embassy-heading" className="mt-8">
          <h2 id="embassy-heading" className="text-lg font-bold">3 — Embassy / Consulate</h2>
          <p className="mt-1 text-sm text-slate-600">
            Pick your post to see its official interview instructions, what its medical exam needs, and how your passport comes back. Every link below goes to the U.S. Department of State&apos;s official instructions for that post, verified November 28, 2026.
          </p>

          <label className="mt-3 block text-sm">
            <span className="font-medium">Embassy / consulate post</span>
            <select
              value={postCode}
              onChange={(e) => setPostCode(e.target.value)}
              className="mt-1 w-full max-w-sm rounded border border-slate-300 bg-white px-2 py-1 text-sm"
            >
              {EMBASSY_POSTS.map((p) => (
                <option key={p.nvcCode} value={p.nvcCode}>
                  {p.nvcCode} — {p.city}, {p.country}
                </option>
              ))}
            </select>
          </label>

          {post && (
            <article className="mt-3 rounded-lg border border-slate-200 bg-white p-4 text-sm">
              <h3 className="text-base font-semibold">
                {post.city}, {post.country} ({post.nvcCode})
              </h3>
              <p className="mt-2">
                <a href={post.instructionsUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-blue-700 underline">
                  Official interview instructions for {post.city} (travel.state.gov)
                </a>
                {post.instructionsUpdated ? ` — updated ${post.instructionsUpdated}.` : "."}
              </p>
              <p className="mt-2">
                <strong>Contact: </strong>
                {post.emailVerified && post.contactEmail ? (
                  <>
                    <a href={`mailto:${post.contactEmail}`} className="font-semibold text-blue-700 underline">{post.contactEmail}</a> —{" "}
                  </>
                ) : (
                  "No embassy email was verified on the official page — use the official instructions link above. "
                )}
                {post.contactNote}
              </p>
              <p className="mt-2"><strong>Medical exam: </strong>{post.medicalNote}</p>
              <p className="mt-2"><strong>Visa pickup: </strong>{post.visaPickupNote}</p>
              {post.specialNote && (
                <p className="mt-2"><strong>Note for this post: </strong>{post.specialNote}</p>
              )}
            </article>
          )}
          <p className="mt-2 text-sm">
            A post not in this list? The full directory is at{" "}
            <a href={USEMBASSY_DIRECTORY_URL} target="_blank" rel="noopener noreferrer" className="font-semibold text-blue-700 underline">
              usembassy.gov
            </a>
            . Never guess a post&apos;s email address — a wrong address sends your documents to the wrong place.
          </p>

          <h3 className="mt-5 text-base font-semibold">What to bring to the interview</h3>
          <ul className="mt-2 space-y-2">
            {EMBASSY_WHAT_TO_BRING.map((b) => (
              <li key={b.item} className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
                <strong>{b.item}</strong>
                <span className="mt-1 block text-slate-700">{b.detail}</span>
              </li>
            ))}
          </ul>
          <p className="mt-1 text-xs text-slate-500">
            Source:{" "}
            <a href="https://travel.state.gov/content/travel/en/us-visas/immigrate/the-immigrant-visa-process/step-10-prepare-for-the-interview/step-11-applicant-interview.html" target="_blank" rel="noopener noreferrer" className="underline">
              travel.state.gov — Step 11, Applicant Interview
            </a>
            . Your post&apos;s instructions above can add to this list — always follow the post&apos;s own checklist too.
          </p>

          <h3 className="mt-5 text-base font-semibold">Medical exam</h3>
          <div className="mt-2 rounded-lg border border-slate-200 bg-white p-3 text-sm">
            <p>{MEDICAL_EXAM_GUIDE.rule}</p>
            <ul className="mt-2 list-disc pl-5">
              {MEDICAL_EXAM_GUIDE.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
            <p className="mt-2 font-medium">Bring to the exam:</p>
            <ul className="list-disc pl-5">
              {MEDICAL_EXAM_GUIDE.bring.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
            <p className="mt-2">{MEDICAL_EXAM_GUIDE.sealedEnvelope}</p>
            <p className="mt-2">{MEDICAL_EXAM_GUIDE.validityNote}</p>
          </div>

          <h3 className="mt-5 text-base font-semibold">After the visa — travel prep</h3>
          <ul className="mt-2 space-y-2">
            {TRAVEL_PREP.map((t) => (
              <li key={t.item} className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
                <strong>{t.item}</strong>
                <span className="mt-1 block text-slate-700">{t.detail}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-sm text-slate-600">
            The ${USCIS_IMMIGRANT_FEE_USD} immigrant fee and the {POST_ARRIVAL_WINDOW_DAYS.min}–{POST_ARRIVAL_WINDOW_DAYS.max} day
            Green Card / SSN window are the locked values already in the case lifecycle — reused here, not re-decided.
          </p>
        </section>

        {/* ================= COVERAGE ================= */}
        <section aria-labelledby="coverage-heading" className="mt-8">
          <h2 id="coverage-heading" className="text-lg font-bold">Backbone coverage — what is covered, what is still manual</h2>
          {summary.map((s) => (
            <div key={s.section} className="mt-4">
              <h3 className="text-base font-semibold">{SECTION_LABEL[s.section]}</h3>
              <ul className="mt-2 space-y-2">
                {BACKBONE_COVERAGE.filter((r) => r.section === s.section).map((r) => (
                  <li key={r.item} className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
                    <strong>{r.item}</strong>{" "}
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-semibold">
                      {r.status === "covered" ? "Already covered" : r.status === "gap-filled" ? "Filled by this check" : "Stays manual"}
                    </span>
                    <span className="mt-1 block text-slate-700">{r.detail}</span>
                    <span className="mt-1 block text-xs text-slate-500">Source: {r.source}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <p className="mt-4 text-xs text-slate-500">
            {BACKBONE_NOT_AFFILIATED_NOTICE} {BACKBONE_NO_ENDORSEMENT_NOTICE}
          </p>
        </section>
      </div>
    </div>
  );
}
