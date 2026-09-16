// Item #5 — featured cities.
//
// The previous version printed one of two fixed sentences per city, chosen
// by whether it was the capital. Five cities in a country therefore read
// identically apart from the name and the population number, which is
// exactly what the user rejected.
//
// This renders per-city SOURCED FACTS instead: where the city sits
// administratively, what time zone it is in, how far and in which direction
// it is from the capital, and which airport actually serves it. Each of
// those differs city by city because it is read from data, not written from
// a template. A field with no source value is omitted rather than filled in.
//
// What is deliberately absent: "known for", "notable attractions",
// "character". No licensed offline source covers those for ~830 cities in
// this project, and inventing them is the one thing the brief rules out.
import { useState } from 'react';
import type { CatalogEntry, DetailStrings, Lang } from '../data/types';
import type { FeaturedCity } from '../data/featuredCities';
import { formatNumber } from '../data/format';
import { Icon } from './Icon';

function cityName(city: FeaturedCity, lang: Lang) {
  return lang === 'ar' ? city.nameAr : city.nameEn;
}

function sourceUrl(city: FeaturedCity) {
  return city.source === 'city-timezones'
    ? 'https://github.com/kevinroberts/city-timezones'
    : 'https://github.com/mledoze/countries';
}

/** The chip next to a city's name: what it IS in the country, said as
 *  specifically as the data supports. */
function roleLabel(city: FeaturedCity, strings: DetailStrings): string {
  if (city.capital) return strings.capitalCity;
  if (city.populationRank === 1) return strings.largestCity;
  if (city.populationRank) {
    return strings.cityPopulationRank.replace('{rank}', formatNumber(city.populationRank));
  }
  return strings.majorCity;
}

function CityFact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="city-fact">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function CityFacts({ city, strings }: { city: FeaturedCity; strings: DetailStrings }) {
  const facts: React.ReactNode[] = [];

  if (city.region) {
    facts.push(<CityFact key="region" label={strings.cityRegion}>{city.region}</CityFact>);
  }
  if (city.population) {
    facts.push(
      <CityFact key="population" label={strings.populationEstimate}>{formatNumber(city.population)}</CityFact>,
    );
  }
  if (city.fromCapital) {
    const direction = strings.cityBearings[city.fromCapital.bearing] ?? city.fromCapital.bearing;
    facts.push(
      <CityFact key="capital" label={strings.cityFromCapital}>
        {strings.cityFromCapitalValue
          .replace('{distance}', formatNumber(city.fromCapital.distanceKm))
          .replace('{unit}', strings.cityDistanceUnit)
          .replace('{direction}', direction)}
      </CityFact>,
    );
  }
  if (city.airport) {
    facts.push(
      <CityFact key="airport" label={strings.cityNearestAirport}>
        {city.airport.name} ({city.airport.iata}) — {formatNumber(city.airport.distanceKm)} {strings.cityDistanceUnit}
      </CityFact>,
    );
  }
  if (city.timezone) {
    facts.push(<CityFact key="timezone" label={strings.cityTimezone}>{city.timezone}</CityFact>);
  }

  if (!facts.length) return <p className="city-data-note">{strings.cityNoFacts}</p>;
  return <dl className="city-facts">{facts}</dl>;
}

export function FeaturedCitiesCard({ destination, lang, strings }: { destination: CatalogEntry; lang: Lang; strings: DetailStrings }) {
  const [cities, setCities] = useState<FeaturedCity[] | null>(null);
  const [open, setOpen] = useState(false);

  return (
    <details
      className="detail-card featured-cities-card"
      onToggle={(event) => {
        const isOpen = event.currentTarget.open;
        setOpen(isOpen);
        if (isOpen && !cities) {
          void import('../data/featuredCities').then((module) => setCities(module.featuredCitiesOf(destination.countryCode)));
        }
      }}
    >
      <summary className="featured-cities-heading">
        <span><Icon name="map" size={18} /> {strings.prominentCities}</span>
        <small>{open ? strings.showLess : strings.showMore}</small>
      </summary>
      {cities ? <div className="featured-cities-list">
        {cities.map((city) => (
          <details className="featured-city" key={`${city.nameEn}-${city.countryCode}`}>
            <summary>
              <strong>{cityName(city, lang)}</strong>
              <span className="meta-chip">{roleLabel(city, strings)}</span>
            </summary>
            <div className="featured-city-body">
              <CityFacts city={city} strings={strings} />
              <a href={sourceUrl(city)} target="_blank" rel="noreferrer">{strings.cityDataSource}</a>
            </div>
          </details>
        ))}
      </div> : <p className="city-data-note">{strings.loadingCities}</p>}
      <p className="city-data-note">{strings.cityFactsNote}</p>
      <p className="city-data-note">{strings.cityDataNote}</p>
    </details>
  );
}
