// Ports renderPurpose() from wejhaty.html.
import { useNavigate } from 'react-router-dom';
import { useAppState, useI18n } from '../state/hooks';
import { PURPOSES } from '../data/purposes';
import { Icon } from '../components/Icon';

export function PurposeSelect() {
  const navigate = useNavigate();
  const { state, dispatch } = useAppState();
  const { t } = useI18n();
  const pu = t.purposes;

  const startQuiz = (id: (typeof PURPOSES)[number]['id']) => {
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
                onClick={() => startQuiz(p.id)}
              >
                <div className="purpose-icon">
                  <Icon name={p.icon} size={22} />
                </div>
                <h3>{pu[p.id].n}</h3>
                <p>{pu[p.id].d}</p>
              </button>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
