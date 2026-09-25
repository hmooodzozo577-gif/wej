// v1.1 — Favorite, Share and Compare for one destination, in one compact
// row under the destination hero. Kept out of routes/Destination.tsx so the
// route does not grow (audit L1).
import { Link } from 'react-router-dom';
import type { CatalogEntry, Lang } from '../data/types';
import { FavoriteButton } from '../favorites/FavoriteButton';
import { ShareButton } from '../share/ShareButton';
import { COMPARE_COPY, compareSearch } from '../compare/compareModel';
import { Icon } from './Icon';

export function DestinationActions({ destination, lang, personalScore }: {
  destination: CatalogEntry;
  lang: Lang;
  personalScore?: number | null;
}) {
  return (
    <div className="destination-actions" role="group" aria-label={lang === 'ar' ? 'إجراءات الوجهة' : 'Destination actions'}>
      <FavoriteButton destination={destination} lang={lang} />
      <ShareButton destination={destination} lang={lang} personalScore={personalScore} />
      <Link className="btn btn-ghost" to={{ pathname: '/compare', search: compareSearch([destination.id]) }}>
        <Icon name="columns" size={18} /> {COMPARE_COPY[lang].compareFrom}
      </Link>
    </div>
  );
}
