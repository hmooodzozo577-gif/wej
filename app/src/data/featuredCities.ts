import featuredCitiesJson from './generated/featuredCities.json';

/** Item #5 — one featured city, described by SOURCED FACTS rather than by a
 *  template sentence chosen from its type. Every optional field is genuinely
 *  optional: where the source has nothing, the UI shows nothing rather than
 *  filling the gap with prose. See scripts/generate-featured-cities.mjs for
 *  where each field comes from and what is deliberately NOT generated. */
export interface FeaturedCity {
  nameEn: string;
  nameAr: string;
  countryCode: string;
  population: number | null;
  capital: boolean;
  /** 1-based rank by source population among all of the country's known
   *  cities — not just the ones featured here. */
  populationRank: number | null;
  /** Administrative region / province, in its source spelling. Null when the
   *  source has none, or when it merely repeats the city's own name. */
  region: string | null;
  /** IANA time zone. Genuinely distinguishing in large countries. */
  timezone: string | null;
  /** Straight-line distance and eight-point compass bearing from the
   *  national capital. Null for the capital itself, for a city too close to
   *  the capital for a direction to mean anything, and whenever the
   *  capital's own position is not known precisely. */
  fromCapital: { distanceKm: number; bearing: string } | null;
  /** Nearest IATA-coded airport WITHIN THE SAME COUNTRY, when one is close
   *  enough to be a fact about this city. Never a cross-border airport. */
  airport: { iata: string; name: string; distanceKm: number } | null;
  source: 'city-timezones' | 'world-countries';
}

const FEATURED_CITIES = featuredCitiesJson as Record<string, FeaturedCity[]>;

export function featuredCitiesOf(countryCode: string): FeaturedCity[] {
  return FEATURED_CITIES[countryCode] ?? [];
}

/** True when a city has at least one fact beyond its name — used to decide
 *  between showing facts and saying plainly that there are none. */
export function hasCityFacts(city: FeaturedCity): boolean {
  return !!(city.region || city.timezone || city.fromCapital || city.airport || city.population);
}
