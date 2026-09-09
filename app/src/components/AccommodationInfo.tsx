// Phase 13.5a — Accommodation Discovery & Architecture. Deliberately
// NOT a hotel search/booking feature (that is Phase 13.5b, deferred):
// this renders a small, honest "what to generally expect" card, reusing
// Destination.costLevel (the SAME general cost tier already shown
// elsewhere on this page — see Destination.tsx's info-grid) rather than
// inventing any new accommodation-specific number. No network call, no
// external API, no npm dependency, no Worker involvement.
//
// Only rendered for `recommendationReady: true` destinations (the 30
// full destinations) — the other 165 BasicCountry catalog entries have
// no costLevel at all (data/types.ts's own comment: "inventing scores
// here would be fabricated data"), so this returns null for them rather
// than guessing. Graceful omission, same pattern TravelInfo.tsx already
// uses for its own "nothing honest to show" cases.
import { useI18n } from '../state/hooks';
import { costLabel } from '../data/destinationText';
import type { CatalogEntry } from '../data/types';
import { Icon } from './Icon';

export function AccommodationInfo({ destination }: { destination: CatalogEntry }) {
  const { t } = useI18n();
  const at = t.accommodation;

  if (!destination.recommendationReady) return null;

  // costLevel is a 1-4 index (see Destination.costLevel / t.costLevels);
  // guidanceByCostLevel is a parallel 4-tuple — no fabricated mapping,
  // just a second, accommodation-framed label for the exact same tier.
  const guidance = at.guidanceByCostLevel[destination.costLevel - 1];
  if (!guidance) return null;

  return (
    <div className="detail-card">
      <h3>
        <Icon name="tag" size={18} /> {at.title}
      </h3>
      <div className="info-grid">
        <div className="info-item">
          <div className="label">{at.costLabel}</div>
          <div className="value">{costLabel(t.costLevels, destination.costLevel)}</div>
        </div>
      </div>
      <p style={{ marginTop: 8 }}>{guidance}</p>
      <p style={{ marginTop: 6 }}>{at.disclaimer}</p>
    </div>
  );
}
