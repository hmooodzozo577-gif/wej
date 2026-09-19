import type { CatalogEntry, Lang } from '../data/types';
import { DESTINATION_VISUALS } from '../data/destinationVisuals';

export function DestinationImage({
  destination,
  lang,
  className = 'destination-card-image',
  priority = false,
}: {
  destination: CatalogEntry;
  lang: Lang;
  className?: string;
  priority?: boolean;
}) {
  const visual = DESTINATION_VISUALS[destination.countryCode];
  if (!visual) return null;
  return (
    <img
      className={className}
      src={visual.imagePath}
      alt={lang === 'ar' ? visual.altAr : visual.altEn}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : undefined}
      decoding="async"
      style={{ objectFit: 'cover', objectPosition: visual.cardPosition }}
    />
  );
}
