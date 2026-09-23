// Phase 19 — passport entry information: the ONE shared model and lookup
// used by Results and the Destination page (P12).
//
// Where the data comes from: src/data/generated/entryRequirements.json, a
// snapshot of official government sources built on a GitHub runner by
// scripts/generate-entry-requirements.mjs. The browser never fetches a
// government site and never sends the passport anywhere: the lookup below
// is a pure function over the bundled snapshot, so the traveller's passport
// country stays in this tab's memory (P14).
//
// What it will and will not say (P6/P7/P20):
//   - a requirement exists only for a (passport, destination) pair the
//     destination's own official source covers; anything else is 'unknown'
//   - allowed stay, passport validity and extra steps appear only as the
//     sourced note codes the generator attached — never derived here
//   - data older than ENTRY_STALE_AFTER_DAYS is not presented as current:
//     the requirement is withheld and only the official sources are shown
//   - excluded countries (IL) and invalid codes produce no result at all
//
// Nothing here feeds ranking (P15): no scoring module imports this file.
import { isExcludedIso2 } from '../data/excludedCountries';

export const ENTRY_CATEGORIES = ['visa_free', 'visa_on_arrival', 'evisa', 'visa_required', 'permit_required'] as const;
export type EntryCategory = (typeof ENTRY_CATEGORIES)[number];

export const ENTRY_NOTES = [
  'uk_eta',
  'eu_90_in_180',
  'biometric_passport',
  'ca_some_eta',
  'ca_eta_air',
  'sa_evisa_90_days',
  'mv_passport_1_month',
  'mv_traveller_declaration',
] as const;
export type EntryNote = (typeof ENTRY_NOTES)[number];

/** Which field of PassportEntryInfo each sourced note belongs to. */
const NOTE_FIELD: Record<EntryNote, 'allowedStay' | 'passportValidity' | 'conditions' | 'additionalRequirements'> = {
  eu_90_in_180: 'allowedStay',
  sa_evisa_90_days: 'allowedStay',
  mv_passport_1_month: 'passportValidity',
  biometric_passport: 'conditions',
  ca_some_eta: 'conditions',
  ca_eta_air: 'conditions',
  uk_eta: 'additionalRequirements',
  mv_traveller_declaration: 'additionalRequirements',
};

/** Entry rules change. The snapshot is refreshed weekly and proposed for
 *  review whenever it is 14+ days old; past this age the app stops stating
 *  requirements and points to the official sources instead (P10). */
export const ENTRY_STALE_AFTER_DAYS = 45;

/** Official hosts a source link may point to. The snapshot is bundled and
 *  reviewed, but a link is still only rendered for these hosts. */
export const OFFICIAL_SOURCE_HOSTS = new Set([
  'www.gov.uk',
  'eur-lex.europa.eu',
  'home-affairs.ec.europa.eu',
  'www.canada.ca',
  'www.ica.gov.sg',
  'visa.visitsaudi.com',
  'www.immigration.gov.mv',
]);

export interface EntrySource {
  id: string;
  authority: { ar: string; en: string };
  title: { ar: string; en: string };
  url: string;
  checkedAt: string;
  sourceUpdatedAt?: string;
}

export interface EntrySnapshot {
  methodologyVersion: string;
  generatedAt: string;
  sources: Record<string, EntrySource>;
  tables: Record<string, { sources: string[]; entries: Record<string, string> }>;
  destinations: Record<string, string>;
}

export type EntryStatus =
  /** The destination's official source gives an answer for this passport. */
  | 'covered'
  /** The destination is covered, but its source does not list this passport. */
  | 'not_listed'
  /** No official source for this destination in the snapshot yet. */
  | 'no_source'
  /** Passport country and destination are the same. */
  | 'own_country';

export interface PassportEntryInfo {
  nationalityIso2: string;
  destinationIso2: string;
  status: EntryStatus;
  visaRequirement: EntryCategory | 'unknown';
  allowedStay: EntryNote | null;
  passportValidity: EntryNote | null;
  conditions: EntryNote[];
  additionalRequirements: EntryNote[];
  sources: EntrySource[];
  lastCheckedAt: string | null;
  freshnessStatus: 'fresh' | 'stale' | 'none';
  methodologyVersion: string;
}

const ISO2 = /^[A-Z]{2}$/;
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isText = (value: unknown): value is string => typeof value === 'string' && value.length > 0;
const isBilingual = (value: unknown): value is { ar: string; en: string } => isRecord(value) && isText(value.ar) && isText(value.en);

