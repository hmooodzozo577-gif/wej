// Ports the static shell around <main id="app">…</main> in wejhaty.html:
// header + routed view + footer, plus a scroll-to-top on every navigation
// (the original's `go()` called `window.scrollTo({top:0, behavior:'smooth'})`
// on every view change).
import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Header } from './Header';
import { Footer } from './Footer';
import { LocationIntro } from '../LocationIntro';
import { ProductTelemetry } from '../../telemetry/ProductTelemetry';
import { TravelBackdrop } from '../TravelBackdrop';

export function RootLayout() {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [location.pathname]);

  return (
    <>
      <Header />
      <ProductTelemetry />
      {/* Workstream C — Global Location Personalization: mounted once
          here (not per-route) so the first-visit intro is reachable
          from anywhere, renders nothing once dismissed/granted/
          in-flight. Explore's own, separate LocationPersonalize control
          is untouched and still lives only on /explore.
          Acceptance fix — Explore already owns a full location surface
          (LocationPersonalize: resolution, nearby countries, retry), so
          showing this SECOND "why we're asking" ask on top of it asked
          for the same permission twice on one page. Explore is excluded
          here; every other route is unaffected. */}
      {location.pathname !== '/explore' ? <LocationIntro /> : null}
      <main id="app" className="view-enter" key={location.pathname}>
        <TravelBackdrop />
        <Outlet />
      </main>
      <Footer />
    </>
  );
}
