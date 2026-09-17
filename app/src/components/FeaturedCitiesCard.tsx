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
// Acceptance item #3 added the missing half: a GENERAL DESCRIPTION above
// those facts — what the city is, what it is known for, what kind of place
// it is. It is fetched from Wikipedia by the Worker (see
// worker/src/cityDescriptions.ts), verified against the city's real
// coordinates so a namesake can never be described in its place, and
// rendered WITH its source and licence. A city with no verified article
// shows its facts alone; nothing is ever written to fill the gap.
import { useEffect, useState } from 'react';
import type { CatalogEntry, DetailStrings, Lang } from '../data/types';
import type { FeaturedCity } from '../data/featuredCities';
import { formatNumber } from '../data/format';
import { lookupCityDescriptions, type CityDescription } from '../cities/cityDescriptionClient';
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

/** The description block: the prose, then who it came from and under what
 *  licence. The attribution is not optional decoration — CC BY-SA requires
 *  it, and a traveller deserves to know whose words these are. */
function CityDescriptionBlock({ description, strings }: { description: CityDescription; strings: DetailStrings }) {
  return (
    <div className="city-description">
      <p>{description.summary}</p>
      <p className="city-description-credit">
        {strings.cityDescriptionSource.replace('{source}', description.source ?? '')}{' '}
        {description.sourceUrl ? (
          <a href={description.sourceUrl} target="_blank" rel="noreferrer">{strings.cityDescriptionReadMore}</a>
        ) : null}{' '}
        {description.licenseUrl ? (
          <a href={description.licenseUrl} target="_blank" rel="noreferrer">{description.license}</a>
        ) : description.license}
      </p>
    </div>
  );
}

export function FeaturedCitiesCard({ destination, lang, strings }: { destination: CatalogEntry; lang: Lang; strings: DetailStrings }) {
  const [cities, setCities] = useState<FeaturedCity[] | null>(null);
  const [open, setOpen] = useState(false);
  const [descriptions, setDescriptions] = useState<Map<string, CityDescription>>(new Map());
  // Acceptance fix — distinguishes "still fetching" from "fetched, and
  // this city genuinely has no verified article": the fallback message
  // below must only ever show the honest latter state, never flash while
  // the lookup is still in flight.
  const [descriptionsLoaded, setDescriptionsLoaded] = useState(false);

  // Asked for once the card is open and its city list is known — never on
  // page load, so a traveller who does not open the card costs nothing.
  useEffect(() => {
    if (!open || !cities?.length) return;
    let cancelled = false;
    void lookupCityDescriptions(
      destination.countryCode,
      // The article title is the city's English name: the Arabic Wikipedia
      // resolves it through a redirect, and it is the only name every city
      // in this data set actually has.
      cities.map((city) => ({ name: city.nameEn, title: lang === 'ar' && city.nameAr !== city.nameEn ? city.nameAr : city.nameEn })),
      lang,
    ).then((result) => {
      if (!cancelled) {
        setDescriptions(result);
        setDescriptionsLoaded(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [open, cities, destination.countryCode, lang]);

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
              {descriptions.get(city.nameEn) ? (
                <CityDescriptionBlock description={descriptions.get(city.nameEn)!} strings={strings} />
              ) : descriptionsLoaded ? (
                <p className="city-data-note">{strings.cityDescriptionUnavailable}</p>
              ) : null}
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
