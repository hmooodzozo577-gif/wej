// Visual refinement pass — renders a landmark image for a destination's
// identity card when (and only when) DESTINATION_VISUALS has a real,
// licensed entry for that countryCode (see data/destinationVisuals.ts's
// own doc comment for why that registry is currently empty). Renders
// null otherwise — a missing entry is never a broken image, a
// placeholder box, or a fabricated stand-in.
import { useI18n } from '../state/hooks';
import { DESTINATION_VISUALS } from '../data/destinationVisuals';

export function DestinationVisual({ countryCode }: { countryCode: string }) {
  const { lang } = useI18n();
  const visual = DESTINATION_VISUALS[countryCode];
  if (!visual) return null;

  const alt = lang === 'ar' ? visual.altAr : visual.altEn;
  const attribution = lang === 'ar' ? visual.attributionAr : visual.attributionEn;

  return (
    <div className="destination-visual">
      <img src={visual.imagePath} alt={alt} className="destination-visual-img" loading="lazy" />
      {attribution ? (
        <p className="destination-visual-attribution">
          {visual.attributionUrl ? (
            <a href={visual.attributionUrl} target="_blank" rel="noopener noreferrer">
              {attribution}
            </a>
          ) : (
            attribution
          )}
        </p>
      ) : null}
    </div>
  );
}
