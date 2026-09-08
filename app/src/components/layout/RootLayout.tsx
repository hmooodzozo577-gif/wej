// Ports the static shell around <main id="app">…</main> in wejhaty.html:
// header + routed view + footer, plus a scroll-to-top on every navigation
// (the original's `go()` called `window.scrollTo({top:0, behavior:'smooth'})`
// on every view change).
import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Header } from './Header';
import { Footer } from './Footer';

export function RootLayout() {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [location.pathname]);

  return (
    <>
      <Header />
      <main id="app" className="view-enter" key={location.pathname}>
        <Outlet />
      </main>
      <Footer />
    </>
  );
}
