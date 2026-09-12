// Ports the `.dest-card` markup shared by renderResults() (with a match %
// and "why" text) and renderExplore() (with the plain description instead)
// in wejhaty.html — same card, same two use sites, one component.
//
// Phase 10: now accepts any CatalogEntry (the 30 full destinations, or one
// of the 165 basic countries). For a basic country there's no description,
// cost/safety/climate — those chips and the description line are simply
// omitted rather than showing fabricated or "undefined" values.
import { Link } from 'react-router-dom';
import type { CatalogEntry, I18nDict, Lang, PurposeId } from '../data/types';
import { costLabel, descOf, nameOf } from '../data/destinationText';
import { continentOf, countryInfoOf } from '../data/worldCatalog';
import { FlagChip, FlagThumb } from './flags/FlagIcon';
import { Icon } from './Icon';

export function DestinationCard({
  dest,
  lang,
  t,
  matchScore,
  whyText,
  purpose,
}: {
  dest: CatalogEntry;
  lang: Lang;
  t: I18nDict;
  /** Present in Results (ranked match); never set for a basic country. */
  matchScore?: number;
  whyText?: string;
  purpose?: PurposeId;
}) {
  const fromResults = matchScore !== undefined;
  const continent = continentOf(dest);
  const subtitle = dest.recommendationReady
    ? (lang === 'ar' ? dest.citiesAr : dest.citiesEn)[0]
    : dest.capitalEn;
  // Phase 11 Step 2 — only used for the basic-country chip row below.
  const info = dest.recommendationReady ? undefined : countryInfoOf(dest.id);
  const currency = info?.currencies[0];

  return (
    <Link
      to={`/destination/${dest.id}`}
      state={{ fromResults, purpose }}
      className="dest-card"
      data-open={dest.id}
    >
      <FlagThumb dest={dest} lang={lang} continent={continent} />
      <div className="dest-body">
        <div className="dest-body-top">
          <span className="name-flag">
            <FlagChip dest={dest} width={24} height={18} />
            <h3>{nameOf(dest, lang)}</h3>
          </span>
          {matchScore !== undefined ? <span className="match-pill">{matchScore}%</span> : null}
        </div>
        <div className="dest-region">
          {t.regionLabels[continent]}
          {subtitle ? ` · ${subtitle}` : ''}
        </div>
        {dest.recommendationReady ? (
          <p className="dest-why">{whyText ?? descOf(dest, lang)}</p>
        ) : (
          <p className="dest-why">{t.detail.notRecommendationReady}</p>
        )}
        {dest.recommendationReady ? (
          <div className="dest-meta">
            <span className="meta-chip">
              <Icon name="tag" size={13} stroke={2.4} /> {costLabel(t.costLevels, dest.costLevel)}
            </span>
            <span className="meta-chip">
              <Icon name="shield" size={13} stroke={2.4} /> {dest.safety}/100
            </span>
            <span className="meta-chip">
              <Icon name="sun" size={13} stroke={2.4} /> {t.climateLabels[dest.climate]}
            </span>
          </div>
        ) : info ? (
          // Phase 11 Step 2 — compact Country Information chips (area,
          // currency) for basic countries, mirroring the chip row above.
          // Either chip is omitted cleanly when its data isn't available
          // (e.g. no reported currency) rather than showing an empty chip.
          <div className="dest-meta">
            <span className="meta-chip">
              <Icon name="globe" size={13} stroke={2.4} /> {t.detail.area}: {info.areaKm2.toLocaleString('en-US')}{' '}
              {t.detail.areaUnit}
            </span>
            {currency ? (
              <span className="meta-chip">
                <Icon name="tag" size={13} stroke={2.4} /> {t.detail.currency}: {currency.code}
                {currency.symbol ? ` (${currency.symbol})` : ''}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </Link>
  );
}
