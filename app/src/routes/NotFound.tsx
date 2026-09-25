// v1.1 — the page for an unknown address or an unknown destination id.
// Before v1.1 an unknown path rendered an empty page and an unknown
// destination showed an untranslated "Not found". Marked noindex by
// seo/meta.ts (NOT_FOUND_META).
import { Link } from 'react-router-dom';
import { useI18n } from '../state/hooks';

const COPY = {
  ar: { title: 'الصفحة غير موجودة', body: 'لم نجد هذه الصفحة. ربما تغيّر الرابط أو كُتب بشكل غير صحيح.', home: 'العودة إلى الرئيسية', explore: 'استكشف الوجهات' },
  en: { title: 'Page not found', body: 'We could not find this page. The link may have changed or been mistyped.', home: 'Back to home', explore: 'Explore destinations' },
} as const;

export function NotFound() {
  const { lang } = useI18n();
  const copy = COPY[lang];
  return (
    <section className="container not-found" aria-labelledby="not-found-title">
      <h1 id="not-found-title">{copy.title}</h1>
      <p>{copy.body}</p>
      <div className="not-found-actions">
        <Link className="btn btn-primary" to="/">{copy.home}</Link>
        <Link className="btn btn-ghost" to="/explore">{copy.explore}</Link>
      </div>
    </section>
  );
}
