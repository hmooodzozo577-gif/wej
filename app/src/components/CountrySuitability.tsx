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
import type { CatalogEntry } from '../data/types';
import { Icon } from './Icon';

function formatTemplate(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, String(value)), template);
}

function ComponentRow({ component, missingLabel }: { component: SuitabilityComponent; missingLabel: string }) {
  const width = component.normalizedValue ?? 0;
  return (
    <li className="suitability-component-row">
      <span className="suitability-component-label">{component.label}</span>
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
                <ul>{strengths.map((component) => <li key={component.factor}>{component.label}</li>)}</ul>
              </div>
            ) : null}
            {limitations.length > 0 ? (
              <div className="suitability-insight-group">
                <strong>{cs.limitationsLabel}</strong>
                <ul>{limitations.map((component) => <li key={component.factor}>{component.label}</li>)}</ul>
              </div>
            ) : null}
            <ul className="suitability-component-list">
              {detail.components.map((component) => (
                <ComponentRow key={component.factor} component={component} missingLabel={cs.missingFactorLabel} />
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

/** Country -> Best Purposes (Phase 16 workstream C). A pure interpretation
 *  of the SAME suitability entries the list below renders — no second
 *  scoring system, no extra fetch. See intelligence/bestSuitedFor.ts for
 *  the documented, deterministic grouping rule this displays. */
function BestSuitedFor({ entries }: { entries: CountryIntelligenceEntry[] }) {
  const { t, lang } = useI18n();
  const cs = t.countrySuitability;
  const result = bestSuitedFor(entries);
  const confidenceLabel = (level: CountryIntelligenceEntry['confidence']) =>
    level === 'high' ? cs.confidenceHigh : level === 'medium' ? cs.confidenceMedium : cs.confidenceLow;
  const purposeName = (purpose: CountryIntelligenceEntry['purpose']) => t.purposes[purpose]?.n ?? purpose;

  return (
    <div className="best-suited-for">
      <h4 className="best-suited-title">{cs.bestSuitedForTitle}</h4>
      {!result.eligible ? (
        <p className="best-suited-insufficient">{cs.bestSuitedForInsufficient}</p>
      ) : (
        <>
          <p className="best-suited-headline">
            {result.topGroup!.length === 1
              ? formatTemplate(cs.bestSuitedForSingle, { purpose: purposeName(result.topGroup![0]!) })
              : formatTemplate(cs.bestSuitedForGroup, {
                  purposes: new Intl.ListFormat(lang === 'ar' ? 'ar' : 'en', { style: 'long', type: 'conjunction' }).format(
                    result.topGroup!.map((purpose) => purposeName(purpose)),
                  ),
                })}
            {' — '}
            {result.topScore}%
          </p>
          <p className="best-suited-confidence">{confidenceLabel(result.topConfidence)}</p>
        </>
      )}
    </div>
  );
}

export function CountrySuitability({ destination }: { destination: CatalogEntry }) {
  const { t } = useI18n();
  const cs = t.countrySuitability;
  const entries = getCountrySuitability(destination.countryCode);
  if (entries.length === 0) return null;

  return (
    <div className="detail-card country-suitability-card">
      <h3>
        <Icon name="trending" size={18} /> {cs.title}
      </h3>
      <p className="suitability-intro">{cs.intro}</p>
      <BestSuitedFor entries={entries} />
      <p className="other-purposes-label">{cs.otherPurposesLabel}</p>
      <ul className="suitability-list">
        {entries.map((entry) => (
          <PurposeRow key={entry.purpose} countryCode={destination.countryCode} entry={entry} />
        ))}
      </ul>
    </div>
  );
}
