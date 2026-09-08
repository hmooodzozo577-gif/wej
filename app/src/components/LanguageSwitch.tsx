// Ports the AR/EN toggle (`.lang-switch`) from wejhaty.html's header.
import type { Lang } from '../data/types';

export function LanguageSwitch({ lang, onChange }: { lang: Lang; onChange: (lang: Lang) => void }) {
  return (
    <div className="lang-switch" role="group" aria-label="Language">
      <button
        type="button"
        className={lang === 'ar' ? 'active' : ''}
        onClick={() => onChange('ar')}
      >
        AR
      </button>
      <button
        type="button"
        className={lang === 'en' ? 'active' : ''}
        onClick={() => onChange('en')}
      >
        EN
      </button>
    </div>
  );
}
