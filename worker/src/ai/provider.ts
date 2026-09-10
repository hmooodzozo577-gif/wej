// Phase 16 — provider resolution. This is the ONLY function index.ts
// calls to obtain an AiProvider; it is the sole place a real vendor
// adapter is ever registered.
//
// AI PROVIDER STATUS: Cloudflare Workers AI, via the native `env.AI`
// binding (wrangler.toml's `[ai] binding = "AI"`) — the provider
// decision this task made explicitly, after a full-repo audit found no
// prior vendor selection anywhere (WEJHATY_PROJECT_CONTEXT.md,
// CLAUDE.md, this Worker's own wrangler.toml/SECRETS.md, all checked
// directly). See cloudflareWorkersAiProvider.ts for the adapter itself
// and SECRETS.md's Phase 16 section for exactly what this DOES and
// does NOT require (no AI_API_KEY — a Cloudflare deployment
// authorization is a separate, unrelated concern from AI inference).
//
// `env.AI` is only actually populated once this Worker is deployed
// with the binding active — in any environment without it (including
// every unit test's plain object `Env`, and this repository's current
// real undeployed state), it is `undefined`, and resolution falls
// through to the legacy AI_PROVIDER/AI_API_KEY extension point below
// (kept for a hypothetical future non-Workers-AI vendor; nothing is
// registered there, so it still always resolves to `null` today).
// Either way, an unavailable provider is never a crash and never a
// silent fabricated fallback — see index.ts's "ai_not_configured" path.
import { createCloudflareWorkersAiProvider } from './cloudflareWorkersAiProvider';
import type { AiProvider, Env } from './types';

export function resolveAiProvider(env: Env): AiProvider | null {
  if (env.AI) return createCloudflareWorkersAiProvider(env.AI);

  if (!env.AI_API_KEY || !env.AI_PROVIDER) return null;
  // No adapter is registered for any other provider name (see the
  // module doc comment above) — a configured-but-unimplemented
  // provider name is treated the same as unconfigured: never a crash,
  // never a silent fallback to fabricated output.
  return null;
}
