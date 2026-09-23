// Phase 19 — passport entry information ingestion. Fixtures only, no
// network: the lists in __fixtures__/entryRequirementsLists.mjs are the
// exact spellings the official pages used on 2026-09-23, so the name
// resolver is exercised against real source text, not idealised names.
import { describe, expect, it } from 'vitest';
import excludedCountriesData from '../../src/data/excludedCountriesData.json' with { type: 'json' };
import basicCountries from '../../src/data/generated/basicCountries.json' with { type: 'json' };
import recommendationDestinations from '../../src/data/generated/destinations.json' with { type: 'json' };
import isoCodes from '../../src/data/generated/isoCodes.json' with { type: 'json' };
import {
  CATEGORIES,
  NOTE_CODES,
  buildSnapshot,
  collapseFootnotes,
  createNameResolver,
  htmlToLines,
  normalizeName,
  parseCanada,
  parseEuRegulation,
  parseMaldives,
  parseSaudiEvisa,
  parseSingapore,
  parseUk,
  sliceBetween,
  validateSnapshot,
} from './entryRequirementsIngest.mjs';
import * as lists from './__fixtures__/entryRequirementsLists.mjs';

const excludedCodes = excludedCountriesData.map((entry) => entry.iso2);
const fullCatalog = [
  ...basicCountries.map((entry) => ({ iso2: entry.iso2, nameEn: entry.nameEn })),
  ...recommendationDestinations.map((entry) => ({ iso2: isoCodes[entry.id], nameEn: entry.nameEn })),
];
const catalog = fullCatalog.filter((entry) => !excludedCodes.includes(entry.iso2));
const catalogCodes = catalog.map((entry) => entry.iso2);
const excludedNames = fullCatalog.filter((entry) => excludedCodes.includes(entry.iso2)).map((entry) => entry.nameEn);
const resolve = createNameResolver(catalog, excludedCodes, excludedNames);

const ukInput = () => ({
  visaNationalLines: ['VN 1.1. A person who meets one or more of the criteria below needs entry clearance', '(a) Nationals or citizens of the following countries or territorial entities (a “*” indicates exceptions):', ...lists.ukVisaNationals, '(b) stateless people; and'],
  etaNationalLines: ['ETANL 1.1. Nationalities of the following locations are subject to the requirement to obtain an ETA', ...lists.ukEtaNationals],
});

const canadaLines = () => [
  'Travellers who need a visa',
  'Visa-required countries or territories',
  ...lists.canadaVisa,
  'Stateless individuals and those with a refugee travel document also need a visa to visit or transit through Canada.',
  'If you’re travelling by air',
  'You need an eTA and a valid passport to board your flight to Canada if you’re a citizen of any of the countries or territories listed below. You don’t need a visitor visa.',
  'eTA-required countries or territories',
  ...lists.canadaEta,
  'Find out how to apply for an eTA',
];

const singaporeLines = () => [
  'Travel Documents by Countries and Places',
  'If your travel document is issued by one of the countries/ places listed below, you will require a valid visa to enter Singapore. Click on individual countries/ places to find out more.',
  ...lists.singaporeVisa,
  'You will also need a visa if you are travelling on:',
  'A Palestinian Authority passport',
  'A temporary passport issued by the United Arab Emirates',
  'You may contact us via the enquiry form',
];

const saudiLines = () => [
  'Saudi Arabia is opening its doors to the world through its new tourist visa. Through the fast and easy-to-use online portal, international visitors from 68 eligible countries can apply for an eVisa',
  'The eVisa will be a one-year, multiple entry visa, allowing tourists to spend up to 90 days in the country.',
  'Eligible Countries',
  ...lists.saudiEvisa,
  'If your country is not in the list contact the nearest',
];

const maldivesLines = () => [
  'Tourist visa is granted on arrival to the Maldives. Foreigners traveling to Maldives as tourists do not require pre-approval for the visa.',
  "- A passport or travel document with a Machine-Readable Zone (MRZ) and at least 1 month's validity.",
  "- All foreigners arriving in the Maldives must complete and submit the 'Traveller Declaration' within 96 hours before arrival.",
];

const euLines = () => [...lists.euAnnexLines, ...lists.euFootnoteLines];

