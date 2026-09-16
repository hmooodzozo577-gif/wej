// Acceptance item #3 — a GENERAL DESCRIPTION for each featured city, on top
// of the structured facts, from a real source rather than a template.
//
// WHY THIS LIVES IN THE WORKER AND NOT IN A BUILD SCRIPT
// The agent sandbox that builds this repository cannot reach Wikipedia,
// Wikidata, Wikivoyage, DBpedia or GeoNames — every one of them is refused
// at the egress proxy (403 to CONNECT). The deployed Worker has none of
// those restrictions: it runs on Cloudflare's network. So the description
// layer is a Worker service that fetches on demand and caches, not a JSON
// file baked at build time. That also gets freshness for free, which a
// baked file would not have.
//
// SOURCE AND LICENCE
// Wikipedia's official REST summary endpoint. Article text is CC BY-SA 4.0
// (plus GFDL); every description this service returns carries its source
// name, its licence, and a link to the article it came from, and the UI
// renders that attribution next to the text. This is the documented public
// API with a descriptive User-Agent, as Wikimedia's policy asks — not
// scraping, and not a prohibited source.
//
// HOW A WRONG CITY IS PREVENTED
// "Santiago", "Córdoba" and "Tripoli" name several real places. A summary is
// accepted ONLY when the article carries coordinates and those coordinates
// are within MATCH_RADIUS_KM of the city we asked about. The reference
// coordinates live in this Worker (generated/cityCoordinates.json, written
// by app/scripts/generate-featured-cities.mjs) — the browser never sends a
// coordinate of any kind. A disambiguation page, an article with no
// coordinates, or an article about a different place produces NO
// description, and the card falls back to structured facts alone.
//
// NOTHING IS EVER INVENTED. No template, no generated prose, no "one of the
// major cities of X". A city with no verified article simply has no
// description.
import cityCoordinates from './generated/cityCoordinates.json';
import type { D1DatabaseLike } from './product';

export interface CityDescriptionEnv {
  PRODUCT_DB?: D1DatabaseLike;
  /** Set to 'off' to disable outbound description fetching entirely. */
  CITY_DESCRIPTIONS?: string;
}

export const DESCRIPTION_SOURCE = 'Wikipedia';
export const DESCRIPTION_LICENSE = 'CC BY-SA 4.0';
export const DESCRIPTION_LICENSE_URL = 'https://creativecommons.org/licenses/by-sa/4.0/';
const USER_AGENT = 'WejhatyTravelApp/1.0 (https://hmooodzozo577-gif.github.io/wej/; city descriptions)';

/** How far an article's own coordinates may sit from the city we asked
 *  about before we treat it as a different place. Generous enough for a
 *  metropolitan centroid disagreement, far too tight for a namesake on
 *  another continent. */
export const MATCH_RADIUS_KM = 45;
/** Below this the "extract" is a stub, not a description. */
const MIN_SUMMARY_LENGTH = 80;
/** Descriptions are trimmed to whole sentences within this budget. */
const MAX_SUMMARY_LENGTH = 420;
const FETCH_TIMEOUT_MS = 6000;
/** A verified description is re-checked monthly; a miss is retried weekly,
 *  because articles do get written. */
const OK_TTL_DAYS = 30;
const MISS_TTL_DAYS = 7;
/** One request may not turn into an unbounded fan-out of upstream calls. */
export const MAX_CITIES_PER_REQUEST = 12;

export type CityDescriptionStatus = 'ok' | 'no_article' | 'ambiguous' | 'wrong_place' | 'too_short' | 'unavailable';

export interface CityDescription {
  cityName: string;
  countryCode: string;
  lang: 'ar' | 'en';
  status: CityDescriptionStatus;
  summary: string | null;
  source: string | null;
  sourceUrl: string | null;
  license: string | null;
  licenseUrl: string | null;
  fetchedAt: string | null;
}

