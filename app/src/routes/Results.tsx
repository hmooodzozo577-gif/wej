// Ports renderResults() from wejhaty.html, including the animated match-
// percentage count-up (`.matchNum`) and the top-pick / results-grid layout.
import { useEffect, useState, type CSSProperties } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAppState, useI18n } from '../state/hooks';
import { costLabel, nameOf } from '../data/destinationText';
import { FlagChip } from '../components/flags/FlagIcon';
import { Icon } from '../components/Icon';
import { DestinationCard } from '../components/DestinationCard';
import { buildWhyText } from '../engine';
import { DestinationImage } from '../components/DestinationImage';
import { QUESTION_BANKS } from '../data/questionBanks';
import { ResultRating } from '../components/ResultRating';
import { VisaRequirementNote } from '../components/VisaRequirementNote';
import { useVisaRequirements } from '../visa/useVisaRequirements';
import { applyVisaRanking, visaRankingChangedOrder } from '../visa/visaRanking';

/** Ports the original's setInterval-based count-up for `.matchNum`:
 *  step = max(1, round(target/30)), tick every 16ms. */
function useCountUp(target: number): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let cur = 0;
    const step = Math.max(1, Math.round(target / 30));
    const iv = setInterval(() => {
      cur += step;
      if (cur >= target) {
        cur = target;
        clearInterval(iv);
      }
      setValue(cur);
    }, 16);
    return () => clearInterval(iv);
  }, [target]);
  return value;
}

export function Results() {
  const navigate = useNavigate();
  const { state, dispatch } = useAppState();
  const { lang, t } = useI18n();
  // Hooks must run unconditionally (same order every render), so compute the
  // count-up target with a safe fallback *before* the guard below, rather
  // than skipping the hook call entirely when there's nothing to show yet.
  const animatedMatch = useCountUp(state.results?.[0]?.score ?? 0);
  // Item #12C — the visa layer only ever REORDERS near-equal results. It
  // touches no Phase 14 score, so the match percentage below is the same
  // number with or without a passport. Hooks run unconditionally, before the
  // guard, so the top-five codes are derived defensively here.
  const rankedTop = (state.results ?? []).slice(0, 8);
  const { requirements, providerConfigured } = useVisaRequirements(
    state.passportCode,
    rankedTop.map((item) => item.dest.countryCode),
    state.purpose ?? undefined,
  );

  if (!state.purpose || !state.results) {
    return <Navigate to="/purpose" replace />;
  }

  const r = t.results;
  const visaOrdered = applyVisaRanking({
    results: rankedTop,
    requirements,
    passportCode: state.passportCode,
  });
  const visaChangedOrder = visaRankingChangedOrder(rankedTop, visaOrdered);
  const top5 = visaOrdered.slice(0, 5);
  const proximityQuestion = QUESTION_BANKS[state.purpose].find((question) => question.kind === 'proximity');
  const proximityRequested = !!(proximityQuestion && Number(state.answers[proximityQuestion.id]) > 0);
  const proximityUsed = top5.some((item) => item.distanceKm !== undefined);
  const first = top5[0];
  const rest = top5.slice(1);
  const resultNavigationIds = top5.map((item) => item.dest.id);
  // Item #10 — the explanation is built from the traveller's OWN answers,
  // so they have to be passed in; without them it could only name engine
  // dimensions, which is exactly the problem being fixed.
  const whyFirst = buildWhyText(lang, state.purpose, first.reasons, first.dest, first.score, state.answers);

  return (
    <div className="results-wrap">
      <div className="container">
        <div className="results-head">
          <h1 className="display">{r.title}</h1>
          <p>{r.sub}</p>
          <p className="results-method-note">{r.recommendationMethodNote}</p>
          {proximityUsed ? <p className="results-proximity-note"><Icon name="map" size={15} /> {r.proximityTieBreak}</p> : null}
          {proximityRequested && !proximityUsed ? <p className="results-proximity-note"><Icon name="map" size={15} /> {r.proximityUnavailable}</p> : null}
        </div>

        <Link
          to={`/destination/${first.dest.id}`}
          state={{ fromResults: true, purpose: state.purpose, navigation: { source: 'results', ids: resultNavigationIds, index: 0 } }}
          className="top-pick"
          role="button"
        >
          <div>
            <span className="rank-badge">
              <Icon name="medal" size={15} stroke={2.2} /> {r.rank1}
            </span>
            <span className="name-flag">
              <FlagChip dest={first.dest} width={30} height={22} />
              <h2 className="display">{nameOf(first.dest, lang)}</h2>
            </span>
            <p className="why">{whyFirst}</p>
            {first.dest.recommendationReady ? <div className="tag-row">
              <span className="mini-tag">
                <Icon name="tag" size={13} stroke={2.4} /> {r.cost}: {costLabel(t.costLevels, first.dest.costLevel)}
              </span>
              <span className="mini-tag">
                <Icon name="shield" size={13} stroke={2.4} /> {r.safety}: {first.dest.safety}/100
              </span>
              <span className="mini-tag">
                <Icon name="sun" size={13} stroke={2.4} /> {r.climate}: {t.climateLabels[first.dest.climate]}
              </span>
            </div> : null}
            {first.dest.recommendationReady ? <p className="results-method-note">{r.visaGeneralNote}</p> : null}
            <span className="top-pick-cta">{r.viewDetails} <Icon name="arrowEnd" size={16} /></span>
          </div>
          <div className="match-ring-wrap">
            <DestinationImage destination={first.dest} lang={lang} priority />
            <div className="match-ring" style={{ '--match': animatedMatch } as CSSProperties}>
              <div className="match-ring-inner">
                <b className="matchNum">{animatedMatch}%</b>
                <span>{r.match}</span>
              </div>
            </div>
          </div>
        </Link>

        <div className="results-grid">
          {rest.map((item, index) => (
            <DestinationCard
              key={item.dest.id}
              dest={item.dest}
              lang={lang}
              t={t}
              matchScore={item.score}
              whyText={buildWhyText(lang, state.purpose!, item.reasons, item.dest, item.score, state.answers)}
              purpose={state.purpose!}
              navigation={{ source: 'results', ids: resultNavigationIds, index: index + 1 }}
            />
          ))}
        </div>

        {/* Item #12E — passport-specific entry requirements for the top
            pick, with provider and check date, or an honest statement of
            why there are none. The passport question itself now lives in
            the questionnaire, before these results exist. */}
        <div className="detail-card visa-card">
          <VisaRequirementNote
            requirement={requirements.get(first.dest.countryCode)}
            providerConfigured={providerConfigured}
            strings={t.visa}
          />
          {!state.passportCode ? <p className="city-data-note">{t.visa.noPassport}</p> : null}
          {visaChangedOrder ? <p className="city-data-note">{t.visa.reorderNote}</p> : null}
        </div>
        <ResultRating results={top5} lang={lang} strings={r} />

        <div className="results-actions">
          <button type="button" className="btn btn-ghost" onClick={() => navigate('/explore')}>
            {r.exploreAll}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              dispatch({ type: 'RESTART_ALL' });
              navigate('/purpose');
            }}
          >
            <Icon name="sparkle" size={16} /> {r.startAgain}
          </button>
        </div>
      </div>
    </div>
  );
}
