// Hero-image correction pass — real user visual review of the deployed
// Saudi Arabia Destination page rejected the standalone sidebar image
// card: the destination's real photo (when the imagery manifest has a
// verified entry for it) is now the Hero's own background instead,
// never rendered a second time in the sidebar. Shared by BOTH
// Destination.tsx branches (basic-country and full-destination) so the
// image-or-fallback logic exists exactly once.
//
// Falls back to the existing flag-banner/region-gradient treatment,
// completely unchanged, for the countries the imagery pipeline hasn't
// resolved yet (32 of 194 — see the final report) and for catalog
// entries with no countryCode at all. Never a broken image, never a
// blank box, never a wrong-country image.
//
// The real photo is an intrinsic-size <img> rather than a CSS background:
// this lets the browser prioritize the above-the-fold asset, reserve its
// aspect ratio before decoding, and keep responsive focal-point metadata in
// one maintainable place. It remains decorative to assistive technology
// because the adjacent h1 and source disclosure identify the destination and
// landmark without repeating the same announcement twice.
import { useState, type ReactNode } from 'react';
import type { FlagSubject } from '../data/types';
import { nameOf } from '../data/destinationText';
import { useI18n } from '../state/hooks';
import { DESTINATION_VISUALS } from '../data/destinationVisuals';
import { FlagBanner, FlagChip } from './flags/FlagIcon';
import { HeroPhotoAttribution } from './HeroPhotoAttribution';
import { TravelRouteDecor } from './TravelRouteDecor';

export function DestinationHero({
  d,
  fallbackBackground,
  subContent,
  rightContent,
  edgeControls,
}: {
  d: FlagSubject;
  /** regionGradientCss(...) result, used verbatim when no real photo exists. */
  fallbackBackground: string;
  subContent: ReactNode;
  rightContent: ReactNode;
  /** Item #3 — previous/next controls rendered in the hero's own side
   *  gutters (see DestinationHeroNav.tsx), replacing the pair of full-width
   *  cards that used to sit below the hero. */
  edgeControls?: ReactNode;
}) {
  const { lang } = useI18n();
  // Phase 19 (19.9) — a photo that fails to load falls back to the same
  // flag banner a country without a photo gets, instead of a broken image.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const known = d.countryCode ? DESTINATION_VISUALS[d.countryCode] : undefined;
  const visual = known && failedSrc !== known.imagePath ? known : undefined;

  return (
    <div
      className={visual ? 'detail-hero' : 'detail-hero flag-banner'}
      style={visual ? undefined : { backgroundImage: fallbackBackground }}
    >
      {/* Flag stays the dominant Hero visual ONLY when no real photo
          exists — once a photo is available the flag is demoted to the
          small identity chip next to the country name below, never
          rendered as the big blurred/centered banner at the same time. */}
      {visual ? (
        <img
          className="detail-hero-image"
          src={visual.imagePath}
          srcSet={`${visual.cardImagePath} ${visual.cardWidth}w, ${visual.imagePath} ${visual.width}w`}
          sizes="(max-width: 900px) 100vw, 1280px"
          alt=""
          aria-hidden="true"
          width={visual.width}
          height={visual.height}
          loading="eager"
          fetchPriority="high"
          decoding="async"
          style={{ objectPosition: visual.heroPosition }}
          onError={() => setFailedSrc(visual.imagePath)}
        />
      ) : <FlagBanner dest={d} lang={lang} />}
      {visual ? <TravelRouteDecor variant="destination" /> : null}
      {edgeControls}
      <div className="detail-hero-inner">
        <div>
          <span className="name-flag">
            <FlagChip dest={d} width={38} height={28} />
            <h1 id="destination-title" className="display">{nameOf(d, lang)}</h1>
          </span>
          <div className="sub">{subContent}</div>
        </div>
        {rightContent}
        {visual ? <HeroPhotoAttribution visual={visual} /> : null}
      </div>
    </div>
  );
}
