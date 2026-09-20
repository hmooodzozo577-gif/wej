import type { CatalogEntry, Lang } from '../data/types';
import { DESTINATION_VISUALS } from '../data/destinationVisuals';

export function DestinationImage({
  destination,
  lang,
  className = 'destination-card-image',
  priority = false,
  variant = 'card',
}: {
  destination: CatalogEntry;
  lang: Lang;
  className?: string;
  priority?: boolean;
  variant?: 'card' | 'hero';
}) {
  const visual = DESTINATION_VISUALS[destination.countryCode];
  if (!visual) return null;
  const isHero = variant === 'hero';
  return (
    <img
      className={className}
      src={isHero ? visual.imagePath : visual.cardImagePath}
      srcSet={isHero ? `${visual.cardImagePath} ${visual.cardWidth}w, ${visual.imagePath} ${visual.width}w` : undefined}
      sizes={isHero ? '(max-width: 760px) 100vw, min(88vw, 1240px)' : undefined}
      alt={lang === 'ar' ? visual.altAr : visual.altEn}
      width={isHero ? visual.width : visual.cardWidth}
      height={isHero ? visual.height : visual.cardHeight}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : undefined}
      decoding="async"
      style={{ objectFit: 'cover', objectPosition: visual.cardPosition }}
    />
  );
}
