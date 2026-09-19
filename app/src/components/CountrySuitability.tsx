// Country Intelligence + Purpose Suitability (Phase 11.x/14.x) — "Suitable
// for" card on a country page. Renders the compact score/confidence/
// coverage summary already bundled with the app (src/data/
// countryIntelligence.ts, no network call for this part); "Why this
// score?" per purpose lazily fetches the full component/source breakdown
// from the Worker only when opened (countryIntelligence/detailClient.ts) —
// the same "keep it light, fetch detail on demand" shape TravelCostIndexInfo
// and the city description cards already use.
//
// This is a COUNTRY SUITABILITY score (how suitable the country is in
// general for a purpose), not a personal match score for the current
// traveller — Phase 18 Personalization is where those get combined; this
// card never claims to be personalized, and says so in its own intro line.
import { useState } from 'react';
import { useI18n } from '../state/hooks';
import { getCountrySuitability, type CountryIntelligenceEntry } from '../data/countryIntelligence';
import { PURPOSES } from '../data/purposes';
import { lookupSuitabilityDetail, type SuitabilityComponent, type SuitabilityDetail } from '../countryIntelligence/detailClient';
import { deriveLimitations, deriveStrengths } from '../countryIntelligence/insights';
import { bestSuitedFor } from '../intelligence/bestSuitedFor';
import type { CatalogEntry, CountrySuitabilityStrings } from '../data/types';
import type { SuitablePurposeId } from '../intelligence/types';
import { Icon } from './Icon';

/** Acceptance fix — "Why this score?" factor names must be localized, not
 *  taken verbatim from the Worker's English-only component.label (see
 *  CountrySuitabilityStrings.factorLabels' own comment in data/types.ts).
 *  Falls back to the server-supplied English label only for a factor the
 *  dictionary has no entry for, which should never happen for the closed,
 *  deterministic factor set in intelligence/methodology.ts (guarded by a
 *  regression test) — never silently blank. */
function factorLabel(cs: CountrySuitabilityStrings, purpose: SuitablePurposeId, component: SuitabilityComponent): string {
  return cs.factorLabels[`${purpose}:${component.factor}`] ?? component.label;
}

function formatTemplate(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, String(value)), template);
}

function ComponentRow({
  component,
  label,
  missingLabel,
}: {
  component: SuitabilityComponent;
  label: string;
  missingLabel: string;
}) {
  const width = component.normalizedValue ?? 0;
  return (
    <li className="suitability-component-row">
      <span className="suitability-component-label">{label}</span>
      {component.status === 'observed' ? (
        <>
          <span className="suitability-component-bar" aria-hidden="true">
            <span className="suitability-component-bar-fill" style={{ width: `${width}%` }} />
          </span>
          <span className="suitability-component-value">{component.normalizedValue}</span>
        </>
      ) : (
        <span className="suitability-component-missing">{missingLabel}</span>
      )}
    </li>
  );
}

function PurposeDetail({ countryCode, entry }: { countryCode: string; entry: CountryIntelligenceEntry }) {
  const { t, lang } = useI18n();
  const cs = t.countrySuitability;
  const [detail, setDetail] = useState<SuitabilityDetail | null | undefined>(undefined);

  const load = () => {
    if (detail !== undefined) return;
    setDetail(null);
    void lookupSuitabilityDetail(countryCode, entry.purpose).then(setDetail);
  };

  const strengths = detail ? deriveStrengths(detail.components) : [];
  const limitations = detail ? deriveLimitations(detail.components) : [];
  const updatedDate = new Date(entry.updatedAt).toLocaleDateString(lang === 'ar' ? 'ar' : 'en-US', { year: 'numeric', month: 'long' });

  return (
    <details className="suitability-why" onToggle={(event) => { if (event.currentTarget.open) load(); }}>
      <summary>{cs.whyThisScore}</summary>
      <div className="suitability-why-body">
        <p className="suitability-updated">{formatTemplate(cs.updatedLabel, { date: updatedDate })}</p>
        {detail === undefined || detail === null ? (
          <p>{detail === undefined ? cs.loadingDetail : cs.detailUnavailable}</p>
        ) : (
          <>
            <p>{formatTemplate(cs.modelVersionLabel, { version: detail.modelVersion })}</p>
            {strengths.length > 0 ? (
              <div className="suitability-insight-group">
                <strong>{cs.strengthsLabel}</strong>
                <ul>{strengths.map((component) => <li key={component.factor}>{factorLabel(cs, entry.purpose, component)}</li>)}</ul>
              </div>
            ) : null}
            {limitations.length > 0 ? (
              <div className="suitability-insight-group">
                <strong>{cs.limitationsLabel}</strong>
                <ul>{limitations.map((component) => <li key={component.factor}>{factorLabel(cs, entry.purpose, component)}</li>)}</ul>
              </div>
            ) : null}
            <ul className="suitability-component-list">
              {detail.components.map((component) => (
                <ComponentRow
                  key={component.factor}
                  component={component}
                  label={factorLabel(cs, entry.purpose, component)}
                  missingLabel={cs.missingFactorLabel}
                />
              ))}
            </ul>
            <p className="suitability-sources">
              <strong>{cs.sourcesLabel}: </strong>
              {[...new Set(detail.components.map((component) => component.sourceId))]
                .map((sourceId) => detail.sources[sourceId])
                .filter((source): source is NonNullable<typeof source> => !!source)
                .map((source, index, list) => (
                  <span key={source.id}>
                    <a href={source.url} target="_blank" rel="noopener noreferrer">{source.name}</a>
                    {index < list.length - 1 ? ', ' : ''}
                  </span>
                ))}
            </p>
          </>
        )}
      </div>
    </details>
  );
}

