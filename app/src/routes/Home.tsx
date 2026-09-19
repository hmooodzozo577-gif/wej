// Ports renderHome() from wejhaty.html.
import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAppState, useI18n } from '../state/hooks';
import { WORLD_CATALOG } from '../data/worldCatalog';
import { nameOf } from '../data/destinationText';
import { PURPOSES } from '../data/purposes';
import { Icon } from '../components/Icon';
import { DestinationImage } from '../components/DestinationImage';

export function Home() {
  const navigate = useNavigate();
  const location = useLocation();
  const { dispatch } = useAppState();
  const { lang, t } = useI18n();
  const h = t.hero;
  const how = t.how;
  const pu = t.purposes;
  const featuredDestination = WORLD_CATALOG.find((destination) => destination.countryCode === 'JP') ?? WORLD_CATALOG[0];

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
          <div className="hero-copy">
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
                {/* Stale "30+" (from the original static copy) replaced with
                    the real catalog size, so this never drifts again. */}
                <b>{WORLD_CATALOG.length}+</b>
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
          <div className="hero-visual hero-folio">
            <DestinationImage destination={featuredDestination} lang={lang} className="hero-folio-image" priority />
            <div className="hero-folio-caption">
              <span>{h.eyebrow}</span>
              <strong>{nameOf(featuredDestination, lang)}</strong>
            </div>
            <div className="hero-folio-index" aria-hidden="true">01</div>
          </div>
        </div>
      </section>

      <section className="section" id="howSection">
        <div className="container">
          <div className="section-head center">
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
