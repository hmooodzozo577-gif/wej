// Ports the <header class="nav"> markup and behavior from wejhaty.html:
// brand button -> home, nav links, language switch, "Start Now" CTA, and the
// mobile hamburger menu. The original's `go('how')` special case (go home,
// then smooth-scroll to #howSection) becomes: navigate home with
// `state: { scrollTo: 'how' }`, which <Home/> reads on mount (routes/Home.tsx).
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppState, useI18n } from '../../state/hooks';
import { LanguageSwitch } from '../LanguageSwitch';

export function Header() {
  const navigate = useNavigate();
  const { dispatch } = useAppState();
  const { lang, t } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);

  // Matches the original exactly: `.mobile-menu` visibility is driven by the
  // existing `body.menu-open .mobile-menu { display: flex; }` CSS rule, not
  // by a class on the menu element itself.
  useEffect(() => {
    document.body.classList.toggle('menu-open', menuOpen);
    return () => document.body.classList.remove('menu-open');
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);

  const goHome = () => {
    navigate('/');
    closeMenu();
  };
  const goHow = () => {
    navigate('/', { state: { scrollTo: 'how' } });
    closeMenu();
  };
  const goExplore = () => {
    navigate('/explore');
    closeMenu();
  };
  const goPurpose = () => {
    navigate('/purpose');
    closeMenu();
  };

  const navLinks = (
    <>
      <button type="button" className="navlink" onClick={goHome}>
        {t.nav.home}
      </button>
      <button type="button" className="navlink" onClick={goHow}>
        {t.nav.how}
      </button>
      <button type="button" className="navlink" onClick={goExplore}>
        {t.nav.explore}
      </button>
      <button type="button" className="navlink" onClick={goPurpose}>
        {t.nav.quiz}
      </button>
    </>
  );

  return (
    <header className="nav">
      <div className="container nav-row">
        <button className="brand" aria-label="Home" onClick={goHome}>
          <span className="brand-mark">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9.5" stroke="#EBE7DC" strokeWidth="1.4" />
              <path d="M15.5 8.5L13 13L8.5 15.5L11 11L15.5 8.5Z" fill="#D9A85C" />
            </svg>
          </span>
          <span className="brand-name">{t.brand}</span>
        </button>
        <nav className="nav-links" aria-label="Primary">
          {navLinks}
        </nav>
        <div className="nav-right">
          <LanguageSwitch lang={lang} onChange={(l) => dispatch({ type: 'SET_LANG', lang: l })} />
          <button type="button" className="btn btn-primary btn-sm" onClick={goPurpose}>
            {t.nav.cta}
          </button>
          <button
            type="button"
            className="hamburger"
            aria-label="Menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <path d="M3 6h18M3 12h18M3 18h18" />
            </svg>
          </button>
        </div>
      </div>
      <div className="container mobile-menu">{navLinks}</div>
    </header>
  );
}
