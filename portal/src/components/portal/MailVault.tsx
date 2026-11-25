import { EXAMPLE_NOTICES, carrierTrackingUrl, daysUntil } from "@/lib/shipments";

const SLOTS: { type: string; label: string; status: string }[] = [
  { type: "uscis_receipt", label: "I-797C Receipt Notice", status: "Received — example receipt IOE0928374651" },
  { type: "biometrics", label: "Biometrics Appointment Letter", status: "Received — appointment Dec 3, 2026 (example)" },
  { type: "rfe", label: "RFE (Request for Evidence)", status: "No RFE received (example)" },
  { type: "approval", label: "Approval Notice", status: "Not yet issued (example)" },
];

export default function MailVault() {
  return (
    <section
      aria-labelledby="mail-vault-heading"
      className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
    >
      <h2 id="mail-vault-heading" className="text-base font-semibold">
        Physical Mail &amp; USCIS Receipt Proof Vault
      </h2>
      <p className="mt-1 text-xs text-slate-500">
        Countdowns are computed from stored dates, not live USCIS data.
        Carrier tracking is a link out to the carrier — no live carrier API.
      </p>

      <h3 className="mt-3 text-sm font-semibold">USCIS Notices &amp; Mail</h3>
      <ul className="mt-2 space-y-2 text-sm">
        {EXAMPLE_NOTICES.map((n) => {
          const url =
            n.carrier !== "USCIS"
              ? carrierTrackingUrl(n.carrier, n.trackingOrReceiptNumber)
              : null;
          const daysLeft = n.deadlineIso ? daysUntil(n.deadlineIso) : null;
          return (
            <li key={n.id} className="rounded border border-slate-200 px-3 py-2">
              <p className="font-medium">{n.label}</p>
              <p className="text-xs text-slate-500">
                {n.carrier}: {n.trackingOrReceiptNumber}
              </p>
              {url && (
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs underline"
                >
                  Track on {n.carrier} — link out to carrier (no live API)
                </a>
              )}
              {n.deadlineLabel && (
                <p className="text-xs font-semibold">
                  {n.deadlineLabel}
                  {daysLeft !== null &&
                    ` — ${daysLeft >= 0 ? `${daysLeft} days left` : `${-daysLeft} days ago`} (computed from stored date ${n.deadlineIso})`}
                </p>
              )}
            </li>
          );
        })}
      </ul>

      <h3 className="mt-4 text-sm font-semibold">Document Slots</h3>
      <ul className="mt-2 space-y-2 text-sm">
        {SLOTS.map((s) => (
          <li
            key={s.type}
            className="flex flex-wrap justify-between gap-2 rounded border border-slate-200 px-3 py-2"
          >
            <span className="font-medium">{s.label}</span>
            <span>{s.status}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-slate-500">
        RFE deadlines reuse the rfe_uploads concept (migration 0002): if an
        RFE arrives, its deadline slot and upload go here — no RFE is open
        in this example.
      </p>
    </section>
  );
}
