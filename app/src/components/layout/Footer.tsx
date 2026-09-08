// Ports the <footer class="footer"> markup from wejhaty.html.
import { useI18n } from '../../state/hooks';

export function Footer() {
  const { t } = useI18n();
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
        <small>{t.footer}</small>
      </div>
    </footer>
  );
}
