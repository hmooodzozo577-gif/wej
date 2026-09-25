// v1.1 — sharing a destination. The link is always the destination's public
// canonical URL (site/site.ts destinationUrl): no query string, no quiz
// answers, no profile, no location, no passport, no preference of any kind,
// so whoever opens it gets the public page and nothing about the sender.
// The share TEXT may mention the sender's Personal Match, and only when the
// sender shares from a place that shows it.
import { destinationUrl } from '../site/site';
import type { CatalogEntry, Lang } from '../data/types';
import { nameOf } from '../data/destinationText';

export interface SharePayload {
  title: string;
  text: string;
  url: string;
}

export const SHARE_COPY = {
  ar: {
    share: 'مشاركة',
    shareFor: (name: string) => `مشاركة ${name}`,
    copied: 'نُسخ الرابط.',
    shared: 'تمت المشاركة.',
    failed: 'تعذّر النسخ تلقائيًا. انسخ الرابط من الحقل.',
    linkLabel: 'رابط الوجهة',
    text: (name: string) => `${name} على وجهتي`,
    textWithMatch: (name: string, score: number) => `${name} — توافقي معها ${score}% على وجهتي`,
  },
  en: {
    share: 'Share',
    shareFor: (name: string) => `Share ${name}`,
    copied: 'Link copied.',
    shared: 'Shared.',
    failed: 'Could not copy automatically. Copy the link from the field.',
    linkLabel: 'Destination link',
    text: (name: string) => `${name} on Wejhaty`,
    textWithMatch: (name: string, score: number) => `${name} — a ${score}% match for me on Wejhaty`,
  },
} satisfies Record<Lang, Record<string, unknown>>;

export function destinationSharePayload(entry: CatalogEntry, lang: Lang, personalScore?: number | null): SharePayload {
  const copy = SHARE_COPY[lang];
  const name = nameOf(entry, lang);
  return {
    title: name,
    text: typeof personalScore === 'number' ? copy.textWithMatch(name, personalScore) : copy.text(name),
    url: destinationUrl(entry.id),
  };
}

export type ShareOutcome = 'shared' | 'copied' | 'cancelled' | 'manual';

/** Native share sheet where the browser has one; otherwise copy the link;
 *  otherwise the caller shows the link for manual copying. */
export async function shareOrCopy(payload: SharePayload, nav: Navigator = navigator): Promise<ShareOutcome> {
  if (typeof nav.share === 'function' && (!nav.canShare || nav.canShare(payload))) {
    try {
      await nav.share(payload);
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
      // Any other failure falls through to copying.
    }
  }
  try {
    if (nav.clipboard?.writeText) {
      await nav.clipboard.writeText(payload.url);
      return 'copied';
    }
  } catch {
    // Clipboard blocked: fall through.
  }
  return 'manual';
}
