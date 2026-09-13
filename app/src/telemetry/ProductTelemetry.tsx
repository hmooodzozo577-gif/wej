import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAppState } from '../state/hooks';
import { trackEvent } from './productDataClient';

export function ProductTelemetry() {
  const location = useLocation();
  const { state } = useAppState();
  const previousLocationStatus = useRef(state.location.status);
  const context = useRef({ path: location.pathname, locale: state.lang });

  useEffect(() => {
    context.current = { path: location.pathname, locale: state.lang };
  }, [location.pathname, state.lang]);

  useEffect(() => {
    trackEvent('page_view', {
      theme: document.documentElement.dataset.theme ?? 'light',
    }, { path: location.pathname, locale: state.lang });
  }, [location.pathname, state.lang]);

  useEffect(() => {
    if (state.location.status !== previousLocationStatus.current) {
      trackEvent('location_permission', { outcome: state.location.status }, { path: location.pathname, locale: state.lang });
      previousLocationStatus.current = state.location.status;
    }
  }, [location.pathname, state.lang, state.location.status]);

  useEffect(() => {
    const reportPerformance = () => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
      if (!navigation) return;
      trackEvent('page_performance', {
        ttfbMs: Math.round(navigation.responseStart),
        domReadyMs: Math.round(navigation.domContentLoadedEventEnd),
        loadMs: Math.round(navigation.loadEventEnd),
      }, context.current);
    };
    const reportError = (event: ErrorEvent) => trackEvent('client_error', {
      kind: event.error?.name ?? 'Error',
      script: event.filename ? event.filename.split('/').pop() : null,
      line: event.lineno || null,
    }, context.current);
    const reportRejection = (event: PromiseRejectionEvent) => trackEvent('client_error', {
      kind: event.reason instanceof Error ? event.reason.name : 'UnhandledRejection',
    }, context.current);

    if (document.readyState === 'complete') reportPerformance();
    else window.addEventListener('load', reportPerformance, { once: true });
    window.addEventListener('error', reportError);
    window.addEventListener('unhandledrejection', reportRejection);
    return () => {
      window.removeEventListener('load', reportPerformance);
      window.removeEventListener('error', reportError);
      window.removeEventListener('unhandledrejection', reportRejection);
    };
  }, []);

  return null;
}
