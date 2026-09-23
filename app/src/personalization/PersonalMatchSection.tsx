// Phase 18.6 — "Why this destination suits you" on a country page. Shown
// only with a saved profile; without one it offers the questionnaire
// instead of inventing a personal score. General suitability ("مناسب لـ",
// CountrySuitability) stays a separate section and is never replaced.
import { useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import type { CatalogEntry } from '../data/types';
import { Icon } from '../components/Icon';
import { useAppState, useI18n } from '../state/hooks';
import { PERSONAL_COPY } from './copy';
import { factorDetail, factorLabel, groupFactors } from './explain';
import { usePersonalization } from './usePersonalization';
import type { FactorResult, PersonalMatch } from './types';
import { destinationMatchState, isPersonalMatchFocusState } from './quizIntent';

/** Factor labels are written for use mid-sentence; as list headings the
 *  English ones start with a capital. */
function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function FactorList({ title, factors, tone, lang }: { title: string; factors: FactorResult[]; tone: string; lang: 'ar' | 'en' }) {
  if (!factors.length) return null;
  const strength = PERSONAL_COPY[lang].strength;
  return (
    <div className={`personal-factor-group is-${tone}`}>
      <h3>{title}</h3>
      <ul>
        {factors.map((factor) => (
          <li key={factor.questionId}>
            <span className="personal-factor-name">
              {lang === 'en' ? capitalize(factorLabel(factor.factor, lang)) : factorLabel(factor.factor, lang)}
              {strength[factor.strength] ? <small className="personal-factor-strength">{strength[factor.strength]}</small> : null}
            </span>
            <span className="personal-factor-detail">{factorDetail(factor, lang)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PersonalMatchSection({ destination, match }: { destination: CatalogEntry; match: PersonalMatch | null }) {
  const { lang, t } = useI18n();
  const { dispatch } = useAppState();
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = usePersonalization();
  const pc = PERSONAL_COPY[lang];
  const sectionRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const hasMatch = !!profile && !!match;
  const focusRequested = hasMatch && isPersonalMatchFocusState(location.state);

  // Phase 20 — arriving from this destination's own questionnaire: bring the
  // answer into view and move focus to its heading, once. Instant under
  // reduced motion. The request is then dropped from history so a reload or
  // Back does not repeat it.
  useEffect(() => {
    if (!focusRequested || !headingRef.current) return;
    const reduce = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // The section (not the heading) is scrolled: its scroll-margin keeps it
    // clear of the sticky navigation bar.
    sectionRef.current?.scrollIntoView?.({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
    headingRef.current.focus({ preventScroll: true });
    navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
  }, [focusRequested, location.pathname, location.search, navigate]);

  if (!profile || !match) {
    return (
      <section className="detail-card destination-section personal-match-card is-empty" aria-labelledby={`personal-match-${destination.id}`}>
        <h2 id={`personal-match-${destination.id}`}>
          <Icon name="compass" size={18} /> {pc.noProfileTitle}
        </h2>
        <p>{pc.noProfileBody}</p>
        {/* Phase 20 — "how well does THIS destination match me": the
            questionnaire returns here and shows this country's match. */}
        <Link className="btn btn-gold btn-sm" to="/purpose" state={destinationMatchState(destination.id)}>
          {pc.noProfileCta} <Icon name="arrowEnd" size={15} />
        </Link>
      </section>
    );
  }

  const groups = groupFactors(match);
  const purposeName = t.purposes[profile.purpose].n;
  const edit = () => {
    dispatch({ type: 'HYDRATE_QUIZ_FROM_PROFILE', purpose: profile.purpose, answers: profile.answers, path: profile.path });
    navigate(`/quiz/${profile.purpose}`);
  };

  return (
    <section ref={sectionRef} className="detail-card destination-section personal-match-card" aria-labelledby={`personal-match-${destination.id}`}>
      <div className="personal-match-head">
        <h2 id={`personal-match-${destination.id}`} ref={headingRef} tabIndex={-1}>
          <Icon name="compass" size={18} /> {pc.whyHeading}
        </h2>
        <p className="personal-match-basis">{pc.basedOn(purposeName)}</p>
      </div>

      {match.score !== null ? (
        <div className="personal-match-score">
          <span className="personal-match-label">{pc.personalMatch}</span>
          <span className="personal-match-value" role="img" aria-label={pc.scoreAria(match.score)}>
            <b>{match.score}%</b>
          </span>
          {match.confidence ? <span className="personal-match-confidence">{pc.confidence[match.confidence]}</span> : null}
        </div>
      ) : (
        <p className="personal-match-empty">{pc.noSignals}</p>
      )}
      {!match.eligible ? <p className="personal-match-constraint"><Icon name="info" size={15} /> {pc.constraintFailed}</p> : null}

      <div className="personal-factors">
        <FactorList title={pc.groupPositive} factors={groups.positive} tone="positive" lang={lang} />
        <FactorList title={pc.groupPartial} factors={groups.partial} tone="partial" lang={lang} />
        <FactorList title={pc.groupNegative} factors={groups.negative} tone="negative" lang={lang} />
        <FactorList title={pc.groupUnavailable} factors={groups.unavailable} tone="unavailable" lang={lang} />
      </div>

      <div className="personal-match-actions">
        <button type="button" className="btn btn-ghost btn-sm" onClick={edit}>
          {pc.editPrefs}
        </button>
      </div>
    </section>
  );
}
