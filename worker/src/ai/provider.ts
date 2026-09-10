// Phase 16 — provider resolution. This is the ONLY function index.ts
// calls to obtain an AiProvider; it is the sole place a real vendor
// adapter would ever be registered.
//
// AI PROVIDER STATUS (checked directly, not assumed): no AI provider
// has been selected anywhere in this repository — grepped for every
// major vendor name across every genuine project document
// (WEJHATY_PROJECT_CONTEXT.md, CLAUDE.md, this Worker's own
// wrangler.toml/SECRETS.md) and found none. Per this task's own rule
// ("do NOT silently choose an AI vendor... do NOT fabricate a key"),
// no vendor was picked here either. `env.AI_API_KEY` is therefore
// never set in this repository — resolveAiProvider() always returns
// `null` today, and every AI endpoint responds with a clear
// "not configured" result (see index.ts) rather than ever pretending
// to call a live model.
//
// Once a provider IS selected: add one adapter file here (e.g.
// `anthropicProvider.ts`) implementing `AiProvider` from ./types
// (interpretPreferences/explainRecommendation), using
// ai/prompts.ts's system/user split and this project's fetchWithTimeout
// convention (see amadeus.ts), and register it below keyed by
// `env.AI_PROVIDER`. No other file needs to change — index.ts and the
// frontend already speak only the provider-neutral contract.
import type { AiProvider, Env } from './types';

export function resolveAiProvider(env: Env): AiProvider | null {
  if (!env.AI_API_KEY || !env.AI_PROVIDER) return null;
  // No adapter is registered for any provider name today (see the
  // module doc comment above) — a configured-but-unimplemented
  // provider name is treated the same as unconfigured: never a crash,
  // never a silent fallback to fabricated output.
  return null;
}
