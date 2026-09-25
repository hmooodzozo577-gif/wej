// v1.1 — keeps the browser title, description, robots rule and canonical
// link in step with the route and the language while the app runs. The
// values come from seo/meta.ts, the same source the build uses for the
// static documents, so a page reads the same before and after React starts.
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import type { Lang } from '../data/types';
import { metaForPath } from './meta';
import { absoluteUrl } from '../site/site';

function setNamedMeta(name: string, content: string) {
  let tag = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.name = name;
    document.head.appendChild(tag);
  }
  tag.content = content;
}

function setCanonical(href: string | null) {
  const existing = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!href) {
    existing?.remove();
    return;
  }
  const link = existing ?? document.head.appendChild(Object.assign(document.createElement('link'), { rel: 'canonical' }));
  link.href = href;
}

export function useDocumentMeta(lang: Lang) {
  const { pathname } = useLocation();
  useEffect(() => {
    const meta = metaForPath(pathname);
    document.title = meta.title[lang];
    setNamedMeta('description', meta.description[lang]);
    setNamedMeta('robots', meta.index ? 'index, follow' : 'noindex, follow');
    setCanonical(meta.index && meta.path !== null ? absoluteUrl(meta.path) : null);
  }, [pathname, lang]);
}
