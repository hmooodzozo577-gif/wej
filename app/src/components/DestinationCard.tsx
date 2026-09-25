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
import { FlagChip } from './flags/FlagIcon';
import { Icon } from './Icon';
import { formatNumber } from '../data/format';
import { DestinationImage } from './DestinationImage';
import { RECOMMENDATION_PROFILE_BY_CODE } from '../data/worldRecommendation';
import type { DestinationNavigation } from '../state/types';
import { trackEvent } from '../telemetry/productDataClient';
import { routerPath } from '../site/site';
import { FavoriteButton } from '../favorites/FavoriteButton';

export function DestinationCard({
  dest,
  lang,
  t,
  matchScore,
  whyText,
  purpose,
  navigation,
  personalScore,
  personalAria,
  favoriteControl = false,
}: {
  dest: CatalogEntry;
  lang: Lang;
  t: I18nDict;
  /** Present in Results (ranked match); never set for a basic country. */
  matchScore?: number;
  whyText?: string;
  purpose?: PurposeId;
  navigation?: DestinationNavigation;
  /** Phase 18 — the traveller's Personal Match. When present it replaces
   *  the plain match pill. The badge shows only "NN%"; `personalAria`
   *  ("التوافق معك NN%") names it for assistive technology and as a
   *  tooltip, and the surrounding page labels it. */
  personalScore?: number | null;
  personalAria?: string;
  /** v1.1 — a compact Favorite toggle over the image (Explore only). It
   *  sits beside the card link, never inside it: a button inside a link is
   *  invalid and unreachable for keyboard users. */
  favoriteControl?: boolean;
}) {
  const fromResults = matchScore !== undefined;
  const continent = continentOf(dest);
  const subtitle = dest.recommendationReady
    ? (lang === 'ar' ? dest.citiesAr : dest.citiesEn)[0]
    : dest.capitalEn;
  // Phase 11 Step 2 — only used for the basic-country chip row below.
  const info = dest.recommendationReady ? undefined : countryInfoOf(dest.id);
  const profile = RECOMMENDATION_PROFILE_BY_CODE.get(dest.countryCode);

  const card = (
    <Link
      to={`/destination/${dest.id}`}
      state={{ fromResults, purpose, navigation }}
      className={`dest-card${fromResults ? ' result-destination-card' : ''}`}
      data-open={dest.id}
      onClick={() => trackEvent('destination_opened', { source: navigation?.source ?? 'direct' }, {
        path: routerPath(window.location.pathname),
        locale: lang,
        countryCode: dest.countryCode,
      })}
    >
      <DestinationImage destination={dest} lang={lang} />
      <div className="dest-body">
        <div className="dest-body-top">
          <span className="name-flag">
            <FlagChip dest={dest} width={24} height={18} />
            <h2>{nameOf(dest, lang)}</h2>
          </span>
          {personalScore !== undefined && personalScore !== null ? (
            // Phase 18 acceptance: the badge shows only "NN%"; its meaning
            // (Personal Match) is in the accessible name and the tooltip.
            <span className="match-pill personal-pill" role="img" aria-label={personalAria} title={personalAria}>
              {personalScore}%
            </span>
          ) : matchScore !== undefined ? <span className="match-pill">{matchScore}%</span> : null}
        </div>
        <div className="dest-region">
          {t.regionLabels[continent]}
          {subtitle ? ` · ${subtitle}` : ''}
        </div>
        {fromResults ? <span className="dest-why-label">{t.results.whyTitle}</span> : null}
        <p className="dest-why">
          {dest.recommendationReady
            ? (whyText ?? descOf(dest, lang))
            : (whyText ?? (lang === 'ar'
                ? `وجهة في ${t.regionLabels[continent]}${dest.capitalEn ? `، وعاصمتها ${dest.capitalEn}` : ''}.`
                : `A destination in ${t.regionLabels[continent]}${dest.capitalEn ? `, with ${dest.capitalEn} as its capital` : ''}.`))}
        </p>
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
        ) : info && profile ? (
          // Phase 11 Step 2 — compact Country Information chips (area,
          // currency) for basic countries, mirroring the chip row above.
          // Either chip is omitted cleanly when its data isn't available
          // (e.g. no reported currency) rather than showing an empty chip.
          <div className="dest-meta">
            <span className="meta-chip">
              <Icon name="tag" size={13} stroke={2.4} /> {costLabel(t.costLevels, profile.costLevel)}
            </span>
            <span className="meta-chip"><Icon name="sun" size={13} stroke={2.4} /> {t.climateLabels[profile.climate]}</span>
            <span className="meta-chip"><Icon name="globe" size={13} stroke={2.4} /> {formatNumber(info.areaKm2)} {t.detail.areaUnit}</span>
          </div>
        ) : null}
        <span className="dest-card-cta">
          {t.results.viewDetails} <Icon name="arrowEnd" size={16} />
        </span>
      </div>
    </Link>
  );
  if (!favoriteControl) return card;
  return (
    <div className="dest-card-wrap">
      {card}
      <FavoriteButton destination={dest} lang={lang} variant="icon" />
    </div>
  );
}
