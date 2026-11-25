// BYO Integrations settings — per professional, inside their dashboard.
// Each professional connects their OWN accounts (Resend, AWS SES,
// Twilio SMS + WhatsApp, video, calendar, e-sign, storage, Google
// Cloud Translation, their own Stripe). The platform never holds their
// money or messages.
//
// SECURITY (read before changing):
//  * Keys are shown as last-4 ONLY (••••1234) — never in full, never in
//    logs, never in chat. In this build there is no live Supabase / key
//    vault, so a key typed here is held in local component state only
//    and is NEVER persisted anywhere. When Supabase is live, the key
//    goes through a service-role vault write into
//    provider_settings.encrypted_key_reference (migration 0014) —
//    NO plaintext key is ever written to the database.
//  * Every integration is labelled CONNECTED / NOT CONNECTED. Every
//    send needing a not-connected integration returns "not configured".
//  * Test-send goes ONLY to the professional's OWN email/phone, and
//    only after connect. Never to a client until connected + tested.
"use client";

import { useState } from "react";
import { BYO_PROVIDERS, last4, type ProviderConnection, type ProviderKey } from "@/lib/byo";

const INITIAL: Record<ProviderKey, ProviderConnection> = Object.fromEntries(
  BYO_PROVIDERS.map((p) => [
    p.key,
    { providerKey: p.key, status: "not_connected" as const, keyLast4: null, connectedAt: null, lastTestedAt: null, testStatus: "not_tested" as const },
  ])
) as Record<ProviderKey, ProviderConnection>;

export default function ByoSettings(props: { profileLabel: string }) {
  const [conns, setConns] = useState<Record<ProviderKey, ProviderConnection>>(INITIAL);
  const [drafts, setDrafts] = useState<Partial<Record<string, string>>>({});
  const [ownEmail, setOwnEmail] = useState("");
  const [ownPhone, setOwnPhone] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [testing, setTesting] = useState<ProviderKey | null>(null);

  function connect(key: ProviderKey) {
    const def = BYO_PROVIDERS.find((p) => p.key === key);
    if (!def) return;
    const secretField = def.connectFields.find((f) => f.secret);
    const secretValue = secretField ? (drafts[`${key}:${secretField.id}`] ?? "") : "";
    // Local state ONLY in this build — nothing is persisted, nothing is
    // logged. The secret value itself is never stored in state: only
    // its last 4 characters are kept (same rule as the database column).
    const masked = secretField && secretValue.trim() ? last4(secretValue) : null;
    setConns((c) => ({
      ...c,
      [key]: { ...c[key], status: "connected", keyLast4: masked, connectedAt: new Date().toISOString(), testStatus: "not_tested" },
    }));
    setDrafts((d) => {
      const next = { ...d };
      for (const f of def.connectFields) if (f.secret) delete next[`${key}:${f.id}`];
      return next;
    });
    setNotice(`${def.name}: saved locally only (example — no key was persisted, no live vault yet). Last 4 shown only. Test-send to your own email/phone next — never to a client until connected + tested.`);
  }

  function disconnect(key: ProviderKey) {
    setConns((c) => ({
      ...c,
      [key]: { ...c[key], status: "not_connected", keyLast4: null, connectedAt: null, lastTestedAt: null, testStatus: "not_tested" },
    }));
    setNotice("Disconnected (local state only).");
  }

  async function testSend(key: ProviderKey) {
    const def = BYO_PROVIDERS.find((p) => p.key === key);
    if (!def) return;
    const target = def.testTarget === "own_phone" ? ownPhone.trim() : ownEmail.trim();
    if (def.testTarget !== "own_account" && !target) {
      setNotice("Enter YOUR OWN email / phone first — test-send goes only to your own contact, never to a client.");
      return;
    }
    setTesting(key);
    try {
      const res = await fetch("/api/byo/test-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: key, ownEmail: ownEmail.trim() || undefined, ownPhone: ownPhone.trim() || undefined }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; status?: string };
      setNotice(`${def.name}: ${data.error ?? data.status ?? "not configured — nothing was sent."}`);
      setConns((c) => ({
        ...c,
        [key]: { ...c[key], testStatus: "not_configured", lastTestedAt: new Date().toISOString() },
      }));
    } catch {
      setNotice("Test-send failed — the route could not be reached. Nothing was sent.");
    }
    setTesting(null);
  }

  return (
    <section aria-label="Your integrations (BYO)" className="rounded-lg border border-slate-300 bg-white p-4 shadow-sm">
      <h3 className="text-base font-semibold">Your Integrations — Bring Your Own (BYO)</h3>
      <p className="mt-1 text-xs text-slate-600">
        {props.profileLabel}. Connect YOUR OWN accounts from inside this dashboard. The platform never holds your money or messages, never splits legal fees, never takes a percentage — flat subscription only.
        Keys are never shown in full — last 4 characters only — never in logs, never in chat. In this build keys are held locally only and never persisted.
      </p>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium">Your own email (for test-send only)</span>
          <input type="email" value={ownEmail} onChange={(e) => setOwnEmail(e.target.value)} placeholder="you@yourpractice.com"
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm" />
        </label>
        <label className="block text-sm">
          <span className="font-medium">Your own phone (for test-send only)</span>
          <input type="tel" value={ownPhone} onChange={(e) => setOwnPhone(e.target.value)} placeholder="+1 …"
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm" />
        </label>
      </div>
      <ul className="mt-3 space-y-3">
        {BYO_PROVIDERS.map((def) => {
          const conn = conns[def.key];
          const connected = conn.status === "connected";
          return (
            <li key={def.key} className="rounded border border-slate-200 p-3">
              <p className="text-sm font-bold">
                {def.name}{" "}
                <span className={connected ? "text-green-700" : "text-amber-700"}>
                  {connected ? "● CONNECTED" : "○ NOT CONNECTED"}
                </span>
                {connected && conn.keyLast4 && <span className="ml-2 font-mono text-xs font-normal">key {conn.keyLast4}</span>}
                {connected && <span className="ml-2 text-xs font-normal">test: {conn.testStatus}</span>}
              </p>
              <p className="mt-1 text-xs text-slate-600">{def.whatItDoes}</p>
              {!connected && <p className="mt-1 text-xs font-semibold text-amber-800">{def.notConnectedLabel}</p>}
              <div className="mt-2 space-y-1">
                {def.connectFields.map((f) => (
                  <label key={f.id} className="block text-xs">
                    <span className="font-medium">{f.label}</span>
                    <input
                      type={f.secret ? "password" : "text"}
                      autoComplete="off"
                      value={drafts[`${def.key}:${f.id}`] ?? ""}
                      onChange={(e) => setDrafts((d) => ({ ...d, [`${def.key}:${f.id}`]: e.target.value }))}
                      placeholder={f.placeholder}
                      className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-sm"
                    />
                  </label>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {!connected ? (
                  <button type="button" onClick={() => connect(def.key)} className="rounded bg-slate-900 px-3 py-1 text-xs font-semibold text-white">Connect (local only — not persisted)</button>
                ) : (
                  <>
                    <button type="button" onClick={() => testSend(def.key)} disabled={testing === def.key}
                      className="rounded bg-blue-700 px-3 py-1 text-xs font-semibold text-white disabled:opacity-50">
                      {testing === def.key ? "Testing…" : "Test-send to my own email/phone"}
                    </button>
                    <button type="button" onClick={() => disconnect(def.key)} className="rounded border border-slate-300 px-3 py-1 text-xs font-semibold">Disconnect</button>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {notice && <p role="status" className="mt-3 rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">{notice}</p>}
    </section>
  );
}
