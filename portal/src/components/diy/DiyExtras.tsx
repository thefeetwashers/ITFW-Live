// DIY extras — client components for the DIY page (src/app/diy/,
// owned by the parallel builder; not created yet at the time of this
// build). Each component here is standalone: the DIY page imports
// only what it needs. None of these components grants access, charges
// anything, or files anything — they render data from src/lib/diy*.
// "use client" because the DIY page renders them inside the intake
// flow; all data they show is computed from props, never fetched
// with credentials.
"use client";

import { runDiyHealthCheck, type DiyHealthCheckResult } from "@/lib/diyHealthCheck";
import { diyFeeBreakdown, diyBundleComparison, formatDiyCents } from "@/lib/diyFees";
import { diyAfterFilingTimeline } from "@/lib/diyAfterFiling";
import { diyFormMeta } from "@/lib/diy";
import { questionGroupsForForm } from "@/lib/diyQuestionHelp";
import {
  DIY_REVIEW_UPSELL_NOTE,
  diyReviewOptions,
  reviewAddOnTotalCents,
  type DiyReviewOptionKey,
} from "@/lib/diyReviewUpsell";
import { referralAfterPrint } from "@/lib/diyReferral";
import { summarizeDraft } from "@/lib/diyDrafts";

// --- Free Packet Health Check -------------------------------------------

export function DiyHealthCheck(props: {
  formCode: string;
  answers: Record<string, string>;
  clearedItemIds?: string[];
  /** Pre-computed result (e.g. from /api/diy/health-check). When
   *  omitted, the check runs client-side from the props. */
  result?: DiyHealthCheckResult;
}) {
  const result = props.result ?? runDiyHealthCheck(props);
  return (
    <section aria-label="Free Packet Health Check">
      <h3>Free Packet Health Check — before you pay</h3>
      <p>
        Score: {result.score}% ({result.earnedWeight}/{result.totalWeight}).
        {result.readyToFile
          ? " Your packet checklist is complete."
          : " Your packet is not ready to file yet — see what is missing below."}
      </p>
      <p>
        <strong>This check is free and does not unlock printing.</strong>{" "}
        Print, save and email still require the DIY payment.
      </p>
      {result.fixes.length === 0 ? (
        <p>No fixes listed — every checklist item is cleared.</p>
      ) : (
        <ul>
          {result.fixes.map((fix, i) => (
            <li key={`${fix.kind}-${i}`}>
              <strong>{fix.blocking ? "Must fix: " : "To do: "}</strong>
              {fix.label} — {fix.detail}
            </li>
          ))}
        </ul>
      )}
      <p>{result.disclaimer}</p>
    </section>
  );
}

// --- Fee calculator (before pay — fees separate, never combined) --------

export function DiyFeeBreakdown(props: {
  formCode: string;
  bundle?: boolean;
  formCount?: number;
}) {
  const breakdown = diyFeeBreakdown(props.formCode, { bundle: props.bundle });
  const comparison = diyBundleComparison(props.formCount ?? 1);
  return (
    <section aria-label="Fees before you pay">
      <h3>Fees — before you pay</h3>
      <p>
        <strong>Our fee:</strong> {breakdown.ourFee.label} —{" "}
        {breakdown.ourFee.amountCents !== null
          ? formatDiyCents(breakdown.ourFee.amountCents)
          : "TO BE CONFIRMED"}
        . {breakdown.ourFee.note}
      </p>
      <p>
        <strong>USCIS government fees (paid to USCIS, not to us):</strong>
      </p>
      {breakdown.governmentFees.length === 0 ? (
        <p>No government fee is listed for this form in the codebase — confirm at uscis.gov/fees.</p>
      ) : (
        <ul>
          {breakdown.governmentFees.map((line, i) => (
            <li key={i}>
              {line.label} —{" "}
              {line.amountCents !== null
                ? formatDiyCents(line.amountCents)
                : "TO BE CONFIRMED"}
              {line.locked ? " (locked)" : " (to be confirmed)"}
              {line.note ? ` — ${line.note}` : ""}
            </li>
          ))}
        </ul>
      )}
      <p>
        Our fee and government fees are shown separately and are never combined into one total —
        they are paid to different parties.
      </p>
      <p>
        {props.formCount !== undefined && props.formCount > 1
          ? `${props.formCount} forms at $25 each would be ${formatDiyCents(comparison.perFormCents)}; the DIY Bundle is ${formatDiyCents(comparison.bundleCents)}. ${comparison.note}`
          : null}
      </p>
      <p>{breakdown.feeWaiverNote}</p>
      <p>{breakdown.disclaimer}</p>
    </section>
  );
}

// --- "What happens after you file" timeline ------------------------------

export function DiyAfterFilingTimeline(props: { formCode: string }) {
  const timeline = diyAfterFilingTimeline(props.formCode);
  return (
    <section aria-label="What happens after you file">
      <h3>What happens after you file — Form {props.formCode}</h3>
      <p>{timeline.routeNote}</p>
      <ol>
        {timeline.steps.map((step, i) => (
          <li key={i}>
            <strong>{step.title}.</strong> {step.detail}
          </li>
        ))}
      </ol>
      <p>{timeline.disclaimer}</p>
    </section>
  );
}

// --- USCIS edition notice (from the DIY flow's own metadata) --------

