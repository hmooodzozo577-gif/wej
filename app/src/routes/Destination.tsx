// Ports renderDetail() from wejhaty.html.
//
// Phase 10: looks up the id in the full WORLD_CATALOG (195) instead of just
// DESTINATIONS (30). The 30 existing destinations render through the exact
// same code path as before (untouched). A basic country (one of the 165)
// renders a smaller, honest detail view — flag, name, continent, capital —
// instead of fabricating an overview/strengths/cost/etc. it doesn't have.
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAppState, useI18n } from '../state/hooks';
import { WORLD_CATALOG, continentOf } from '../data/worldCatalog';
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
import type { Destination as DestinationType, PurposeId } from '../data/types';
import { FlagBanner, FlagChip } from '../components/flags/FlagIcon';
import { Icon } from '../components/Icon';
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

          <div className="detail-hero flag-banner" style={{ backgroundImage: regionGradientCss(continent) }}>
            <FlagBanner dest={d} lang={lang} />
            <div className="detail-hero-inner">
              <div>
                <span className="name-flag">
                  <FlagChip dest={d} width={38} height={28} />
                  <h1 className="display">{nameOf(d, lang)}</h1>
                </span>
                <div className="sub">{t.regionLabels[continent]}</div>
              </div>
              <div className="detail-match" style={{ background: 'rgba(255,255,255,0.16)', color: '#fff' }}>
                {dt.browse}
              </div>
            </div>
          </div>

          <div className="detail-grid">
            <div>
              <div className="detail-card">
                <h3>
                  <Icon name="info" size={18} /> {dt.overview}
                </h3>
                <p>{dt.notRecommendationReady}</p>
              </div>
            </div>
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

        <div className="detail-hero flag-banner" style={{ backgroundImage: regionGradientCss(d.region) }}>
          <FlagBanner dest={d} lang={lang} />
          <div className="detail-hero-inner">
            <div>
              <span className="name-flag">
                <FlagChip dest={d} width={38} height={28} />
                <h1 className="display">{nameOf(d, lang)}</h1>
              </span>
              <div className="sub">
                {t.regionLabels[d.region]} · {cities}
              </div>
            </div>
            {matchScore !== null ? (
              <div className="detail-match">
                {matchScore}% {dt.match}
              </div>
            ) : (
              <div className="detail-match" style={{ background: 'rgba(255,255,255,0.16)', color: '#fff' }}>
                {dt.browse}
              </div>
            )}
          </div>
        </div>

        <div className="detail-grid">
          <div>
            <div className="detail-card">
              <h3>
                <Icon name="info" size={18} /> {dt.overview}
              </h3>
              <p>{descOf(d, lang)}</p>
            </div>
            {why ? (
              <div className="detail-card why-box">
                <h3>
                  <Icon name="bulb" size={18} /> {dt.why}
                </h3>
                <p>{why}</p>
              </div>
            ) : null}
            <div className="detail-card">
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
            <div className="detail-card">
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
            <div className="detail-card">
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
          </div>
        </div>
      </div>
    </div>
  );
}
