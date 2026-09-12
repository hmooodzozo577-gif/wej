import type { CatalogEntry, Lang } from '../data/types';
import { DESTINATION_VISUALS } from '../data/destinationVisuals';

export function DestinationImage({ destination, lang, className = 'destination-card-image' }: { destination: CatalogEntry; lang: Lang; className?: string }) {
  const visual = DESTINATION_VISUALS[destination.countryCode];
  if (!visual) return null;
  return (
    <img
      className={className}
      src={visual.imagePath}
      alt={lang === 'ar' ? visual.altAr : visual.altEn}
      loading="lazy"
      decoding="async"
      style={{ objectFit: 'cover', objectPosition: visual.cardPosition }}
    />
  );
}
