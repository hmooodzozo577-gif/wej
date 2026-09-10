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
// `.detail-hero` (wejhaty.generated.css) already ships
// background-size:cover/background-position:center (no distortion, a
// clean crop) and a `::after` dark gradient overlay anchored to the
// bottom (where the hero's own text sits) — reused as-is for the photo
// background, not redesigned.
import type { ReactNode } from 'react';
import type { FlagSubject } from '../data/types';
import { nameOf } from '../data/destinationText';
import { useI18n } from '../state/hooks';
import { DESTINATION_VISUALS } from '../data/destinationVisuals';
import { FlagBanner, FlagChip } from './flags/FlagIcon';
import { HeroPhotoAttribution } from './HeroPhotoAttribution';

export function DestinationHero({
  d,
  fallbackBackground,
  subContent,
  rightContent,
}: {
  d: FlagSubject;
  /** regionGradientCss(...) result, used verbatim when no real photo exists. */
  fallbackBackground: string;
  subContent: ReactNode;
  rightContent: ReactNode;
}) {
  const { lang } = useI18n();
  const visual = d.countryCode ? DESTINATION_VISUALS[d.countryCode] : undefined;

  return (
    <div
      className={visual ? 'detail-hero' : 'detail-hero flag-banner'}
      style={{ backgroundImage: visual ? `url(${visual.imagePath})` : fallbackBackground }}
    >
      {/* Flag stays the dominant Hero visual ONLY when no real photo
          exists — once a photo is available the flag is demoted to the
          small identity chip next to the country name below, never
          rendered as the big blurred/centered banner at the same time. */}
      {visual ? null : <FlagBanner dest={d} lang={lang} />}
      <div className="detail-hero-inner">
        <div>
          <span className="name-flag">
            <FlagChip dest={d} width={38} height={28} />
            <h1 className="display">{nameOf(d, lang)}</h1>
          </span>
          <div className="sub">{subContent}</div>
        </div>
        {rightContent}
        {visual ? <HeroPhotoAttribution visual={visual} /> : null}
      </div>
    </div>
  );
}
