// Ports renderPurpose() from wejhaty.html.
import { useLocation, useNavigate } from 'react-router-dom';
import { useAppState, useI18n } from '../state/hooks';
import { PURPOSES } from '../data/purposes';
import { Icon } from '../components/Icon';
import { trackEvent } from '../telemetry/productDataClient';
import { TravelRouteDecor } from '../components/TravelRouteDecor';
import { PERSONAL_COPY } from '../personalization/copy';
import { readDestinationMatchIntent } from '../personalization/quizIntent';

export function PurposeSelect() {
  const navigate = useNavigate();
  const { state, dispatch } = useAppState();
  const { lang, t } = useI18n();
  const pu = t.purposes;
  const location = useLocation();
  // Phase 18 — confirms a "reset preferences" that led here.
  const justReset = !!(location.state as { personalizationReset?: boolean } | null)?.personalizationReset;
  // Phase 20 — a destination page's "how well does it match me" flow passes
  // through here; the intent is handed on to the questionnaire unchanged.
  const intent = readDestinationMatchIntent(location.state);

  const startQuiz = (id: (typeof PURPOSES)[number]['id']) => {
    trackEvent('quiz_started', { purpose: id }, { path: '/purpose', locale: state.lang });
    dispatch({ type: 'START_QUIZ', purpose: id });
    navigate(`/quiz/${id}`, intent ? { state: { quizIntent: intent } } : undefined);
  };

  return (
    <>
      <section className="page-hero page-hero-ambient">
        <TravelRouteDecor variant="purpose-header" />
        <div className="container">
          <h1 className="display">{pu.title}</h1>
          <p>{pu.sub}</p>
          {justReset ? <p className="personal-reset-note" role="status">{PERSONAL_COPY[lang].resetDone}</p> : null}
        </div>
      </section>
      <section className="section" style={{ paddingTop: 34 }}>
        <div className="container">
          <div className="purpose-grid" id="purposeGrid">
            {PURPOSES.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`purpose-card${state.purpose === p.id ? ' selected' : ''}`}
                aria-pressed={state.purpose === p.id}
                onClick={() => startQuiz(p.id)}
              >
                <span className="purpose-selected-mark" aria-hidden="true">✓</span>
                <div className="purpose-icon">
                  <Icon name={p.icon} size={22} />
                </div>
                <h2>{pu[p.id].n}</h2>
                <p>{pu[p.id].d}</p>
                <Icon name="arrowEnd" size={17} className="purpose-arrow" />
              </button>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
