// Acceptance item #3 — the browser side of the city description lookup.
//
// The description itself is fetched by the Worker from Wikipedia's public
// REST API (the build sandbox cannot reach Wikipedia; the deployed Worker
// can) and cached there. This module only asks, and only for the cities the
// card is actually showing.
//
// It sends a country code and city names. It sends no coordinates, no
// session identifier and nothing about the traveller — the Worker holds its
// own coordinate table to verify that an article is about the right city.
//
// Every failure resolves to "no description": the card then renders its
// structured facts alone, exactly as it does today. There is no fallback
// text, because a fallback would be invented text.
import { toLatinDigits } from '../data/format';

export interface CityDescription {
  cityName: string;
  countryCode: string;
  lang: 'ar' | 'en';
  status: 'ok' | 'no_article' | 'ambiguous' | 'wrong_place' | 'too_short' | 'unavailable';
  summary: string | null;
  source: string | null;
  sourceUrl: string | null;
  license: string | null;
  licenseUrl: string | null;
  fetchedAt: string | null;
}

function workerBaseUrl(): string | undefined {
  return import.meta.env.VITE_TRAVEL_WORKER_URL;
}

const LOOKUP_TIMEOUT_MS = 9000;
const CITY_SUMMARY_BUDGET = 280;

export function compactCitySummary(value: string): string {
  const clean = value.replace(/\s+/g, ' ').trim();
  const sentences = clean.match(/[^.!؟۔]+[.!؟۔]+(?:\s+|$)/g)?.map((sentence) => sentence.trim()) ?? [];
  const two = sentences.slice(0, 2).join(' ');
  if (two && two.length <= CITY_SUMMARY_BUDGET) return two;
  if (clean.length <= CITY_SUMMARY_BUDGET) return clean;
  const window = clean.slice(0, CITY_SUMMARY_BUDGET + 1);
  const lastSpace = window.lastIndexOf(' ');
  return `${clean.slice(0, lastSpace > 0 ? lastSpace : CITY_SUMMARY_BUDGET).trim()}…`;
}

/** Security Pass 2 (optional item) — a "read more" link is rendered only
 *  when it is an HTTPS Wikipedia article URL, which is all the Worker ever
 *  returns. Anything else (another host, another scheme, a malformed value)
 *  is dropped, so the page never links wherever an answer happens to say. */
export function safeWikipediaUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 2048) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
    return /^(?:[a-z]{2,3}(?:-[a-z]+)?\.)?(?:m\.)?wikipedia\.org$/.test(url.hostname) ? url.href : null;
  } catch {
    return null;
  }
}

/** Per-page-load memo. Reopening a city card, or coming back to a country
 *  during the same visit, must not ask again — the answer cannot have
 *  changed, and the Worker is a guest of the API behind it.
 *
 *  Only a real answer is remembered. A failed request is NOT: "we could not
 *  reach the Worker" is a temporary state, and caching it would turn one bad
 *  moment into a permanently empty card for the rest of the visit. */
const memo = new Map<string, Map<string, CityDescription>>();

/** Test seam. The memo is module state, so a suite that stubs different
 *  responses in successive cases has to be able to clear it. */
export function clearCityDescriptionMemo() {
  memo.clear();
}

export async function lookupCityDescriptions(
  countryCode: string,
  cities: { name: string; title?: string }[],
  lang: 'ar' | 'en',
): Promise<Map<string, CityDescription>> {
  const base = workerBaseUrl();
  const empty = new Map<string, CityDescription>();
  if (!base || !cities.length) return empty;

  const memoKey = `${lang}|${countryCode}|${cities.map((city) => city.name).join(',')}`;
  const remembered = memo.get(memoKey);
  if (remembered) return remembered;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);
  try {
    const response = await fetch(`${base}/api/cities/descriptions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lang, countryCode, cities: cities.slice(0, 12) }),
      signal: controller.signal,
    });
    if (!response.ok) return empty;
    const body = (await response.json()) as { descriptions?: CityDescription[] };
    const result = new Map<string, CityDescription>();
    for (const description of body.descriptions ?? []) {
      // Only a verified description is kept. Every other status means the
      // card shows facts alone, so there is nothing to store.
      if (description && description.status === 'ok' && description.summary) {
        result.set(description.cityName, {
          ...description,
          summary: compactCitySummary(toLatinDigits(description.summary)),
          sourceUrl: safeWikipediaUrl(description.sourceUrl),
        });
      }
    }
    memo.set(memoKey, result);
    return result;
  } catch {
    return empty;
  } finally {
    clearTimeout(timer);
  }
}
