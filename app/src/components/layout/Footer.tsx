// Ports the <footer class="footer"> markup from wejhaty.html.
import { useI18n } from '../../state/hooks';
import { FeedbackDialog } from '../FeedbackDialog';
import { APP_VERSION } from '../../site/site';
import { BrandMark } from '../../brand/BrandMark';
import { NameStoryDialog } from '../../brand/NameStoryDialog';

export function Footer() {
  const { lang, t } = useI18n();
  return (
    <footer className="footer">
      <div className="container footer-row">
        <div className="brand" style={{ cursor: 'default' }}>
          <BrandMark size={18} />
          <span className="brand-name" style={{ fontSize: '1.05rem' }}>
            {t.brand}
          </span>
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
