// Phase 19 P19 — the shared passport entry-information model.
import { describe, expect, it } from 'vitest';
import realSnapshot from '../data/generated/entryRequirements.json';
import { WORLD_CATALOG } from '../data/worldCatalog';
import {
  ENTRY_STALE_AFTER_DAYS,
  coveredDestinations,
  lookupEntryInfo,
  parseEntrySnapshot,
  type EntrySnapshot,
} from './entryInfo';

const CODES: ReadonlySet<string> = new Set(WORLD_CATALOG.map((entry) => entry.countryCode));
const NOW = new Date('2026-09-24T00:00:00Z');

function fixture(overrides: Partial<EntrySnapshot> = {}): EntrySnapshot {
  const snapshot = parseEntrySnapshot({
    methodologyVersion: 'entry-sources-1.0',
    generatedAt: '2026-09-23T12:00:00.000Z',
    sources: {
      'uk-visa-nationals': {
        authority: { en: 'UK Home Office', ar: 'وزارة الداخلية البريطانية' },
        title: { en: 'Visa national list', ar: 'قائمة' },
        url: 'https://www.gov.uk/guidance/immigration-rules/immigration-rules-appendix-visitor-visa-national-list',
        checkedAt: '2026-09-23T12:00:00.000Z',
      },
    },
    tables: { uk: { sources: ['uk-visa-nationals'], entries: { EG: 'visa_required', SA: 'permit_required|uk_eta' } } },
    destinations: { GB: 'uk' },
    ...overrides,
  });
  if (!snapshot) throw new Error('fixture did not parse');
  return snapshot;
}

describe('parseEntrySnapshot', () => {
  it('accepts the committed, generated snapshot', () => {
    const snapshot = parseEntrySnapshot(realSnapshot);
    expect(snapshot).not.toBeNull();
    expect(coveredDestinations(snapshot!).length).toBeGreaterThan(0);
  });

  it('never contains the excluded country, as passport or destination', () => {
    const snapshot = parseEntrySnapshot(realSnapshot)!;
    expect(snapshot.destinations.IL).toBeUndefined();
    for (const table of Object.values(snapshot.tables)) expect(table.entries.IL).toBeUndefined();
  });

  it('rejects malformed data instead of showing part of it', () => {
    const good = JSON.parse(JSON.stringify(realSnapshot));
    const cases: Array<(s: any) => void> = [
      (s) => { s.tables.uk.entries.SA = 'probably_fine'; },
      (s) => { s.tables.uk.entries.SA = 'visa_free|made_up_note'; },
      (s) => { s.sources['uk-visa-nationals'].url = 'http://www.gov.uk/x'; },
      (s) => { s.sources['uk-visa-nationals'].url = 'https://visa-help.example.com/uk'; },
      (s) => { s.tables.uk.entries.IL = 'visa_free'; },
      (s) => { s.destinations.IL = 'uk'; },
      (s) => { s.destinations.FR = 'no-such-table'; },
      (s) => { delete s.generatedAt; },
    ];
    for (const mutate of cases) {
      const copy = JSON.parse(JSON.stringify(good));
      mutate(copy);
      expect(parseEntrySnapshot(copy)).toBeNull();
    }
    expect(parseEntrySnapshot(null)).toBeNull();
    expect(parseEntrySnapshot('nope')).toBeNull();
  });
});

