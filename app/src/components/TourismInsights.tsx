// Phase 13.5d — Destination Tourism Insights. Separate component from
// TravelCostIndexInfo.tsx (different World Bank indicators, different
// units — arrivals/receipts are never charted against Price Level Index
// on one axis). Like TravelCostIndexInfo, keyed purely by countryCode so
// it works for a BasicCountry too, not just recommendation-ready
// destinations. No network call here — only reads data/tourismInsights.ts's
// already-local, already-validated snapshot.
//
// Renders nothing when this country has no snapshot entry at all
// (graceful omission). When an entry exists but the count of usable
// points for a given series is too small to trend (<2), that
// individual card/chart is simply omitted — never a fabricated single
// bar or a broken chart.
import { useEffect, useState } from 'react';
import { useI18n } from '../state/hooks';
import { computeYoyGrowth, formatCompactNumber, getLatestObservation, getTourismInsights } from '../data/tourismInsights';
import type { CatalogEntry, DestinationTourismEntry } from '../data/types';
import { Icon } from './Icon';
import { TourismLineChart } from './TourismLineChart';

export function TourismInsights({ destination }: { destination: CatalogEntry }) {
  const { t } = useI18n();
  const ti = t.tourismInsights;
  const [entry, setEntry] = useState<DestinationTourismEntry | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    getTourismInsights(destination.countryCode).then((result) => {
      if (!cancelled) setEntry(result);
    });
    return () => {
      cancelled = true;
    };
  }, [destination.countryCode]);

  if (!entry) return null;

  const latestArrivals = getLatestObservation(entry.arrivals);
  const latestReceipts = getLatestObservation(entry.receiptsUsd);
  const arrivalsGrowth = computeYoyGrowth(entry.arrivals);

  if (!latestArrivals && !latestReceipts) return null;

  return (
    <div className="detail-card tourism-insights-card">
      <h3>
        <Icon name="trending" size={18} /> {ti.title}
      </h3>
      <div className="info-grid">
        {latestArrivals ? (
          <div className="info-item">
            <div className="label">{ti.arrivalsLabel}</div>
            <div className="value">{formatCompactNumber(latestArrivals.value)}</div>
          </div>
        ) : null}
        {latestReceipts ? (
          <div className="info-item">
            <div className="label">{ti.receiptsLabel}</div>
            <div className="value">${formatCompactNumber(latestReceipts.value)}</div>
          </div>
        ) : null}
        {arrivalsGrowth ? (
          <div className="info-item">
            <div className="label">{ti.growthLabel}</div>
            <div className="value">
              {arrivalsGrowth.percent >= 0 ? '+' : ''}
              {arrivalsGrowth.percent.toFixed(1)}%
            </div>
          </div>
        ) : null}
      </div>

      {arrivalsGrowth ? (
        <p style={{ marginTop: 6 }}>
          {ti.growthPeriodLabel.replace('{from}', arrivalsGrowth.previousPeriod).replace('{to}', arrivalsGrowth.currentPeriod)}
        </p>
      ) : null}

      {entry.arrivals && entry.arrivals.length >= 2 ? (
        <>
          <p style={{ marginTop: 12, fontWeight: 600 }}>{ti.arrivalsChartTitle}</p>
          <TourismLineChart
            series={entry.arrivals}
            formatValue={formatCompactNumber}
            ariaLabel={`${ti.arrivalsChartTitle}: ${entry.arrivals.map((o) => `${o.period}: ${formatCompactNumber(o.value)}`).join(', ')}`}
          />
        </>
      ) : null}

      {entry.receiptsUsd && entry.receiptsUsd.length >= 2 ? (
        <>
          <p style={{ marginTop: 12, fontWeight: 600 }}>{ti.receiptsChartTitle}</p>
          <TourismLineChart
            series={entry.receiptsUsd}
            formatValue={(v) => `$${formatCompactNumber(v)}`}
            ariaLabel={`${ti.receiptsChartTitle}: ${entry.receiptsUsd.map((o) => `${o.period}: $${formatCompactNumber(o.value)}`).join(', ')}`}
            color="#4a7c59"
          />
        </>
      ) : null}

      {latestArrivals ? (
        <p style={{ marginTop: 12 }}>{ti.sourcePeriodLabel.replace('{year}', latestArrivals.period)}</p>
      ) : latestReceipts ? (
        <p style={{ marginTop: 12 }}>{ti.sourcePeriodLabel.replace('{year}', latestReceipts.period)}</p>
      ) : null}
      <p style={{ marginTop: 6 }}>{ti.disclaimer}</p>
    </div>
  );
}
