// Ports renderResults() from wejhaty.html, including the animated match-
// percentage count-up (`.matchNum`) and the top-pick / results-grid layout.
//
// Phase 18 — the numbers shown are PERSONAL MATCH ("XX% لك"), always
// labelled, next to the country's labelled GENERAL SUITABILITY for the
// purpose. Phase 14 still decides which countries are candidates and their
// baseline order; Personal Match only reorders within its top candidates
// (personalization/personalMatch.ts#refineRanking) and never changes a
// Phase 14 score. After a reload, the saved browser-local profile rebuilds
// the same results without asking the questionnaire again.
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAppState, useI18n } from '../state/hooks';
import { costLabel, nameOf } from '../data/destinationText';
import { FlagChip } from '../components/flags/FlagIcon';
import { Icon } from '../components/Icon';
import { DestinationCard } from '../components/DestinationCard';
import { buildWhyText, rankDestinations } from '../engine';
import { DestinationImage } from '../components/DestinationImage';
import { QUESTION_BANKS } from '../data/questionBanks';
import { ResultRating } from '../components/ResultRating';
import { VisaRequirementNote } from '../components/VisaRequirementNote';
import { useVisaRequirements } from '../visa/useVisaRequirements';
import { visaConvenienceRank } from '../visa/types';
import { getCountrySuitability } from '../data/countryIntelligence';
import { usePersonalization } from '../personalization/usePersonalization';
import { normalizePreferences } from '../personalization/signals';
import { REFINEMENT_POOL_SIZE, refineRanking, type RefinedResult } from '../personalization/personalMatch';
import { personalSummary } from '../personalization/explain';
import { PERSONAL_COPY } from '../personalization/copy';
import { useResetPreferences } from '../personalization/useResetPreferences';
import type { Lang, PurposeId } from '../data/types';

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

/** The labelled number a result card shows: Personal Match when one could
 *  be computed, otherwise (no evaluable preference) the Phase 14 match. */
function displayScore(item: RefinedResult): { value: number; personal: boolean } {
  return item.personal.score !== null ? { value: item.personal.score, personal: true } : { value: item.result.score, personal: false };
}

function generalSuitabilityOf(countryCode: string, purpose: PurposeId): number | null {
  const entry = getCountrySuitability(countryCode).find((item) => item.purpose === purpose);
  return entry && !entry.insufficientData ? entry.score : null;
}

function sameOrder(a: RefinedResult[], b: RefinedResult[]): boolean {
  return a.length === b.length && a.every((item, index) => item.result.dest.id === b[index]?.result.dest.id);
}

