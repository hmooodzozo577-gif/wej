// Ports the static shell around <main id="app">…</main> in wejhaty.html:
// header + routed view + footer, plus a scroll-to-top on every navigation
// (the original's `go()` called `window.scrollTo({top:0, behavior:'smooth'})`
// on every view change).
import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Header } from './Header';
import { Footer } from './Footer';
import { LocationIntro } from '../LocationIntro';

export function RootLayout() {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [location.pathname]);

  return (
    <>
      <Header />
      {/* Workstream C — Global Location Personalization: mounted once
          here (not per-route) so the first-visit intro is reachable
          from anywhere, renders nothing once dismissed/granted/
          in-flight. Explore's own, separate LocationPersonalize control
          is untouched and still lives only on /explore. */}
      <LocationIntro />
      <main id="app" className="view-enter" key={location.pathname}>
        <Outlet />
      </main>
      <Footer />
    </>
  );
}
