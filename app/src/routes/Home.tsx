// Ports renderHome() from wejhaty.html.
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAppState, useI18n } from '../state/hooks';
import { WORLD_CATALOG } from '../data/worldCatalog';
import { nameOf } from '../data/destinationText';
import { PURPOSES } from '../data/purposes';
import { Icon } from '../components/Icon';
import { DestinationImage } from '../components/DestinationImage';
import { CompassMark } from '../components/CompassMark';
import { FlagChip } from '../components/flags/FlagIcon';
import { TravelRouteDecor } from '../components/TravelRouteDecor';
import { HERO_DESTINATION_POOL, selectHeroOrbitDestinations, selectSessionHero } from '../home/heroDestination';

export function Home() {
  const navigate = useNavigate();
  const location = useLocation();
  const { state, dispatch } = useAppState();
  const { lang, t } = useI18n();
  const h = t.hero;
  const how = t.how;
  const pu = t.purposes;
  const [featuredDestination] = useState(() => selectSessionHero(HERO_DESTINATION_POOL));
  const [orbitDestinations] = useState(() => selectHeroOrbitDestinations(HERO_DESTINATION_POOL, featuredDestination));

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
      <section className="hero home-hero-cinematic">
        <div className="container">
          <div className="home-hero-stage">
            <TravelRouteDecor variant="home" />
            <div className="home-hero-frame">
              <DestinationImage destination={featuredDestination} lang={lang} className="hero-folio-image" priority variant="hero" />
              <div className="home-hero-scrim" />
              <div className="hero-grid">
                <div className="hero-copy">
                  <h1 className="display">{h.h1}</h1>
                  <p className="hero-engine-label">{h.eyebrow}</p>
                  <p className="lead">{h.lead}</p>
                  <div className="hero-cta-cluster">
                    <p className="hero-editorial-note hero-journey-note">{h.journeyStarts}</p>
                    <div className="hero-cta-row">
                      <button type="button" className="btn btn-gold" onClick={() => navigate('/purpose')}>
                        <Icon name="compass" size={18} /> {h.cta}
                      </button>
                      <button type="button" className="btn btn-ghost" onClick={() => navigate('/explore')}>
                        {h.cta2} <Icon name="arrowEnd" size={16} />
                      </button>
                    </div>
                  </div>
                  <div className="hero-stats">
                    <div className="hero-stat">
                      <Icon name="globe" size={16} className="hero-stat-icon" />
                      <b>{WORLD_CATALOG.length}+</b>
                      <span>{h.stat1l}</span>
                    </div>
                    <div className="hero-stat">
                      <Icon name="briefcase" size={16} className="hero-stat-icon" />
                      <b>{h.stat2n}</b>
                      <span>{h.stat2l}</span>
                    </div>
                    <div className="hero-stat hero-stat-phrase">
                      <Icon name="check" size={16} className="hero-stat-icon" />
                      <span>{h.stat3l}</span>
                    </div>
                  </div>
                </div>
                <div className="home-hero-compass-cluster">
                  <p className="hero-editorial-note hero-nearby-note">
                    {h.nearbyDestinations}
                    <svg className="hero-nearby-flourish" viewBox="0 0 34 20" aria-hidden="true" focusable="false">
                      <path d="M4 2 C 4 12, 16 10, 30 17" />
                    </svg>
                  </p>
                  <div className="home-hero-compass">
                    <CompassMark size={190} />
                    {orbitDestinations.map((destination, index) => (
                      <span
                        key={destination.countryCode}
                        className={`hero-orbit-destination orbit-${index + 1}`}
                        data-destination={destination.id}
                      >
                        <FlagChip dest={destination} width={18} height={13} />
                        {nameOf(destination, lang)}
                      </span>
                    ))}
                  </div>
                  <p className="hero-vertical-tagline" aria-hidden="true">
                    {h.verticalTagline}
                  </p>
                </div>
                <Link className="hero-destination-badge" to={`/destination/${featuredDestination.id}`}>
                  <span>{lang === 'ar' ? 'وجهة من الكتالوج' : 'From the catalog'}</span>
                  <strong>
                    <Icon name="map" size={14} className="hero-destination-badge-pin" />
                    {nameOf(featuredDestination, lang)}
                  </strong>
                  <Icon name="arrowEnd" size={18} />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section home-how-section" id="howSection">
        <TravelRouteDecor variant="how" />
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
              <button
                key={p.id}
                type="button"
                className={`purpose-card${state.purpose === p.id ? ' selected' : ''}`}
                aria-pressed={state.purpose === p.id}
                onClick={() => openPurposePreview(p.id)}
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