const COUNTRY_RE = /^[A-Z]{2}$/;
const EARTH_RADIUS_KM = 6371;
const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

export function haversineKm(a: [number, number], b: [number, number]): number {
  const dLat = toRadians(b[0] - a[0]);
  const dLng = toRadians(b[1] - a[1]);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(toRadians(a[0])) * Math.cos(toRadians(b[0])) * sinLng * sinLng;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function normalizeCityKey(name: string): string {
  return name.toLocaleLowerCase('en').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
}

/** The reference position for a city we actually feature, or null when the
 *  city is not one of ours — which is also how an arbitrary lookup request
 *  is refused. */
export function referenceCoordinates(countryCode: string, cityName: string): [number, number] | null {
  const table = cityCoordinates as unknown as Record<string, number[]>;
  const entry = table[`${countryCode}|${normalizeCityKey(cityName)}`];
  return entry && entry.length === 2 ? [entry[0]!, entry[1]!] : null;
}

/** Cuts an extract to whole sentences inside the length budget. Never cuts
 *  mid-word and never appends an ellipsis to a sentence that was complete. */
export function trimToSentences(text: string, budget = MAX_SUMMARY_LENGTH): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= budget) return clean;
  const window = clean.slice(0, budget + 1);
  // Arabic full stop, Arabic question mark and the Latin sentence enders.
  const lastEnd = Math.max(window.lastIndexOf('. '), window.lastIndexOf('۔ '), window.lastIndexOf('؟ '), window.lastIndexOf('! '));
  if (lastEnd > budget * 0.45) return clean.slice(0, lastEnd + 1).trim();
  const lastSpace = window.lastIndexOf(' ');
  return `${clean.slice(0, lastSpace > 0 ? lastSpace : budget).trim()}…`;
}

interface WikipediaSummary {
  type?: unknown;
  title?: unknown;
  extract?: unknown;
  coordinates?: { lat?: unknown; lon?: unknown };
  content_urls?: { desktop?: { page?: unknown } };
}

/** Turns one Wikipedia summary payload into a verdict. Pure, so the whole
 *  accept/reject policy is testable without a network. */
export function evaluateSummary(
  payload: unknown,
  reference: [number, number],
): { status: CityDescriptionStatus; summary?: string; sourceUrl?: string } {
  if (!payload || typeof payload !== 'object') return { status: 'no_article' };
  const body = payload as WikipediaSummary;
  if (body.type === 'disambiguation') return { status: 'ambiguous' };
  if (body.type !== 'standard') return { status: 'no_article' };

  const lat = body.coordinates?.lat;
  const lon = body.coordinates?.lon;
  // No coordinates means no way to prove the article is about this place.
  // We would rather show facts alone than the wrong city's description.
  if (typeof lat !== 'number' || typeof lon !== 'number') return { status: 'wrong_place' };
  if (haversineKm(reference, [lat, lon]) > MATCH_RADIUS_KM) return { status: 'wrong_place' };

  const extract = typeof body.extract === 'string' ? body.extract.trim() : '';
  if (extract.length < MIN_SUMMARY_LENGTH) return { status: 'too_short' };

  const page = body.content_urls?.desktop?.page;
  return {
    status: 'ok',
    summary: trimToSentences(extract),
    sourceUrl: typeof page === 'string' ? page : undefined,
  };
}

/** Edge cache in front of the upstream call.
 *
 *  D1 is the durable cache, but it is not guaranteed to exist — and while it
 *  does not, every open of a city card would otherwise be five fresh calls to
 *  Wikipedia. Cloudflare's own cache absorbs that, costs nothing, and is
 *  polite to an API we are a guest of. It is optional everywhere: no `caches`
 *  binding (tests, a local runtime) simply means no edge cache. */
