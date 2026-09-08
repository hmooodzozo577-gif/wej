// Ports renderHome() from wejhaty.html.
import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAppState, useI18n } from '../state/hooks';
import { DESTINATIONS } from '../data/destinations';
import { nameOf } from '../data/destinationText';
import { PURPOSES } from '../data/purposes';
import { Icon } from '../components/Icon';
import { FlagChip } from '../components/flags/FlagIcon';

export function Home() {
  const navigate = useNavigate();
  const location = useLocation();
  const { dispatch } = useAppState();
  const { lang, t } = useI18n();
  const h = t.hero;
  const how = t.how;
  const pu = t.purposes;

  // Ports the header's `go('how')` special case: land on Home, then smooth
  // -scroll to #howSection.
  useEffect(() => {
    const state = location.state as { scrollTo?: string } | null;
    if (state?.scrollTo === 'how') {
      const s = document.getElementById('howSection');
      if (s) setTimeout(() => s.scrollIntoView({ behavior: 'smooth' }), 50);
    }
  }, [location.state]);

  const openPurposePreview = (id: (typeof PURPOSES)[number]['id']) => {
    dispatch({ type: 'PRESELECT_PURPOSE', purpose: id });
    navigate('/purpose');
  };

  return (
    <>
      <section className="hero">
        <div className="container hero-grid">
          <div>
            <span className="eyebrow-pill">
              <Icon name="sparkle" size={15} stroke={2.2} /> {h.eyebrow}
            </span>
            <h1 className="display">{h.h1}</h1>
            <p className="lead">{h.lead}</p>
            <div className="hero-cta-row">
              <button type="button" className="btn btn-gold" onClick={() => navigate('/purpose')}>
                <Icon name="compass" size={18} /> {h.cta}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => navigate('/explore')}>
                {h.cta2}
              </button>
            </div>
            <div className="hero-stats">
              <div className="hero-stat">
                <b>{h.stat1n}</b>
                <span>{h.stat1l}</span>
              </div>
              <div className="hero-stat">
                <b>{h.stat2n}</b>
                <span>{h.stat2l}</span>
              </div>
              <div className="hero-stat">
                <b>{h.stat3n}</b>
                <span>{h.stat3l}</span>
              </div>
            </div>
          </div>
          <div className="hero-visual">
            <div className="compass-wrap">
              <svg className="compass-ring" width="300" height="300" viewBox="0 0 300 300" fill="none">
                <circle cx="150" cy="150" r="128" stroke="#B3813C" strokeWidth="1.4" strokeDasharray="2 8" />
                <circle cx="150" cy="150" r="98" stroke="#101C2C" strokeWidth="1" opacity="0.25" />
                <path d="M150 60L165 150L150 240L135 150Z" fill="#101C2C" opacity="0.85" />
                <path d="M60 150L150 135L240 150L150 165Z" fill="#D9A85C" opacity="0.9" />
                <circle cx="150" cy="150" r="10" fill="#EBE7DC" stroke="#101C2C" strokeWidth="2" />
              </svg>
            </div>
            {[0, 5, 3, 17].map((idx, i) => (
              <div className={`float-card fc${i + 1}`} key={idx}>
                <FlagChip dest={DESTINATIONS[idx]} width={34} height={34} /> {nameOf(DESTINATIONS[idx], lang)}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section" id="howSection">
        <div className="container">
          <div className="section-head center">
            <span className="eyebrow-pill">{how.eyebrow}</span>
            <h2 className="display">{how.title}</h2>
            <p>{how.sub}</p>
          </div>
          <div className="steps-row">
            <div className="step-card">
              <div className="step-num">01</div>
              <h3>{how.s1t}</h3>
              <p>{how.s1d}</p>
            </div>
            <div className="step-card">
              <div className="step-num">02</div>
              <h3>{how.s2t}</h3>
              <p>{how.s2d}</p>
            </div>
            <div className="step-card">
              <div className="step-num">03</div>
              <h3>{how.s3t}</h3>
              <p>{how.s3d}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="section-head center">
            <h2 className="display">{pu.title}</h2>
            <p>{pu.sub}</p>
          </div>
          <div className="purpose-grid">
            {PURPOSES.map((p) => (
              <div
                key={p.id}
                className="purpose-card"
                role="button"
                tabIndex={0}
                onClick={() => openPurposePreview(p.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openPurposePreview(p.id);
                  }
                }}
              >
                <div className="purpose-icon">
                  <Icon name={p.icon} size={22} />
                </div>
                <h3>{pu[p.id].n}</h3>
                <p>{pu[p.id].d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="disclaimer-bar">
            <Icon name="info" size={20} stroke={2} />
            <span>{t.disclaimer}</span>
          </div>
        </div>
      </section>
    </>
  );
}
