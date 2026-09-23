// Phase 18.6 — "Why this destination suits you" on a country page. Shown
// only with a saved profile; without one it offers the questionnaire
// instead of inventing a personal score. General suitability ("مناسب لـ",
// CountrySuitability) stays a separate section and is never replaced.
import { Link, useNavigate } from 'react-router-dom';
import type { CatalogEntry } from '../data/types';
import { Icon } from '../components/Icon';
import { useAppState, useI18n } from '../state/hooks';
import { PERSONAL_COPY } from './copy';
import { factorDetail, factorLabel, groupFactors } from './explain';
import { usePersonalization } from './usePersonalization';
import type { FactorResult, PersonalMatch } from './types';

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
      <h4>{title}</h4>
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
  const { profile } = usePersonalization();
  const pc = PERSONAL_COPY[lang];

  if (!profile || !match) {
    return (
      <section className="detail-card destination-section personal-match-card is-empty" aria-labelledby={`personal-match-${destination.id}`}>
        <h3 id={`personal-match-${destination.id}`}>
          <Icon name="compass" size={18} /> {pc.noProfileTitle}
        </h3>
        <p>{pc.noProfileBody}</p>
        <Link className="btn btn-gold btn-sm" to="/purpose">
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
    <section className="detail-card destination-section personal-match-card" aria-labelledby={`personal-match-${destination.id}`}>
      <div className="personal-match-head">
        <h3 id={`personal-match-${destination.id}`}>
          <Icon name="compass" size={18} /> {pc.whyHeading}
        </h3>
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
