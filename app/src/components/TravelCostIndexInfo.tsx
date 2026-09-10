// Phase 13.5c — Dynamic Travel Cost Index. Deliberately a SEPARATE
// component from AccommodationInfo.tsx: that card only ever renders for
// `recommendationReady: true` destinations (it needs Destination.costLevel,
// which BasicCountry entries don't have), but the dynamic index is keyed
// purely by `countryCode` — every CatalogEntry has one — so this can show
// real data for a BasicCountry too, once the snapshot has coverage for
// it. No network call happens from this component; it only awaits
// data/travelCostIndex.ts's already-local, already-validated snapshot
// read (see that file's own doc comment).
//
// Renders nothing (graceful omission, never a guess) when this country
// has no snapshot entry — e.g. it isn't covered by the World Bank's
// PA.NUS.GDP.PLI series for the fetched period, or the snapshot failed
// to load. This is intentional: never pretend data exists for a country
// the source dataset doesn't actually cover.
import { useEffect, useState } from 'react';
import { useI18n } from '../state/hooks';
import {
  classifyPriceLevelIndex,
  computeBaselineDifference,
  formatPriceLevelIndex,
  getTravelCostIndex,
} from '../data/travelCostIndex';
import type { CatalogEntry, TravelCostIndexEntry } from '../data/types';
import { Icon } from './Icon';

export function TravelCostIndexInfo({ destination }: { destination: CatalogEntry }) {
  const { t } = useI18n();
  const tc = t.travelCost;
  const [entry, setEntry] = useState<TravelCostIndexEntry | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    getTravelCostIndex(destination.countryCode).then((result) => {
      // Guards against a stale, already-superseded lookup (e.g. the user
      // navigated to a different destination before this resolved)
      // overwriting a newer one — clears via the same setEntry call
      // rather than a separate synchronous reset at the top of the
      // effect, so this only ever renders a value for the CURRENT
      // destination, never a leftover one from the previous.
      if (!cancelled) setEntry(result);
    });
    return () => {
      cancelled = true;
    };
  }, [destination.countryCode]);

  if (!entry) return null;

  const tier = classifyPriceLevelIndex(entry.priceLevelIndex);
  const diff = computeBaselineDifference(entry.priceLevelIndex);
  const primaryTemplate = diff.direction === 'below' ? tc.differenceBelow : diff.direction === 'above' ? tc.differenceAbove : tc.differenceAt;
  const primaryText = primaryTemplate.replace('{percent}', String(diff.percent));

  return (
    <div className="detail-card">
      <h3>
        <Icon name="trending" size={18} /> {tc.title}
      </h3>
      {/* PRIMARY explanation (Travel Cost clarity fix): a plain-language
          "cheaper/pricier than the reference level, by about how much"
          sentence comes first — the raw index number and the raw
          "United States = 100" baseline are secondary technical detail
          below, never the headline a traveler reads first. */}
      <p style={{ fontWeight: 600 }}>{primaryText}</p>
      <div className="info-grid" style={{ marginTop: 10 }}>
        <div className="info-item">
          <div className="label">{tc.indexLabel}</div>
          <div className="value">{formatPriceLevelIndex(entry.priceLevelIndex)}</div>
        </div>
        <div className="info-item">
          <div className="label">{tc.tierLabel}</div>
          <div className="value">{tc.tiers[tier]}</div>
        </div>
      </div>
      <p style={{ marginTop: 8 }}>{tc.baselineNote}</p>
      <p style={{ marginTop: 6 }}>{tc.baselineExplainer}</p>
      <p style={{ marginTop: 6 }}>{tc.relative[tier]}</p>
      <p style={{ marginTop: 6 }}>{tc.sourcePeriodLabel.replace('{year}', entry.sourcePeriod)}</p>
      <p style={{ marginTop: 6 }}>{tc.disclaimer}</p>
    </div>
  );
}
