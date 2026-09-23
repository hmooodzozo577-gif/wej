// Ports renderDetail() from wejhaty.html.
//
// Looks up the id in the full effective WORLD_CATALOG (194 after the explicit
// IL exclusion). The original 30 destinations retain their editorial cards;
// every other country gets a factual overview assembled from sourced catalog
// and country-information fields plus its worldwide recommendation profile.
import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAppState, useI18n } from '../state/hooks';
import { WORLD_CATALOG, continentOf, countryInfoOf, resolvedBordersOf } from '../data/worldCatalog';
import {
  citiesOf,
  costLabel,
  descOf,
  langOf,
  livingCostOf,
  nameOf,
  strengthsOf,
  weaknessesOf,
} from '../data/destinationText';
import type {
  CatalogEntry,
  CountryInfo,
  DetailStrings,
  Lang,
  PurposeId,
} from '../data/types';
import { formatNumber } from '../data/format';
import { AccommodationInfo } from '../components/AccommodationInfo';
import { DestinationHero } from '../components/DestinationHero';
import { HeroNavButton } from '../components/DestinationHeroNav';
import { DestinationRating } from '../components/DestinationRating';
import { heroNavTargets } from '../components/heroNavTargets';
import { FlagChip } from '../components/flags/FlagIcon';
import { Icon } from '../components/Icon';
import { FeaturedCitiesCard } from '../components/FeaturedCitiesCard';
import { FeedbackDialog } from '../components/FeedbackDialog';
import { TravelCostIndexInfo } from '../components/TravelCostIndexInfo';
import { TourismInsights } from '../components/TourismInsights';
import { TravelInfo } from '../components/TravelInfo';
import { CountrySuitability } from '../components/CountrySuitability';
import { regionGradientCss } from '../components/regionGradient';
import { buildWhyText } from '../engine';
import { RECOMMENDATION_PROFILE_BY_CODE } from '../data/worldRecommendation';
import type { DestinationNavigation } from '../state/types';
import { usePersonalization } from '../personalization/usePersonalization';
import { computePersonalMatch } from '../personalization/personalMatch';
import { PersonalMatchSection } from '../personalization/PersonalMatchSection';
import { PERSONAL_COPY } from '../personalization/copy';

