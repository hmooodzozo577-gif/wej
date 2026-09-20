// Ports renderPurpose() from wejhaty.html.
import { useNavigate } from 'react-router-dom';
import { useAppState, useI18n } from '../state/hooks';
import { PURPOSES } from '../data/purposes';
import { Icon } from '../components/Icon';
import { trackEvent } from '../telemetry/productDataClient';

export function PurposeSelect() {
  const navigate = useNavigate();
  const { state, dispatch } = useAppState();
  const { t } = useI18n();
  const pu = t.purposes;

  const startQuiz = (id: (typeof PURPOSES)[number]['id']) => {
    trackEvent('quiz_started', { purpose: id }, { path: '/purpose', locale: state.lang });
    dispatch({ type: 'START_QUIZ', purpose: id });
    navigate(`/quiz/${id}`);
  };

  return (
    <>
      <section className="page-hero">
        <div className="container">
          <h1 className="display">{pu.title}</h1>
          <p>{pu.sub}</p>
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
                <h3>{pu[p.id].n}</h3>
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
