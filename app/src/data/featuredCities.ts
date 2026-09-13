import featuredCitiesJson from './generated/featuredCities.json';

export interface FeaturedCity {
  nameEn: string;
  nameAr: string;
  countryCode: string;
  population: number | null;
  capital: boolean;
  source: 'city-timezones' | 'world-countries';
}

const FEATURED_CITIES = featuredCitiesJson as Record<string, FeaturedCity[]>;

export function featuredCitiesOf(countryCode: string): FeaturedCity[] {
  return FEATURED_CITIES[countryCode] ?? [];
}