function PurposeRow({ countryCode, entry }: { countryCode: string; entry: CountryIntelligenceEntry }) {
  const { t } = useI18n();
  const cs = t.countrySuitability;
  const purposeMeta = PURPOSES.find((purpose) => purpose.id === entry.purpose);
  const purposeLabel = t.purposes[entry.purpose]?.n ?? entry.purpose;
  const confidenceLabel = entry.confidence === 'high' ? cs.confidenceHigh : entry.confidence === 'medium' ? cs.confidenceMedium : cs.confidenceLow;

  return (
    <li className="suitability-row">
      <div className="suitability-row-head">
        {purposeMeta ? <Icon name={purposeMeta.icon} size={18} /> : null}
        <span className="suitability-purpose-label">{purposeLabel}</span>
        {entry.insufficientData ? (
          <span className="suitability-insufficient">{cs.insufficientData}</span>
        ) : (
          <span className="suitability-score">{entry.score}%</span>
        )}
      </div>
      {!entry.insufficientData ? (
        <>
          <div className="suitability-bar" aria-hidden="true">
            <div className="suitability-bar-fill" style={{ width: `${entry.score}%` }} />
          </div>
          <p className="suitability-meta">
            {confidenceLabel} · {formatTemplate(cs.coverageLabel, { pct: entry.coverage })}
          </p>
        </>
      ) : null}
      <PurposeDetail countryCode={countryCode} entry={entry} />
    </li>
  );
}

export function CountrySuitability({ destination }: { destination: CatalogEntry }) {
  const { t } = useI18n();
  const cs = t.countrySuitability;
  const [expanded, setExpanded] = useState(false);
  const entries = getCountrySuitability(destination.countryCode);
  if (entries.length === 0) return null;

  // Acceptance fix — the raw `entries` array is in fixed METHODOLOGY order
  // (see getCountrySuitability's own doc comment), not score order. The
  // list must display in descending suitability-score order instead
  // (insufficient-data purposes last, ties broken deterministically) — so
  // this reuses bestSuitedFor()'s own `ranked` ordering (same documented
  // sort/tie-break rule as the "Best suited for" card above) purely to
  // order these SAME entries; it introduces no second scoring system and
  // no new fetch.
  const rankedOrder = bestSuitedFor(entries).ranked;
  const entryByPurpose = new Map(entries.map((entry) => [entry.purpose, entry]));
  const orderedEntries = rankedOrder.map((ranked) => entryByPurpose.get(ranked.purpose)!);
  const visibleEntries = expanded ? orderedEntries : orderedEntries.slice(0, 1);

  return (
    <div className="detail-card country-suitability-card">
      <h3>
        <Icon name="trending" size={18} /> {cs.title}
      </h3>
      <p className="suitability-intro">{cs.intro}</p>
      <ul className="suitability-list">
        {visibleEntries.map((entry) => (
          <PurposeRow key={entry.purpose} countryCode={destination.countryCode} entry={entry} />
        ))}
      </ul>
      {orderedEntries.length > 1 ? (
        <button
          type="button"
          className="suitability-disclosure"
          aria-expanded={expanded}
          onClick={() => setExpanded((current) => !current)}
        >
          {expanded ? cs.showLess : cs.showMore}
        </button>
      ) : null}
    </div>
  );
}