describe('htmlToLines', () => {
  it('drops scripts/styles, splits blocks and decodes entities', () => {
    const lines = htmlToLines('<div><script>alert(1)</script><style>p{}</style><p>C&ocirc;te&nbsp;d&rsquo;Ivoire</p><ul><li>Chad</li><li>Togo &amp; more</li></ul></div>');
    expect(lines).toEqual(['C&ocirc;te d’Ivoire', 'Chad', 'Togo & more']);
  });
});

describe('name resolution', () => {
  it('resolves every spelling the official lists use, or fails loudly', () => {
    for (const [label, entries] of Object.entries({
      uk: lists.ukVisaNationals,
      ukEta: lists.ukEtaNationals.filter((line) => !/^[(*]/.test(line)),
      canadaVisa: lists.canadaVisa,
      canadaEta: lists.canadaEta,
      singapore: lists.singaporeVisa,
      saudi: lists.saudiEvisa.filter((line) => !/^(North America|South America|Europe|Asia|Africa|Oceania)$/.test(line)),
    })) {
      const unknown = entries.filter((entry) => resolve(entry).status === 'unknown');
      expect(unknown, label).toEqual([]);
    }
  });

  it('never maps an excluded country (IL) to a code', () => {
    expect(resolve('Israel').status).toBe('excluded');
    expect(resolve('Israel (must have a national Israeli passport)').status).toBe('excluded');
    expect(resolve('Israel (Travellers must have a valid Israeli “Travel Document in Lieu of National Passport”.)').status).toBe('excluded');
  });

  it('handles the awkward spellings explicitly', () => {
    expect(resolve('Korea (North)')).toEqual({ status: 'ok', iso2: 'KP' });
    expect(resolve('Korea, North')).toEqual({ status: 'ok', iso2: 'KP' });
    expect(resolve('Republic of Korea')).toEqual({ status: 'ok', iso2: 'KR' });
    expect(resolve('People’s Republic of China*')).toEqual({ status: 'ok', iso2: 'CN' });
    expect(resolve('Côte d’Ivoire (formerly Ivory Coast)')).toEqual({ status: 'ok', iso2: 'CI' });
    expect(resolve('St. Vincent and the Grenadines (St. Vincent) (Some citizens may be eligible for an eTA.)')).toEqual({ status: 'ok', iso2: 'VC' });
    expect(resolve('Myanmar/Burma')).toEqual({ status: 'ok', iso2: 'MM' });
    expect(resolve('China (including Hong Kong and Macau)')).toEqual({ status: 'ok', iso2: 'CN' });
    expect(resolve('Congo')).toEqual({ status: 'ok', iso2: 'CG' });
    expect(resolve('Democratic Republic of the Congo')).toEqual({ status: 'ok', iso2: 'CD' });
    expect(resolve('Hong Kong Special Administrative Region').status).toBe('non-catalog');
    expect(resolve('Taiwan*').status).toBe('non-catalog');
    expect(resolve('Atlantis').status).toBe('unknown');
  });

  it('normalizes diacritics, quotes and abbreviations', () => {
    expect(normalizeName('São Tomé and Príncipe')).toBe('sao tome and principe');
    expect(normalizeName('St Lucia')).toBe('saint lucia');
    expect(normalizeName('Guinea-Bissau')).toBe('guinea bissau');
  });
});

describe('sliceBetween', () => {
  it('throws when an anchor is missing instead of parsing garbage', () => {
    expect(() => sliceBetween(['a', 'b'], /^x$/, /^b$/, 'test')).toThrow(/start anchor/);
    expect(() => sliceBetween(['a', 'b'], /^a$/, /^x$/, 'test')).toThrow(/end anchor/);
  });
});

describe('UK', () => {
  it('maps the visa national list to visa_required and the ETA list to permit_required', () => {
    const { rules } = parseUk(ukInput(), resolve);
    expect(rules.get('EG')).toEqual({ category: 'visa_required', notes: [] });
    expect(rules.get('SA')).toEqual({ category: 'permit_required', notes: ['uk_eta'] });
    expect(rules.get('FR')).toEqual({ category: 'permit_required', notes: ['uk_eta'] });
    expect(rules.has('IL')).toBe(false);
    // Not on either list (e.g. Ireland): no answer, not a guess.
    expect(rules.has('IE')).toBe(false);
  });

  it('fails when a list shrinks implausibly (truncated or restructured page)', () => {
    const input = ukInput();
    input.visaNationalLines = input.visaNationalLines.slice(0, 20).concat('(b) stateless people; and');
    expect(() => parseUk(input, resolve)).toThrow(/plausible range/);
  });

  it('fails on a country name it cannot resolve', () => {
    const input = ukInput();
    input.visaNationalLines.splice(3, 0, 'Freedonia');
    expect(() => parseUk(input, resolve)).toThrow(/unrecognised country names: Freedonia/);
  });
});

describe('EU Regulation 2018/1806', () => {
  it('reads Annex I as visa_required and Annex II as visa_free for 90 days in any 180', () => {
    const { rules } = parseEuRegulation(euLines(), resolve);
    expect(rules.get('SA')).toEqual({ category: 'visa_required', notes: [] });
    expect(rules.get('PS')).toEqual({ category: 'visa_required', notes: [] });
    expect(rules.get('US')).toEqual({ category: 'visa_free', notes: ['eu_90_in_180'] });
    expect(rules.get('GB')).toEqual({ category: 'visa_free', notes: ['eu_90_in_180'] });
    expect(rules.get('VA')).toEqual({ category: 'visa_free', notes: ['eu_90_in_180'] });
  });

  it('attaches the biometric-passport condition from the footnote', () => {
    const { rules } = parseEuRegulation(euLines(), resolve);
    expect(rules.get('AL')).toEqual({ category: 'visa_free', notes: ['eu_90_in_180', 'biometric_passport'] });
    expect(rules.get('GE')?.notes).toContain('biometric_passport');
    expect(rules.get('UA')?.notes).toContain('biometric_passport');
  });

  it('leaves agreement-conditional exemptions unknown instead of claiming them', () => {
    const { rules, warnings } = parseEuRegulation(euLines(), resolve);
    for (const iso2 of ['AE', 'PE', 'DM', 'TO']) expect(rules.has(iso2), iso2).toBe(false);
    expect(warnings.some((warning) => warning.includes('AE'))).toBe(true);
  });

  it('keeps Vanuatu, moved to Annex I by an amendment, as visa_required', () => {
    expect(parseEuRegulation(euLines(), resolve).rules.get('VU')).toEqual({ category: 'visa_required', notes: [] });
  });

  it('fails on an unrecognised footnote attached to a covered nationality', () => {
    // The official text uses non-breaking spaces, hence \s+.
    const biometric = /The\s+exemption\s+from\s+the\s+visa\s+requirement\s+shall\s+only\s+apply\s+to\s+holders\s+of\s+biometric\s+passports\./;
    const lines = euLines().map((line) => line.replace(biometric, 'Some new condition nobody has reviewed.'));
    expect(() => parseEuRegulation(lines, resolve)).toThrow(/unrecognised footnote/);
  });

  it('collapses split footnote markers onto their entry', () => {
    const { lines, footnotes } = collapseFootnotes(['Georgia (', '8', ')', 'Kosovo (', '18', ')', '(', '19', ')', '(', '8', ') The exemption applies to biometric passports.']);
    expect(lines.slice(0, 2)).toEqual(['Georgia (8)', 'Kosovo (18) (19)']);
    expect(footnotes.get('8')).toBe('The exemption applies to biometric passports.');
  });
});

describe('Canada', () => {
  it('reads visa-required, eTA-required and the eTA-eligible caveat', () => {
    const { rules } = parseCanada(canadaLines(), resolve);
    expect(rules.get('SA')).toEqual({ category: 'visa_required', notes: [] });
    expect(rules.get('MX')).toEqual({ category: 'visa_required', notes: ['ca_some_eta'] });
    expect(rules.get('AE')).toEqual({ category: 'permit_required', notes: ['ca_eta_air'] });
    expect(rules.get('GB')).toEqual({ category: 'permit_required', notes: ['ca_eta_air'] });
  });

  it('drops a nationality listed under both requirements (depends on passport type)', () => {
    expect(parseCanada(canadaLines(), resolve).rules.has('RO')).toBe(false);
  });

  it('drops the eTA "by air" note when its phrase disappears, without failing', () => {
    const lines = canadaLines().filter((line) => !line.startsWith('You need an eTA and a valid passport'));
    const { rules, warnings } = parseCanada(lines, resolve);
    expect(rules.get('AE')).toEqual({ category: 'permit_required', notes: [] });
    expect(warnings.join(' ')).toMatch(/ca_eta_air dropped/);
  });
});

describe('Singapore', () => {
  it('uses the negative list: listed need a visa, every other catalog nationality does not', () => {
    const { rules } = parseSingapore(singaporeLines(), resolve, catalogCodes);
    expect(rules.get('EG')?.category).toBe('visa_required');
    expect(rules.get('PS')?.category).toBe('visa_required');
    expect(rules.get('SA')?.category).toBe('visa_free');
    expect(rules.has('SG')).toBe(false);
    expect(rules.has('IL')).toBe(false);
  });

  it('refuses to infer anything when the governing sentence is gone', () => {
    const lines = singaporeLines().filter((line) => !line.startsWith('If your travel document'));
    expect(() => parseSingapore(lines, resolve, catalogCodes)).toThrow(/required phrase/);
  });
});

describe('Saudi eVisa', () => {
  it('marks only listed nationalities as evisa, with the 90-day note from the portal text', () => {
    const { rules } = parseSaudiEvisa(saudiLines(), resolve);
    expect(rules.get('GB')).toEqual({ category: 'evisa', notes: ['sa_evisa_90_days'] });
    expect(rules.get('CN')?.category).toBe('evisa');
    expect(rules.has('EG')).toBe(false);
  });
});

describe('Maldives', () => {
  it('applies the on-arrival rule to every foreign catalog nationality, with sourced notes', () => {
    const { rules } = parseMaldives(maldivesLines(), catalogCodes);
    expect(rules.get('SA')).toEqual({ category: 'visa_on_arrival', notes: ['mv_passport_1_month', 'mv_traveller_declaration'] });
    expect(rules.has('MV')).toBe(false);
    expect(rules.has('IL')).toBe(false);
  });

  it('does not invent a passport-validity note the page no longer states', () => {
    const { rules } = parseMaldives(maldivesLines().filter((line) => !line.includes('validity')), catalogCodes);
    expect(rules.get('SA')?.notes).toEqual(['mv_traveller_declaration']);
  });
});

describe('snapshot', () => {
  const build = () =>
    buildSnapshot({
      generatedAt: '2026-09-23T12:00:00.000Z',
      sources: [
        { id: 'uk-visa-nationals', meta: { url: 'https://www.gov.uk/x', checkedAt: '2026-09-23T12:00:00.000Z' } },
        { id: 'uk-eta-nationals', meta: { url: 'https://www.gov.uk/y', checkedAt: '2026-09-23T12:00:00.000Z' } },
      ],
      tables: [{ id: 'uk', destinations: ['GB'], sourceIds: ['uk-visa-nationals', 'uk-eta-nationals'], rules: parseUk(ukInput(), resolve).rules }],
    });

  it('is valid, compact and uses only known categories and notes', () => {
    const snapshot = build();
    expect(validateSnapshot(snapshot, { catalogCodes, excludedCodes })).toEqual([]);
    expect(snapshot.destinations).toEqual({ GB: 'uk' });
    expect(snapshot.tables.uk.entries.SA).toBe('permit_required|uk_eta');
    for (const value of Object.values(snapshot.tables.uk.entries)) {
      const [category, ...notes] = value.split('|');
      expect(CATEGORIES).toContain(category);
      for (const note of notes) expect(NOTE_CODES).toContain(note);
    }
  });

  it('rejects an excluded country, a non-HTTPS source and an unknown note', () => {
    const snapshot = build();
    snapshot.tables.uk.entries.IL = 'visa_free';
    snapshot.sources['uk-eta-nationals'].url = 'http://www.gov.uk/y';
    snapshot.tables.uk.entries.FR = 'permit_required|made_up_note';
    const errors = validateSnapshot(snapshot, { catalogCodes, excludedCodes }).join('\n');
    expect(errors).toMatch(/excluded nationality present: uk\/IL/);
    expect(errors).toMatch(/not HTTPS/);
    expect(errors).toMatch(/unknown note made_up_note/);
  });
});
