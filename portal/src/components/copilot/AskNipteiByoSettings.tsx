// BYO Chat AI — Ask NIPTEI Copilot settings (per professional,
// inside their dashboard).
//  * Provider: platform OpenRouter (NOT connected — env
//    OPENROUTER_API_KEY only), or the professional's own OpenAI /
//    Anthropic / other provider key, or their own custom
//    instructions / system prompt.
//  * Model is selectable — the input starts EMPTY. There is NO
//    hardcoded model anywhere here; the founder did not choose one.
//  * Keys: encrypted at rest when Supabase is live
//    (provider_settings.encrypted_key_reference). In THIS build
//    there is no live vault, so a key typed here is held in local
//    component state only and is NEVER persisted, NEVER logged,
//    NEVER put in chat. Only the last 4 characters are kept
//    (last4() from src/lib/byo.ts) — the full key is cleared from
//    the draft the moment it is saved.
//  * Mode: off / live / human review before release (every AI
//    answer held until the professional approves it).
//  * Test goes nowhere live: it only reads /api/ask-niptei status
//    (501 "AI not configured" in this build) and reports it.
"use client";

import { useState } from "react";
import {
  COPILOT_MODE_LABELS,
  COPILOT_PROVIDERS,
  DEFAULT_COPILOT_BYO_SETTINGS,
  copilotStatusLabel,
  isCopilotAiConfigured,
  last4,
  type CopilotByoSettings,
  type CopilotMode,
  type CopilotProviderKind,
} from "@/lib/copilotByo";
import { LANGUAGES, type LanguageCode } from "@/lib/i18n";

