// Ports the <footer class="footer"> markup from wejhaty.html.
import { useI18n } from '../../state/hooks';
import { FeedbackDialog } from '../FeedbackDialog';
import { APP_VERSION } from '../../site/site';
import { TilqaaLogo } from '../../brand/TilqaaLogo';
import { BRAND } from '../../brand/brand';
import { NameStoryDialog } from '../../brand/NameStoryDialog';

export function Footer() {
  const { lang, t } = useI18n();
  return (
    <footer className="footer">
      <div className="container footer-row">
        <div className="brand footer-brand">
          <TilqaaLogo variant="horizontal" height={34} className="brand-logo" label={`${BRAND.ar} — ${BRAND.en}`} />
        </div>
        <div className="footer-actions">
          <FeedbackDialog lang={t.htmlLang} strings={t.feedback} />
          <small>{t.footer}</small>
          {/* v1.1 — the release, from package.json via the build (one source),
              with the story of the name beside it. */}
          <div className="footer-meta">
            <small className="footer-version">
              {t.brand} <span dir="ltr">v{APP_VERSION}</span>
            </small>
            <NameStoryDialog lang={lang} />
          </div>
        </div>
      </div>
    </footer>
  );
}