async function cachedFetch(url: string): Promise<Response | null> {
  const edge = (globalThis as { caches?: { default?: Cache } }).caches?.default;
  const request = new Request(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } });
  if (edge) {
    try {
      const hit = await edge.match(request);
      if (hit) return hit;
    } catch {
      // A cache that cannot be read is not a reason to fail the lookup.
    }
  }
  const response = await fetch(request);
  if (edge && response.ok) {
    try {
      const copy = new Response(response.clone().body, response);
      copy.headers.set('Cache-Control', `public, max-age=${OK_TTL_DAYS * 24 * 60 * 60}`);
      await edge.put(request, copy);
    } catch {
      // Same: a cache write failure is invisible to the traveller.
    }
  }
  return response;
}

async function fetchSummary(lang: 'ar' | 'en', title: string): Promise<unknown | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}?redirect=true`;
    const response = await Promise.race([
      cachedFetch(url),
      new Promise<null>((resolve) => controller.signal.addEventListener('abort', () => resolve(null))),
    ]);
    if (!response || !response.ok) return null;
    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function emptyDescription(cityName: string, countryCode: string, lang: 'ar' | 'en', status: CityDescriptionStatus): CityDescription {
  return {
    cityName, countryCode, lang, status,
    summary: null, source: null, sourceUrl: null, license: null, licenseUrl: null, fetchedAt: null,
  };
}

function rowToDescription(row: Record<string, unknown>, cityName: string, countryCode: string, lang: 'ar' | 'en'): CityDescription {
  const summary = typeof row.summary === 'string' && row.summary ? row.summary : null;
  return {
    cityName, countryCode, lang,
    status: (row.status as CityDescriptionStatus) ?? 'unavailable',
    summary,
    source: summary ? DESCRIPTION_SOURCE : null,
    sourceUrl: summary && typeof row.source_url === 'string' ? row.source_url : null,
    license: summary ? DESCRIPTION_LICENSE : null,
    licenseUrl: summary ? DESCRIPTION_LICENSE_URL : null,
    fetchedAt: typeof row.fetched_at === 'string' ? row.fetched_at : null,
  };
}

function isFresh(fetchedAt: unknown, status: unknown): boolean {
  if (typeof fetchedAt !== 'string') return false;
  const age = Date.now() - Date.parse(fetchedAt);
  if (!Number.isFinite(age) || age < 0) return false;
  const ttl = (status === 'ok' ? OK_TTL_DAYS : MISS_TTL_DAYS) * 24 * 60 * 60 * 1000;
  return age < ttl;
}

/** Resolves ONE city, cache first. Exported for tests. */
export async function resolveCityDescription(
  env: CityDescriptionEnv,
  countryCode: string,
  cityName: string,
  lang: 'ar' | 'en',
  title: string,
): Promise<CityDescription> {
  const reference = referenceCoordinates(countryCode, cityName);
  // Not one of our featured cities: this endpoint is not a general-purpose
  // Wikipedia proxy, so there is nothing to look up.
  if (!reference) return emptyDescription(cityName, countryCode, lang, 'no_article');

  const key = `${countryCode}|${normalizeCityKey(cityName)}|${lang}`;
  const db = env.PRODUCT_DB;

  if (db) {
    try {
      const cached = await db.prepare(
        'SELECT status, summary, source_url, fetched_at FROM city_descriptions WHERE city_key = ?',
      ).bind(key).first();
      if (cached && isFresh(cached.fetched_at, cached.status)) {
        return rowToDescription(cached, cityName, countryCode, lang);
      }
    } catch {
      // A missing table or an unavailable database must never break the
      // page — it just means no cache on this request.
    }
  }

  if (env.CITY_DESCRIPTIONS === 'off') return emptyDescription(cityName, countryCode, lang, 'unavailable');

  const payload = await fetchSummary(lang, title);
  if (payload === null) return emptyDescription(cityName, countryCode, lang, 'unavailable');
  const verdict = evaluateSummary(payload, reference);
  const fetchedAt = new Date().toISOString();

  if (db) {
    try {
      await db.prepare(`INSERT INTO city_descriptions
        (city_key, country_code, city_name, lang, status, summary, source, source_url, license, fetched_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(city_key) DO UPDATE SET
          status = excluded.status, summary = excluded.summary, source = excluded.source,
          source_url = excluded.source_url, license = excluded.license, fetched_at = excluded.fetched_at`)
        .bind(
          key, countryCode, cityName, lang, verdict.status,
          verdict.summary ?? null,
          verdict.status === 'ok' ? DESCRIPTION_SOURCE : null,
          verdict.sourceUrl ?? null,
          verdict.status === 'ok' ? DESCRIPTION_LICENSE : null,
          fetchedAt,
        ).run();
    } catch {
      // Cache write failures are invisible to the traveller by design.
    }
  }

  if (verdict.status !== 'ok' || !verdict.summary) {
    return emptyDescription(cityName, countryCode, lang, verdict.status);
  }
  return {
    cityName, countryCode, lang,
    status: 'ok',
    summary: verdict.summary,
    source: DESCRIPTION_SOURCE,
    sourceUrl: verdict.sourceUrl ?? null,
    license: DESCRIPTION_LICENSE,
    licenseUrl: DESCRIPTION_LICENSE_URL,
    fetchedAt,
  };
}

interface CityRequest { name: string; title?: string }

export function validateDescriptionRequest(body: unknown): { lang: 'ar' | 'en'; countryCode: string; cities: CityRequest[] } | string[] {
  const problems: string[] = [];
  if (!body || typeof body !== 'object') return ['body'];
  const input = body as Record<string, unknown>;
  const lang = input.lang === 'ar' || input.lang === 'en' ? input.lang : null;
  if (!lang) problems.push('lang');
  const countryCode = typeof input.countryCode === 'string' && COUNTRY_RE.test(input.countryCode) && input.countryCode !== 'IL'
    ? input.countryCode
    : null;
  if (!countryCode) problems.push('countryCode');
  const rawCities = Array.isArray(input.cities) ? input.cities : null;
  if (!rawCities || rawCities.length === 0 || rawCities.length > MAX_CITIES_PER_REQUEST) problems.push('cities');
  const cities: CityRequest[] = [];
  for (const entry of rawCities ?? []) {
    if (!entry || typeof entry !== 'object') { problems.push('cities'); break; }
    const city = entry as Record<string, unknown>;
    const name = typeof city.name === 'string' ? city.name.trim() : '';
    const title = typeof city.title === 'string' ? city.title.trim() : '';
    if (!name || name.length > 120 || title.length > 200) { problems.push('cities'); break; }
    cities.push(title ? { name, title } : { name });
  }
  if (problems.length > 0) return [...new Set(problems)];
  return { lang: lang!, countryCode: countryCode!, cities };
}

export async function handleCityDescriptionRequest(
  request: Request,
  env: CityDescriptionEnv,
  json: (body: unknown, status: number) => Response,
): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== '/api/cities/descriptions') return null;
  if (request.method !== 'POST') return json({ error: 'method_not_allowed', message: 'Use POST.' }, 405);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid_request', message: 'Request body must be valid JSON.' }, 400);
  }
  const validated = validateDescriptionRequest(body);
  if (Array.isArray(validated)) {
    return json({ error: 'invalid_request', message: 'Request failed validation.', fields: validated }, 400);
  }

  const { lang, countryCode, cities } = validated;
  const descriptions = await Promise.all(
    cities.map((city) => resolveCityDescription(env, countryCode, city.name, lang, city.title || city.name)),
  );
  // A 200 carrying `status: 'no_article'` is a real answer, not an error:
  // the card renders its structured facts and says nothing more.
  return json({ descriptions, attribution: { source: DESCRIPTION_SOURCE, license: DESCRIPTION_LICENSE, licenseUrl: DESCRIPTION_LICENSE_URL } }, 200);
}
