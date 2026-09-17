// Phase 16 workstream E — the browser side of the AI explanation endpoint.
// Same shape as countryIntelligence/detailClient.ts: fetched from the
// Worker only on demand (never eagerly, never on every render/keystroke —
// E.9), every failure resolves to an honest "not available" result rather
// than throwing, and nothing traveller-identifying is ever sent (see
// buildExplanationRequest.ts for what IS sent).
import type { AIExplanationRequest, AIExplanationResult } from './types';

function workerBaseUrl(): string | undefined {
  return import.meta.env.VITE_TRAVEL_WORKER_URL;
}

const EXPLAIN_TIMEOUT_MS = 9000;
const STATUS_TIMEOUT_MS = 5000;

/** Memoized for the lifetime of the page: whether an AI provider is
 *  configured does not change mid-session, so this is checked once and
 *  reused by every "Explain with AI" entry point on the page, never
 *  re-fetched per render or per destination. */
let statusPromise: Promise<boolean> | null = null;

/** Test seam, same reasoning as clearSuitabilityDetailMemo(). */
export function clearAIStatusMemo() {
  statusPromise = null;
}

export async function checkAIStatus(): Promise<boolean> {
  const base = workerBaseUrl();
  if (!base) return false;
  if (!statusPromise) {
    statusPromise = (async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), STATUS_TIMEOUT_MS);
      try {
        const response = await fetch(`${base}/api/ai/status`, { signal: controller.signal });
        if (!response.ok) return false;
        const body = (await response.json()) as { available?: boolean };
        return body.available === true;
      } catch {
        return false;
      } finally {
        clearTimeout(timer);
      }
    })();
  }
  return statusPromise;
}

/** One-shot lookup for one request shape — the caller (AIExplanation.tsx)
 *  is responsible for only calling this from an explicit user action (a
 *  button press), never automatically, so a page view never costs an AI
 *  request on its own. */
export async function requestAIExplanation(request: AIExplanationRequest): Promise<AIExplanationResult> {
  const base = workerBaseUrl();
  if (!base) return { available: false, reason: 'not_configured' };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), EXPLAIN_TIMEOUT_MS);
  try {
    const response = await fetch(`${base}/api/ai/explain`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal: controller.signal,
    });
    if (!response.ok) return { available: false, reason: 'provider_error' };
    return (await response.json()) as AIExplanationResult;
  } catch {
    return { available: false, reason: 'network_error' };
  } finally {
    clearTimeout(timer);
  }
}
