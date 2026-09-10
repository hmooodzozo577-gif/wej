// Hero-image correction pass — compact, accessible photo-attribution
// disclosure. A CSS background-image (see DestinationHero.tsx) carries
// no alt text, so this is the ONLY place the real landmark identity,
// source, author, and license survive once the photo moved out of a
// standalone <img>-based sidebar card. Native <details>/<summary> — the
// same progressive-disclosure pattern already used by
// TravelCostIndexInfo/AccommodationInfo's "How is this calculated?":
// free keyboard/screen-reader support, no JS state, closed by default
// so it never competes with the Hero's own name/match content.
import { useI18n } from '../state/hooks';
import type { DestinationVisualMeta } from '../data/destinationVisuals';

export function HeroPhotoAttribution({ visual }: { visual: DestinationVisualMeta }) {
  const { lang, t } = useI18n();
  const dt = t.detail;
  const alt = lang === 'ar' ? visual.altAr : visual.altEn;
  const author = visual.author || 'Wikimedia Commons';

  return (
    <details className="hero-photo-attribution">
      <summary>{dt.photoInfo}</summary>
      <div className="hero-photo-attribution-body">
        {/* The landmark's real, verified identity — otherwise lost once
            the photo is a background instead of an <img alt>. */}
        <p>{alt}</p>
        <dl>
          <dt>{dt.photoSource}</dt>
          <dd>
            {visual.attributionUrl ? (
              <a href={visual.attributionUrl} target="_blank" rel="noopener noreferrer">
                Wikimedia Commons
              </a>
            ) : (
              'Wikimedia Commons'
            )}
          </dd>
          <dt>{dt.photoAuthor}</dt>
          <dd>{author}</dd>
          <dt>{dt.photoLicense}</dt>
          <dd>{visual.license}</dd>
        </dl>
      </div>
    </details>
  );
}