export default function AskNipteiByoSettings(props: {
  profileLabel: string;
}) {
  const [settings, setSettings] = useState<CopilotByoSettings>(
    DEFAULT_COPILOT_BYO_SETTINGS
  );
  const [keyDraft, setKeyDraft] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  const def = COPILOT_PROVIDERS.find((p) => p.kind === settings.provider)!;

  function saveKey() {
    if (!keyDraft.trim()) {
      setNotice("Paste your API key first — it is never shown in full, never logged, never put in chat.");
      return;
    }
    // Local state ONLY in this build — nothing is persisted. Only
    // the last 4 characters are kept; the full key is cleared.
    setSettings((s) => ({
      ...s,
      status: "connected",
      keyLast4: last4(keyDraft),
      connectedAt: new Date().toISOString(),
    }));
    setKeyDraft("");
    setNotice(
      `${def.name}: saved locally only (example — no key was persisted, no live vault yet). Last 4 shown only. Choose a model below — AI stays off until a model is chosen.`
    );
  }

  function disconnect() {
    setSettings((s) => ({
      ...s,
      status: "not_connected",
      keyLast4: null,
      connectedAt: null,
      model: "",
    }));
    setKeyDraft("");
    setNotice("Disconnected (local state only). The copilot falls back to the locked FAQ / form guides.");
  }

  function toggleLanguage(code: LanguageCode) {
    setSettings((s) => ({
      ...s,
      languages: s.languages.includes(code)
        ? s.languages.filter((l) => l !== code)
        : [...s.languages, code],
    }));
  }

  async function testConnection() {
    setTesting(true);
    try {
      const res = await fetch("/api/ask-niptei");
      const data = (await res.json()) as { note?: string; status?: string };
      setNotice(
        `Test (no live AI call made): ${res.status} — ${data.status ?? "not_configured"}. ${data.note ?? "AI not configured."}`
      );
    } catch {
      setNotice("Test failed to reach /api/ask-niptei. No AI call was made.");
    } finally {
      setTesting(false);
    }
  }

  return (
    <section
      aria-labelledby="byo-copilot-heading"
      className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
    >
      <h2 id="byo-copilot-heading" className="text-lg font-semibold">
        Ask NIPTEI — Your own chat AI (BYO)
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        {props.profileLabel}. Connect YOUR OWN chat AI for your clients,
        or leave the platform default (OpenRouter — NOT connected).
        The platform never sees your key.
      </p>
      <p className="mt-2 rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900" role="status">
        Status: {copilotStatusLabel(settings)}
      </p>

      <div className="mt-3 space-y-3">
        <div>
          <label htmlFor="copilot-provider" className="text-sm font-medium">
            Chat AI provider
          </label>
          <select
            id="copilot-provider"
            value={settings.provider}
            onChange={(e) =>
              setSettings((s) => ({
                ...s,
                provider: e.target.value as CopilotProviderKind,
                status: "not_connected",
                keyLast4: null,
                connectedAt: null,
                model: "",
              }))
            }
            className="mt-1 block w-full rounded border border-slate-300 px-2 py-1 text-sm"
          >
            {COPILOT_PROVIDERS.map((p) => (
              <option key={p.kind} value={p.kind}>
                {p.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-500">{def.whatItDoes}</p>
          {def.envNames.length > 0 && (
            <p className="text-xs text-slate-500">
              Env name{def.envNames.length > 1 ? "s" : ""} only:{" "}
              {def.envNames.join(", ")} — never a key value.
            </p>
          )}
        </div>

        <div>
          <label htmlFor="copilot-key" className="text-sm font-medium">
            {def.keyLabel}
          </label>
          <div className="mt-1 flex gap-2">
            <input
              id="copilot-key"
              type="password"
              autoComplete="off"
              value={keyDraft}
              onChange={(e) => setKeyDraft(e.target.value)}
              placeholder={def.keyPlaceholder}
              className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1 text-sm"
            />
            <button
              type="button"
              onClick={saveKey}
              className="rounded bg-blue-600 px-3 py-1 text-sm font-semibold text-white"
            >
              Save key
            </button>
            {settings.status === "connected" && (
              <button
                type="button"
                onClick={disconnect}
                className="rounded border border-slate-300 px-3 py-1 text-sm"
              >
                Disconnect
              </button>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {settings.keyLast4
              ? `Connected — key shown as last-4 only: ${settings.keyLast4}. Full key is never stored, never logged, never in chat.`
              : def.notConnectedLabel}
          </p>
        </div>

        <div>
          <label htmlFor="copilot-model" className="text-sm font-medium">
            Model — you choose it (no model is pre-selected)
          </label>
          <input
            id="copilot-model"
            value={settings.model}
            onChange={(e) => setSettings((s) => ({ ...s, model: e.target.value }))}
            placeholder="Type the model name you chose — e.g. the model from your provider's list"
            className="mt-1 block w-full rounded border border-slate-300 px-2 py-1 text-sm"
          />
          <p className="mt-1 text-xs text-slate-500">
            No hardcoded model: the founder did not choose one. AI stays
            off until you enter a model name AND connect a key.
          </p>
        </div>

        <div>
          <label htmlFor="copilot-instructions" className="text-sm font-medium">
            Your custom instructions / system prompt
          </label>
          <textarea
            id="copilot-instructions"
            value={settings.customInstructions}
            onChange={(e) =>
              setSettings((s) => ({ ...s, customInstructions: e.target.value }))
            }
            rows={3}
            className="mt-1 block w-full rounded border border-slate-300 px-2 py-1 text-sm"
          />
          <p className="mt-1 text-xs text-slate-500">
            Example: “Answer in my voice, in these languages, always cite
            sources, never give legal advice.” Your instructions apply
            only to YOUR clients.
          </p>
        </div>

        <fieldset>
          <legend className="text-sm font-medium">
            Languages your copilot answers in
          </legend>
          <div className="mt-1 flex flex-wrap gap-2">
            {LANGUAGES.map((l) => (
              <label key={l.code} className="flex items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  checked={settings.languages.includes(l.code)}
                  onChange={() => toggleLanguage(l.code)}
                />
                {l.native}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-sm font-medium">Copilot mode</legend>
          <div className="mt-1 space-y-1">
            {(Object.keys(COPILOT_MODE_LABELS) as CopilotMode[]).map((m) => (
              <label key={m} className="flex items-start gap-2 text-sm">
                <input
                  type="radio"
                  name="copilot-mode"
                  checked={settings.mode === m}
                  onChange={() => setSettings((s) => ({ ...s, mode: m }))}
                />
                <span>{COPILOT_MODE_LABELS[m]}</span>
              </label>
            ))}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            “Human review before release” reuses the Ask a Law Student
            review pattern: every AI answer is held until you tick
            review and approve it.
          </p>
        </fieldset>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void testConnection()}
            disabled={testing}
            className="rounded border border-slate-300 px-3 py-1 text-sm disabled:opacity-50"
          >
            {testing ? "Testing…" : "Test connection (no live AI call)"}
          </button>
          <span className="text-xs text-slate-500 self-center">
            {isCopilotAiConfigured(settings)
              ? "AI configured for your clients (local demo — no live call made in this build)."
              : "AI not configured — copilot answers from the locked FAQ / form guides."}
          </span>
        </div>

        {notice && (
          <p role="status" className="rounded border border-blue-200 bg-blue-50 p-2 text-xs text-blue-900">
            {notice}
          </p>
        )}
      </div>
    </section>
  );
}