function isOfficialUrl(value: unknown): value is string {
  if (!isText(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && OFFICIAL_SOURCE_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

/** Validates the bundled snapshot's shape. Anything unexpected — a missing
 *  field, an unknown category or note, a non-official link, an excluded
 *  country — rejects the whole snapshot: the UI then says the information
 *  could not be loaded rather than showing part of a malformed file. */
export function parseEntrySnapshot(raw: unknown): EntrySnapshot | null {
  if (!isRecord(raw) || !isText(raw.methodologyVersion) || !isText(raw.generatedAt) || Number.isNaN(Date.parse(raw.generatedAt))) return null;
  if (!isRecord(raw.sources) || !isRecord(raw.tables) || !isRecord(raw.destinations)) return null;

  for (const [id, source] of Object.entries(raw.sources)) {
    if (!isRecord(source) || !isBilingual(source.authority) || !isBilingual(source.title) || !isOfficialUrl(source.url) || !isText(source.checkedAt)) return null;
    if (Number.isNaN(Date.parse(source.checkedAt))) return null;
    if (source.id !== undefined && source.id !== id) return null;
  }
  for (const table of Object.values(raw.tables)) {
    if (!isRecord(table) || !Array.isArray(table.sources) || !isRecord(table.entries)) return null;
    if (!table.sources.length || !table.sources.every((id) => isText(id) && isRecord((raw.sources as Record<string, unknown>)[id]))) return null;
    for (const [nationality, value] of Object.entries(table.entries)) {
      if (!ISO2.test(nationality) || isExcludedIso2(nationality) || !isText(value)) return null;
      const [category, ...notes] = value.split('|');
      if (!(ENTRY_CATEGORIES as readonly string[]).includes(category!)) return null;
      if (!notes.every((note) => (ENTRY_NOTES as readonly string[]).includes(note))) return null;
    }
  }
  for (const [destination, tableId] of Object.entries(raw.destinations)) {
    if (!ISO2.test(destination) || isExcludedIso2(destination) || !isText(tableId) || !isRecord((raw.tables as Record<string, unknown>)[tableId])) return null;
  }

  const sources: Record<string, EntrySource> = {};
  for (const [id, source] of Object.entries(raw.sources as Record<string, Omit<EntrySource, 'id'>>)) sources[id] = { ...source, id };
  return { ...(raw as unknown as EntrySnapshot), sources };
}

/** Whole days between an ISO timestamp and `now`. */
function ageInDays(iso: string, now: Date): number {
  return (now.getTime() - Date.parse(iso)) / 86_400_000;
}

/**
 * The entry information for one passport and one destination, or null when
 * there is nothing to say at all: no passport, an invalid or excluded code.
 * `validCodes` is the effective catalog (WORLD_CATALOG's country codes).
 */
export function lookupEntryInfo(
  snapshot: EntrySnapshot,
  nationalityIso2: string | null | undefined,
  destinationIso2: string,
  validCodes: ReadonlySet<string>,
  now: Date = new Date(),
): PassportEntryInfo | null {
  if (!nationalityIso2 || !ISO2.test(nationalityIso2) || !ISO2.test(destinationIso2)) return null;
  if (isExcludedIso2(nationalityIso2) || isExcludedIso2(destinationIso2)) return null;
  if (!validCodes.has(nationalityIso2) || !validCodes.has(destinationIso2)) return null;

  const base: PassportEntryInfo = {
    nationalityIso2,
    destinationIso2,
    status: 'no_source',
    visaRequirement: 'unknown',
    allowedStay: null,
    passportValidity: null,
    conditions: [],
    additionalRequirements: [],
    sources: [],
    lastCheckedAt: null,
    freshnessStatus: 'none',
    methodologyVersion: snapshot.methodologyVersion,
  };

  if (nationalityIso2 === destinationIso2) return { ...base, status: 'own_country' };

  const tableId = snapshot.destinations[destinationIso2];
  const table = tableId ? snapshot.tables[tableId] : undefined;
  if (!table) return base;

  const sources = table.sources.map((id) => snapshot.sources[id]!).filter(Boolean);
  const lastCheckedAt = sources.map((source) => source.checkedAt).sort()[0] ?? snapshot.generatedAt;
  const stale = ageInDays(lastCheckedAt, now) > ENTRY_STALE_AFTER_DAYS;
  const withSources = { ...base, sources, lastCheckedAt, freshnessStatus: stale ? ('stale' as const) : ('fresh' as const) };

  const value = table.entries[nationalityIso2];
  if (!value) return { ...withSources, status: 'not_listed' };
  // Stale: keep the sources and the check date, withhold the requirement.
  if (stale) return { ...withSources, status: 'covered' };

  const [category, ...notes] = value.split('|') as [EntryCategory, ...EntryNote[]];
  const info: PassportEntryInfo = { ...withSources, status: 'covered', visaRequirement: category };
  for (const note of notes) {
    const field = NOTE_FIELD[note];
    if (field === 'allowedStay' || field === 'passportValidity') info[field] = note;
    else info[field] = [...info[field], note];
  }
  return info;
}

/** Destinations the snapshot covers — used for the transparent coverage
 *  statement on the passport step (P17). */
export function coveredDestinations(snapshot: EntrySnapshot): string[] {
  return Object.keys(snapshot.destinations);
}
