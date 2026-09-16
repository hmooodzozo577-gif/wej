// "Why this score?" — the browser side of the full suitability-detail
// lookup. The compact score/confidence/coverage summary is already bundled
// with the app (src/data/countryIntelligence.ts); this only fetches the
// full per-component/per-source breakdown, and only when a traveller
// actually opens "Why this score?" for one purpose — never eagerly.
//
// Same shape as cities/cityDescriptionClient.ts: memoized per page load,
// every failure resolves to "no detail available" (the summary card still
// works without it), and it sends nothing about the traveller — only a
// country code and a purpose id.
import type { ConfidenceLevel, SuitablePurposeId } from '../intelligence/types';

export interface SuitabilityComponent {
  factor: string;
  label: string;
  rawValue: number | null;
  normalizedValue: number | null;
  contribution: number | null;
  weight: number;
  dataYear: string | null;
  sourceId: string;
  status: 'observed' | 'missing';
}

export interface SuitabilitySource {
  id: string;
  name: string;
  provider: string;
  tier: string;
  indicatorId: string;
  url: string;
  license: string;
}

export interface SuitabilityDetail {
  countryCode: string;
  purpose: SuitablePurposeId;
  modelVersion: string;
  score: number | null;
  insufficientData: boolean;
  coverage: number;
  confidence: ConfidenceLevel | null;
  updatedAt: string;
  components: SuitabilityComponent[];
  sources: Record<string, SuitabilitySource>;
}

function workerBaseUrl(): string | undefined {
  return import.meta.env.VITE_TRAVEL_WORKER_URL;
}

const LOOKUP_TIMEOUT_MS = 9000;

const memo = new Map<string, SuitabilityDetail | null>();

/** Test seam, same reasoning as clearCityDescriptionMemo(). */
export function clearSuitabilityDetailMemo() {
  memo.clear();
}

export async function lookupSuitabilityDetail(
  countryCode: string,
  purpose: SuitablePurposeId,
): Promise<SuitabilityDetail | null> {
  const base = workerBaseUrl();
  if (!base) return null;

  const memoKey = `${countryCode}|${purpose}`;
  if (memo.has(memoKey)) return memo.get(memoKey)!;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);
  try {
    const response = await fetch(`${base}/api/intelligence/${countryCode}/${purpose}`, { signal: controller.signal });
    if (!response.ok) {
      memo.set(memoKey, null);
      return null;
    }
    const body = (await response.json()) as SuitabilityDetail;
    memo.set(memoKey, body);
    return body;
  } catch {
    // A network failure is NOT remembered — unlike a real 404/400, it may
    // succeed on a later attempt (e.g. the traveller reopens the panel).
    return null;
  } finally {
    clearTimeout(timer);
  }
}
