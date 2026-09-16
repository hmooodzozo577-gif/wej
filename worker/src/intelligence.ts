// Country Intelligence + Purpose Suitability — "Why this score?" detail API.
//
// WHY THIS LIVES IN THE WORKER, AND WHY IT NEEDS NEITHER D1 NOR A SECRET
// The full per-component/per-source breakdown behind a suitability score
// is deliberately kept out of the frontend bundle (task 3.15 — "does not
// bloat the frontend bundle"): app/src/data/generated/countryIntelligence
// .json (bundled into the app) carries only the compact score/confidence/
// coverage summary a "Suitable for" card needs; this Worker endpoint
// serves the full detail on demand, the same "keep the bundle light,
// fetch detail lazily" shape already used for city descriptions.
//
// Unlike city descriptions, this data is not fetched live per request —
// it is a deterministic, versioned, build-time-computed dataset (see
// app/scripts/generate-country-intelligence.mjs and app/src/intelligence/),
// bundled as a static asset with the Worker exactly like
// generated/cityCoordinates.json already is. That means this endpoint
// needs no D1 binding, no external fetch, and no secret — a lookup into
// an in-memory Map built once at module load.
import detailSnapshot from './generated/countryIntelligenceDetail.json';

const COUNTRY_RE = /^[A-Z]{2}$/;
const EXCLUDED_COUNTRIES = new Set(['IL']);

interface ComponentScore {
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

interface PurposeSuitability {
  countryCode: string;
  purpose: string;
  modelVersion: string;
  score: number | null;
  insufficientData: boolean;
  coverage: number;
  confidence: 'high' | 'medium' | 'low' | null;
  updatedAt: string;
  components: ComponentScore[];
  sources: string[];
}

const ENTRIES = detailSnapshot.entries as PurposeSuitability[];
const SOURCES = detailSnapshot.sources as Record<string, unknown>;
const VALID_PURPOSES = new Set(ENTRIES.map((entry) => entry.purpose));

const byKey = new Map<string, PurposeSuitability>();
for (const entry of ENTRIES) byKey.set(`${entry.countryCode}:${entry.purpose}`, entry);

export function lookupSuitabilityDetail(countryCode: string, purpose: string): PurposeSuitability | null {
  return byKey.get(`${countryCode}:${purpose}`) ?? null;
}

export async function handleIntelligenceRequest(
  request: Request,
  json: (body: unknown, status: number) => Response,
): Promise<Response | null> {
  const url = new URL(request.url);
  const match = /^\/api\/intelligence\/([^/]+)\/([^/]+)$/.exec(url.pathname);
  if (!match) return null;
  if (request.method !== 'GET') return json({ error: 'method_not_allowed', message: 'Use GET.' }, 405);

  const countryCode = decodeURIComponent(match[1]!).toUpperCase();
  const purpose = decodeURIComponent(match[2]!);

  if (!COUNTRY_RE.test(countryCode)) {
    return json({ error: 'invalid_request', message: 'countryCode must be a 2-letter uppercase ISO code.' }, 400);
  }
  if (EXCLUDED_COUNTRIES.has(countryCode)) {
    return json({ error: 'not_found', message: 'No intelligence data for this country.' }, 404);
  }
  if (!VALID_PURPOSES.has(purpose)) {
    return json({ error: 'invalid_request', message: 'Unknown purpose.' }, 400);
  }

  const detail = lookupSuitabilityDetail(countryCode, purpose);
  if (!detail) return json({ error: 'not_found', message: 'No intelligence data for this country/purpose.' }, 404);

  const sources = Object.fromEntries([...new Set(detail.sources)].map((id) => [id, SOURCES[id]]));
  return json({ ...detail, sources }, 200);
}
