// Ports renderResults() from wejhaty.html, including the animated match-
// percentage count-up (`.matchNum`) and the top-pick / results-grid layout.
import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAppState, useI18n } from '../state/hooks';
import { costLabel, nameOf } from '../data/destinationText';
import { FlagBanner, FlagChip } from '../components/flags/FlagIcon';
import { Icon } from '../components/Icon';
import { DestinationCard } from '../components/DestinationCard';
import { buildWhyText } from '../engine';
import { regionGradientCss } from '../components/regionGradient';

/** Ports the original's setInterval-based count-up for `.matchNum` exactly:
 *  step = max(1, round(target/30)), tick every 16ms. Synchronizing with the
 *  interval (an external timer) is exactly what useEffect is for — the
 *  `setValue(0)` on target-change is the animation's intentional restart,
 *  not a redundant derived value. */
function useCountUp(target: number): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    setValue(0);
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

  if (!state.purpose || !state.results) {
    return <Navigate to="/purpose" replace />;
  }

  const r = t.results;
  const top5 = state.results.slice(0, 5);
  const first = top5[0];
  const rest = top5.slice(1);
  const whyFirst = buildWhyText(lang, state.purpose, first.reasons, first.dest);

  return (
    <div className="results-wrap">
      <div className="container">
        <div className="results-head">
          <h1 className="display">{r.title}</h1>
          <p>{r.sub}</p>
        </div>

        <Link
          to={`/destination/${first.dest.id}`}
          state={{ fromResults: true }}
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
            <div className="tag-row">
              <span className="mini-tag">
                <Icon name="tag" size={13} stroke={2.4} /> {r.cost}: {costLabel(t.costLevels, first.dest.costLevel)}
              </span>
              <span className="mini-tag">
                <Icon name="shield" size={13} stroke={2.4} /> {r.safety}: {first.dest.safety}/100
              </span>
              <span className="mini-tag">
                <Icon name="sun" size={13} stroke={2.4} /> {r.climate}: {t.climateLabels[first.dest.climate]}
              </span>
              <span className="mini-tag">
                <Icon name="check" size={13} stroke={2.4} /> {r.visa}: {t.visaLabels[first.dest.visaDiff]}
              </span>
            </div>
          </div>
          <div className="match-ring-wrap">
            <div
              className="thumb flag-banner"
              style={{ backgroundImage: regionGradientCss(first.dest.region), width: 120, height: 120 }}
            >
              <FlagBanner dest={first.dest} lang={lang} />
            </div>
            <b
              className="matchNum"
              style={{ fontFamily: "'Fraunces',serif", fontSize: '1.9rem', color: '#D9A85C' }}
            >
              {animatedMatch}%
            </b>
            <span>{r.match}</span>
          </div>
        </Link>

        <div className="results-grid">
          {rest.map((item) => (
            <DestinationCard
              key={item.dest.id}
              dest={item.dest}
              lang={lang}
              t={t}
              matchScore={item.score}
              whyText={buildWhyText(lang, state.purpose!, item.reasons, item.dest)}
            />
          ))}
        </div>

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
