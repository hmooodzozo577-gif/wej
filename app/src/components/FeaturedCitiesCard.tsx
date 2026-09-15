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
              <span className="meta-chip">{city.capital ? strings.capitalCity : strings.majorCity}</span>
            </summary>
            <div className="featured-city-body">
              <p>{city.capital ? strings.capitalCityDescription : strings.majorCityDescription}</p>
              <p>{city.capital ? strings.capitalCityBestFor : strings.majorCityBestFor}</p>
              {city.population ? (
                <p><strong>{strings.populationEstimate}:</strong> {formatNumber(city.population)}</p>
              ) : null}
              <a href={sourceUrl(city)} target="_blank" rel="noreferrer">{strings.cityDataSource}</a>
            </div>
          </details>
        ))}
      </div> : <p className="city-data-note">{strings.loadingCities}</p>}
      <p className="city-data-note">{strings.cityDataNote}</p>
    </details>
  );
}
