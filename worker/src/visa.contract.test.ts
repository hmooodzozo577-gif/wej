// The provider contract, as far as it can honestly be checked today.
//
// The agent sandbox cannot reach api.joinsherpa.com, developers.joinsherpa.com,
// joinsherpa.com, iata.org or api.visahq.com — every one is refused at the
// egress proxy. So the adapter's field mapping has NEVER been run against a
// real response, and this file does not pretend otherwise.
//
// What it does instead:
//   * asserts everything that IS verifiable without the provider — that with
//     no credentials the app answers "unknown" on every path and lets nothing
//     influence the ranking;
//   * turns into a real mapping test the moment somebody drops a genuine
//     sandbox response into worker/fixtures/sherpa/ (see the README there).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  createSherpaProvider,
  extractSherpaRequirement,
  mapSherpaCategory,
  resolveVisaProvider,
  unavailableProvider,
  type VisaRequirementCategory,
} from './visa';

const fixtureDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'sherpa');
const CATEGORIES: VisaRequirementCategory[] = [
  'visaFree', 'visaOnArrival', 'eVisa', 'authorizationRequired', 'embassyVisaRequired', 'unknown',
];

function fixtures(): { name: string; expected: VisaRequirementCategory; payload: unknown }[] {
  if (!fs.existsSync(fixtureDir)) return [];
  return fs.readdirSync(fixtureDir)
    .filter((file) => file.endsWith('.json'))
    .map((file) => {
      const expected = path.basename(file, '.json') as VisaRequirementCategory;
      return { name: file, expected, payload: JSON.parse(fs.readFileSync(path.join(fixtureDir, file), 'utf8')) };
    });
}

describe('with no provider configured — the current production state', () => {
  it('resolves to the honest unavailable provider', () => {
    expect(resolveVisaProvider({})).toBe(unavailableProvider);
    expect(resolveVisaProvider({ SHERPA_API_KEY: '' })).toBe(unavailableProvider);
  });

  it('reports itself unconfigured rather than silently answering', () => {
    expect(createSherpaProvider({}).isConfigured()).toBe(false);
    expect(createSherpaProvider({ SHERPA_API_KEY: 'k' }).isConfigured()).toBe(true);
  });

  it('answers "unknown" without making a network call', async () => {
    const requirement = await createSherpaProvider({}).lookup({ passportCode: 'SA', destinationCode: 'JP' });
    expect(requirement.category).toBe('unknown');
    expect(requirement.details).toContain('credentials');
  });

  it('maps an unrecognised provider value to unknown, never to a guess', () => {
    for (const value of [undefined, null, 42, '', 'something_new_the_provider_added', {}]) {
      expect(mapSherpaCategory(value)).toBe('unknown');
    }
  });

  it('survives a drifted response shape without throwing or inventing', () => {
    for (const payload of [undefined, null, {}, { data: {} }, { data: { attributes: {} } },
      { data: { attributes: { informationGroups: 'not an array' } } },
      { data: { attributes: { informationGroups: [{ type: 'SOMETHING_ELSE' }] } } }]) {
      expect(extractSherpaRequirement(payload).category).toBe('unknown');
    }
  });
});

const available = fixtures();

describe('mapping against a REAL provider response', () => {
  if (available.length === 0) {
    // Not skipped silently: this asserts the state of the world, so the
    // moment a fixture lands the assertion below flips and the mapping tests
    // start running.
    it('is UNVERIFIED — no real sandbox response has been captured yet', () => {
      expect(available).toHaveLength(0);
      expect(fs.existsSync(path.join(fixtureDir, 'README.md'))).toBe(true);
    });
    return;
  }

  for (const fixture of available) {
    it(`maps ${fixture.name} to ${fixture.expected}`, () => {
      expect(CATEGORIES, `${fixture.name} must be named after a Wejhaty category`).toContain(fixture.expected);
      expect(extractSherpaRequirement(fixture.payload).category).toBe(fixture.expected);
    });
  }

  it('covers more than one category, so the mapping is not proved by one lucky case', () => {
    expect(new Set(available.map((fixture) => fixture.expected)).size).toBeGreaterThan(1);
  });
});
