// Phase 19 — passport entry information UI. Two surfaces, one model:
//   - EntryRequirementsPanel: Results, a compact row per recommended
//     destination (P11)
//   - EntryRequirementsCard: the Destination page, the same information in
//     full for one destination (P12)
// Both render nothing without a passport (P13) and read the passport only
// from session state; nothing here writes it anywhere (P14).
import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { formatIsoDate } from '../data/format';
import { nameOf } from '../data/destinationText';
import type { CatalogEntry, Lang } from '../data/types';
import { WORLD_CATALOG } from '../data/worldCatalog';
import { FlagChip } from '../components/flags/FlagIcon';
import { Icon } from '../components/Icon';
import { useAppState, useI18n } from '../state/hooks';
import { ENTRY_COPY, type EntryCopy } from './copy';
import { lookupEntryInfo, type EntrySnapshot, type EntrySource, type PassportEntryInfo } from './entryInfo';
import { useEntrySnapshot } from './useEntrySnapshot';

const CATALOG_CODES: ReadonlySet<string> = new Set(WORLD_CATALOG.map((entry) => entry.countryCode));
const CATALOG_BY_CODE = new Map(WORLD_CATALOG.map((entry) => [entry.countryCode, entry]));

function statusClass(info: PassportEntryInfo): string {
  if (info.freshnessStatus === 'stale' || info.visaRequirement === 'unknown') return 'is-unknown';
  return `is-${info.visaRequirement.replace(/_/g, '-')}`;
}

function SourceLinks({ sources, lang, copy }: { sources: EntrySource[]; lang: Lang; copy: EntryCopy }) {
  if (!sources.length) return null;
  return (
    <span className="entry-sources">
      {sources.map((source, index) => (
        <span key={source.id}>
          {index ? <span aria-hidden="true"> · </span> : null}
          <a href={source.url} target="_blank" rel="noopener noreferrer" title={source.title[lang]}>
            {source.authority[lang]}
            <span className="visually-hidden"> ({copy.opensInNewTab})</span>
          </a>
        </span>
      ))}
    </span>
  );
}

function statusLine(info: PassportEntryInfo, copy: EntryCopy): string | null {
  if (info.status === 'own_country') return copy.ownCountry;
  if (info.status === 'no_source') return copy.noSource;
  if (info.freshnessStatus === 'stale') return copy.stale(formatIsoDate(info.lastCheckedAt ?? ''));
  if (info.status === 'not_listed') return copy.notListed;
  return null;
}

function categoryLabel(info: PassportEntryInfo, copy: EntryCopy): string {
  if (info.status === 'own_country') return copy.ownCountry;
  return copy.categories[info.freshnessStatus === 'stale' ? 'unknown' : info.visaRequirement];
}

function Checked({ iso, copy }: { iso: string | null; copy: EntryCopy }) {
  if (!iso) return null;
  return (
    <span className="entry-checked">
      {copy.lastCheckedLabel}: <bdi dir="ltr">{formatIsoDate(iso)}</bdi>
    </span>
  );
}

function useEntryLookup(destinationCodes: string[]) {
  const { state } = useAppState();
  const passport = state.passportCode;
  const snapshotState = useEntrySnapshot(!!passport);
  const key = destinationCodes.join(',');
  const infos = useMemo(() => {
    if (snapshotState.status !== 'ready' || !passport) return [];
    return key
      .split(',')
      .filter(Boolean)
      .map((code) => lookupEntryInfo(snapshotState.snapshot, passport, code, CATALOG_CODES))
      .filter((info): info is PassportEntryInfo => info !== null);
  }, [snapshotState, passport, key]);
  return { passport, snapshotState, infos };
}

function Shell({ title, passportEntry, lang, children, className }: { title: string; passportEntry: CatalogEntry | undefined; lang: Lang; children: ReactNode; className?: string }) {
  const copy = ENTRY_COPY[lang];
  return (
    <section className={`detail-card entry-card${className ? ` ${className}` : ''}`} aria-label={title}>
      <h3 className="entry-title">
        <Icon name="shield" size={17} stroke={2.2} /> {title}
      </h3>
      {passportEntry ? (
        <p className="entry-passport">
          {copy.passportLabel}: <FlagChip dest={passportEntry} width={20} height={15} /> {nameOf(passportEntry, lang)}
        </p>
      ) : null}
      {children}
    </section>
  );
}

