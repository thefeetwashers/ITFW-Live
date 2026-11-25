// BYO Chat AI — Ask NIPTEI Copilot provider settings (per professional)
// ---------------------------------------------------------------------------
// Each professional can integrate THEIR OWN chat AI from inside their
// dashboard. The copilot uses the PLATFORM default (OpenRouter, NOT
// connected — env name only: OPENROUTER_API_KEY) unless the
// professional has connected their own — then it uses THEIRS for
// their clients, with their instructions, and the platform never
// sees their key.
//
// SECURITY (same rules as src/lib/byo.ts — do not weaken):
//  * Keys are encrypted at rest (provider_settings.
//    encrypted_key_reference when Supabase is live) — NO plaintext
//    key is ever written to the database, to a log, or to chat.
//  * The UI shows ONLY the last 4 characters (key_last4, via
//    last4() from src/lib/byo.ts). Never in full, never in logs.
//  * In this build there is no live Supabase / key vault, so a key
//    typed here is held in local component state only and is NEVER
//    persisted. When Supabase is live it goes through the
//    service-role key-vault write — never a client-side insert.
//  * Model is SELECTABLE, never hardcoded: the founder did not
//    choose a model, so there is NO default model in this code.
//    The professional types/selects the model name themselves;
//    an empty model means "no model chosen — AI stays off".
//  * The professional can turn the copilot OFF for their clients,
//    or set it to "human review before release" — every AI answer
//    is held until the professional approves it (reuse of the
//    "Ask a Law Student" review pattern: attorney/professional
//    must tick review before release).
import { last4 } from "./byo";
import { LANGUAGES, type LanguageCode } from "./i18n";

export { last4, LANGUAGES };
export type { LanguageCode };

export const PLATFORM_COPILOT_PROVIDER = "OpenRouter" as const;
export const PLATFORM_COPILOT_ENV_VAR = "OPENROUTER_API_KEY" as const;
/** No model is pre-selected — the founder did not choose one. */
export const PLATFORM_COPILOT_MODEL: string | null = null;

export type CopilotProviderKind =
  | "platform_openrouter"
  | "openai"
  | "anthropic"
  | "other";

export type CopilotMode = "off" | "live" | "human_review_before_release";

export interface CopilotProviderDef {
  kind: CopilotProviderKind;
  name: string;
  whatItDoes: string;
  /** Env names only — never a key value. */
  envNames: string[];
  keyLabel: string;
  keyPlaceholder: string;
  /** True when the model is chosen by the professional, not hardcoded. */
  modelSelectable: boolean;
  notConnectedLabel: string;
}

export const COPILOT_PROVIDERS: CopilotProviderDef[] = [
  {
    kind: "platform_openrouter",
    name: "Platform default — OpenRouter",
    whatItDoes:
      "The platform's planned provider. NOT connected in this build — env name only: OPENROUTER_API_KEY. Until a key is set AND a client is installed, the copilot answers from the locked FAQ / form guides instead and never returns a fake AI answer.",
    envNames: ["OPENROUTER_API_KEY"],
    keyLabel: "Platform OpenRouter API key (founder / admin only)",
    keyPlaceholder: "sk-or-…",
    modelSelectable: true,
    notConnectedLabel:
      "NOT CONNECTED — AI not configured. Copilot answers from the locked FAQ / form guides.",
  },
  {
    kind: "openai",
    name: "Your own OpenAI key",
    whatItDoes:
      "Use your own OpenAI account for your clients, with your own custom instructions. The platform never sees your key.",
    envNames: [],
    keyLabel: "Your OpenAI API key",
    keyPlaceholder: "sk-…",
    modelSelectable: true,
    notConnectedLabel: "NOT CONNECTED — your OpenAI key is not set.",
  },
  {
    kind: "anthropic",
    name: "Your own Anthropic key",
    whatItDoes:
      "Use your own Anthropic account for your clients, with your own custom instructions. The platform never sees your key.",
    envNames: [],
    keyLabel: "Your Anthropic API key",
    keyPlaceholder: "sk-ant-…",
    modelSelectable: true,
    notConnectedLabel: "NOT CONNECTED — your Anthropic key is not set.",
  },
  {
    kind: "other",
    name: "Your own other provider / custom endpoint",
    whatItDoes:
      "Use another chat-AI provider or your own endpoint for your clients, with your own custom instructions. The platform never sees your key.",
    envNames: [],
    keyLabel: "Your provider API key",
    keyPlaceholder: "••••",
    modelSelectable: true,
    notConnectedLabel: "NOT CONNECTED — your provider key is not set.",
  },
];

export interface CopilotByoSettings {
  provider: CopilotProviderKind;
  /** Model name the professional chose. "" = no model chosen. NEVER a hardcoded default. */
  model: string;
  /** Professional's own custom instructions / system prompt. */
  customInstructions: string;
  languages: LanguageCode[];
  mode: CopilotMode;
  /** Last 4 only — never a full key. Null when not connected. */
  keyLast4: string | null;
  status: "connected" | "not_connected";
  connectedAt: string | null;
}

export const DEFAULT_COPILOT_BYO_SETTINGS: CopilotByoSettings = {
  provider: "platform_openrouter",
  model: "",
  customInstructions:
    "Answer in my voice, in the client's language, always cite sources, never give legal advice.",
  languages: ["en", "es", "ht", "fr", "pt", "zh", "ar"],
  mode: "live",
  keyLast4: null,
  status: "not_connected",
  connectedAt: null,
};

export const COPILOT_MODE_LABELS: Record<CopilotMode, string> = {
  off: "Off — copilot is turned OFF for my clients",
  live: "Live — AI answers go straight to my clients",
  human_review_before_release:
    "Human review before release — every AI answer is held until I approve it",
};

/** AI may answer only when a provider is connected AND a model is
 *  chosen AND the mode is not off. Platform OpenRouter is never
 *  "connected" in this build (no client installed, no live call). */
export function isCopilotAiConfigured(s: CopilotByoSettings): boolean {
  if (s.mode === "off") return false;
  if (s.status !== "connected" || !s.keyLast4) return false;
  if (!s.model.trim()) return false;
  return true;
}

export function copilotStatusLabel(s: CopilotByoSettings): string {
  if (s.mode === "off") return "Copilot OFF for your clients.";
  if (!isCopilotAiConfigured(s)) {
    return s.provider === "platform_openrouter"
      ? "AI not configured — OpenRouter NOT connected (env OPENROUTER_API_KEY only). Copilot answers from the locked FAQ / form guides."
      : "AI not configured — connect your key and choose a model first. Copilot answers from the locked FAQ / form guides.";
  }
  return s.mode === "human_review_before_release"
    ? "AI configured — every answer is held for your review before release."
    : "AI configured — answers go to your clients in your voice.";
}