export function Results() {
  const navigate = useNavigate();
  const { state, dispatch } = useAppState();
  const { lang, t } = useI18n();
  const { profile, persisted } = usePersonalization();
  const resetAll = useResetPreferences();
  const pc = PERSONAL_COPY[lang as Lang];
  // Set by "reset preferences": the redirect below then carries the
  // confirmation to the purpose page (the reset itself removes this page's
  // source, so the guard — not an explicit navigate — performs the move).
  const [resetting, setResetting] = useState(false);

  // The questionnaire just completed in this visit wins; otherwise the
  // profile saved in this browser (a returning traveller after a reload).
  const fromProfile = !(state.purpose && state.results) && !!profile;
  const purpose = (fromProfile ? profile!.purpose : state.purpose) as PurposeId | null;
  const answers = fromProfile ? profile!.answers : state.answers;
  const phase14Results = useMemo(
    () => (fromProfile ? rankDestinations(profile!.purpose, profile!.answers, state.location.coords) : state.results),
    [fromProfile, profile, state.location.coords, state.results],
  );
  const preferences = useMemo(() => (purpose ? normalizePreferences(purpose, answers) : null), [purpose, answers]);

  // Hooks must run unconditionally (same order every render), so everything
  // the visa hook and the count-up need is derived defensively before the
  // guard below.
  const rankedTop = (phase14Results ?? []).slice(0, REFINEMENT_POOL_SIZE);
  const { requirements, providerConfigured } = useVisaRequirements(
    state.passportCode,
    rankedTop.map((item) => item.dest.countryCode),
    purpose ?? undefined,
  );
  const origin = state.location.coords;
  const visaRank = (result: (typeof rankedTop)[number]) =>
    state.passportCode && requirements.size ? visaConvenienceRank(requirements.get(result.dest.countryCode)?.category ?? 'unknown') : 0;
  const refined = preferences ? refineRanking(rankedTop, preferences, { origin }, visaRank) : [];
  const refinedWithoutVisa = preferences ? refineRanking(rankedTop, preferences, { origin }) : [];
  const top5 = refined.slice(0, 5);
  const firstDisplay = top5[0] ? displayScore(top5[0]) : { value: 0, personal: false };
  const animatedMatch = useCountUp(firstDisplay.value);

  if (!purpose || !phase14Results || !preferences || !top5.length) {
    return <Navigate to="/purpose" replace state={resetting ? { personalizationReset: true } : undefined} />;
  }

  const r = t.results;
  const visaChangedOrder = !sameOrder(refined.slice(0, 5), refinedWithoutVisa.slice(0, 5));
  const proximityQuestion = QUESTION_BANKS[purpose].find((question) => question.kind === 'proximity');
  const proximityRequested = !!(proximityQuestion && Number(answers[proximityQuestion.id]) > 0);
  const proximityUsed = top5.some((item) => item.personal.factors.some((factor) => factor.kind === 'near' && factor.fit !== null));
  const first = top5[0]!;
  const rest = top5.slice(1);
  const resultNavigationIds = top5.map((item) => item.result.dest.id);
  const purposeName = t.purposes[purpose].n;
  const whyOf = (item: RefinedResult) => (item.personal.score !== null
    ? personalSummary(item.personal, preferences, item.result.dest, lang)
    : buildWhyText(lang, purpose, item.result.reasons, item.result.dest, item.result.score, answers));
  const firstGeneral = generalSuitabilityOf(first.result.dest.countryCode, purpose);
  const anyPersonal = top5.some((item) => item.personal.score !== null);

  const editPreferences = () => {
    dispatch({ type: 'HYDRATE_QUIZ_FROM_PROFILE', purpose, answers, path: fromProfile ? profile!.path : state.path });
    navigate(`/quiz/${purpose}`);
  };
  const resetPreferences = () => {
    setResetting(true);
    resetAll();
  };

  return (
    <div className="results-wrap">
      <div className="container">
        <div className="results-head">
          <h1 className="display">{r.title}</h1>
          <p>{r.sub}</p>
          <p className="results-method-note">{anyPersonal ? pc.methodNote : r.recommendationMethodNote}</p>
          {proximityUsed ? <p className="results-proximity-note"><Icon name="map" size={15} /> {r.proximityTieBreak}</p> : null}
          {proximityRequested && !proximityUsed ? <p className="results-proximity-note"><Icon name="map" size={15} /> {r.proximityUnavailable}</p> : null}
          <div className="personal-controls">
            <button type="button" className="btn btn-ghost btn-sm" onClick={editPreferences}>
              {pc.editPrefs}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={resetPreferences}>
              {pc.resetPrefs}
            </button>
            {persisted ? <p className="personal-saved-note">{pc.savedLocally}</p> : null}
          </div>
        </div>

        <Link
          to={`/destination/${first.result.dest.id}`}
          state={{ fromResults: true, purpose, navigation: { source: 'results', ids: resultNavigationIds, index: 0 } }}
          className="top-pick"
          role="button"
        >
          <div className="top-pick-media">
            <DestinationImage destination={first.result.dest} lang={lang} priority />
          </div>
          <div className="top-pick-body">
            <div className="top-pick-identity">
              <span className="rank-badge">
                <Icon name="medal" size={15} stroke={2.2} /> {r.rank1}
              </span>
              <span className="name-flag">
                <FlagChip dest={first.result.dest} width={30} height={22} />
                <h2 className="display">{nameOf(first.result.dest, lang)}</h2>
              </span>
            </div>
            <div className="top-pick-score">
              <div
                className="match-ring"
                style={{ '--match': animatedMatch } as CSSProperties}
                role="img"
                aria-label={firstDisplay.personal ? pc.scoreAria(firstDisplay.value) : `${firstDisplay.value}% ${r.match}`}
              >
                <div className="match-ring-inner">
                  <b className="matchNum">{animatedMatch}%</b>
                </div>
              </div>
              <span className="top-pick-score-text">
                <span className="top-pick-score-label">{firstDisplay.personal ? pc.personalMatch : r.match}</span>
                {firstDisplay.personal && first.personal.confidence ? (
                  <span className="top-pick-confidence">{pc.confidence[first.personal.confidence]}</span>
                ) : null}
                {firstGeneral !== null ? (
                  <span className="top-pick-general">
                    {/* dir: after Arabic text the digits would otherwise take
                        Arabic-number direction and render as "%63", unlike
                        the ring and pills beside it. */}
                    {pc.generalSuitability(purposeName)}: <b dir="ltr">{firstGeneral}%</b>
                  </span>
                ) : null}
              </span>
            </div>
            <p className="why">{whyOf(first)}</p>
            {first.result.dest.recommendationReady ? <div className="tag-row">
              <span className="mini-tag">
                <Icon name="tag" size={13} stroke={2.4} /> {r.cost}: {costLabel(t.costLevels, first.result.dest.costLevel)}
              </span>
              <span className="mini-tag">
                <Icon name="shield" size={13} stroke={2.4} /> {r.safety}: {first.result.dest.safety}/100
              </span>
              <span className="mini-tag">
                <Icon name="sun" size={13} stroke={2.4} /> {r.climate}: {t.climateLabels[first.result.dest.climate]}
              </span>
            </div> : null}
            {first.result.dest.recommendationReady ? <p className="results-method-note">{r.visaGeneralNote}</p> : null}
            <span className="top-pick-cta">{r.viewDetails} <Icon name="arrowEnd" size={16} /></span>
          </div>
        </Link>

        <div className="results-grid">
          {rest.map((item, index) => {
            const shown = displayScore(item);
            return (
              <DestinationCard
                key={item.result.dest.id}
                dest={item.result.dest}
                lang={lang}
                t={t}
                matchScore={item.result.score}
                personalScore={shown.personal ? shown.value : null}
                personalAria={shown.personal ? pc.scoreAria(shown.value) : undefined}
                whyText={whyOf(item)}
                purpose={purpose}
                navigation={{ source: 'results', ids: resultNavigationIds, index: index + 1 }}
              />
            );
          })}
        </div>

        {/* Item #12E — passport-specific entry requirements for the top
            pick, with provider and check date, or an honest statement of
            why there are none. The passport question itself now lives in
            the questionnaire, before these results exist. */}
        <div className="detail-card visa-card">
          <VisaRequirementNote
            requirement={requirements.get(first.result.dest.countryCode)}
            providerConfigured={providerConfigured}
            strings={t.visa}
          />
          {!state.passportCode ? <p className="city-data-note">{t.visa.noPassport}</p> : null}
          {visaChangedOrder ? <p className="city-data-note">{t.visa.reorderNote}</p> : null}
        </div>
        <ResultRating results={top5.map((item) => item.result)} lang={lang} strings={r} />

        <div className="results-actions">
          <button type="button" className="btn btn-ghost" onClick={() => navigate('/explore')}>
            {r.exploreAll}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              // A new trip: fresh questions. The saved profile stays in
              // effect until the new questionnaire is completed.
              dispatch({ type: 'RESTART_ALL' });
              navigate('/purpose');
            }}
          >
            <Icon name="sparkle" size={16} /> {pc.newTrip}
          </button>
        </div>
      </div>
    </div>
  );
}
