// Ports renderDetail() from wejhaty.html.
//
// Phase 10: looks up the id in the full WORLD_CATALOG (195) instead of just
// DESTINATIONS (30). The 30 existing destinations render through the exact
// same code path as before (untouched). A basic country (one of the 165)
// renders a smaller, honest detail view — flag, name, continent, capital —
// instead of fabricating an overview/strengths/cost/etc. it doesn't have.
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
  Destination as DestinationType,
  DetailStrings,
  Lang,
  PurposeId,
} from '../data/types';
import { AccommodationInfo } from '../components/AccommodationInfo';
import { DestinationHero } from '../components/DestinationHero';
import { FlagChip } from '../components/flags/FlagIcon';
import { Icon } from '../components/Icon';
import { TravelCostIndexInfo } from '../components/TravelCostIndexInfo';
import { TourismInsights } from '../components/TourismInsights';
import { TravelInfo } from '../components/TravelInfo';
import { regionGradientCss } from '../components/regionGradient';
import { buildWhyText } from '../engine';

// Same 7-purpose "best suited for" ranking as the original (excludes "other").
const PURPOSE_SCORE_KEYS: [PurposeId, keyof DestinationType][] = [
  ['tourism', 'pTourism'],
  ['work', 'pWork'],
  ['education', 'pEdu'],
  ['medical', 'pMed'],
  ['immigration', 'pImmi'],
  ['investment', 'pInvest'],
  ['wellness', 'pWellness'],
];

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
    <div className="detail-card">
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
            {info.areaKm2.toLocaleString('en-US')} {dt.areaUnit}
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