export function DiyEditionBanner(props: { formCode: string }) {
  const meta = diyFormMeta(props.formCode);
  if (!meta) {
    return (
      <p>
        <strong>Form {props.formCode} — edition:</strong> No verified edition is stored — check
        the current edition at <a href="https://www.uscis.gov/forms">uscis.gov</a> before filing.
      </p>
    );
  }
  return (
    <p>
      <strong>Form {meta.formCode} — edition:</strong> {meta.draftNotice}. {meta.editionNote}
    </p>
  );
}

// --- Plain-language question help ----------------------------------------

export function DiyQuestionHelp(props: { formCode: string }) {
  const groups = questionGroupsForForm(props.formCode);
  if (groups.length === 0) {
    return (
      <section aria-label="Question help">
        <h3>What each question means</h3>
        <p>
          No plain-language help exists in the codebase for Form {props.formCode} yet. Read the
          official instructions at{" "}
          <a href="https://www.uscis.gov/forms">uscis.gov</a>.
        </p>
      </section>
    );
  }
  return (
    <section aria-label="Question help">
      <h3>What each question means</h3>
      {groups.map((group) => (
        <div key={group.groupId}>
          <h4>{group.groupTitle}</h4>
          <p>{group.explanation}</p>
          {group.fields.length > 0 ? (
            <ul>
              {group.fields.map((field) => (
                <li key={field.key}>
                  <strong>{field.label}</strong> — {field.explanation}
                </li>
              ))}
            </ul>
          ) : null}
          <p>
            {group.sourceLabel}. Official instructions:{" "}
            <a href={group.uscisUrl}>uscis.gov</a>.
          </p>
        </div>
      ))}
    </section>
  );
}

// --- Review upsell (optional — print works without it) --------------------

export function DiyReviewUpsell(props: {
  selected: DiyReviewOptionKey[];
  onChange: (selected: DiyReviewOptionKey[]) => void;
}) {
  const options = diyReviewOptions();
  const total = reviewAddOnTotalCents(props.selected);
  const toggle = (key: DiyReviewOptionKey) => {
    props.onChange(
      props.selected.includes(key)
        ? props.selected.filter((k) => k !== key)
        : [...props.selected, key]
    );
  };
  return (
    <section aria-label="Optional review">
      <h3>Want a second pair of eyes before you print? (Optional)</h3>
      <p>{DIY_REVIEW_UPSELL_NOTE}</p>
      <ul>
        {options.map((option) => (
          <li key={option.key}>
            <label>
              <input
                type="checkbox"
                checked={props.selected.includes(option.key)}
                onChange={() => toggle(option.key)}
              />{" "}
              {option.label} — {formatDiyCents(option.amountCents)}. {option.covers}
            </label>
          </li>
        ))}
      </ul>
      {props.selected.length > 0 ? (
        <p>Selected review add-ons: {formatDiyCents(total)} (optional — never added to the DIY fee or USCIS fees).</p>
      ) : (
        <p>No review selected — you can print without one.</p>
      )}
    </section>
  );
}

// --- Referral link after a successful print -------------------------------

export function DiyReferralAfterPrint(props: {
  referralCode: string | null;
  referrerAccountId?: string | null;
}) {
  const result = referralAfterPrint({
    referralCode: props.referralCode,
    referrerAccountId: props.referrerAccountId,
  });
  if (!result.configured) {
    return (
      <section aria-label="Refer a family">
        <h3>Refer a family</h3>
        <p>{result.emptyState}</p>
        <p>{result.rewardLabel}</p>
      </section>
    );
  }
  return (
    <section aria-label="Refer a family">
      <h3>Refer a family</h3>
      <p>
        Your referral link: <a href={result.referralUrl ?? undefined}>{result.referralUrl}</a>
      </p>
      <p>
        {result.referred} {result.referred === 1 ? "person" : "people"} referred,{" "}
        {result.becameClients} became clients (counted from real referral records only).
      </p>
      <p>{result.rewardLabel}</p>
    </section>
  );
}

// --- Saved drafts (resume list) -------------------------------------------

export function DiyDraftsList(props: {
  drafts: {
    id: string;
    formCode: string;
    answers: Record<string, string>;
    updatedAt: string;
    resumeUrl: string;
  }[];
  totalKnownFieldsByForm?: Record<string, number>;
}) {
  if (props.drafts.length === 0) {
    return (
      <section aria-label="Your saved drafts">
        <h3>Your saved drafts</h3>
        <p>No DIY drafts saved yet. Start a form and your answers are saved as you go — you can come back and resume.</p>
      </section>
    );
  }
  return (
    <section aria-label="Your saved drafts">
      <h3>Your saved drafts</h3>
      <ul>
        {props.drafts.map((draft) => {
          const summary = summarizeDraft({
            formCode: draft.formCode,
            answers: draft.answers,
            totalKnownFields: props.totalKnownFieldsByForm?.[draft.formCode] ?? null,
            lastSavedAt: draft.updatedAt,
          });
          return (
            <li key={draft.id}>
              Form {draft.formCode} — {summary.answeredCount} answers saved
              {summary.progressPercent !== null ? ` (${summary.progressPercent}% of known questions)` : ""}
              {draft.updatedAt ? ` — last saved ${new Date(draft.updatedAt).toLocaleDateString("en-US")}` : ""}{" "}
              <a href={draft.resumeUrl}>Resume</a>
            </li>
          );
        })}
      </ul>
      <p>
        Drafts never store Social Security numbers, A-Numbers, passport numbers or green card
        numbers — re-enter those on the official form itself.
      </p>
    </section>
  );
}
