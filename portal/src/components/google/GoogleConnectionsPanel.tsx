// Google Connections — professional dashboard panel (client component).
// Shows Google Calendar / Drive / Gmail with connect buttons, scope
// lists, and honest "Not connected" states. No Google product is
// connected in this build (Google Cloud OAuth setup not done), and
// the panel says so — it never claims a connection. The professional
// can also record their OWN Google email + phone here (their own
// contact details, from their profile — never scraped).
"use client";

import { useEffect, useState } from "react";
import {
  GOOGLE_PRODUCTS,
  GOOGLE_SETUP_NOT_DONE_NOTE,
  googleConnectionLabel,
  type GoogleConnection,
  type GoogleProduct,
} from "@/lib/googleIntegrations";

export default function GoogleConnectionsPanel({
  accountId,
  profileId,
}: {
  accountId: string;
  profileId: string;
}) {
  const [connections, setConnections] = useState<GoogleConnection[] | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [googleEmail, setGoogleEmail] = useState("");
  const [googlePhone, setGooglePhone] = useState("");
  const [contactSaved, setContactSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `/api/google-connections?accountId=${encodeURIComponent(accountId)}`
        );
        const data = (await res.json()) as {
          connections?: GoogleConnection[];
          note?: string;
        };
        if (!cancelled && data.connections) setConnections(data.connections);
        if (!cancelled && data.note) setNote(data.note);
      } catch {
        if (!cancelled) setNote(GOOGLE_SETUP_NOT_DONE_NOTE);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accountId]);

  const requestConnect = async (product: GoogleProduct) => {
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch("/api/google-connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "connect", product, accountId }),
      });
      const data = (await res.json()) as { error?: string };
      setNote(
        data.error ??
          "Google is not connected — Google Cloud OAuth setup is not done yet."
      );
    } catch {
      setNote("Could not reach the server. Nothing was connected.");
    } finally {
      setBusy(false);
    }
  };

  const saveContact = async () => {
    setBusy(true);
    setContactSaved(false);
    setNote(null);
    try {
      const res = await fetch("/api/google-connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save_contact", profileId, googleEmail, googlePhone }),
      });
      const data = (await res.json()) as { error?: string; ok?: boolean };
      if (res.ok && data.ok) {
        setContactSaved(true);
      } else {
        setNote(data.error ?? "Your Google contact details could not be saved.");
      }
    } catch {
      setNote("Could not reach the server. Nothing was saved.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      aria-labelledby="google-connections-heading"
      className="rounded-lg border border-slate-300 bg-white p-4 shadow-sm"
    >
      <h2 id="google-connections-heading" className="text-lg font-semibold">
        Google Calendar, Drive &amp; Gmail
      </h2>
      <p className="mt-1 text-sm text-slate-700">
        Connect YOUR Google account — the platform never holds a shared
        Google account, and your Google password is never stored (OAuth
        only). Google Cloud OAuth setup is not done yet, so every product
        below shows “Not connected” until the founder finishes it.
      </p>
      <ul className="mt-3 space-y-3">
        {GOOGLE_PRODUCTS.map((p) => {
          const conn =
            connections?.find((c) => c.product === p.product) ?? null;
          const label = conn
            ? googleConnectionLabel(conn)
            : p.notConnectedLabel;
          const connected = conn?.status === "connected" && !!conn.connectedAt;
          return (
            <li key={p.product} className="rounded border border-slate-200 p-3">
              <p className="font-medium">{p.name}</p>
              <p className="mt-1 text-sm text-slate-700">{p.whatItDoes}</p>
              <p className="mt-1 text-sm">
                <span className="font-medium">Scopes needed: </span>
                {p.scopes.join(", ")}
              </p>
              <p className="text-sm text-slate-600">
                {p.scopePlainEnglish.join(" · ")}
              </p>
              <p className="mt-1 text-sm font-medium">{label}</p>
              <button
                type="button"
                disabled={connected || busy}
                onClick={() => void requestConnect(p.product)}
                className="mt-2 rounded bg-blue-700 px-3 py-1 text-sm font-medium text-white disabled:opacity-50"
              >
                {connected ? "Connected" : `Connect ${p.name}`}
              </button>
            </li>
          );
        })}
      </ul>

      <h3 className="mt-4 font-semibold">Your Google contact details</h3>
      <p className="mt-1 text-sm text-slate-700">
        Your own Google email address and phone number, for your profile.
        Entered by you — never scraped.
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <label className="text-sm">
          Google email{" "}
          <input
            type="email"
            value={googleEmail}
            onChange={(e) => setGoogleEmail(e.target.value)}
            placeholder="you@gmail.com"
            className="rounded border border-slate-300 px-2 py-1"
          />
        </label>
        <label className="text-sm">
          Phone{" "}
          <input
            type="tel"
            value={googlePhone}
            onChange={(e) => setGooglePhone(e.target.value)}
            placeholder="+1 …"
            className="rounded border border-slate-300 px-2 py-1"
          />
        </label>
        <button
          type="button"
          disabled={busy}
          onClick={() => void saveContact()}
          className="rounded bg-blue-700 px-3 py-1 text-sm font-medium text-white disabled:opacity-50"
        >
          Save contact details
        </button>
      </div>
      {contactSaved ? (
        <p className="mt-2 text-sm font-medium text-green-800">
          Your Google contact details were saved.
        </p>
      ) : null}
      {note ? (
        <p className="mt-3 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          {note}
        </p>
      ) : null}
    </section>
  );
}