// Phase 11 Step 1 — compact, build-time Country Information card. Shared by
// both the basic-country branch and the full-destination branch below, so
// all 195 catalog entries get it identically. Omits any row whose data is
// empty (e.g. no reported currency, no land border) instead of showing a
// blank value.
function CountryInfoCard({
  info,
  borders,
  dt,
  lang,
}: {
  info: CountryInfo;
  /** Phase 11 Step 3 — resolved via resolvedBordersOf(), already filtered to
   *  real, navigable, non-self, non-duplicate catalog entries. */
  borders: CatalogEntry[];
  dt: DetailStrings;
  lang: Lang;
}) {
  const currencyText = info.currencies
    .map((c) => (c.symbol ? `${c.name} (${c.symbol})` : c.name))
    .join(' · ');
  const languagesText = info.languagesEn.join(' · ');

  return (
    <div className="detail-card destination-section country-info-section">
      <h3>
        <Icon name="globe" size={18} /> {dt.countryInfo}
      </h3>
      <div className="info-grid">
        <div className="info-item">
          <div className="label">{dt.officialName}</div>
          <div className="value">{lang === 'ar' ? info.officialNameAr : info.officialNameEn}</div>
        </div>
        <div className="info-item">
          <div className="label">{dt.area}</div>
          <div className="value">
            {formatNumber(info.areaKm2)} {dt.areaUnit}
          </div>
        </div>
        {currencyText ? (
          <div className="info-item">
            <div className="label">{dt.currency}</div>
            <div className="value">{currencyText}</div>
          </div>
        ) : null}
        {languagesText ? (
          <div className="info-item">
            <div className="label">{dt.languages}</div>
            <div className="value">{languagesText}</div>
          </div>
        ) : null}
        <div className="info-item">
          <div className="label">{dt.callingCode}</div>
          <div className="value">{info.callingCode}</div>
        </div>
        {borders.length ? (
          <div className="info-item">
            <div className="label">{dt.borders}</div>
            <div className="dest-meta">
              {borders.map((b) => (
                <Link key={b.id} to={`/destination/${b.id}`} className="meta-chip">
                  <FlagChip dest={b} width={16} height={12} /> {nameOf(b, lang)}
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function OptionalPlanningInfo({
  destination,
  dt,
}: {
  destination: CatalogEntry;
  dt: DetailStrings;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="optional-info">
      <button
        type="button"
        className="btn btn-ghost optional-info-toggle"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Icon name="map" size={16} /> {open ? dt.hideAdditionalInfo : dt.showAdditionalInfo}
      </button>
      {open ? (
        <section aria-label={dt.additionalInfoTitle} className="info-cards-container">
          <div className="info-cards-grid">
            <TravelInfo destination={destination} />
            <AccommodationInfo destination={destination} />
            <TravelCostIndexInfo destination={destination} />
            <TourismInsights destination={destination} />
          </div>
        </section>
      ) : null}
    </div>
  );
}


/** Item #3 — what remains of the below-hero pager: the surprise-context
 *  return link only. Previous/next now live inside the hero image itself
 *  (components/DestinationHeroNav.tsx); a surprise result has no ordered
 *  siblings to page through, so it keeps its single centered link back to
 *  the surprise experience — unchanged behavior, unchanged wording. */
function SurprisePager({
  navigation,
  surpriseLabel,
}: {
  navigation: DestinationNavigation | null;
  surpriseLabel: string;
}) {
  if (navigation?.source !== 'surprise') return null;
  return (
    <nav className="destination-pager destination-pager-surprise" aria-label={surpriseLabel}>
      <Link className="destination-pager-link" to="/explore">
        <small><Icon name="sparkle" size={14} /> {surpriseLabel}</small>
      </Link>
    </nav>
  );
}

/** The pair of hero-edge controls for a destination, or nothing when the
 *  current navigation context has no siblings (a surprise result, a single
 *  -entry list, or an id that is not in the preserved list at all). */
function HeroEdgeControls({
  current,
  navigation,
  lang,
  previousLabel,
  nextLabel,
}: {
  current: CatalogEntry;
  navigation: DestinationNavigation | null;
  lang: Lang;
  previousLabel: string;
  nextLabel: string;
}) {
  const { previous, next } = heroNavTargets(current, navigation, WORLD_CATALOG);
  if (!previous && !next) return null;
  return (
    <>
      {previous ? <HeroNavButton target={previous} direction="previous" label={previousLabel} lang={lang} /> : null}
      {next ? <HeroNavButton target={next} direction="next" label={nextLabel} lang={lang} /> : null}
    </>
  );
}

export function Destination() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { state, dispatch } = useAppState();
  const { lang, t } = useI18n();
  const routeState = location.state as { fromResults?: boolean; purpose?: PurposeId; navigation?: DestinationNavigation } | null;
  const { preferences } = usePersonalization();

  const d = WORLD_CATALOG.find((x) => x.id === id);
  if (!d) {
    return (
      <div className="container" style={{ padding: '60px 0' }}>
        Not found
      </div>
    );
  }

  const dt = t.detail;
  const continent = continentOf(d);
  const info = countryInfoOf(d.id);
  const borders = resolvedBordersOf(d.id);
  const profile = RECOMMENDATION_PROFILE_BY_CODE.get(d.countryCode);
  const directIds = [...WORLD_CATALOG]
    .sort((a, b) => nameOf(a, lang).localeCompare(nameOf(b, lang), lang === 'ar' ? 'ar' : 'en'))
    .map((country) => country.id);
  const navigation = routeState?.navigation ?? { source: 'explore' as const, ids: directIds, index: directIds.indexOf(d.id) };
  const fromResults = !!(routeState?.fromResults && state.results);
  const resultItem = fromResults ? state.results!.find((result) => result.dest.id === d.id) : undefined;
  const matchScore = resultItem?.score ?? null;
  // Phase 18 — with a saved profile, the Personal Match section is the one
  // explanation shown; the Phase 14 text remains only as the fallback for a
  // results visit without a usable profile.
  const personal = preferences ? computePersonalMatch(d, preferences, { origin: state.location.coords }) : null;
  const why = !personal && resultItem && state.purpose ? buildWhyText(lang, state.purpose, resultItem.reasons, d, resultItem.score, state.answers) : null;
  const pc = PERSONAL_COPY[lang];
  // The chip names the measure beside the number ("التوافق معك 91%"); the
  // number itself is only "NN%", direction-isolated after Arabic text.
  const heroChip = personal && personal.score !== null && personal.eligible
    ? (
      <div className="detail-match detail-match-personal" role="img" aria-label={pc.scoreAria(personal.score)}>
        <span className="detail-match-label">{pc.personalMatch}</span> <b dir="ltr">{personal.score}%</b>
      </div>
    )
    : null;

  const goBackBasic = () => navigate(fromResults ? '/results' : '/explore');
  const startAgain = () => {
    dispatch({ type: 'RESTART_ALL' });
    navigate('/purpose');
  };

  // --- Country without the original editorial profile: sourced factual state ---
  if (!d.recommendationReady) {
    return (
      <div className="detail-wrap destination-page">
        <div className="container">
          <section className="destination-opening" aria-labelledby="destination-title">
          <div className="back-row destination-opening-actions">
            <button type="button" className="btn btn-ghost btn-sm" onClick={goBackBasic}>
              <Icon name="arrowStart" size={16} /> {t.results.exploreAll}
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={startAgain}>
              <Icon name="sparkle" size={15} /> {dt.startAgain}
            </button>
            <FeedbackDialog lang={lang} strings={t.feedback} countryCode={d.countryCode} />
          </div>

          <DestinationHero
            d={d}
            fallbackBackground={regionGradientCss(continent)}
            subContent={t.regionLabels[continent]}
            rightContent={
              heroChip ?? (
                <div className="detail-match detail-match-browse">
                  {matchScore !== null ? `${matchScore}% ${t.results.match}` : dt.browse}
                </div>
              )
            }
            edgeControls={
              <HeroEdgeControls current={d} navigation={navigation} lang={lang} previousLabel={dt.previousCountry} nextLabel={dt.nextCountry} />
            }
          />
          <SurprisePager navigation={navigation} surpriseLabel={dt.surpriseAgain} />
          </section>

          {/* Visual refinement pass: two-zone layout. First (now narrow,
              see .detail-grid's 1fr/2fr override in wejhaty.css) column
              is the destination IDENTITY sidebar — country facts (the
              landmark image, when one exists, now lives in the Hero
              above instead — see DestinationHero.tsx). Second (now wide)
              column is MAIN — the simple overview a basic country gets,
              plus the compact Travel/Accommodation/Travel Cost row and
              Tourism Insights, nested here rather than as a separate
              full-width section below the whole grid. */}
          <div className="detail-grid destination-content-grid">
            <aside className="destination-facts" aria-label={dt.countryInfo}>
              <div className="detail-card destination-section destination-facts-summary">
                <div className="info-grid">
                  <div className="info-item">
                    <div className="label">{dt.region}</div>
                    <div className="value">{t.regionLabels[continent]}</div>
                  </div>
                  {d.capitalEn ? (
                    <div className="info-item">
                      <div className="label">{dt.capital}</div>
                      <div className="value">{d.capitalEn}</div>
                    </div>
                  ) : null}
                </div>
              </div>
              {info ? <CountryInfoCard info={info} borders={borders} dt={dt} lang={lang} /> : null}
              <FeaturedCitiesCard destination={d} lang={lang} strings={dt} />
            </aside>
            <div className="destination-narrative">
              <PersonalMatchSection destination={d} match={personal} />
              {why || profile ? (
                <div className="detail-card destination-section overview-card">
                  <h3>
                    <Icon name="info" size={18} /> {dt.overview}
                  </h3>
                  {why ? <p>{why}</p> : null}
                  {profile ? (
                    <div className="info-grid">
                      <div className="info-item"><div className="label">{t.results.cost}</div><div className="value">{costLabel(t.costLevels, profile.costLevel)}</div></div>
                      <div className="info-item"><div className="label">{t.results.climate}</div><div className="value">{t.climateLabels[profile.climate]}</div></div>
                      <div className="info-item"><div className="label">{lang === 'ar' ? 'تغطية البيانات المباشرة' : 'Direct data coverage'}</div><div className="value">{formatNumber(profile.dataCoverage)}%</div></div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {/* Acceptance fix — "Suitable for" is primary decision-support
                  information; "Additional information" below is secondary
                  detail, so it renders ABOVE that collapsed toggle instead
                  of inside it. */}
              <CountrySuitability destination={d} />

              <OptionalPlanningInfo destination={d} dt={dt} />

              {/* Item #13B — usable from every entry path (recommendations,
                  Explore, a surprise result, a direct link). */}
              <DestinationRating destination={d} navigation={navigation} lang={lang} strings={t.destinationRating} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- Full destination: unchanged from before Phase 10 ---
  const cities = citiesOf(d, lang).join(' · ');
  const goBack = () => navigate(fromResults ? '/results' : '/explore');

  return (
    <div className="detail-wrap destination-page">
      <div className="container">
        <section className="destination-opening" aria-labelledby="destination-title">
        <div className="back-row destination-opening-actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={goBack}>
            <Icon name="arrowStart" size={16} /> {fromResults ? dt.back : t.results.exploreAll}
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={startAgain}>
            <Icon name="sparkle" size={15} /> {dt.startAgain}
          </button>
          <FeedbackDialog lang={lang} strings={t.feedback} countryCode={d.countryCode} />
        </div>

        <DestinationHero
          d={d}
          fallbackBackground={regionGradientCss(d.region)}
          subContent={
            <>
              {t.regionLabels[d.region]} · {cities}
            </>
          }
          rightContent={
            heroChip ?? (matchScore !== null ? (
              <div className="detail-match">
                {matchScore}% {dt.match}
              </div>
            ) : (
              <div className="detail-match detail-match-browse">
                {dt.browse}
              </div>
            ))
          }
          edgeControls={
            <HeroEdgeControls current={d} navigation={navigation} lang={lang} previousLabel={dt.previousCountry} nextLabel={dt.nextCountry} />
          }
        />
        <SurprisePager navigation={navigation} surpriseLabel={dt.surpriseAgain} />
        </section>

        {/* Visual refinement pass: two-zone layout. First (now narrow,
            see .detail-grid's 1fr/2fr override in wejhaty.css) column is
            the destination IDENTITY sidebar — quick facts, cities,
            country info (the landmark image, when one exists, now lives
            in the Hero above instead — see DestinationHero.tsx). Second
            (now wide) column is MAIN — overview/why/strengths/
            weaknesses/best-for, plus the compact Travel/Accommodation/
            Travel Cost row and Tourism Insights, nested here rather than
            as a separate full-width section below the whole grid. */}
        <div className="detail-grid destination-content-grid">
          <aside className="destination-facts" aria-label={dt.countryInfo}>
            <div className="detail-card destination-section destination-facts-summary">
              <div className="info-grid">
                <div className="info-item">
                  <div className="label">{dt.cost}</div>
                  <div className="value">{costLabel(t.costLevels, d.costLevel)}</div>
                </div>
                <div className="info-item">
                  <div className="label">{dt.safety}</div>
                  <div className="value">{d.safety}/100</div>
                </div>
                <div className="info-item">
                  <div className="label">{dt.climateL}</div>
                  <div className="value">{t.climateLabels[d.climate]}</div>
                </div>
                <div className="info-item">
                  <div className="label">{dt.visa}</div>
                  <div className="city-data-note">{dt.visaGeneralNote}</div>
                </div>
                <div className="info-item">
                  <div className="label">{dt.language}</div>
                  <div className="value">{langOf(d, lang)}</div>
                </div>
                <div className="info-item">
                  <div className="label">{dt.livingCost}</div>
                  <div className="value">{livingCostOf(d, lang)}</div>
                </div>
              </div>
            </div>
            <FeaturedCitiesCard destination={d} lang={lang} strings={dt} />
            {info ? <CountryInfoCard info={info} borders={borders} dt={dt} lang={lang} /> : null}
          </aside>
          <div className="destination-narrative">
            <PersonalMatchSection destination={d} match={personal} />
            {/* A personalized match explanation is semantically different
                from the general editorial overview, so it stays full-width
                above the calmer information layout when present. */}
            {why ? (
              <div className="detail-card destination-section why-box">
                <h3>
                  <Icon name="bulb" size={18} /> {dt.why}
                </h3>
                <p>{why}</p>
              </div>
            ) : null}
            {/* Overview spans the reading measure, followed by parallel
                strengths and cautions. The old duplicate "Best suited for"
                summary is intentionally absent; CountrySuitability below is
                the single source for that decision-support information. */}
            <div className="overview-cards-grid">
              <div className="detail-card destination-section overview-card">
                <h3>
                  <Icon name="info" size={18} /> {dt.overview}
                </h3>
                <p>{descOf(d, lang)}</p>
              </div>
              <div className="detail-card destination-section strengths-card">
                <h3>
                  <Icon name="check" size={18} /> {dt.strengths}
                </h3>
                <div className="pill-list">
                  {strengthsOf(d, lang).map((s) => (
                    <span className="pill good" key={s}>
                      <Icon name="check" size={13} stroke={2.6} /> {s}
                    </span>
                  ))}
                </div>
              </div>
              <div className="detail-card destination-section weaknesses-card">
                <h3>
                  <Icon name="info" size={18} /> {dt.weaknesses}
                </h3>
                <div className="pill-list">
                  {weaknessesOf(d, lang).map((s) => (
                    <span className="pill warn" key={s}>
                      <Icon name="info" size={13} stroke={2.6} /> {s}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Acceptance fix — "Suitable for" is primary decision-support
                information; "Additional information" below is secondary
                detail, so it renders ABOVE that collapsed toggle instead
                of inside it. */}
            <CountrySuitability destination={d} />

            <OptionalPlanningInfo destination={d} dt={dt} />

            {/* Item #13B — usable from every entry path (recommendations,
                Explore, a surprise result, a direct link). */}
            <DestinationRating destination={d} navigation={navigation} lang={lang} strings={t.destinationRating} />
          </div>
        </div>
      </div>
    </div>
  );
}