describe('lookupEntryInfo', () => {
  it('answers a covered pair with its category, sourced notes, source and check date', () => {
    const info = lookupEntryInfo(fixture(), 'SA', 'GB', CODES, NOW)!;
    expect(info).toMatchObject({
      status: 'covered',
      visaRequirement: 'permit_required',
      additionalRequirements: ['uk_eta'],
      freshnessStatus: 'fresh',
      lastCheckedAt: '2026-09-23T12:00:00.000Z',
    });
    expect(info.sources.map((source) => source.url)).toEqual([
      'https://www.gov.uk/guidance/immigration-rules/immigration-rules-appendix-visitor-visa-national-list',
    ]);
  });

  it('says unknown for a nationality the source does not list — never a guess', () => {
    const info = lookupEntryInfo(fixture(), 'IE', 'GB', CODES, NOW)!;
    expect(info.status).toBe('not_listed');
    expect(info.visaRequirement).toBe('unknown');
    expect(info.sources).toHaveLength(1);
  });

  it('says no source for an uncovered destination', () => {
    const info = lookupEntryInfo(fixture(), 'SA', 'JP', CODES, NOW)!;
    expect(info).toMatchObject({ status: 'no_source', visaRequirement: 'unknown', sources: [], lastCheckedAt: null });
  });

  it('withholds the requirement once the data is stale, keeping the official links', () => {
    const later = new Date(Date.parse('2026-09-23T12:00:00Z') + (ENTRY_STALE_AFTER_DAYS + 1) * 86_400_000);
    const info = lookupEntryInfo(fixture(), 'SA', 'GB', CODES, later)!;
    expect(info).toMatchObject({ status: 'covered', freshnessStatus: 'stale', visaRequirement: 'unknown', additionalRequirements: [] });
    expect(info.sources).toHaveLength(1);
  });

  it('treats the passport country as the destination specially', () => {
    expect(lookupEntryInfo(fixture(), 'GB', 'GB', CODES, NOW)?.status).toBe('own_country');
  });

  it('returns nothing for no passport, an invalid code or an excluded country', () => {
    const snapshot = fixture();
    expect(lookupEntryInfo(snapshot, null, 'GB', CODES, NOW)).toBeNull();
    expect(lookupEntryInfo(snapshot, '', 'GB', CODES, NOW)).toBeNull();
    expect(lookupEntryInfo(snapshot, 'sa', 'GB', CODES, NOW)).toBeNull();
    expect(lookupEntryInfo(snapshot, 'XX', 'GB', CODES, NOW)).toBeNull();
    expect(lookupEntryInfo(snapshot, 'SAU', 'GB', CODES, NOW)).toBeNull();
    expect(lookupEntryInfo(snapshot, 'IL', 'GB', CODES, NOW)).toBeNull();
    expect(lookupEntryInfo(snapshot, 'SA', 'IL', CODES, NOW)).toBeNull();
  });

  it('matches the real snapshot for pairs checked against the official pages', () => {
    const snapshot = parseEntrySnapshot(realSnapshot)!;
    const at = new Date(Date.parse(snapshot.generatedAt) + 86_400_000);
    // UK: Saudi Arabia is on the ETA National List; Egypt on the visa national list.
    expect(lookupEntryInfo(snapshot, 'SA', 'GB', CODES, at)?.visaRequirement).toBe('permit_required');
    expect(lookupEntryInfo(snapshot, 'EG', 'GB', CODES, at)?.visaRequirement).toBe('visa_required');
    // EU Regulation 2018/1806: Saudi Arabia in Annex I; the US in Annex II.
    expect(lookupEntryInfo(snapshot, 'SA', 'FR', CODES, at)?.visaRequirement).toBe('visa_required');
    expect(lookupEntryInfo(snapshot, 'US', 'FR', CODES, at)).toMatchObject({ visaRequirement: 'visa_free', allowedStay: 'eu_90_in_180' });
    // Annex II entry conditional on an agreement the Regulation does not
    // say is in force: left unknown.
    expect(lookupEntryInfo(snapshot, 'AE', 'FR', CODES, at)?.status).toBe('not_listed');
    // Maldives: on arrival for every foreign tourist, with its sourced notes.
    expect(lookupEntryInfo(snapshot, 'SA', 'MV', CODES, at)).toMatchObject({
      visaRequirement: 'visa_on_arrival',
      passportValidity: 'mv_passport_1_month',
      additionalRequirements: ['mv_traveller_declaration'],
    });
  });
});