export function Destination() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { state, dispatch } = useAppState();
  const { lang, t } = useI18n();

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

  const goBackBasic = () => navigate('/explore');
  const startAgain = () => {
    dispatch({ type: 'RESTART_ALL' });
    navigate('/purpose');
  };

  // --- Basic country (not yet recommendation-ready): graceful, honest state ---
  if (!d.recommendationReady) {
    return (
      <div className="detail-wrap">
        <div className="container">
          <div className="back-row">
            <button type="button" className="btn btn-ghost btn-sm" onClick={goBackBasic}>
              <Icon name="arrowStart" size={16} /> {t.results.exploreAll}
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={startAgain}>
              <Icon name="sparkle" size={15} /> {dt.startAgain}
            </button>
          </div>

          <DestinationHero
            d={d}
            fallbackBackground={regionGradientCss(continent)}
            subContent={t.regionLabels[continent]}
            rightContent={
              <div className="detail-match" style={{ background: 'rgba(255,255,255,0.16)', color: '#fff' }}>
                {dt.browse}
              </div>
            }
          />

          {/* Visual refinement pass: two-zone layout. First (now narrow,
              see .detail-grid's 1fr/2fr override in wejhaty.css) column
              is the destination IDENTITY sidebar — country facts (the
              landmark image, when one exists, now lives in the Hero
              above instead — see DestinationHero.tsx). Second (now wide)
              column is MAIN — the simple overview a basic country gets,
              plus the compact Travel/Accommodation/Travel Cost row and
              Tourism Insights, nested here rather than as a separate
              full-width section below the whole grid. */}
          <div className="detail-grid">
            <div>
              <div className="detail-card">
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
            </div>
            <div>
              <div className="detail-card">
                <h3>
                  <Icon name="info" size={18} /> {dt.overview}
                </h3>
                <p>{dt.notRecommendationReady}</p>
              </div>

              <div className="info-cards-container">
                <div className="info-cards-grid">
                  <TravelInfo destination={d} />
                  <AccommodationInfo destination={d} />
                  <TravelCostIndexInfo destination={d} />
                  <TourismInsights destination={d} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- Full destination: unchanged from before Phase 10 ---
  const fromResultsFlag = (location.state as { fromResults?: boolean } | null)?.fromResults;
  const fromResults = !!(fromResultsFlag && state.results);

  let matchScore: number | null = null;
  let why: string | null = null;
  if (fromResults) {
    const item = state.results!.find((r) => r.dest.id === d.id);
    if (item) {
      matchScore = item.score;
      why = buildWhyText(lang, state.purpose!, item.reasons, d);
    }
  }

  const cities = citiesOf(d, lang).join(' · ');
  const bestFor = [...PURPOSE_SCORE_KEYS]
    .sort((a, b) => (d[b[1]] as number) - (d[a[1]] as number))
    .slice(0, 3);

  const goBack = () => navigate(fromResults ? '/results' : '/explore');

  return (
    <div className="detail-wrap">
      <div className="container">
        <div className="back-row">
          <button type="button" className="btn btn-ghost btn-sm" onClick={goBack}>
            <Icon name="arrowStart" size={16} /> {fromResults ? dt.back : t.results.exploreAll}
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={startAgain}>
            <Icon name="sparkle" size={15} /> {dt.startAgain}
          </button>
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
            matchScore !== null ? (
              <div className="detail-match">
                {matchScore}% {dt.match}
              </div>
            ) : (
              <div className="detail-match" style={{ background: 'rgba(255,255,255,0.16)', color: '#fff' }}>
                {dt.browse}
              </div>
            )
          }
        />

        {/* Visual refinement pass: two-zone layout. First (now narrow,
            see .detail-grid's 1fr/2fr override in wejhaty.css) column is
            the destination IDENTITY sidebar — quick facts, cities,
            country info (the landmark image, when one exists, now lives
            in the Hero above instead — see DestinationHero.tsx). Second
            (now wide) column is MAIN — overview/why/strengths/
            weaknesses/best-for, plus the compact Travel/Accommodation/
            Travel Cost row and Tourism Insights, nested here rather than
            as a separate full-width section below the whole grid. */}
        <div className="detail-grid">
          <div>
            <div className="detail-card">
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
                  <div className="value">{t.visaLabels[d.visaDiff]}</div>
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
            <div className="detail-card">
              <h3>
                <Icon name="map" size={18} /> {dt.cities}
              </h3>
              <p>{cities}</p>
            </div>
            {info ? <CountryInfoCard info={info} borders={borders} dt={dt} lang={lang} /> : null}
          </div>
          <div>
            {/* Approved-dashboard pass: `why` (only present when arriving
                from quiz results with a match score) is semantically
                different from the other 4 cards — it explains THIS
                specific match, not a general comparative fact — and
                rendering it as a 5th item inside the 2x2 grid would
                orphan Best For alone in a 3rd row (a real edge case a
                prior version of this grid had: Overview/Why paired,
                Strengths/Weaknesses paired, Best For alone). Pulled out
                to its own full-width card ABOVE the grid instead: the
                grid stays a clean, always-exactly-4-cards 2x2
                (Overview/Strengths/Weaknesses/Best For) whether or not
                `why` is present, and the match explanation still reads
                first, as the most personally relevant content on the
                page when it exists. */}
            {why ? (
              <div className="detail-card why-box">
                <h3>
                  <Icon name="bulb" size={18} /> {dt.why}
                </h3>
                <p>{why}</p>
              </div>
            ) : null}
            {/* Landscape correction pass (real user visual review of
                production): a prior version of .overview-cards-grid
                switched to 3 columns at 1180px, which put Overview/
                Strengths/Weaknesses on one row and orphaned Best For
                alone on a second row — explicitly rejected by the user.
                Fixed two ways together: the 1180px 3-column override is
                REMOVED from wejhaty.css entirely (2 columns is now the
                only landscape state this grid ever has), and each card
                now carries its own explicit class
                (overview-card/strengths-card/weaknesses-card/
                bestfor-card) mapped to a named grid-template-area — so
                even if a future change reorders this JSX, CSS
                auto-placement can never regenerate the orphan. Fixed
                2x2: Overview+Strengths first row, Weaknesses+BestFor
                second row, always. */}
            <div className="overview-cards-grid">
              <div className="detail-card overview-card">
                <h3>
                  <Icon name="info" size={18} /> {dt.overview}
                </h3>
                <p>{descOf(d, lang)}</p>
              </div>
              <div className="detail-card strengths-card">
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
              <div className="detail-card weaknesses-card">
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
              <div className="detail-card bestfor-card">
                <h3>
                  <Icon name="sparkle" size={18} /> {dt.bestFor}
                </h3>
                <div className="dest-meta">
                  {bestFor.map(([pid]) => (
                    <span className="meta-chip" key={pid}>
                      {t.purposes[pid].n}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="info-cards-container">
              <div className="info-cards-grid">
                <TravelInfo destination={d} />
                <AccommodationInfo destination={d} />
                <TravelCostIndexInfo destination={d} />
                <TourismInsights destination={d} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