/** Results: one compact row per recommended destination. */
export function EntryRequirementsPanel({ destinations }: { destinations: CatalogEntry[] }) {
  const { lang } = useI18n();
  const copy = ENTRY_COPY[lang];
  const { passport, snapshotState, infos } = useEntryLookup(destinations.map((entry) => entry.countryCode));
  if (!passport || snapshotState.status === 'idle') return null;
  const passportEntry = CATALOG_BY_CODE.get(passport);

  if (snapshotState.status !== 'ready') {
    return (
      <Shell title={copy.title} passportEntry={passportEntry} lang={lang}>
        <p className="entry-state" role="status">{snapshotState.status === 'loading' ? copy.loading : copy.error}</p>
        <p className="entry-disclaimer">{copy.disclaimer}</p>
      </Shell>
    );
  }

  const checked = infos.map((info) => info.lastCheckedAt).filter((iso): iso is string => !!iso).sort()[0] ?? null;
  // The long explanations are said once, under the list, not in every row.
  const anyNoSource = infos.some((info) => info.status === 'no_source');
  const anyNotListed = infos.some((info) => info.status === 'not_listed' && info.freshnessStatus !== 'stale');
  const anyStale = infos.find((info) => info.freshnessStatus === 'stale');
  return (
    <Shell title={copy.title} passportEntry={passportEntry} lang={lang}>
      <ul className="entry-list">
        {infos.map((info) => {
          const destination = CATALOG_BY_CODE.get(info.destinationIso2)!;
          const fresh = info.status === 'covered' && info.freshnessStatus === 'fresh';
          const notes = fresh
            ? [info.allowedStay, info.passportValidity, ...info.conditions, ...info.additionalRequirements]
                .filter((note): note is NonNullable<typeof note> => !!note)
                .map((note) => copy.notes[note])
                .join(' · ')
            : info.status === 'no_source'
              ? copy.rowNoSource
              : info.status === 'not_listed' && info.freshnessStatus !== 'stale'
                ? copy.rowNotListed
                : '';
          return (
            <li key={info.destinationIso2} className="entry-row">
              <span className="entry-dest">
                <FlagChip dest={destination} width={20} height={15} /> {nameOf(destination, lang)}
              </span>
              <span className={`entry-status ${statusClass(info)}`}>{categoryLabel(info, copy)}</span>
              <span className="entry-detail">
                {notes ? <span className="entry-notes">{notes}</span> : null}
                <SourceLinks sources={info.sources} lang={lang} copy={copy} />
              </span>
            </li>
          );
        })}
      </ul>
      {anyStale ? <p className="entry-state">{copy.stale(formatIsoDate(anyStale.lastCheckedAt ?? ''))}</p> : null}
      {anyNotListed ? <p className="entry-state">{copy.notListed}</p> : null}
      {anyNoSource ? <p className="entry-state">{copy.noSource}</p> : null}
      <p className="entry-meta">
        <Checked iso={checked} copy={copy} />
      </p>
      <p className="entry-disclaimer">{copy.disclaimer}</p>
    </Shell>
  );
}

/** Destination page: the same information in full for one destination. */
export function EntryRequirementsCard({ destination }: { destination: CatalogEntry }) {
  const { lang } = useI18n();
  const copy = ENTRY_COPY[lang];
  const { passport, snapshotState, infos } = useEntryLookup([destination.countryCode]);
  if (!passport || snapshotState.status === 'idle') return null;
  const passportEntry = CATALOG_BY_CODE.get(passport);

  if (snapshotState.status !== 'ready') {
    return (
      <Shell title={copy.destinationTitle} passportEntry={passportEntry} lang={lang} className="destination-section">
        <p className="entry-state" role="status">{snapshotState.status === 'loading' ? copy.loading : copy.error}</p>
        <p className="entry-disclaimer">{copy.disclaimer}</p>
      </Shell>
    );
  }

  const info = infos[0];
  if (!info) return null;
  const line = statusLine(info, copy);
  const fresh = info.status === 'covered' && info.freshnessStatus === 'fresh';
  const rows: [string, string][] = fresh
    ? ([
        [copy.stayLabel, info.allowedStay ? copy.notes[info.allowedStay] : null],
        [copy.validityLabel, info.passportValidity ? copy.notes[info.passportValidity] : null],
        [copy.conditionsLabel, info.conditions.map((note) => copy.notes[note]).join(' · ') || null],
        [copy.additionalLabel, info.additionalRequirements.map((note) => copy.notes[note]).join(' · ') || null],
      ].filter((row): row is [string, string] => !!row[1]))
    : [];

  return (
    <Shell title={copy.destinationTitle} passportEntry={passportEntry} lang={lang} className="destination-section">
      <p className={`entry-status entry-status-lg ${statusClass(info)}`}>{categoryLabel(info, copy)}</p>
      {line && info.status !== 'own_country' ? <p className="entry-state">{line}</p> : null}
      {rows.length ? (
        <dl className="entry-facts">
          {rows.map(([label, value]) => (
            <div key={label} className="entry-fact">
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {info.sources.length ? (
        <p className="entry-meta">
          {copy.sourceLabel}: <SourceLinks sources={info.sources} lang={lang} copy={copy} />
          {' · '}
          <Checked iso={info.lastCheckedAt} copy={copy} />
        </p>
      ) : null}
      <p className="entry-disclaimer">{copy.disclaimer}</p>
    </Shell>
  );
}

/** The passport step's coverage line, derived from the snapshot itself so
 *  the claim can never drift from the data (P17). */
export function EntryCoverageNote({ snapshot, lang }: { snapshot: EntrySnapshot; lang: Lang }) {
  const copy = ENTRY_COPY[lang];
  const tables = [...new Set(Object.values(snapshot.destinations))];
  const regions = tables.map((id) => copy.tableNames[id]).filter((name): name is string => !!name);
  return <p className="passport-why passport-coverage">{copy.passportStepCoverage(Object.keys(snapshot.destinations).length, regions)}</p>;
}
