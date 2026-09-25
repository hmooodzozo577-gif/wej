// Ports the <footer class="footer"> markup from wejhaty.html.
import { useI18n } from '../../state/hooks';
import { Link } from 'react-router-dom';
import { FeedbackDialog } from '../FeedbackDialog';
import { FAVORITES_COPY } from '../../favorites/copy';
import { APP_VERSION } from '../../site/site';

export function Footer() {
  const { lang, t } = useI18n();
  return (
    <footer className="footer">
      <div className="container footer-row">
        <div className="brand" style={{ cursor: 'default' }}>
          <span className="brand-mark">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9.5" stroke="#EBE7DC" strokeWidth="1.4" />
              <path d="M15.5 8.5L13 13L8.5 15.5L11 11L15.5 8.5Z" fill="#D9A85C" />
            </svg>
          </span>
          <span className="brand-name" style={{ fontSize: '1.05rem' }}>
            {t.brand}
          </span>
        </div>
        <div className="footer-actions">
          {/* v1.1 — Favorites is always reachable from here; the header
              link is hidden between 861 and 1099 px, where it would wrap
              the accepted header onto two lines. */}
          <Link className="footer-link" to="/favorites">{FAVORITES_COPY[lang].nav}</Link>
          <FeedbackDialog lang={t.htmlLang} strings={t.feedback} />
          <small>{t.footer}</small>
          {/* v1.1 — the release, from package.json via the build (one source). */}
          <small className="footer-version">
            {t.brand} <span dir="ltr">v{APP_VERSION}</span>
          </small>
        </div>
      </div>
    </footer>
  );
}
