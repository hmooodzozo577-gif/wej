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

export async function lookupCityDescriptions(
  countryCode: string,
  cities: { name: string; title?: string }[],
  lang: 'ar' | 'en',
): Promise<Map<string, CityDescription>> {
  const base = workerBaseUrl();
  const empty = new Map<string, CityDescription>();
  if (!base || !cities.length) return empty;

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
        result.set(description.cityName, description);
      }
    }
    return result;
  } catch {
    return empty;
  } finally {
    clearTimeout(timer);
  }
}
